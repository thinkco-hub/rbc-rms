import React from "react";
import { computeBatches, computeRequiredIngredients, isRunFeasible } from "../../utils/production";
import type { IngredientStock, MenuItemStock, ProductionRun, ProductionRunId, Recipe } from "../../types/domain";

interface RunDetailModalProps {
  run: ProductionRun;
  recipe: Recipe;
  menuItem: MenuItemStock | undefined;
  ingredients: IngredientStock[];
  onClose: () => void;
  onComplete: (id: ProductionRunId) => void;
  onDelete: () => void;
}

export default function RunDetailModal({ run, recipe, menuItem, ingredients, onClose, onComplete, onDelete }: RunDetailModalProps) {
  const batches = computeBatches(run.plannedQty, recipe);
  const required = computeRequiredIngredients(run, recipe, ingredients);
  const feasible = isRunFeasible(run, recipe, ingredients);
  const actualYield = batches * (Number(recipe.yieldQty) || 0);
  const isCompleted = run.status === "completed";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-bold text-[#121212]">{recipe.name}</h2>
          {isCompleted ? (
            <span className="px-3 py-1 rounded-full border border-green-300 bg-green-50 text-green-700 text-xs font-bold">
              Completed
            </span>
          ) : feasible ? (
            <span className="px-3 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 text-xs font-bold">
              Scheduled
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 text-xs font-bold">
              Insufficient Stock
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm mb-6">
          {menuItem ? menuItem.name : "—"} · Planned {run.plannedDate}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">Planned Qty</p>
            <p className="font-bold text-[#121212]">
              {run.plannedQty} {recipe.yieldUnit}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">Batches</p>
            <p className="font-bold text-[#121212]">{batches}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">Batch Yield</p>
            <p className="font-bold text-[#121212]">
              {actualYield} {recipe.yieldUnit}
            </p>
          </div>
        </div>

        {run.notes && (
          <div className="bg-[#fff6ef] rounded-lg p-3 text-sm text-[#562D07] font-medium mb-6">{run.notes}</div>
        )}

        <h3 className="text-sm font-bold text-gray-700 mb-3">Required Ingredients</h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Ingredient</th>
                <th className="px-4 py-2.5 text-right">Required</th>
                <th className="px-4 py-2.5 text-right">In Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {required.map((line) => (
                <tr key={line.ingredientId} className={line.shortfall > 0 ? "bg-red-50/50" : ""}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{line.name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {line.requiredQty} {line.unit}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${
                      line.shortfall > 0 ? "text-red-600" : "text-gray-700"
                    }`}
                  >
                    {line.inStock} {line.unit}
                    {line.shortfall > 0 && (
                      <span className="block text-xs font-normal text-red-500">
                        short {line.shortfall} {line.unit}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isCompleted && !feasible && (
          <p className="text-xs text-red-600 font-medium mb-4">
            Completing this run will deduct available stock down to zero for short ingredients.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          {!isCompleted && (
            <>
              <button
                onClick={onDelete}
                className="py-3 px-4 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => onComplete(run.id)}
                className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
              >
                Mark Complete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
