import React, { useState } from "react";
import FinishedGoodsTable from "../inventory/FinishedGoodsTable";
import RawMaterialsTable from "../inventory/RawMaterialsTable";
import RestockReminders from "../inventory/RestockReminders";
import ClosingCountForm from "../inventory/ClosingCountForm";
import ReconciliationReview from "../inventory/ReconciliationReview";
import type {
  ClosingCountSubmission,
  CountResolutionAction,
  IngredientFormData,
  IngredientStock,
  InventoryCount,
  InventoryCountId,
  InventoryTabId,
  MenuItemStock,
  NavTabId,
  RestockCategory,
  RestockReminder,
  RestockReminderData,
} from "../../types/domain";

interface InventoryViewProps {
  activeTab: InventoryTabId;
  menuInventory: MenuItemStock[];
  ingredients: IngredientStock[];
  restockReminders: RestockReminder[];
  inventoryCounts: InventoryCount[];
  onNavClick: (tab: NavTabId) => void;
  onRestockToProduction: () => void;
  onOpenRestock: (category: RestockCategory, itemId?: string) => void;
  onAddIngredient: (data: IngredientFormData) => void;
  onUpdateIngredient: (id: string, data: Partial<IngredientStock>) => void;
  onAddReminder: (data: RestockReminderData) => void;
  onToggleReminderDone: (id: string) => void;
  onSubmitClosingCount: (data: ClosingCountSubmission) => void;
  onResolveCount: (id: InventoryCountId, action: CountResolutionAction) => void;
  onApplyAllCounts: () => void;
}

/** Which stock collection the combined Inventory view is showing. */
type StockView = "menu" | "raw";

export default function InventoryView({
  activeTab,
  menuInventory,
  ingredients,
  restockReminders,
  inventoryCounts,
  onNavClick,
  onRestockToProduction,
  onOpenRestock,
  onAddIngredient,
  onUpdateIngredient,
  onAddReminder,
  onToggleReminderDone,
  onSubmitClosingCount,
  onResolveCount,
  onApplyAllCounts,
}: InventoryViewProps) {
  // Menu Items / Raw Materials toggle (combined main Inventory view)
  const [stockView, setStockView] = useState<StockView>("menu");

  // =========================================================
  //     VIEW: INVENTORY - CLOSING COUNT (reached via button)
  // =========================================================
  if (activeTab === "inventory-closing-count") {
    return (
      <ClosingCountForm
        menuInventory={menuInventory}
        ingredients={ingredients}
        onSubmit={onSubmitClosingCount}
        onBack={() => onNavClick("inventory")}
      />
    );
  }

  // =========================================================
  //     VIEW: INVENTORY - RECONCILIATION (admin-only)
  // =========================================================
  if (activeTab === "inventory-reconciliation") {
    return (
      <ReconciliationReview
        counts={inventoryCounts}
        menuInventory={menuInventory}
        ingredients={ingredients}
        onResolve={onResolveCount}
        onApplyAll={onApplyAllCounts}
      />
    );
  }

  // =========================================================
  //     VIEW: INVENTORY (combined: toggle + reminders)
  // =========================================================
  return (
    <div className="space-y-6">
      {/* Header: Menu Items / Raw Materials toggle + Closing Count button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="inline-flex rounded-xl bg-[#4a2605] p-1 shadow-inner">
          <button
            onClick={() => setStockView("menu")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              stockView === "menu"
                ? "bg-[#F17D0C] text-white shadow-md"
                : "text-[#FDF9F3]/70 hover:text-white"
            }`}
          >
            Menu Items
          </button>
          <button
            onClick={() => setStockView("raw")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              stockView === "raw"
                ? "bg-[#F17D0C] text-white shadow-md"
                : "text-[#FDF9F3]/70 hover:text-white"
            }`}
          >
            Raw Materials
          </button>
        </div>

        <button
          onClick={() => onNavClick("inventory-closing-count")}
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#F17D0C] text-white text-sm font-bold shadow-md hover:bg-[#d96f0a] transition-colors"
        >
          Closing Count
        </button>
      </div>

      {/* Combined stock tables — Menu Items and Raw Materials are toggleable */}
      {stockView === "menu" ? (
        <FinishedGoodsTable
          menuInventory={menuInventory}
          // Restock routes to Production Runs — replenish finished goods by scheduling a run
          onRestock={onRestockToProduction}
        />
      ) : (
        <RawMaterialsTable
          ingredients={ingredients}
          onRestock={(id: string) => onOpenRestock("ingredient", id)}
          onAdd={onAddIngredient}
          onUpdate={onUpdateIngredient}
        />
      )}

      {/* Restock Reminders live in the main Inventory view */}
      <RestockReminders
        ingredients={ingredients}
        reminders={restockReminders}
        onAdd={onAddReminder}
        onToggleDone={onToggleReminderDone}
      />
    </div>
  );
}
