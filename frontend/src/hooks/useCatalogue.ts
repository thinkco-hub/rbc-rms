import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { recordAuditEvent } from "../utils/auditLog";
import { DEFAULT_POS_COLOR, toPosProducts, trackedItems } from "../utils/catalogue";
import { computeRecipeCost } from "../utils/pricing";
import type {
  CatalogueItem,
  IngredientFormData,
  IngredientStock,
  InventoryCount,
  InventoryItemCategory,
  MenuItemId,
  OrderItem,
  PosItemCategory,
  PosProduct,
  PricingRuleInput,
  PricingRules,
  Quantity,
  RecipeIngredientLine,
  RecipeInput,
  RecipeId,
  RestockCategory,
  RestockModalState,
  RestockReminder,
  RestockReminderData,
  User,
} from "../types/domain";

const EMPTY_RESTOCK_MODAL: RestockModalState = {
  isOpen: false,
  category: "menu",
  selectedItemId: "",
  amountToAdd: "",
};

const CATEGORY_COLORS: Record<string, string> = {
  Pastries: "bg-amber-500",
  Bread: "bg-stone-500",
  Cakes: "bg-rose-500",
  Drinks: "bg-teal-700",
};

const POS_CATEGORIES: PosItemCategory[] = ["Pastries", "Bread", "Cakes", "Drinks"];
const toCategory = (value: string): PosItemCategory =>
  POS_CATEGORIES.includes(value as PosItemCategory) ? (value as PosItemCategory) : "Pastries";
const colorFor = (category: string) => CATEGORY_COLORS[category] || DEFAULT_POS_COLOR;

// ---------- Backend shapes ----------
interface BackendMenuItem {
  id: number;
  name: string;
  unit: string;
  selling_price: string | number;
  stock_quantity: string | number;
  reorder_threshold: string | number;
  category: string;
  shelf_life: string;
}

