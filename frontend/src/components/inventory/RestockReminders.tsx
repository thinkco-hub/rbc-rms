import React, { useState } from "react";
import type { FormEvent } from "react";
import type { IngredientStock, IngredientId, ISODate, RestockReminder, RestockReminderData } from "../../types/domain";

interface RestockRemindersProps {
  ingredients: IngredientStock[];
  reminders: RestockReminder[];
  onAdd: (data: RestockReminderData) => void;
  onToggleDone: (id: string) => void;
}

export default function RestockReminders({ ingredients, reminders, onAdd, onToggleDone }: RestockRemindersProps) {
  const [form, setForm] = useState<{ ingredientId: IngredientId; note: string; dueDate: ISODate | "" }>({
    ingredientId: ingredients[0]?.id || "",
    note: "",
    dueDate: "",
  });

  const ingredientName = (id: IngredientId) => ingredients.find((i) => i.id === id)?.name || id;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.ingredientId || !form.dueDate) return;
    onAdd(form);
    setForm({ ingredientId: ingredients[0]?.id || "", note: "", dueDate: "" });
  };

  const pending = reminders.filter((r) => !r.done);
  const done = reminders.filter((r) => r.done);

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#562D07]">Restock Reminders</h2>
        <p className="text-[#562D07]/70 mt-1 font-medium text-sm md:text-base">
          Manual reminders to reorder ingredients ahead of time
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-max">
          <h3 className="text-lg font-bold text-[#121212] mb-4">New Reminder</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Ingredient</label>
              <select
                value={form.ingredientId}
                onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Note</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                placeholder="Optional note..."
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
            >
              Add Reminder
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#121212]">
                Pending <span className="text-gray-400 font-medium text-sm">({pending.length})</span>
              </h3>
            </div>
            {pending.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">No pending reminders.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pending.map((r) => (
                  <li key={r.id} className="p-5 flex items-start justify-between gap-4 hover:bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{ingredientName(r.ingredientId)}</p>
                      {r.note && <p className="text-sm text-gray-500 mt-0.5">{r.note}</p>}
                      <p className="text-xs text-gray-400 mt-1">Due {r.dueDate}</p>
                    </div>
                    <button
                      onClick={() => onToggleDone(r.id)}
                      className="px-3 py-1.5 rounded-md text-xs font-bold bg-orange-50 text-[#F17D0C] hover:bg-orange-100 transition-colors whitespace-nowrap"
                    >
                      Mark Done
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {done.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-[#121212]">
                  Completed <span className="text-gray-400 font-medium text-sm">({done.length})</span>
                </h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {done.map((r) => (
                  <li key={r.id} className="p-5 flex items-start justify-between gap-4 opacity-60">
                    <div>
                      <p className="font-bold text-gray-900 text-sm line-through">
                        {ingredientName(r.ingredientId)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Due {r.dueDate}</p>
                    </div>
                    <button
                      onClick={() => onToggleDone(r.id)}
                      className="px-3 py-1.5 rounded-md text-xs font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
