import React, { useState } from "react";
import { discrepancyLabel } from "../../utils/counts";
import type {
  CountResolutionAction,
  IngredientStock,
  InventoryCount,
  MenuItemStock,
} from "../../types/domain";

const FILTERS = [
  { key: "flagged", label: "Flagged" },
  { key: "all", label: "All" },
  { key: "resolved", label: "Resolved" },
] as const;

type ReconciliationFilter = (typeof FILTERS)[number]["key"];

interface ReconciliationReviewProps {
  counts: InventoryCount[];
  menuInventory: MenuItemStock[];
  ingredients: IngredientStock[];
  onResolve: (id: string, action: CountResolutionAction) => void;
  onApplyAll: () => void;
}

export default function ReconciliationReview({
  counts,
  menuInventory,
  ingredients,
  onResolve,
  onApplyAll,
}: ReconciliationReviewProps) {
  const [filter, setFilter] = useState<ReconciliationFilter>("flagged");

  const itemName = (c: InventoryCount) => {
    const list = c.itemType === "ingredient" ? ingredients : menuInventory;
    return list.find((i) => i.id === c.itemId)?.name || c.itemId;
  };

  const flaggedPending = counts.filter((c) => c.discrepancy !== 0 && c.status === "pending");
  const resolved = counts.filter((c) => c.status === "resolved");

  const handleApplyAll = () => {
    if (
      !window.confirm(
        `Apply all ${flaggedPending.length} pending count${flaggedPending.length !== 1 ? "s" : ""}? This will adjust system stock to match each counted quantity.`
      )
    )
      return;
    onApplyAll();
  };

  let visible = counts;
  if (filter === "flagged") visible = flaggedPending;
  else if (filter === "resolved") visible = resolved;

  const sorted = [...visible].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#562D07]">Inventory Reconciliation</h2>
        <p className="text-[#562D07]/70 mt-1 font-medium text-sm md:text-base">
          Review discrepancies between counted and system stock
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Flagged (Pending)</p>
          <p className="text-xl md:text-2xl font-bold text-red-600">{flaggedPending.length}</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Total Counts Logged</p>
          <p className="text-xl md:text-2xl font-bold text-[#121212]">{counts.length}</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-green-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Resolved</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">{resolved.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded border text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleApplyAll}
          disabled={flaggedPending.length === 0}
          className="px-4 py-1.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          Apply All ({flaggedPending.length})
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">System Qty</th>
                <th className="px-6 py-4 text-right">Counted Qty</th>
                <th className="px-6 py-4 text-right">Discrepancy</th>
                <th className="px-6 py-4">Resolution</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {filter === "flagged" ? "No flagged discrepancies right now." : "No records in this view."}
                  </td>
                </tr>
              ) : (
                sorted.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{c.date}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{itemName(c)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-semibold uppercase">
                      {c.itemType === "ingredient" ? "Raw Material" : "Menu Item"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{c.systemQty}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{c.countedQty}</td>
                    <td
                      className={`px-6 py-4 text-right font-bold ${
                        c.discrepancy === 0 ? "text-gray-400" : c.discrepancy > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {discrepancyLabel(c.discrepancy)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {c.status === "pending" ? (
                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                          Pending
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full capitalize">
                          {c.resolution}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {c.status === "pending" && c.discrepancy !== 0 ? (
                        <>
                          <button
                            onClick={() => onResolve(c.id, "apply")}
                            className="text-[#F17D0C] hover:bg-orange-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                            title="Adjust system stock to match the counted quantity"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => onResolve(c.id, "dismiss")}
                            className="text-gray-400 hover:bg-gray-100 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                            title="Keep system stock as-is, discard this count"
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
