import { useState } from "react";
import {
  initialIngredients,
  initialRestockReminders,
} from "../data/initialInventory";
import { initialRecipes } from "../data/initialRecipes";
import type {
  IngredientFormData,
  IngredientId,
  IngredientStock,
  InventoryCount,
  InventoryItemCategory,
  MenuItemId,
  MenuItemStock,
  OrderItem,
  Quantity,
  RecipeIngredientLine,
  RestockCategory,
  RestockModalState,
  RestockReminder,
  RestockReminderData,
  RestockReminderId,
  StockItem,
} from "../types/domain";

const EMPTY_RESTOCK_MODAL: RestockModalState = {
  isOpen: false,
  category: "menu",
  selectedItemId: "",
  amountToAdd: "",
};

// Monotonic ID counters, seeded past the highest seeded record so new IDs keep
// the display formats (ING-xx, RR-xxx) and never collide — even after deletes.
let nextIngredientSeq = initialIngredients.length + 1;
const nextIngredientId = (): IngredientId =>
  `ING-${String(nextIngredientSeq++).padStart(2, "0")}`;

let nextReminderSeq = initialRestockReminders.length + 1;
const nextReminderId = (): RestockReminderId =>
  `RR-${String(nextReminderSeq++).padStart(3, "0")}`;

/**
 * Owns the inventory feature: menu item stock, raw ingredient stock, restock
 * reminders and the restock modal. All stock movements (order delivery,
 * production completion, reconciliation, restocking) flow through the
 * stock-movement actions below so the stock collections have a single owner.
 */
export function useInventory() {
  const [menuInventory, setMenuInventory] = useState<MenuItemStock[]>(initialRecipes);
  const [ingredients, setIngredients] = useState<IngredientStock[]>(initialIngredients);
  const [restockReminders, setRestockReminders] = useState<RestockReminder[]>(initialRestockReminders);
  const [restockModal, setRestockModal] = useState<RestockModalState>(EMPTY_RESTOCK_MODAL);

  // --- STOCK MOVEMENTS (consumed by orders, production and closing) ---

  // Deducts the menu items of a delivered order (FR-8).
  const deductOrderLines = (lines: OrderItem[]) => {
    setMenuInventory((prev) =>
      prev.map((item) => {
        const line = lines.find((l) => l.menuItemId === item.id);
        if (!line) return item;
        return { ...item, qty: Math.max(0, item.qty - line.qty) };
      })
    );
  };

  // Deducts the ingredients consumed by the batches of a completed run (FR-8).
  const deductRecipeLines = (lines: RecipeIngredientLine[], batches: number) => {
    setIngredients((prev) =>
      prev.map((item) => {
        const line = lines.find((l) => l.ingredientId === item.id);
        if (!line) return item;
        return { ...item, qty: Math.max(0, item.qty - line.qty * batches) };
      })
    );
  };

  // Adds completed production yield to a menu item's stock (FR-8).
  const addMenuStock = (menuItemId: MenuItemId, amount: number) => {
    setMenuInventory((prev) =>
      prev.map((item) =>
        item.id === menuItemId ? { ...item, qty: item.qty + amount } : item
      )
    );
  };

  // Sets one stock item's qty in the collection matching the category.
  const setQtyById = (
    category: InventoryItemCategory,
    id: string,
    qty: (prev: Quantity) => Quantity
  ) => {
    const apply = <T extends StockItem>(item: T): T =>
      item.id === id ? { ...item, qty: qty(item.qty) } : item;
    if (category === "menu") {
      setMenuInventory((prev) => prev.map(apply));
    } else {
      setIngredients((prev) => prev.map(apply));
    }
  };

  // Applies a resolved count to system stock (FR-4.5).
  const applyCountedQty = (
    itemType: InventoryItemCategory,
    itemId: string,
    countedQty: number
  ) => {
    setQtyById(itemType, itemId, () => countedQty);
  };

  // Bulk-applies pending reconciliation counts (FR-4.5).
  const applyPendingCounts = (pending: InventoryCount[]) => {
    pending.forEach((count) => {
      setQtyById(count.itemType, count.itemId, () => count.countedQty);
    });
  };

  // --- RESTOCKING (FR-1.2) ---
  const openRestock = (category: RestockCategory, itemId = "") => {
    const defaultId =
      itemId || (category === "menu" ? menuInventory[0].id : ingredients[0].id);
    setRestockModal({
      isOpen: true,
      category: category,
      selectedItemId: defaultId,
      amountToAdd: "",
    });
  };

  const submitRestock = () => {
    const amount = parseInt(restockModal.amountToAdd);
    if (isNaN(amount) || amount <= 0) return;

    setQtyById(restockModal.category, restockModal.selectedItemId, (qty) => qty + amount);

    setRestockModal(EMPTY_RESTOCK_MODAL);
  };

  const handleRestockQuickAdd = (delta: number) => {
    setRestockModal({
      ...restockModal,
      amountToAdd: (parseInt(restockModal.amountToAdd || "0") + delta).toString(),
    });
  };

  const closeRestockModal = () => {
    setRestockModal(EMPTY_RESTOCK_MODAL);
  };

  // --- INGREDIENTS & RESTOCK REMINDERS (FR-1.2) ---
  const addIngredient = (data: IngredientFormData) => {
    setIngredients((prev) => [
      ...prev,
      { id: nextIngredientId(), type: "Ingredient", ...data },
    ]);
  };

  const updateIngredient = (id: string, data: Partial<IngredientStock>) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...data } : item))
    );
  };

  const addRestockReminder = (data: RestockReminderData) => {
    setRestockReminders((prev) => [
      ...prev,
      { id: nextReminderId(), done: false, ...data },
    ]);
  };

  const toggleReminderDone = (id: string) => {
    setRestockReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))
    );
  };

  // --- RESTOCK MODAL DERIVED VALUES ---
  const restockItems =
    restockModal.category === "menu" ? menuInventory : ingredients;
  const isRestockConfirmDisabled =
    !restockModal.amountToAdd || parseInt(restockModal.amountToAdd) <= 0;

  return {
    menuInventory,
    ingredients,
    restockReminders,
    restockModal,
    setRestockModal,
    addIngredient,
    updateIngredient,
    addRestockReminder,
    toggleReminderDone,
    openRestock,
    handleRestockQuickAdd,
    closeRestockModal,
    submitRestock,
    restockItems,
    isRestockConfirmDisabled,
    deductOrderLines,
    deductRecipeLines,
    addMenuStock,
    applyCountedQty,
    applyPendingCounts,
  };
}