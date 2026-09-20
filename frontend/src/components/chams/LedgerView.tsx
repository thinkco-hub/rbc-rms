import React from "react";
import { formatMonthLabel, shiftMonthKey, buildLedgerForMonth, computeBranchProfitForMonth } from "../../utils/ledger";
import { discrepancyLabel } from "../../utils/counts";
import type {
  ChamsBeginning,
  ChamsBranch,
  ChamsCount,
  ChamsMovement,
  ChamsProduct,
} from "../../types/domain";

export default function LedgerView({ branches, products, beginnings, movements, counts, month, onMonthChange }: {
  branches: ChamsBranch[];
  products: ChamsProduct[];
  beginnings: ChamsBeginning[];
  movements: ChamsMovement[];
  counts: ChamsCount[];
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const rows = buildLedgerForMonth(branches, products, month, beginnings, movements, counts).sort(
    (a, b) => a.branchName.localeCompare(b.branchName) || a.productName.localeCompare(b.productName)
  );
  const flaggedCount = rows.filter((r) => r.flagged).length;
  const notSubmittedCount = rows.filter((r) => !r.countSubmitted).length;
  const totalRemaining = rows.reduce((sum, r) => sum + r.remainingCalculated, 0);
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0);

  const branchProfits = branches.map((branch) => ({
    branch,
    profit: computeBranchProfitForMonth(branch, products, month, beginnings, movements, counts),
  }));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1B2A4A]">Branch Stock Ledger</h2>
          <p className="text-[#1B2A4A]/70 mt-1 font-medium text-sm md:text-base">
            Beginning, restocked, spoilage, sold and remaining siopao stock per branch.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm">
          <button
            onClick={() => onMonthChange(shiftMonthKey(month, -1))}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
            title="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-bold text-[#1B2A4A] w-32 text-center">{formatMonthLabel(month)}</span>
          <button
            onClick={() => onMonthChange(shiftMonthKey(month, 1))}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
            title="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Branches</p>
          <p className="text-xl md:text-2xl font-bold text-[#1B2A4A]">{branches.length}</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Flagged Discrepancies</p>
          <p className="text-xl md:text-2xl font-bold text-red-600">{flaggedCount}</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Total Remaining (Calc.)</p>
          <p className="text-xl md:text-2xl font-bold text-[#1B2A4A]">{totalRemaining}</p>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-green-100 shadow-sm">
          <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">Total Profit</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">₱{totalProfit.toFixed(2)}</p>
        </div>
      </div>

      {notSubmittedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium rounded-lg px-4 py-3 mb-4">
          {notSubmittedCount} branch/siopao combo{notSubmittedCount !== 1 ? "s" : ""} without a remaining count for{" "}
          {formatMonthLabel(month)} yet.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-[#1B2A4A] mb-4">Profit by Branch</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {branchProfits.map(({ branch, profit }) => (
            <div key={branch.id} className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium text-gray-500 mb-1">{branch.name}</p>
              <p className="text-lg font-bold text-[#1B2A4A]">₱{profit.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1020px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-5 py-4">Branch</th>
                <th className="px-5 py-4">Siopao Type</th>
                <th className="px-5 py-4 text-right">Beginning</th>
                <th className="px-5 py-4 text-right">Restocked</th>
                <th className="px-5 py-4 text-right">Spoilage</th>
                <th className="px-5 py-4 text-right">Sold</th>
                <th className="px-5 py-4 text-right">Profit</th>
                <th className="px-5 py-4 text-right">Remaining (Calc.)</th>
                <th className="px-5 py-4 text-right">Remaining (Reported)</th>
                <th className="px-5 py-4">Discrepancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {rows.map((r) => (
                <tr
                  key={`${r.branchId}-${r.productId}`}
                  className={`hover:bg-gray-50/50 transition-colors ${r.flagged ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-5 py-4 font-medium text-gray-900">{r.branchName}</td>
                  <td className="px-5 py-4 text-gray-600">{r.productName}</td>
                  <td className="px-5 py-4 text-right text-gray-600">{r.beginning}</td>
                  <td className="px-5 py-4 text-right text-gray-600">{r.restocked}</td>
                  <td className="px-5 py-4 text-right text-gray-600">{r.spoilage}</td>
                  <td className="px-5 py-4 text-right text-gray-600">{r.sold}</td>
                  <td className="px-5 py-4 text-right text-green-700 font-medium">₱{r.profit.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-gray-900">{r.remainingCalculated}</td>
                  <td className="px-5 py-4 text-right text-gray-600">
                    {r.countSubmitted ? r.remainingReported : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    {!r.countSubmitted ? (
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        Not Submitted
                      </span>
                    ) : r.flagged ? (
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                        {discrepancyLabel(r.discrepancy as number)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        Match
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