interface BackendRecipe {
  id: number;
  menu_item_id: number;
  name: string;
  yield_quantity: string | number;
  yield_unit: string;
  target_margin_percent: string | number;
  ingredients: Array<{ raw_material_id: number; quantity_required: string | number; unit: string }>;
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

interface BackendReminder {
  id: number;
  raw_material_id: number;
  note: string;
  target_date: string | null;
  status: string;
}

interface BackendPosProduct {
  id: number;
  name: string;
  selling_price: string | number;
  category: string;
}

function toCatalogueItem(menuItem: BackendMenuItem, recipe?: BackendRecipe): CatalogueItem {
  return {
    id: String(menuItem.id),
    name: menuItem.name,
    qty: Number(menuItem.stock_quantity),
    target: Number(menuItem.reorder_threshold),
    shelfLife: menuItem.shelf_life || "",
    type: "Menu Item",
    price: Number(menuItem.selling_price),
    category: toCategory(menuItem.category),
    yieldQty: recipe ? Number(recipe.yield_quantity) : undefined,
    yieldUnit: recipe ? recipe.yield_unit : menuItem.unit || undefined,
    ingredients: recipe
      ? recipe.ingredients.map((line) => ({
          ingredientId: String(line.raw_material_id),
          qty: Number(line.quantity_required),
          unit: line.unit,
        }))
      : [],
    color: colorFor(menuItem.category),
    // The backend tracks stock for every menu item.
    trackedStock: true,
  };
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

function toReminder(item: BackendReminder): RestockReminder {
  return {
    id: String(item.id),
    ingredientId: String(item.raw_material_id),
    note: item.note,
    dueDate: item.target_date || "",
    done: item.status === "completed",
  };
}

function toPosProduct(item: BackendPosProduct): PosProduct {
  return {
    id: String(item.id),
    name: item.name,
    price: Number(item.selling_price),
    category: toCategory(item.category),
    color: colorFor(item.category),
  };
}

interface UseCatalogueOptions {
  currentUser: User | null;
  /** Seeded collections; a test fixture replaces the server load. */
  catalogue?: CatalogueItem[];
  ingredients?: IngredientStock[];
  restockReminders?: RestockReminder[];
}

/**
 * Owns the menu catalogue and the raw-material stock beside it. The backend
 * keeps MenuItem and Recipe as separate resources (a recipe references its menu
 * item); this hook joins them into one catalogue record per menu item on read,
 * and on write upserts the menu item first, then the recipe pointing at it.
 *
 * Each collection loads on its own, so a role the server denies one module
 * (a cashier has POS but no inventory access) still gets the rest. The POS
 * product list comes from /pos/products/, which is the cashier's grant.
 */
export function useCatalogue({
  currentUser,
  catalogue: seededCatalogue,
  ingredients: seededIngredients,
  restockReminders: seededRestockReminders,
}: UseCatalogueOptions) {
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>(seededCatalogue ?? []);
  const [serverPosProducts, setServerPosProducts] = useState<PosProduct[] | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRules>({ targetMarginPercent: 40 });
  const [ingredients, setIngredients] = useState<IngredientStock[]>(seededIngredients ?? []);
  const [restockReminders, setRestockReminders] = useState<RestockReminder[]>(
    seededRestockReminders ?? []
  );
  const [restockModal, setRestockModal] = useState<RestockModalState>(EMPTY_RESTOCK_MODAL);
  const [isLoading, setIsLoading] = useState(!seededCatalogue);
  const [error, setError] = useState<string | null>(null);

  // Backend recipe id per menu item, since a catalogue record is keyed by its menu item.
  const recipeIdByMenuItemId = useRef<Map<MenuItemId, RecipeId>>(new Map());

  const loadCatalogue = useCallback(async () => {
    const [menuItems, recipes] = await Promise.all([
      api.get<BackendMenuItem[]>("/api/v1/inventory/menu-items/"),
      api.get<BackendRecipe[]>("/api/v1/recipes/").catch(() => [] as BackendRecipe[]),
    ]);
    const recipeByMenuItem = new Map(recipes.map((r) => [r.menu_item_id, r]));
    recipeIdByMenuItemId.current = new Map(
      recipes.map((r) => [String(r.menu_item_id), String(r.id)])
    );
    if (recipes[0]) {
      setPricingRules({ targetMarginPercent: Number(recipes[0].target_margin_percent) });
    }
    setCatalogue(menuItems.map((m) => toCatalogueItem(m, recipeByMenuItem.get(m.id))));
  }, []);

  const loadPosProducts = useCallback(async () => {
    const products = await api.get<BackendPosProduct[]>("/api/v1/pos/products/");
    setServerPosProducts(products.map(toPosProduct));
  }, []);

  /** Reloads everything that moves stock server-side (sales, deliveries). */
  const refreshStock = useCallback(async () => {
    await Promise.allSettled([
      loadCatalogue(),
      loadPosProducts(),
      api
        .get<BackendRawMaterial[]>("/api/v1/inventory/raw-materials/")
        .then((rows) => setIngredients(rows.map(toIngredient))),
    ]);
  }, [loadCatalogue, loadPosProducts]);

  useEffect(() => {
    if (seededCatalogue) return;
    let cancelled = false;
    const guard = <T,>(fn: (value: T) => void) => (value: T) => {
      if (!cancelled) fn(value);
    };
    Promise.allSettled([
      // Both loaders set state only after their awaited fetch resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCatalogue(),
      loadPosProducts(),
      seededIngredients
        ? Promise.resolve()
        : api
            .get<BackendRawMaterial[]>("/api/v1/inventory/raw-materials/")
            .then(guard((rows) => setIngredients(rows.map(toIngredient)))),
      seededRestockReminders
        ? Promise.resolve()
        : api
            .get<BackendReminder[]>("/api/v1/inventory/reminders/")
            .then(guard((rows) => setRestockReminders(rows.map(toReminder)))),
    ]).then(
      guard((results) => {
        const failed = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        // A 403 on one module is the server's RBAC, not a load failure.
        const message = failed?.reason instanceof Error ? failed.reason.message : null;
        setError(results.every((r) => r.status === "rejected") ? message : null);
        setIsLoading(false);
      })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stockItems = trackedItems(catalogue);
  // The server's POS list is authoritative for what a cashier can sell; the
  // catalogue (when this role can read it) supplies the swatch it already shows.
  const colorById = new Map(catalogue.map((item) => [item.id, item.color]));
  const posProducts = serverPosProducts
    ? serverPosProducts.map((p) => ({ ...p, color: colorById.get(p.id) ?? p.color }))
    : toPosProducts(catalogue);

  const logEvent = (
    action:
      | "recipe.saved"
      | "inventory.ingredient_added"
      | "inventory.ingredient_updated"
      | "inventory.restocked",
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

  // --- RECIPES (FR-1.1, FR-2.x) ---
  const saveRecipe = async (recipe: RecipeInput) => {
    try {
      const menuItemPayload = {
        name: recipe.name,
        unit: recipe.yieldUnit || "",
        selling_price: recipe.price,
        // Stock is never written here: finished goods carry FIFO cost layers,
        // which only the restock, production and sale paths keep in balance.
        reorder_threshold: recipe.target,
        category: recipe.category,
        shelf_life: recipe.shelfLife,
      };
      const menuItem = recipe.id
        ? await api.patch<BackendMenuItem>(`/api/v1/inventory/menu-items/${recipe.id}/`, menuItemPayload)
        : await api.post<BackendMenuItem>("/api/v1/inventory/menu-items/", menuItemPayload);

      const recipePayload = {
        menu_item_id: menuItem.id,
        name: recipe.name,
        yield_quantity: recipe.yieldQty || 1,
        yield_unit: recipe.yieldUnit || "",
        target_margin_percent: Number(pricingRules.targetMarginPercent) || 0,
        ingredients: recipe.ingredients.map((line) => ({
          raw_material_id: line.ingredientId,
          quantity_required: line.qty,
        })),
      };
      const existingRecipeId = recipeIdByMenuItemId.current.get(String(menuItem.id));
      const savedRecipe = existingRecipeId
        ? await api.patch<BackendRecipe>(`/api/v1/recipes/${existingRecipeId}/`, recipePayload)
        : await api.post<BackendRecipe>("/api/v1/recipes/", recipePayload);
      recipeIdByMenuItemId.current.set(String(menuItem.id), String(savedRecipe.id));

      // The swatch and stock flag belong to the record, not the editor form.
      const previous = catalogue.find((item) => item.id === String(menuItem.id));
      const saved: CatalogueItem = {
        ...toCatalogueItem(menuItem, savedRecipe),
        ...(previous && { color: previous.color, trackedStock: previous.trackedStock }),
      };
      setCatalogue((prev) =>
        prev.some((item) => item.id === saved.id)
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [...prev, saved]
      );
      setError(null);
      void loadPosProducts().catch(() => undefined);
      logEvent(
        "recipe.saved",
        "Recipe",
        saved.id,
        `${recipe.id ? "Updated" : "Created"} recipe ${saved.id} (${recipe.name})`
      );
      return saved.id;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save recipe.");
      throw requestError;
    }
  };

  const updatePricingRule = (data: PricingRuleInput) => {
    setPricingRules((prev) => ({
      ...prev,
      targetMarginPercent:
        data.targetMarginPercent === "" ? "" : parseFloat(data.targetMarginPercent) || 0,
    }));
  };

  // --- LOCAL STOCK MOVEMENTS ---
  // Production runs and closing counts are not on the backend yet, so their
  // stock effects stay in this session. Sales and order deliveries move stock
  // server-side and call refreshStock instead.

  const setMenuQty = (id: string, qty: (prev: Quantity) => Quantity) => {
    setCatalogue((prev) =>
      prev.map((item) =>
        item.id === id && item.trackedStock ? { ...item, qty: qty(item.qty) } : item
      )
    );
  };

  const setIngredientQty = (id: string, qty: (prev: Quantity) => Quantity) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: qty(item.qty) } : item))
    );
  };

  const deductOrderLines = (lines: OrderItem[]) => {
    setCatalogue((prev) =>
      prev.map((item) => {
        if (!item.trackedStock) return item;
        const line = lines.find((l) => l.menuItemId === item.id);
        if (!line) return item;
        return { ...item, qty: Math.max(0, item.qty - line.qty) };
      })
    );
  };

  const deductRecipeLines = (lines: RecipeIngredientLine[], batches: number) => {
    setIngredients((prev) =>
      prev.map((item) => {
        const line = lines.find((l) => l.ingredientId === item.id);
        if (!line) return item;
        return { ...item, qty: Math.max(0, item.qty - line.qty * batches) };
      })
    );
  };

  const addMenuStock = (menuItemId: MenuItemId, amount: number) => {
    setMenuQty(menuItemId, (qty) => qty + amount);
  };

  const applyCountedQty = (
    itemType: InventoryItemCategory,
    itemId: string,
    countedQty: number
  ) => {
    if (itemType === "menu") setMenuQty(itemId, () => countedQty);
    else setIngredientQty(itemId, () => countedQty);
  };

  const applyPendingCounts = (pending: InventoryCount[]) => {
    pending.forEach((count) => applyCountedQty(count.itemType, count.itemId, count.countedQty));
  };

  // --- RESTOCKING (FR-1.2) ---
  const openRestock = (category: RestockCategory, itemId = "") => {
    const items = category === "menu" ? stockItems : ingredients;
    const defaultId = itemId || items[0]?.id || "";
    setRestockModal({ isOpen: true, category, selectedItemId: defaultId, amountToAdd: "" });
  };

  const submitRestock = async () => {
    const amount = parseInt(restockModal.amountToAdd);
    if (isNaN(amount) || amount <= 0) return;
    const { category, selectedItemId } = restockModal;

    try {
      if (category === "ingredient") {
        const ingredient = ingredients.find((item) => item.id === selectedItemId);
        if (!ingredient) return;
        const result = await api.post<{ raw_material: BackendRawMaterial }>(
          "/api/v1/inventory/receipts/",
          { raw_material_id: selectedItemId, quantity: amount, unit_cost: ingredient.unitCost }
        );
        setIngredients((prev) =>
          prev.map((item) => (item.id === selectedItemId ? toIngredient(result.raw_material) : item))
        );
      } else {
        const item = catalogue.find((entry) => entry.id === selectedItemId);
        if (!item) return;
        // The restock action adds a FIFO cost layer; the unit cost is the
        // recipe's ingredient cost per unit, the best figure the UI holds.
        const updated = await api.post<BackendMenuItem>(
          `/api/v1/inventory/menu-items/${selectedItemId}/restock/`,
          {
            quantity: amount,
            unit_cost: Math.round(computeRecipeCost(item, ingredients).costPerUnit * 100) / 100,
          }
        );
        setMenuQty(selectedItemId, () => Number(updated.stock_quantity));
        void loadPosProducts().catch(() => undefined);
      }
      setError(null);
      logEvent(
        "inventory.restocked",
        "Inventory",
        selectedItemId,
        `Restocked ${selectedItemId} (${category}) by ${amount}`
      );
      setRestockModal(EMPTY_RESTOCK_MODAL);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Restock failed.");
    }
  };

  const handleRestockQuickAdd = (delta: number) => {
    setRestockModal({
      ...restockModal,
      amountToAdd: (parseInt(restockModal.amountToAdd || "0") + delta).toString(),
    });
  };

  const closeRestockModal = () => setRestockModal(EMPTY_RESTOCK_MODAL);

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
      const receipt = await api.post<{ raw_material: BackendRawMaterial }>(
        "/api/v1/inventory/receipts/",
        { raw_material_id: created.id, quantity: data.qty, unit_cost: data.unitCost }
      );
      material = receipt.raw_material;
    }
    const ingredient = toIngredient(material);
    setIngredients((prev) => [...prev, ingredient]);
    setError(null);
    logEvent(
      "inventory.ingredient_added",
      "Inventory",
      ingredient.id,
      `Added ingredient ${ingredient.id} (${data.name})`
    );
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
        const receipt = await api.post<{ raw_material: BackendRawMaterial }>(
          "/api/v1/inventory/receipts/",
          {
            raw_material_id: id,
            quantity: delta,
            unit_cost: data.unitCost ?? current?.unitCost ?? updated.unit_cost,
          }
        );
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
    logEvent("inventory.ingredient_updated", "Inventory", id, `Updated ingredient ${id}`);
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

  // --- DERIVED VALUES ---
  const restockItems = restockModal.category === "menu" ? stockItems : ingredients;
  const isRestockConfirmDisabled =
    !restockModal.amountToAdd || parseInt(restockModal.amountToAdd) <= 0;

  return {
    catalogue,
    stockItems,
    posProducts,
    pricingRules,
    saveRecipe,
    updatePricingRule,
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
    refreshStock,
    isLoading,
    error,
    deductOrderLines,
    deductRecipeLines,
    addMenuStock,
    applyCountedQty,
    applyPendingCounts,
  };
}
