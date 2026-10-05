import React from "react";
import ReportsDashboard from "../reports/ReportsDashboard";
import EndOfDayClosing from "../reports/EndOfDayClosing";
import ClosingInventory from "../reports/ClosingInventory";
import type {
  DayClosing,
  DayClosingData,
  Expense,
  ExpenseData,
  ExpenseId,
  IngredientStock,
  InventoryCount,
  MenuItemStock,
  ReportsTabId,
  Sale,
} from "../../types/domain";

interface ReportsViewProps {
  activeTab: ReportsTabId;
  sales: Sale[];
  salesLoading: boolean;
  salesError: string | null;
  onReprintSale: (sale: Sale | null) => void;
  expenses: Expense[];
  dayClosings: DayClosing[];
  onAddExpense: (data: ExpenseData) => void;
  onDeleteExpense: (id: ExpenseId) => void;
  onCloseDay: (data: DayClosingData) => void;
  menuInventory: MenuItemStock[];
  ingredients: IngredientStock[];
  inventoryCounts: InventoryCount[];
}

export default function ReportsView({
  activeTab,
  sales,
  salesLoading,
  salesError,
  onReprintSale,
  expenses,
  dayClosings,
  onAddExpense,
  onDeleteExpense,
  onCloseDay,
  menuInventory,
  ingredients,
  inventoryCounts,
}: ReportsViewProps) {
  return (
    <>
      {salesLoading && (
        <p role="status" className="mb-4 text-sm text-gray-500">Loading persisted sales history...</p>
      )}
      {salesError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Sales history could not be loaded: {salesError}
        </p>
      )}
      {activeTab === "reports-dashboard" && <ReportsDashboard sales={sales} onReprintSale={onReprintSale} />}

      {/* =========================================
          VIEW: END-OF-DAY CLOSING
      ========================================= */}
      {activeTab === "reports-closing" && (
        <EndOfDayClosing
          sales={sales}
          expenses={expenses}
          dayClosings={dayClosings}
          onAddExpense={onAddExpense}
          onDeleteExpense={onDeleteExpense}
          onCloseDay={onCloseDay}
        />
      )}

      {/* =========================================
          VIEW: CLOSING INVENTORY REPORT
      ========================================= */}
      {activeTab === "reports-inventory" && (
        <ClosingInventory
          menuInventory={menuInventory}
          ingredients={ingredients}
          inventoryCounts={inventoryCounts}
        />
      )}
    </>
  );
}
