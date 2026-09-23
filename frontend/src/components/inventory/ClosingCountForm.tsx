import React, { useState } from "react";
import type { FormEvent } from "react";
import type {
  ClosingCountEntry,
  ClosingCountSubmission,
  IngredientStock,
  InventoryItemCategory,
  MenuItemStock,
} from "../../types/domain";

const today = () => new Date().toISOString().slice(0, 10);

type CountMap = Record<string, string>;

function CountSection({
  title,
  icon,
  items,
  counts,
  onUpdate,
}: {
  title: string;
  icon: string;
  items: (MenuItemStock | IngredientStock)[];
  counts: CountMap;
  onUpdate: (id: string, value: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
      <h3 className="text-base font-bold text-[#121212] mb-4">
        {icon} {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[420px]">
          <thead>
            <tr className="bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Counted Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-3 text-gray-500">{("unit" in item && item.unit) || "pcs"}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={counts[item.id] ?? ""}
                    onChange={(e) => onUpdate(item.id, e.target.value)}
                    placeholder="Enter count"
                    className="w-32 px-2 py-1.5 border border-gray-300 rounded-md text-right focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ClosingCountFormProps {
  menuInventory: MenuItemStock[];
  ingredients: IngredientStock[];
  onSubmit: (submission: ClosingCountSubmission) => void;
  onBack: () => void;
}

export default function ClosingCountForm({ menuInventory, ingredients, onSubmit, onBack }: ClosingCountFormProps) {
  const [date, setDate] = useState(today());
  const [menuCounts, setMenuCounts] = useState<CountMap>({});
  const [ingredientCounts, setIngredientCounts] = useState<CountMap>({});
  const [submittedMsg, setSubmittedMsg] = useState("");

  const updateMenuCount = (id: string, value: string) => setMenuCounts((prev) => ({ ...prev, [id]: value }));
  const updateIngredientCount = (id: string, value: string) =>
    setIngredientCounts((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const menuEntries: ClosingCountEntry[] = menuInventory
      .filter((item) => menuCounts[item.id] !== undefined && menuCounts[item.id] !== "")
      .map((item) => ({
        itemId: item.id,
        itemType: "menu" as InventoryItemCategory,
        systemQty: item.qty,
        countedQty: parseFloat(menuCounts[item.id]) || 0,
      }));

    const ingredientEntries: ClosingCountEntry[] = ingredients
      .filter((item) => ingredientCounts[item.id] !== undefined && ingredientCounts[item.id] !== "")
      .map((item) => ({
        itemId: item.id,
        itemType: "ingredient" as InventoryItemCategory,
        systemQty: item.qty,
        countedQty: parseFloat(ingredientCounts[item.id]) || 0,
      }));

    const entries = [...menuEntries, ...ingredientEntries];
    if (entries.length === 0) return;

    onSubmit({ date, entries });
    setMenuCounts({});
    setIngredientCounts({});
    setSubmittedMsg(`Closing count for ${date} submitted for review.`);
    setTimeout(() => setSubmittedMsg(""), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-10 w-full">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-4 text-sm font-semibold text-[#562D07]/70 hover:text-[#562D07] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Inventory
      </button>

      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#562D07]">Closing Inventory Count</h2>
        <p className="text-[#562D07]/70 mt-1 font-medium text-sm md:text-base">
          End-of-day physical count — menu items and raw materials. Enter what you physically counted;
          system stock is only compared afterward during reconciliation.
        </p>
      </header>

      {submittedMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg px-4 py-3 mb-4">
          {submittedMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Count Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              required
            />
          </div>
        </div>

        <CountSection
          title="Menu Items"
          icon="📦"
          items={menuInventory}
          counts={menuCounts}
          onUpdate={updateMenuCount}
        />
        <CountSection
          title="Raw Materials"
          icon="🛒"
          items={ingredients}
          counts={ingredientCounts}
          onUpdate={updateIngredientCount}
        />

        <button
          type="submit"
          className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
        >
          Submit Closing Count
        </button>
      </form>
    </div>
  );
}
