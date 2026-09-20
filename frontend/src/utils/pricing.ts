import type { IngredientStock, Quantity, Recipe, RecipeCost } from "../types/domain";

export function computeRecipeCost(
  recipe: Recipe,
  ingredients: IngredientStock[]
): RecipeCost {
  const totalCost = recipe.ingredients.reduce((sum, line) => {
    const ingredient = ingredients.find((i) => i.id === line.ingredientId);
    const unitCost = ingredient ? Number(ingredient.unitCost || 0) : 0;
    return sum + unitCost * Number(line.qty || 0);
  }, 0);
  const yieldQty = Number(recipe.yieldQty) || 1;
  return { totalCost, costPerUnit: totalCost / yieldQty };
}

export function suggestedPrice(
  costPerUnit: number,
  targetMarginPercent: number | ""
): number {
  const margin = Math.min(Math.max(Number(targetMarginPercent) || 0, 0), 95) / 100;
  if (margin >= 1) return costPerUnit;
  return costPerUnit / (1 - margin);
}