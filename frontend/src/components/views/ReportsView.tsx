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
