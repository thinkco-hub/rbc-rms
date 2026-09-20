import React, { useState } from "react";
import { computeRecipeCost, suggestedPrice } from "../../utils/pricing";
import type { FormEvent } from "react";
import type {
  IngredientStock,
  MenuItemStock,
  PricingRules,
  Recipe,
  RecipeInput,
} from "../../types/domain";

const emptyLine = () => ({ ingredientId: "", qty: "", unit: "" });

const clampMargin = (value: number) => Math.min(Math.max(value, 0), 95);

const TIER_LABELS = ["Conservative", "Standard", "Premium"];

interface RecipeEditorProps {
  recipe: Recipe | null;
  ingredients: IngredientStock[];
  menuInventory: MenuItemStock[];
  pricingRules: PricingRules;
  onCancel: () => void;
  onSave: (recipe: RecipeInput) => void;
}

/** Editor form state: yieldQty is a raw string while typing. */
type RecipeEditorForm = Omit<RecipeInput, "yieldQty" | "ingredients"> & {
  yieldQty: string | number;
  ingredients: Array<{ ingredientId: string; qty: string | number; unit: string }>;
};

export default function RecipeEditor({ recipe, ingredients, menuInventory, pricingRules, onCancel, onSave }: RecipeEditorProps) {
  const isNew = !recipe;
  const [form, setForm] = useState<RecipeEditorForm>(
    recipe || {
      id: null,
      menuItemId: menuInventory[0]?.id || "",
      name: "",
      yieldQty: "",
      yieldUnit: "pcs",
      ingredients: [emptyLine()],
    }
  );

  const [marginTiers, setMarginTiers] = useState<Array<number | "">>(() => {
    const base = Number(pricingRules.targetMarginPercent) || 40;
    return [clampMargin(base - 10), clampMargin(base), clampMargin(base + 10)];
  });

  const updateMarginTier = (idx: number, value: string) => {
    setMarginTiers((prev) =>
      prev.map((m, i) => (i === idx ? (value === "" ? "" : clampMargin(parseFloat(value) || 0)) : m))
    );
  };

  const updateField = (field: "menuItemId" | "name" | "yieldUnit" | "yieldQty", value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateLine = (idx: number, field: "ingredientId" | "qty" | "unit", value: string) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((line, i) =>
        i === idx ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addLine = () =>
    setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyLine()] }));

  const removeLine = (idx: number) =>
    setForm((prev) => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }));

  const normalizedForCalc = {
    ...form,
    id: form.id || "",
    yieldQty: parseFloat(String(form.yieldQty)) || 0,
    ingredients: form.ingredients
      .filter((l) => l.ingredientId)
      .map((l) => ({ ...l, qty: parseFloat(String(l.qty)) || 0 })),
  } as Recipe;
  const { totalCost, costPerUnit } = computeRecipeCost(normalizedForCalc, ingredients);
  const linkedMenuItem = menuInventory.find((m) => m.id === form.menuItemId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.menuItemId || !form.yieldQty) return;
    const cleanIngredients = form.ingredients
      .filter((l) => l.ingredientId && l.qty !== "")
      .map((l) => ({ ...l, qty: parseFloat(String(l.qty)) || 0 }));
    if (cleanIngredients.length === 0) return;
    onSave({
      id: form.id,
      menuItemId: form.menuItemId,
      name: form.name,
      yieldQty: parseFloat(String(form.yieldQty)),
      yieldUnit: form.yieldUnit,
      ingredients: cleanIngredients,
    });
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <div className="flex items-center text-[15px] mb-6 text-gray-500 font-medium tracking-wide">
        <button onClick={onCancel} className="hover:text-[#F17D0C] transition-colors">
          Recipes
        </button>
        <span className="mx-2 text-gray-400">&gt;</span>
        <span className="text-[#121212] font-bold">{isNew ? "New Recipe" : "Edit Recipe"}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-[#121212] mb-4">Recipe Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Recipe Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Linked Menu Item</label>
                  <select
                    value={form.menuItemId}
                    onChange={(e) => updateField("menuItemId", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                  >
                    {menuInventory.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Yield Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.yieldQty}
                      onChange={(e) => updateField("yieldQty", e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Yield Unit</label>
                    <input
                      type="text"
                      value={form.yieldUnit}
                      onChange={(e) => updateField("yieldUnit", e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#121212]">Ingredients (per batch)</h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-sm font-bold text-[#F17D0C] hover:underline"
                >
                  + Add Ingredient
                </button>
              </div>
              <div className="space-y-3">
                {form.ingredients.map((line, idx) => {
                  const ingredient = ingredients.find((i) => i.id === line.ingredientId);
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <select
                        value={line.ingredientId}
                        onChange={(e) => {
                          const selected = ingredients.find((i) => i.id === e.target.value);
                          updateLine(idx, "ingredientId", e.target.value);
                          if (selected) updateLine(idx, "unit", selected.unit);
                        }}
                        className="flex-1 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                      >
                        <option value="">Select ingredient...</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Qty"
                        value={line.qty}
                        onChange={(e) => updateLine(idx, "qty", e.target.value)}
                        className="w-full sm:w-28 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                      />
                      <span className="w-16 text-sm text-gray-500 font-medium">
                        {ingredient?.unit || line.unit || ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-4">
              <h3 className="text-lg font-bold text-[#121212] mb-4">Live Cost Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Total Batch Cost</span>
                  <span className="text-gray-900">₱{totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Cost per Unit</span>
                  <span className="text-gray-900">₱{costPerUnit.toFixed(2)}</span>
                </div>
                {typeof linkedMenuItem?.price === "number" && (
                  <div className="flex justify-between text-gray-600 font-medium border-b border-gray-200 pb-3">
                    <span>Current Actual Price</span>
                    <span className="text-gray-900">₱{linkedMenuItem.price.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-5 border-t border-gray-200">
                <h4 className="text-sm font-bold text-[#121212] mb-3">
                  Suggested Prices <span className="text-gray-400 font-normal">(customizable margin)</span>
                </h4>
                <div className="space-y-3">
                  {marginTiers.map((margin, idx) => {
                    const tierPrice = suggestedPrice(costPerUnit, margin);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 bg-[#FDF9F3] border border-[#F3B978]/60 rounded-lg px-3 py-2.5"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#562D07]/70 uppercase tracking-wide">
                            {TIER_LABELS[idx]}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="number"
                              min="0"
                              max="95"
                              value={margin}
                              onChange={(e) => updateMarginTier(idx, e.target.value)}
                              className="w-14 px-1.5 py-1 border border-gray-300 rounded text-xs font-bold text-gray-800 text-right focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none"
                            />
                            <span className="text-xs text-gray-500 font-medium">% margin</span>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-[#F17D0C]">₱{tierPrice.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
