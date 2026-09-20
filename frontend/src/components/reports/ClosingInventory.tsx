import React, { useMemo, useState } from "react";
import { downloadCSV } from "../../utils/sales";
import { discrepancyLabel } from "../../utils/counts";
import {
  todayISO,
  getWeekRange,
  getMonthRange,
  shiftWeekRange,
  shiftMonthKey,
  monthKeyOf,
  formatWeekLabel,
  formatMonthLabel,
  computeClosingInventory,
  closingInventoryToCSV,
} from "../../utils/closingInventory";
import type {
  ClosingInventoryRow,
  IngredientStock,
  InventoryCount,
  ISODate,
  MenuItemStock,
} from "../../types/domain";

const pillCls = (active: boolean) =>
  `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
    active ? "bg-[#562D07] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`;

const navBtnCls =
  "px-3 py-1.5 rounded-md border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${accent || "text-[#121212]"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function DiscrepancyBadge({ row }: { row: ClosingInventoryRow }) {
  if (!row.periodCountCount) {
    return <span className="text-gray-300">—</span>;
  }
  const cls =
    row.discrepancyQty === 0
      ? "bg-green-50 text-green-700"
      : row.discrepancyQty > 0
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {discrepancyLabel(row.discrepancyQty)}
    </span>
  );
}

function ClosingSection({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: ClosingInventoryRow[];
  emptyText: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#121212]">
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3">Unit</th>
              <th className="px-6 py-3 text-right">System Qty</th>
              <th className="px-6 py-3 text-right">Closing Qty</th>
              <th className="px-6 py-3">Source</th>
              <th className="px-6 py-3 text-right">Unit Value</th>
              <th className="px-6 py-3 text-right">Closing Value</th>
              <th className="px-6 py-3">Count Discrepancy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-6 py-3 text-gray-500">{row.unit}</td>
                  <td className="px-6 py-3 text-right text-gray-500">{row.systemQty}</td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">{row.closingQty}</td>
                  <td className="px-6 py-3">
                    {row.closingSource === "counted" ? (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Counted {row.lastCountDate}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-600">₱{row.unitValue.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">
                    ₱{row.closingValue.toFixed(2)}
                  </td>
                  <td className="px-6 py-3">
                    <DiscrepancyBadge row={row} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ClosingInventoryProps {
  menuInventory: MenuItemStock[];
  ingredients: IngredientStock[];
  inventoryCounts: InventoryCount[];
}

export default function ClosingInventory({ menuInventory, ingredients, inventoryCounts }: ClosingInventoryProps) {
  const [view, setView] = useState<"week" | "month">("week");
  const [weekAnchor, setWeekAnchor] = useState<ISODate>(todayISO());
  const [monthKey, setMonthKey] = useState(monthKeyOf(todayISO()));

  const period = useMemo(
    () => (view === "week" ? getWeekRange(weekAnchor) : getMonthRange(monthKey)),
    [view, weekAnchor, monthKey]
  );

  const result = useMemo(
    () => computeClosingInventory(period, menuInventory, ingredients, inventoryCounts),
    [period, menuInventory, ingredients, inventoryCounts]
  );

  const periodLabel = view === "week" ? formatWeekLabel(period) : formatMonthLabel(monthKey);
  const canGoNext = period.end < todayISO();

  const goPrev = () => {
    if (view === "week") setWeekAnchor(shiftWeekRange(period, -1).start);
    else setMonthKey(shiftMonthKey(monthKey, -1));
  };

  const goNext = () => {
    if (!canGoNext) return;
    if (view === "week") setWeekAnchor(shiftWeekRange(period, 1).start);
    else setMonthKey(shiftMonthKey(monthKey, 1));
  };

  const handleExport = () => {
    const csv = closingInventoryToCSV(result);
    const label = view === "week" ? `${period.start}_to_${period.end}` : monthKey;
    downloadCSV(`closing-inventory-${label}.csv`, csv);
  };

  const { summary } = result;
  const discrepancyAccent =
    summary.netDiscrepancyQty === 0
      ? "text-[#121212]"
      : summary.netDiscrepancyQty > 0
      ? "text-amber-600"
      : "text-red-500";

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Closing Inventory</h2>
          <p className="text-gray-500 mt-1">
            Stock on hand and its value as of the close of a week or month.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={result.rows.length === 0}
          className="px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
          Export CSV
        </button>
      </header>

      {/* View toggle + period navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setView("week")} className={pillCls(view === "week")}>
          Weekly
        </button>
        <button onClick={() => setView("month")} className={pillCls(view === "month")}>
          Monthly
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
        <button onClick={goPrev} className={navBtnCls} title="Previous period">
          ‹ Prev
        </button>
        <span className="text-sm font-semibold text-gray-700 px-1 whitespace-nowrap">{periodLabel}</span>
        <button onClick={goNext} disabled={!canGoNext} className={navBtnCls} title="Next period">
          Next ›
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Total Closing Stock Value"
          value={`₱${summary.totalValue.toFixed(2)}`}
          accent="text-[#F17D0C]"
        />
        <StatCard
          label="Menu Items Value"
          value={`₱${summary.menuValue.toFixed(2)}`}
          sub={`${menuInventory.length} item(s)`}
        />
        <StatCard
          label="Raw Materials Value"
          value={`₱${summary.ingredientValue.toFixed(2)}`}
          sub={`${ingredients.length} item(s)`}
        />
        <StatCard
          label="Net Count Discrepancy"
          value={`${summary.netDiscrepancyQty > 0 ? "+" : ""}${summary.netDiscrepancyQty} unit(s)`}
          accent={discrepancyAccent}
          sub={`≈ ₱${summary.netDiscrepancyValue.toFixed(2)} · ${summary.countedItems} counted / ${summary.systemItems} system`}
        />
      </div>

      <ClosingSection
        title="Menu Items"
        rows={result.menuRows}
        emptyText="No menu items to report."
      />
      <ClosingSection
        title="Raw Materials"
        rows={result.ingredientRows}
        emptyText="No raw materials to report."
      />

      <p className="text-xs text-gray-400 leading-relaxed mt-2">
        Closing Qty is taken from the latest physical count on or before {period.end} (submitted via
        Inventory → Closing Count). Items without any count fall back to current system stock and are
        marked "System". Menu items are valued at selling price; raw materials at unit cost.
        Discrepancies reflect counts recorded inside the selected period.
      </p>
    </div>
  );
}
