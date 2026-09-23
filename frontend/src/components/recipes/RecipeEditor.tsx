import React, { useState } from "react";
import { computeRecipeCost, suggestedPrice } from "../../utils/pricing";
import type { FormEvent } from "react";
import type {
  IngredientStock,
  PosItemCategory,
  PricingRules,
  Recipe,
  RecipeInput,
} from "../../types/domain";

const emptyLine = () => ({ ingredientId: "", qty: "", unit: "" });

const clampMargin = (value: number) => Math.min(Math.max(value, 0), 95);

const TIER_LABELS = ["Conservative", "Standard", "Premium"];

const CATEGORY_OPTIONS: PosItemCategory[] = ["Pastries", "Bread", "Cakes", "Drinks"];

interface RecipeEditorProps {
  recipe: Recipe | null;
  ingredients: IngredientStock[];
  pricingRules: PricingRules;
  onCancel: () => void;
  onSave: (recipe: RecipeInput) => void;
}

/** Editor form state: numeric fields are raw strings while typing. */
type RecipeEditorForm = Omit<RecipeInput, "yieldQty" | "ingredients" | "price" | "qty" | "target"> & {
  yieldQty: string | number;
  price: string | number;
  qty: string | number;
  target: string | number;
  ingredients: Array<{ ingredientId: string; qty: string | number; unit: string }>;
};

export default function RecipeEditor({ recipe, ingredients, pricingRules, onCancel, onSave }: RecipeEditorProps) {
  const isNew = !recipe;
  const [form, setForm] = useState<RecipeEditorForm>(() =>
    recipe
      ? { ...recipe, yieldQty: recipe.yieldQty ?? "", yieldUnit: recipe.yieldUnit ?? "pcs" }
      : {
          id: null,
          name: "",
          type: "Menu Item",
          category: "Pastries",
          price: "",
          qty: "",
          target: "",
          shelfLife: "",
          yieldQty: "",
          yieldUnit: "pcs",
          ingredients: [],
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

  const updateField = (
    field: "name" | "price" | "qty" | "target" | "shelfLife" | "yieldUnit" | "yieldQty",
    value: string
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateCategory = (value: PosItemCategory) =>
    setForm((prev) => ({ ...prev, category: value }));

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || form.price === "" || form.qty === "" || form.target === "" || !form.shelfLife) {
      return;
    }
    const cleanIngredients = form.ingredients
      .filter((l) => l.ingredientId && l.qty !== "")
      .map((l) => ({ ...l, qty: parseFloat(String(l.qty)) || 0 }));
    const hasBom = cleanIngredients.length > 0;
    if (hasBom && (!form.yieldQty || !form.yieldUnit)) return;
    const hasYield = form.yieldQty !== "" && !!form.yieldUnit;

    onSave({
      id: form.id,
      name: form.name,
      type: "Menu Item",
      category: form.category,
      price: parseFloat(String(form.price)) || 0,
      qty: parseFloat(String(form.qty)) || 0,
      target: parseFloat(String(form.target)) || 0,
      shelfLife: form.shelfLife,
      yieldQty: hasYield ? parseFloat(String(form.yieldQty)) || 0 : undefined,
      yieldUnit: hasYield ? form.yieldUnit : undefined,
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateCategory(e.target.value as PosItemCategory)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Initial Qty on Hand</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.qty}
                    onChange={(e) => updateField("qty", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Target Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.target}
                    onChange={(e) => updateField("target", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Shelf Life</label>
                  <input
                    type="text"
                    placeholder="e.g. 24 Hours"
                    value={form.shelfLife}
                    onChange={(e) => updateField("shelfLife", e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    required
                  />
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Yield Qty <span className="text-gray-400 font-normal">(if made in batches)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.yieldQty}
                      onChange={(e) => updateField("yieldQty", e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Yield Unit</label>
                    <input
                      type="text"
                      value={form.yieldUnit}
                      onChange={(e) => updateField("yieldUnit", e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#121212]">Ingredients (per batch)</h3>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Optional — leave empty for simple items with no BOM.
                  </p>
                </div>
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
                <div className="flex justify-between text-gray-600 font-medium border-b border-gray-200 pb-3">
                  <span>Cost per Unit</span>
                  <span className="text-gray-900">₱{costPerUnit.toFixed(2)}</span>
                </div>
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
