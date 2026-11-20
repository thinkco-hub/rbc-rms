import { useState } from "react";
import { computeDiscrepancy } from "../utils/counts";
import { isPayableAmount } from "../utils/orders";
import { initialInventoryCounts } from "../data/initialInventory";
import { recordAuditEvent } from "../utils/auditLog";
import type {
  ClosingCountSubmission,
  CountResolutionAction,
  DayClosing,
  DayClosingData,
  Expense,
  ExpenseData,
  ExpenseId,
  InventoryCount,
  InventoryCountId,
  InventoryItemCategory,
  User,
} from "../types/domain";

interface UseClosingOptions {
  /**
   * Catalogue-owned stock corrections for reconciled counts. Injected by the
   * app shell so stock updates stay with their one owner.
   */
  applyCountedQty: (itemType: InventoryItemCategory, itemId: string, countedQty: number) => void;
  applyPendingCounts: (pending: InventoryCount[]) => void;
  currentUser: User | null;
  /** Seeded counts; a test fixture replaces the value from src/data. */
  inventoryCounts?: InventoryCount[];
}

/**
 * Owns the closing feature: inventory reconciliation counts, expenses and
 * end-of-day closings.
 */
export function useClosing({
  applyCountedQty,
  applyPendingCounts,
  currentUser,
  inventoryCounts: seededInventoryCounts,
}: UseClosingOptions) {
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCount[]>(
    seededInventoryCounts ?? initialInventoryCounts
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);

  const logClosingEvent = (
    action:
      | "inventory.count_submitted"
      | "inventory.count_resolved"
      | "inventory.reconciliation_applied"
      | "closing.expense_added"
      | "closing.expense_deleted"
      | "closing.day_closed",
    entityType: string,
    entityId: string,
    details: string
  ) => {
    if (!currentUser) return;
    recordAuditEvent({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      entityType,
      entityId,
      details,
    });
  };

  // --- INVENTORY RECONCILIATION (FR-4.4, FR-4.5) ---
  const submitClosingCount = ({ date, entries }: ClosingCountSubmission) => {
    setInventoryCounts((prev) => [
      ...entries.map((entry, idx): InventoryCount => {
        const discrepancy = computeDiscrepancy(entry.countedQty, entry.systemQty);
        return {
          id: `IC-${String(prev.length + idx + 1).padStart(3, "0")}`,
          itemId: entry.itemId,
          itemType: entry.itemType,
          date,
          systemQty: entry.systemQty,
          countedQty: entry.countedQty,
          discrepancy,
          status: discrepancy === 0 ? "resolved" : "pending",
          resolution: discrepancy === 0 ? "match" : undefined,
        };
      }),
      ...prev,
    ]);
    logClosingEvent(
      "inventory.count_submitted",
      "ClosingCount",
      date,
      `Submitted ${entries.length} inventory count${entries.length === 1 ? "" : "s"} for ${date}`
    );
  };

  const resolveInventoryCount = (id: InventoryCountId, action: CountResolutionAction) => {
    const record = inventoryCounts.find((c) => c.id === id);
    if (!record) return;

    if (action === "apply") {
      applyCountedQty(record.itemType, record.itemId, record.countedQty);
    }

    setInventoryCounts((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: "resolved", resolution: action === "apply" ? "applied" : "dismissed" }
          : c
      )
    );
    logClosingEvent(
      "inventory.count_resolved",
      "InventoryCount",
      id,
      `Resolved count ${id} (${record.itemId}) as ${action === "apply" ? "applied" : "dismissed"}`
    );
  };

  const applyAllPendingCounts = () => {
    const pending = inventoryCounts.filter(
      (c) => c.status === "pending" && c.discrepancy !== 0
    );
    if (pending.length === 0) return;

    applyPendingCounts(pending);

    setInventoryCounts((prev) =>
      prev.map((c) =>
        c.status === "pending" && c.discrepancy !== 0
          ? { ...c, status: "resolved", resolution: "applied" }
          : c
      )
    );
    logClosingEvent(
      "inventory.reconciliation_applied",
      "InventoryCount",
      "bulk",
      `Applied ${pending.length} pending reconciliation count${pending.length === 1 ? "" : "s"}`
    );
  };

  // --- EXPENSES & END-OF-DAY CLOSING (FR-8.1) ---
  const addExpense = (data: ExpenseData) => {
    // The bound lives here, not in the form: the closing totals and the audit
    // entry below both take the amount as given.
    if (!isPayableAmount(data.amount)) return;
    const id: ExpenseId = `EXP-${String(expenses.length + 1).padStart(4, "0")}`;
    setExpenses((prev) => [...prev, { id, ...data }]);
    logClosingEvent("closing.expense_added", "Expense", id, `Added expense ${id} (${data.description}: ${data.amount})`);
  };

  const deleteExpense = (id: ExpenseId) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    logClosingEvent("closing.expense_deleted", "Expense", id, `Deleted expense ${id}`);
  };

  const closeDay = (data: DayClosingData) => {
    if (dayClosings.some((c) => c.date === data.date)) return;
    const id = `EOD-${String(dayClosings.length + 1).padStart(4, "0")}`;
    setDayClosings((prev) => [
      ...prev,
      { id, closedAt: new Date().toISOString(), ...data },
    ]);
    logClosingEvent("closing.day_closed", "DayClosing", id, `Closed day ${data.date}`);
  };

  return {
    inventoryCounts,
    expenses,
    dayClosings,
    submitClosingCount,
    resolveInventoryCount,
    applyAllPendingCounts,
    addExpense,
    deleteExpense,
    closeDay,
  };
}