import React from "react";
import { computeRecipeCost, suggestedPrice } from "../../utils/pricing";
import type {
  IngredientStock,
  MenuItemStock,
  PricingRuleInput,
  PricingRules,
  Recipe,
} from "../../types/domain";

interface RecipesListProps {
  recipes: Recipe[];
  ingredients: IngredientStock[];
  menuInventory: MenuItemStock[];
  pricingRules: PricingRules;
  onEditRule: (data: PricingRuleInput) => void;
  onEdit: (recipe: Recipe) => void;
  onCreate: () => void;
}

export default function RecipesList({
  recipes,
  ingredients,
  menuInventory,
  pricingRules,
  onEditRule,
  onEdit,
  onCreate,
}: RecipesListProps) {
  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Recipes / BOM</h2>
          <p className="text-gray-500 mt-1">
            One recipe per menu item, with live cost and suggested pricing.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          + New Recipe
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div>
          <h3 className="font-bold text-[#121212]">Pricing Rule</h3>
          <p className="text-sm text-gray-500">Target margin used to compute suggested prices.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="95"
            value={pricingRules.targetMarginPercent}
            onChange={(e) => onEditRule({ targetMarginPercent: e.target.value })}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 text-right font-bold"
          />
          <span className="text-gray-500 font-medium">% target margin</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-4">Recipe</th>
                <th className="px-6 py-4">Linked Menu Item</th>
                <th className="px-6 py-4">Yield</th>
                <th className="px-6 py-4 text-right">COGS / Unit</th>
                <th className="px-6 py-4 text-right">Suggested Price</th>
                <th className="px-6 py-4 text-right">Actual Price</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No recipes yet. Create one to see live COGS and pricing.
                  </td>
                </tr>
              ) : (
                recipes.map((recipe) => {
                  const { costPerUnit } = computeRecipeCost(recipe, ingredients);
                  const price = suggestedPrice(costPerUnit, pricingRules.targetMarginPercent);
                  const menuItem = menuInventory.find((m) => m.id === recipe.id);
                  const actualPrice = recipe.price;
                  const delta = actualPrice - price;
                  return (
                    <tr key={recipe.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{recipe.name}</td>
                      <td className="px-6 py-4 text-gray-600">{menuItem ? menuItem.name : "—"}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {recipe.yieldQty} {recipe.yieldUnit}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        ₱{costPerUnit.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-[#F17D0C]">
                        ₱{price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div>
                          <span className="font-bold text-gray-900">₱{actualPrice.toFixed(2)}</span>
                          <span
                            className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                              delta >= 0
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            ₱{delta.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => onEdit(recipe)}
                          className="text-gray-500 hover:text-[#F17D0C] hover:bg-orange-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
