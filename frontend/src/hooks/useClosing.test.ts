import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialUsers } from "../data/initialUsers";
import { getAuditLog } from "../utils/auditLog";
import { useClosing } from "./useClosing";

const cashier = initialUsers.find((u) => u.email === "cashier@rbc.test") ?? initialUsers[0];

function mountClosing() {
  const view = renderHook(() =>
    useClosing({
      applyCountedQty: vi.fn(),
      applyPendingCounts: vi.fn(),
      currentUser: cashier,
    })
  );

  return {
    expenses: () => view.result.current.expenses,
    add: (amount: number) =>
      act(() =>
        view.result.current.addExpense({
          date: "2026-10-23",
          description: "Flour delivery",
          amount,
        })
      ),
  };
}

const expenseEvents = () =>
  getAuditLog().filter((entry) => entry.action === "closing.expense_added");

describe("addExpense amount bound", () => {
  it("logs a positive expense", () => {
    const { expenses, add } = mountClosing();
    add(350);
    expect(expenses()).toHaveLength(1);
    expect(expenses()[0].amount).toBe(350);
    expect(expenseEvents()).toHaveLength(1);
  });

  it("refuses zero, negative and non-finite amounts", () => {
    const { expenses, add } = mountClosing();
    for (const amount of [0, -350, Number.NaN, Number.POSITIVE_INFINITY]) add(amount);
    expect(expenses()).toHaveLength(0);
    expect(expenseEvents()).toHaveLength(0);
  });
});
