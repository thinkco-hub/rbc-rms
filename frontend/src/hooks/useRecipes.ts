import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type {
  MenuItemId,
  PricingRuleInput,
  PricingRules,
  Recipe,
  RecipeId,
  RecipeInput,
} from "../types/domain";

/**
 * Owns the recipes/BOM feature: the recipe list, pricing rules and the state
 * of the recipe editor (viewing an existing recipe or creating a new one).
 *
 * A "recipe" in the UI is a menu item plus its bill of materials, but the
 * backend keeps MenuItem and Recipe as separate resources (a recipe
 * references its menu item by id). This hook joins the two on read, and on
 * write upserts the menu item first, then the recipe pointing at it.
 */
export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRules>({
    targetMarginPercent: 40,
  });
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);

  // Backend recipe id for each menu item, since the combined `Recipe` shape
  // only exposes the menu item's id.
  const recipeIdByMenuItemId = useRef<Map<MenuItemId, RecipeId>>(new Map());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<BackendMenuItem[]>("/api/v1/inventory/menu-items/"),
      api.get<BackendRecipe[]>("/api/v1/recipes/"),
    ])
      .then(([menuItems, backendRecipes]) => {
        if (cancelled) return;
        const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));
        const merged: Recipe[] = [];
        recipeIdByMenuItemId.current.clear();
        backendRecipes.forEach((recipe) => {
          const menuItem = menuItemsById.get(recipe.menu_item_id);
          if (!menuItem) return;
          recipeIdByMenuItemId.current.set(String(menuItem.id), String(recipe.id));
          merged.push(toRecipe(recipe, menuItem));
        });
        setRecipes(merged);
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

  const saveRecipe = async (recipe: RecipeInput) => {
    const menuItemPayload = {
      name: recipe.name,
      unit: recipe.yieldUnit || "",
      selling_price: recipe.price,
      stock_quantity: recipe.qty,
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
      yield_quantity: recipe.yieldQty || 0,
      yield_unit: recipe.yieldUnit || "",
      target_margin_percent: Number(pricingRules.targetMarginPercent) || 0,
      ingredients: recipe.ingredients.map((line) => ({
        raw_material_id: Number(line.ingredientId),
        quantity_required: line.qty,
      })),
    };
    const existingRecipeId = recipe.id ? recipeIdByMenuItemId.current.get(recipe.id) : undefined;
    const savedRecipe = existingRecipeId
      ? await api.patch<BackendRecipe>(`/api/v1/recipes/${existingRecipeId}/`, recipePayload)
      : await api.post<BackendRecipe>("/api/v1/recipes/", recipePayload);
    recipeIdByMenuItemId.current.set(String(menuItem.id), String(savedRecipe.id));

    setRecipes((prev) => {
      const mapped = toRecipe(savedRecipe, menuItem);
      return existingRecipeId
        ? prev.map((item) => (item.id === mapped.id ? mapped : item))
        : [...prev, mapped];
    });
    setError(null);
    setViewingRecipe(null);
    setIsCreatingRecipe(false);
  };

  const cancelRecipeEdit = () => {
    setViewingRecipe(null);
    setIsCreatingRecipe(false);
  };

  const updatePricingRule = (data: PricingRuleInput) => {
    setPricingRules((prev) => ({
      ...prev,
      targetMarginPercent:
        data.targetMarginPercent === "" ? "" : parseFloat(data.targetMarginPercent) || 0,
    }));
  };

  return {
    recipes,
    pricingRules,
    viewingRecipe,
    setViewingRecipe,
    isCreatingRecipe,
    setIsCreatingRecipe,
    saveRecipe,
    cancelRecipeEdit,
    updatePricingRule,
    isLoading,
    error,
  };
}

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

function toRecipe(recipe: BackendRecipe, menuItem: BackendMenuItem): Recipe {
  return {
    id: String(menuItem.id),
    name: menuItem.name,
    qty: Number(menuItem.stock_quantity),
    target: Number(menuItem.reorder_threshold),
    shelfLife: menuItem.shelf_life,
    type: "Menu Item",
    price: Number(menuItem.selling_price),
    category: (menuItem.category || "Pastries") as Recipe["category"],
    yieldQty: Number(recipe.yield_quantity),
    yieldUnit: recipe.yield_unit,
    ingredients: recipe.ingredients.map((line) => ({
      ingredientId: String(line.raw_material_id),
      qty: Number(line.quantity_required),
      unit: line.unit,
    })),
  };
}
