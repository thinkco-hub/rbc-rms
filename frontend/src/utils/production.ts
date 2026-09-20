import type {
  IngredientStock,
  ProductionRun,
  ProductionRunDisposition,
  Quantity,
  Recipe,
  RequiredIngredientLine,
} from "../types/domain";

export function computeBatches(plannedQty: Quantity, recipe: Recipe): number {
  const yieldQty = Number(recipe.yieldQty) || 1;
  return Math.ceil((Number(plannedQty) || 0) / yieldQty);
}

export function computeRequiredIngredients(
  run: Pick<ProductionRun, "plannedQty">,
  recipe: Recipe,
  ingredients: IngredientStock[]
): RequiredIngredientLine[] {
  const batches = computeBatches(run.plannedQty, recipe);
  return recipe.ingredients.map((line) => {
    const ingredient = ingredients.find((i) => i.id === line.ingredientId);
    const requiredQty = line.qty * batches;
    const inStock = ingredient ? ingredient.qty : 0;
    return {
      ingredientId: line.ingredientId,
      name: ingredient ? ingredient.name : line.ingredientId,
      unit: ingredient ? ingredient.unit : line.unit,
      requiredQty,
      inStock,
      shortfall: Math.max(0, requiredQty - inStock),
    };
  });
}

export function isRunFeasible(
  run: Pick<ProductionRun, "plannedQty">,
  recipe: Recipe,
  ingredients: IngredientStock[]
): boolean {
  return computeRequiredIngredients(run, recipe, ingredients).every(
    (line) => line.shortfall === 0
  );
}

export function getRunStatus(
  run: Pick<ProductionRun, "plannedQty" | "status">,
  recipe: Recipe,
  ingredients: IngredientStock[]
): ProductionRunDisposition {
  if (run.status === "completed") return "completed";
  return isRunFeasible(run, recipe, ingredients) ? "scheduled" : "insufficient";
}

export const RUN_STATUS_LABELS: Record<ProductionRunDisposition, string> = {
  scheduled: "Scheduled",
  insufficient: "Insufficient Stock",
  completed: "Completed",
};