import { useState } from "react";
import { initialProductionRuns } from "../data/initialProductionRuns";
import { computeBatches } from "../utils/production";
import type {
  MenuItemId,
  ProductionRun,
  ProductionRunId,
  Recipe,
  RecipeIngredientLine,
  ScheduleRunData,
} from "../types/domain";

interface UseProductionOptions {
  /** Current recipes (used to resolve BOM lines when completing a run). */
  recipes: Recipe[];
  /**
   * Inventory-owned ingredient deduction for completed batches. Injected by
   * the app shell so stock updates stay owned by useInventory.
   */
  deductRecipeLines: (lines: RecipeIngredientLine[], batches: number) => void;
  /** Inventory-owned stock increase for the produced menu item. */
  addMenuStock: (menuItemId: MenuItemId, amount: number) => void;
}

/**
 * Owns the production runs feature: scheduling, completion and deletion.
 */
export function useProduction({
  recipes,
  deductRecipeLines,
  addMenuStock,
}: UseProductionOptions) {
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>(initialProductionRuns);

  const scheduleProductionRun = (data: ScheduleRunData) => {
    setProductionRuns((prev) => [
      ...prev,
      {
        id: `PR-${String(prev.length + 1).padStart(3, "0")}`,
        recipeId: data.recipeId,
        plannedQty: data.plannedQty,
        plannedDate: data.plannedDate,
        notes: data.notes,
        status: "scheduled",
        completedDate: null,
      },
    ]);
  };

  const completeProductionRun = (id: ProductionRunId) => {
    const run = productionRuns.find((r) => r.id === id);
    const recipe = recipes.find((r) => r.id === run?.recipeId);
    if (!run || !recipe) return;

    const batches = computeBatches(run.plannedQty, recipe);
    const actualYield = batches * (Number(recipe.yieldQty) || 0);

    deductRecipeLines(recipe.ingredients, batches);
    addMenuStock(recipe.id, actualYield);

    setProductionRuns((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "completed",
              completedDate: new Date().toISOString().slice(0, 10),
              actualYield,
              batches,
            }
          : r
      )
    );
  };

  const deleteProductionRun = (id: ProductionRunId) => {
    setProductionRuns((prev) =>
      prev.filter((r) => r.id !== id || r.status === "completed")
    );
  };

  return {
    productionRuns,
    scheduleProductionRun,
    completeProductionRun,
    deleteProductionRun,
  };
}