import React, { useState } from "react";
import { computeBatches } from "../../utils/production";
import type { FormEvent } from "react";
import type { Recipe, ScheduleRunData } from "../../types/domain";

const today = () => new Date().toISOString().slice(0, 10);

interface ScheduleRunModalProps {
  recipes: Recipe[];
  onClose: () => void;
  onSchedule: (data: ScheduleRunData) => void;
}

export default function ScheduleRunModal({ recipes, onClose, onSchedule }: ScheduleRunModalProps) {
  const [form, setForm] = useState({
    recipeId: recipes[0]?.id || "",
    qty: "",
    qtyUnit: "pcs",
    plannedDate: today(),
    notes: "",
  });

  const recipe = recipes.find((r) => r.id === form.recipeId);
  const qtyNum = parseFloat(form.qty) || 0;
  const isBatchMode = form.qtyUnit === "batch";
  const batches = recipe ? (isBatchMode ? qtyNum : computeBatches(qtyNum, recipe)) : 0;
  const plannedQtyUnits = recipe ? (isBatchMode ? batches * (recipe.yieldQty || 1) : qtyNum) : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.recipeId || !recipe || qtyNum <= 0 || !form.plannedDate) return;
    onSchedule({
      recipeId: form.recipeId,
      plannedQty: plannedQtyUnits,
      plannedDate: form.plannedDate,
      notes: form.notes,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn"
      >
        <h2 className="text-2xl font-bold text-[#121212] mb-1">Schedule Production Run</h2>
        <p className="text-gray-500 text-sm mb-6">Plan a batch run for a recipe.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Recipe</label>
            <select
              value={form.recipeId}
              onChange={(e) => setForm({ ...form, recipeId: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
            >
              {recipes.length === 0 && <option value="">No recipes available</option>}
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity to Produce</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step={isBatchMode ? "1" : "any"}
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                required
              />
              <select
                value={form.qtyUnit}
                onChange={(e) => setForm({ ...form, qtyUnit: e.target.value })}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 font-medium"
              >
                <option value="pcs">{recipe ? recipe.yieldUnit : "pcs"}</option>
                <option value="batch">batch{qtyNum === 1 ? "" : "es"}</option>
              </select>
            </div>
            {recipe && form.qty && isBatchMode && (
              <p className="text-xs text-gray-500 mt-1">
                1 batch = {recipe.yieldQty} {recipe.yieldUnit} → {batches} batch{batches !== 1 ? "es" : ""} ={" "}
                {plannedQtyUnits} {recipe.yieldUnit}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Planned Date</label>
            <input
              type="date"
              value={form.plannedDate}
              onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              placeholder="Optional..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={recipes.length === 0}
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Schedule Run
          </button>
        </div>
      </form>
    </div>
  );
}
