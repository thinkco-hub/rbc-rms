import { useState } from "react";
import { computeDiscrepancy } from "../utils/counts";
import { initialInventoryCounts } from "../data/initialInventory";
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
} from "../types/domain";

interface UseClosingOptions {
  /**
   * Inventory-owned stock corrections for reconciled counts. Injected by the
   * app shell so stock updates stay owned by useInventory.
   */
  applyCountedQty: (itemType: InventoryItemCategory, itemId: string, countedQty: number) => void;
  applyPendingCounts: (pending: InventoryCount[]) => void;
}

/**
 * Owns the closing feature: inventory reconciliation counts, expenses and
 * end-of-day closings.
 */
export function useClosing({ applyCountedQty, applyPendingCounts }: UseClosingOptions) {
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCount[]>(initialInventoryCounts);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dayClosings, setDayClosings] = useState<DayClosing[]>([]);

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
  };

  // --- EXPENSES & END-OF-DAY CLOSING (FR-8.1) ---
  const addExpense = (data: ExpenseData) => {
    setExpenses((prev) => [
      ...prev,
      { id: `EXP-${String(prev.length + 1).padStart(4, "0")}`, ...data },
    ]);
  };

  const deleteExpense = (id: ExpenseId) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const closeDay = (data: DayClosingData) => {
    setDayClosings((prev) => {
      if (prev.some((c) => c.date === data.date)) return prev;
      return [
        ...prev,
        {
          id: `EOD-${String(prev.length + 1).padStart(4, "0")}`,
          closedAt: new Date().toISOString(),
          ...data,
        },
      ];
    });
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