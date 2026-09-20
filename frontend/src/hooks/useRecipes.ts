import { useState } from "react";
import { initialRecipes } from "../data/initialRecipes";
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
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [pricingRules, setPricingRules] = useState<PricingRules>({
    targetMarginPercent: 40,
  });
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);

  const saveRecipe = (recipe: RecipeInput) => {
    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === recipe.id);
      if (exists) return prev.map((r) => (r.id === recipe.id ? (recipe as Recipe) : r));
      return [
        ...prev,
        { ...recipe, id: `REC-${String(prev.length + 1).padStart(2, "0")}` },
      ];
    });
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
  };
}