import { useState } from "react";
import { initialProductionRuns } from "../data/initialProductionRuns";
import { computeBatches } from "../utils/production";
import { recordAuditEvent } from "../utils/auditLog";
import { todayISO } from "../utils/dates";
import type {
  MenuItemId,
  ProductionRun,
  ProductionRunId,
  Recipe,
  RecipeIngredientLine,
  ScheduleRunData,
  User,
} from "../types/domain";

interface UseProductionOptions {
  /** Current recipes (used to resolve BOM lines when completing a run). */
  recipes: Recipe[];
  /**
   * Catalogue-owned ingredient deduction for completed batches. Injected by
   * the app shell so stock updates stay with their one owner.
   */
  deductRecipeLines: (lines: RecipeIngredientLine[], batches: number) => void;
  /** Catalogue-owned stock increase for the produced menu item. */
  addMenuStock: (menuItemId: MenuItemId, amount: number) => void;
  currentUser: User | null;
  /** Seeded runs; a test fixture replaces the value from src/data. */
  productionRuns?: ProductionRun[];
}

/**
 * Owns the production runs feature: scheduling, completion and deletion.
 */
export function useProduction({
  recipes,
  deductRecipeLines,
  addMenuStock,
  currentUser,
  productionRuns: seededProductionRuns,
}: UseProductionOptions) {
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>(
    seededProductionRuns ?? initialProductionRuns
  );

  const logProductionEvent = (
    action: "production.run_scheduled" | "production.run_completed" | "production.run_deleted",
    runId: ProductionRunId,
    details: string
  ) => {
    if (!currentUser) return;
    recordAuditEvent({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      entityType: "ProductionRun",
      entityId: runId,
      details,
    });
  };

  const scheduleProductionRun = (data: ScheduleRunData) => {
    const id: ProductionRunId = `PR-${String(productionRuns.length + 1).padStart(3, "0")}`;
    setProductionRuns((prev) => [
      ...prev,
      {
        id,
        recipeId: data.recipeId,
        plannedQty: data.plannedQty,
        plannedDate: data.plannedDate,
        notes: data.notes,
        status: "scheduled",
        completedDate: null,
      },
    ]);
    logProductionEvent(
      "production.run_scheduled",
      id,
      `Scheduled production run ${id} (${data.plannedQty} units on ${data.plannedDate})`
    );
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
              completedDate: todayISO(),
              actualYield,
              batches,
            }
          : r
      )
    );
    logProductionEvent(
      "production.run_completed",
      id,
      `Completed production run ${id} (${batches} batches, yield ${actualYield})`
    );
  };

  const deleteProductionRun = (id: ProductionRunId) => {
    const run = productionRuns.find((r) => r.id === id);
    if (!run || run.status === "completed") return;

    setProductionRuns((prev) => prev.filter((r) => r.id !== id));
    logProductionEvent("production.run_deleted", id, `Deleted production run ${id}`);
  };

  return {
    productionRuns,
    scheduleProductionRun,
    completeProductionRun,
    deleteProductionRun,
  };
}