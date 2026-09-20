import { useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  PricingRuleInput,
  PricingRules,
  Recipe,
  RecipeInput,
} from "../types/domain";

/**
 * Owns the recipes/BOM feature: the recipe list, pricing rules and the state
 * of the recipe editor (viewing an existing recipe or creating a new one).
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

  useEffect(() => {
    let cancelled = false;
    api
      .get<BackendRecipe[]>("/api/v1/recipes/")
      .then((data) => {
        if (!cancelled) setRecipes(data.map(toRecipe));
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
    const payload = {
      menu_item_id: Number(recipe.menuItemId),
      name: recipe.name,
      yield_quantity: recipe.yieldQty,
      yield_unit: recipe.yieldUnit,
      target_margin_percent: Number(pricingRules.targetMarginPercent) || 0,
      ingredients: recipe.ingredients.map((line) => ({
        raw_material_id: Number(line.ingredientId),
        quantity_required: line.qty,
      })),
    };
    const path = recipe.id ? `/api/v1/recipes/${recipe.id.replace("REC-", "")}/` : "/api/v1/recipes/";
    const saved = recipe.id
      ? await api.patch<BackendRecipe>(path, payload)
      : await api.post<BackendRecipe>(path, payload);
    setRecipes((prev) => {
      const mapped = toRecipe(saved);
      return recipe.id ? prev.map((item) => (item.id === mapped.id ? mapped : item)) : [...prev, mapped];
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

interface BackendRecipe {
  id: number;
  menu_item_id: number;
  name: string;
  yield_quantity: string | number;
  yield_unit: string;
  target_margin_percent: string | number;
  ingredients: Array<{ raw_material_id: number; quantity_required: string | number; unit: string }>;
}

function toRecipe(recipe: BackendRecipe): Recipe {
  return {
    id: `REC-${recipe.id}`,
    menuItemId: String(recipe.menu_item_id),
    name: recipe.name,
    yieldQty: Number(recipe.yield_quantity),
    yieldUnit: recipe.yield_unit,
    ingredients: recipe.ingredients.map((line) => ({
      ingredientId: String(line.raw_material_id),
      qty: Number(line.quantity_required),
      unit: line.unit,
    })),
  };
}