import { useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  IngredientFormData,
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
  StockItem,
} from "../types/domain";

const EMPTY_RESTOCK_MODAL: RestockModalState = {
  isOpen: false,
  category: "menu",
  selectedItemId: "",
  amountToAdd: "",
};

/**
 * Owns the inventory feature: menu item stock, raw ingredient stock, restock
 * reminders and the restock modal. All stock movements (order delivery,
 * production completion, reconciliation, restocking) flow through the
 * stock-movement actions below so the stock collections have a single owner.
 */
export function useInventory() {
  const [menuInventory, setMenuInventory] = useState<MenuItemStock[]>([]);
  const [ingredients, setIngredients] = useState<IngredientStock[]>([]);
  const [restockReminders, setRestockReminders] = useState<RestockReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restockModal, setRestockModal] = useState<RestockModalState>(EMPTY_RESTOCK_MODAL);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<BackendMenuItem[]>("/api/v1/inventory/menu-items/"),
      api.get<BackendRawMaterial[]>("/api/v1/inventory/raw-materials/"),
      api.get<BackendReminder[]>("/api/v1/inventory/reminders/"),
    ])
      .then(([menuItems, rawMaterials, reminders]) => {
        if (cancelled) return;
        setMenuInventory(menuItems.map(toMenuItem));
        setIngredients(rawMaterials.map(toIngredient));
        setRestockReminders(reminders.map(toReminder));
      })
      .catch((requestError: Error) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const submitRestock = async () => {
    const amount = parseInt(restockModal.amountToAdd);
    if (isNaN(amount) || amount <= 0) return;

    if (restockModal.category === "ingredient") {
      const ingredient = ingredients.find((item) => item.id === restockModal.selectedItemId);
      if (!ingredient) return;
      const result = await api.post<{ raw_material: BackendRawMaterial }>("/api/v1/inventory/receipts/", {
        raw_material_id: restockModal.selectedItemId,
        quantity: amount,
        unit_cost: ingredient.unitCost,
      });
      setIngredients((prev) => prev.map((item) =>
        item.id === restockModal.selectedItemId ? toIngredient(result.raw_material) : item
      ));
    } else {
      setQtyById(restockModal.category, restockModal.selectedItemId, (qty) => qty + amount);
    }

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
  const addIngredient = async (data: IngredientFormData) => {
    const created = await api.post<BackendRawMaterial>("/api/v1/inventory/raw-materials/", {
      name: data.name,
      unit: data.unit,
      supplier: data.supplier,
      unit_cost: data.unitCost,
      reorder_threshold: data.target,
    });
    let material = created;
    if (data.qty > 0) {
      const receipt = await api.post<{ raw_material: BackendRawMaterial }>("/api/v1/inventory/receipts/", {
        raw_material_id: created.id,
        quantity: data.qty,
        unit_cost: data.unitCost,
      });
      material = receipt.raw_material;
    }
    setIngredients((prev) => [...prev, toIngredient(material)]);
    setError(null);
  };

  const updateIngredient = async (id: string, data: Partial<IngredientStock>) => {
    const updated = await api.patch<BackendRawMaterial>(`/api/v1/inventory/raw-materials/${id}/`, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.supplier !== undefined && { supplier: data.supplier }),
      ...(data.unitCost !== undefined && { unit_cost: data.unitCost }),
      ...(data.target !== undefined && { reorder_threshold: data.target }),
    });
    let material = updated;
    if (data.qty !== undefined) {
      const current = ingredients.find((item) => item.id === id);
      const delta = data.qty - (current?.qty ?? Number(updated.current_stock));
      if (delta > 0) {
        const receipt = await api.post<{ raw_material: BackendRawMaterial }>("/api/v1/inventory/receipts/", {
          raw_material_id: id,
          quantity: delta,
          unit_cost: data.unitCost ?? current?.unitCost ?? updated.unit_cost,
        });
        material = receipt.raw_material;
      } else if (delta < 0) {
        const consumed = await api.post<{ raw_material: BackendRawMaterial }>(
          `/api/v1/inventory/raw-materials/${id}/consume/`,
          { quantity: -delta }
        );
        material = consumed.raw_material;
      }
    }
    setIngredients((prev) => prev.map((item) => (item.id === id ? toIngredient(material) : item)));
    setError(null);
  };

  const addRestockReminder = async (data: RestockReminderData) => {
    const created = await api.post<BackendReminder>("/api/v1/inventory/reminders/", {
      raw_material_id: data.ingredientId,
      note: data.note,
      target_date: data.dueDate || null,
      quantity_needed: 1,
    });
    setRestockReminders((prev) => [...prev, toReminder(created)]);
    setError(null);
  };

  const toggleReminderDone = async (id: string) => {
    const reminder = restockReminders.find((item) => item.id === id);
    if (!reminder) return;
    const updated = await api.patch<BackendReminder>(`/api/v1/inventory/reminders/${id}/`, {
      status: reminder.done ? "pending" : "completed",
    });
    setRestockReminders((prev) => prev.map((item) => (item.id === id ? toReminder(updated) : item)));
    setError(null);
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
    isLoading,
    error,
    deductOrderLines,
    deductRecipeLines,
    addMenuStock,
    applyCountedQty,
    applyPendingCounts,
  };
}

interface BackendRawMaterial {
  id: number;
  name: string;
  unit: string;
  supplier: string;
  unit_cost: string | number;
  current_stock: string | number;
  reorder_threshold: string | number;
}

interface BackendMenuItem {
  id: number;
  name: string;
  stock_quantity: string | number;
  reorder_threshold: string | number;
  selling_price: string | number;
  unit: string;
}

interface BackendReminder {
  id: number;
  raw_material_id: number;
  note: string;
  quantity_needed: string | number;
  target_date: string | null;
  status: string;
}

function toIngredient(item: BackendRawMaterial): IngredientStock {
  return {
    id: String(item.id),
    name: item.name,
    qty: Number(item.current_stock),
    target: Number(item.reorder_threshold),
    unit: item.unit,
    type: "Ingredient",
    supplier: item.supplier,
    unitCost: Number(item.unit_cost),
  };
}

function toMenuItem(item: BackendMenuItem): MenuItemStock {
  return {
    id: String(item.id),
    name: item.name,
    qty: Number(item.stock_quantity),
    target: Number(item.reorder_threshold),
    shelfLife: "",
    type: "Menu Item",
    price: Number(item.selling_price),
  };
}

function toReminder(item: BackendReminder): RestockReminder {
  return {
    id: String(item.id),
    ingredientId: String(item.raw_material_id),
    note: item.note,
    dueDate: item.target_date || "",
    done: item.status === "completed",
  };
}