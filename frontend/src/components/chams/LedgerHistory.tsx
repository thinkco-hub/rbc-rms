import React, { useState } from "react";
import { formatMonthLabel, buildLedgerHistoryForBranchProduct } from "../../utils/ledger";
import { discrepancyLabel } from "../../utils/counts";
import type { ChamsBeginning, ChamsBranch, ChamsCount, ChamsMovement, ChamsProduct, LedgerRow } from "../../types/domain";

function TrendBars({ rows }: { rows: LedgerRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.remainingCalculated));
  return (
    <div className="flex items-end gap-2" style={{ height: 140 }}>
      {rows.map((r) => {
        const height = Math.max(2, (r.remainingCalculated / max) * 120);
        return (
          <div key={r.month} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
            <span className="text-[10px] font-semibold text-gray-500 mb-1">{r.remainingCalculated}</span>
            <div
              className={`w-full max-w-[32px] rounded-t-[4px] ${r.flagged ? "bg-red-400" : "bg-[#3B5BA5]"}`}
              style={{ height }}
              title={`${r.branchName} — ${r.productName} — ${formatMonthLabel(r.month)}`}
            />
            <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
              {formatMonthLabel(r.month).split(" ")[0].slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface LedgerHistoryProps {
  branches: ChamsBranch[];
  products: ChamsProduct[];
  beginnings: ChamsBeginning[];
  movements: ChamsMovement[];
  counts: ChamsCount[];
}

export default function LedgerHistory({ branches, products, beginnings, movements, counts }: LedgerHistoryProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const branch = branches.find((b) => b.id === branchId);
  const product = products.find((p) => p.id === productId);
  const rows =
    branch && product ? buildLedgerHistoryForBranchProduct(branch, product, beginnings, movements, counts) : [];

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1B2A4A]">Ledger History</h2>
          <p className="text-[#1B2A4A]/70 mt-1 font-medium text-sm md:text-base">
            Multi-month trend of remaining stock per branch and siopao type.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B5BA5] focus:border-[#3B5BA5] outline-none text-gray-800 bg-white shadow-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B5BA5] focus:border-[#3B5BA5] outline-none text-gray-800 bg-white shadow-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-[#1B2A4A] mb-4">Remaining Stock (Calculated)</h3>
        <TrendBars rows={rows} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[940px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-5 py-4">Month</th>
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
                <tr key={r.month} className={`hover:bg-gray-50/50 transition-colors ${r.flagged ? "bg-red-50/40" : ""}`}>
                  <td className="px-5 py-4 font-medium text-gray-900">{formatMonthLabel(r.month)}</td>
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
