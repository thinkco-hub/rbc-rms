import React, { useId, useState } from "react";
import Modal from "../common/Modal";
import { todayISO } from "../../utils/dates";
import { computeBatches } from "../../utils/production";
import type { FormEvent } from "react";
import type { Recipe, ScheduleRunData } from "../../types/domain";
import SelectField from "../common/SelectField";

const SELECT_BASE =
  "rounded-lg border border-gray-300 py-2.5 text-gray-800 outline-none focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)]";

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
    plannedDate: todayISO(),
    notes: "",
  });

  const recipe = recipes.find((r) => r.id === form.recipeId);
  const headingId = useId();
  const recipeFieldId = useId();
  const qtyFieldId = useId();
  const qtyUnitFieldId = useId();
  const dateFieldId = useId();
  const notesFieldId = useId();
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
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn max-h-[85dvh] flex flex-col overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 md:p-8">
          <h2 id={headingId} className="text-2xl font-bold text-[#121212] mb-1">Schedule Production Run</h2>
          <p className="text-gray-500 text-sm mb-6">Plan a batch run for a recipe.</p>

          <div className="space-y-4">
            <div>
              <label htmlFor={recipeFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Recipe</label>
              <SelectField
                id={recipeFieldId}
                value={form.recipeId}
                onChange={(e) => setForm({ ...form, recipeId: e.target.value })}
                className={`w-full pl-4 ${SELECT_BASE}`}
              >
                {recipes.length === 0 && <option value="">No recipes available</option>}
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div>
              <label htmlFor={qtyFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Quantity to Produce</label>
              <div className="flex gap-2">
                <input
                  id={qtyFieldId}
                  type="number"
                  min="1"
                  step={isBatchMode ? "1" : "any"}
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  className="min-w-0 flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                  required
                />
                <SelectField
                  id={qtyUnitFieldId}
                  value={form.qtyUnit}
                  onChange={(e) => setForm({ ...form, qtyUnit: e.target.value })}
                  aria-label="Quantity unit"
                  wrapperClassName="shrink-0"
                  className={`pl-3 font-medium ${SELECT_BASE}`}
                >
                  <option value="pcs">{recipe ? recipe.yieldUnit : "pcs"}</option>
                  <option value="batch">batch{qtyNum === 1 ? "" : "es"}</option>
                </SelectField>
              </div>
              {recipe && form.qty && isBatchMode && (
                <p className="text-xs text-gray-500 mt-1">
                  1 batch = {recipe.yieldQty} {recipe.yieldUnit} → {batches} batch{batches !== 1 ? "es" : ""} ={" "}
                  {plannedQtyUnits} {recipe.yieldUnit}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={dateFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Planned Date</label>
              <input
                id={dateFieldId}
                type="date"
                value={form.plannedDate}
                onChange={(e) => setForm({ ...form, plannedDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                required
              />
            </div>
            <div>
              <label htmlFor={notesFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
              <textarea
                id={notesFieldId}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                placeholder="Optional..."
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap gap-3 border-t border-gray-100 px-6 md:px-8 py-4 md:py-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[2.75rem] md:min-h-0 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold whitespace-nowrap hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={recipes.length === 0}
            className="flex-1 min-h-[2.75rem] md:min-h-0 px-4 py-3 rounded-xl text-white font-bold whitespace-nowrap bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Schedule Run
          </button>
        </div>
      </form>
    </Modal>
  );
}
