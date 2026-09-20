import React, { useMemo, useState } from "react";
import RevenueByDayChart from "./RevenueByDayChart";
import SellerBarList from "./SellerBarList";
import {
  DATE_PRESETS,
  getPresetRange,
  filterSalesByRange,
  computeSalesSummary,
  getBestSellers,
  getWorstSellers,
  getRevenueByDay,
  getRevenueByPaymentMethod,
  salesToCSV,
  downloadCSV,
} from "../../utils/sales";
import type { DatePresetId, Sale } from "../../types/domain";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-gray-500 text-xs md:text-sm font-medium mb-1">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${accent || "text-[#121212]"}`}>{value}</p>
    </div>
  );
}

interface ReportsDashboardProps {
  sales: Sale[];
  onReprintSale?: (sale: Sale) => void;
}

export default function ReportsDashboard({ sales, onReprintSale }: ReportsDashboardProps) {
  const [preset, setPreset] = useState<DatePresetId | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = useMemo(() => {
    if (preset === "custom") return { start: customStart, end: customEnd };
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  const filteredSales = useMemo(() => {
    return filterSalesByRange(sales, range.start, range.end).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [sales, range.start, range.end]);

  const summary = useMemo(() => computeSalesSummary(filteredSales), [filteredSales]);
  const bestSellers = useMemo(() => getBestSellers(filteredSales, 5), [filteredSales]);
  const worstSellers = useMemo(() => getWorstSellers(filteredSales, 5), [filteredSales]);
  const revenueByDay = useMemo(() => getRevenueByDay(filteredSales), [filteredSales]);
  const byPaymentMethod = useMemo(() => getRevenueByPaymentMethod(filteredSales), [filteredSales]);

  const handleExport = () => {
    const csv = salesToCSV(filteredSales);
    const label = preset === "custom" ? `${customStart || "start"}_to_${customEnd || "end"}` : preset;
    downloadCSV(`sales-report-${label}.csv`, csv);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Sales Reports</h2>
          <p className="text-gray-500 mt-1">Revenue, best/worst sellers, and exportable sales logs.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredSales.length === 0}
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

      {/* Date range filter — one row, presets before custom */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              preset === p.id
                ? "bg-[#562D07] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              setPreset("custom");
            }}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:ring-1 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setPreset("custom");
            }}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:ring-1 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard label="Total Revenue" value={`₱${summary.totalRevenue.toFixed(2)}`} accent="text-[#F17D0C]" />
        <StatCard label="Transactions" value={summary.totalTransactions} />
        <StatCard label="Avg Ticket" value={`₱${summary.avgTicket.toFixed(2)}`} />
        <StatCard label="Tax Collected" value={`₱${summary.totalTax.toFixed(2)}`} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-[#121212] mb-4">Revenue by Day</h3>
        <RevenueByDayChart data={revenueByDay} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-[#121212] mb-4">Best Sellers</h3>
          <SellerBarList items={bestSellers} barColor="bg-[#F17D0C]" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-[#121212] mb-4">Worst Sellers</h3>
          <SellerBarList items={worstSellers} barColor="bg-gray-400" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-[#121212] mb-4">Revenue by Payment Method</h3>
        {byPaymentMethod.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions in this range.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {byPaymentMethod.map((m) => (
              <div key={m.method} className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 mb-1">{m.method}</p>
                <p className="text-lg font-bold text-[#121212]">₱{m.revenue.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#121212]">Sales Log</h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-3">Sale</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No sales found in the selected range.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-gray-900">{sale.id}</td>
                    <td className="px-6 py-3 text-gray-600">{new Date(sale.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-3 text-gray-600">{sale.type}</td>
                    <td className="px-6 py-3 text-gray-800">{sale.customerName}</td>
                    <td className="px-6 py-3 text-gray-600">{sale.paymentMethod}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">₱{sale.total.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => onReprintSale?.(sale)}
                        title="View / Print Receipt"
                        className="p-2 rounded-lg text-gray-400 hover:text-[#F17D0C] hover:bg-orange-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                          />
                        </svg>
                      </button>
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
