import React, { useMemo, useState } from "react";
import RevenueByDayChart from "./RevenueByDayChart";
import SellerBarList from "./SellerBarList";
import EditSaleModal from "./EditSaleModal";
import { SearchIcon } from "../icons";
import { linkedSaleView } from "../../utils/checkout";
import { formatDateTime } from "../../utils/dates";
import { formatMoney } from "../../utils/money";
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
import type {
  DatePresetId,
  EditSaleInput,
  Order,
  PaymentMethod,
  PosProduct,
  RevenueByPaymentMethod,
  Sale,
  SaleId,
} from "../../types/domain";

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

const METHOD_COLORS: Record<PaymentMethod, string> = {
  Cash: "#F17D0C",
  GCash: "#3B5BA5",
  "Bank Transfer": "#562D07",
  Card: "#94A3B8",
};

/** Donut of the payment split (FR-3.8.2) — inline SVG, no chart dependency. */
function PaymentDonut({ data }: { data: RevenueByPaymentMethod[] }) {
  const total = data.reduce((sum, m) => sum + m.revenue, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const segments = data.reduce<
    { list: Array<RevenueByPaymentMethod & { fraction: number; dash: number; offset: number }>; offset: number }
  >(
    (acc, m) => {
      const fraction = total > 0 ? m.revenue / total : 0;
      const dash = fraction * circumference;
      return {
        list: [...acc.list, { ...m, fraction, dash, offset: acc.offset }],
        offset: acc.offset + dash,
      };
    },
    { list: [], offset: 0 }
  ).list;

  return (
    <div className="flex items-center gap-5 md:gap-6">
      <svg viewBox="0 0 120 120" className="w-32 h-32 md:w-36 md:h-36 -rotate-90 shrink-0">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="16" />
        {segments.map((s) => (
          <circle
            key={s.method}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={METHOD_COLORS[s.method]}
            strokeWidth="16"
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset}
          >
            <title>{`${s.method}: ${formatMoney(s.revenue)}`}</title>
          </circle>
        ))}
      </svg>
      <ul className="text-sm space-y-1.5">
        {segments.map((s) => (
          <li key={s.method} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: METHOD_COLORS[s.method] }}
            />
            <span className="text-gray-600">{s.method}</span>
            <span className="font-semibold text-gray-900">
              {Math.round(s.fraction * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ReportsDashboardProps {
  sales: Sale[];
  orders: Order[];
  /** POS projection of the catalogue, for the edit-sale item picker. */
  products: PosProduct[];
  onReprintSale?: (sale: Sale) => void;
  /** Omitted when sales are immutable (the backend keeps POS transactions read-only). */
  onSaveSaleEdit?: (id: SaleId, input: EditSaleInput) => void;
}

export default function ReportsDashboard({
  sales,
  orders,
  products,
  onReprintSale,
  onSaveSaleEdit,
}: ReportsDashboardProps) {
  const [preset, setPreset] = useState<DatePresetId | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const range = useMemo(() => {
    if (preset === "custom") return { start: customStart, end: customEnd };
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  // An Order-type sale reports as its linked order currently stands; a walk-in
  // reports as recorded.
  const reportSales = useMemo(
    () => sales.map((sale) => linkedSaleView(sale, orders)),
    [sales, orders]
  );

  const filteredSales = useMemo(() => {
    return filterSalesByRange(reportSales, range.start, range.end).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [reportSales, range.start, range.end]);

  const summary = useMemo(() => computeSalesSummary(filteredSales), [filteredSales]);
  const bestSellers = useMemo(() => getBestSellers(filteredSales, 5), [filteredSales]);
  const worstSellers = useMemo(() => getWorstSellers(filteredSales, 5), [filteredSales]);
  const revenueByDay = useMemo(() => getRevenueByDay(filteredSales), [filteredSales]);
  const byPaymentMethod = useMemo(() => getRevenueByPaymentMethod(filteredSales), [filteredSales]);

  const query = logSearch.toLowerCase();
  const logRows = filteredSales.filter(
    (sale) =>
      !logSearch ||
      sale.id.toLowerCase().includes(query) ||
      sale.customerName.toLowerCase().includes(query)
  );

  const handleExport = () => {
    const csv = salesToCSV(filteredSales);
    const label = preset === "custom" ? `${customStart || "start"}_to_${customEnd || "end"}` : preset;
    downloadCSV(`sales-report-${label}.csv`, csv);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      {editingSale && onSaveSaleEdit && (
        <EditSaleModal
          sale={editingSale}
          products={products}
          onClose={() => setEditingSale(null)}
          onSave={(input) => {
            onSaveSaleEdit(editingSale.id, input);
            setEditingSale(null);
          }}
        />
      )}

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
            aria-label="Report start date"
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setPreset("custom");
            }}
            aria-label="Report end date"
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatMoney(summary.totalRevenue)} accent="text-[var(--color-brand-text)]" />
        <StatCard label="Transactions" value={summary.totalTransactions} />
        <StatCard label="Avg Ticket" value={formatMoney(summary.avgTicket)} />
        <StatCard label="Tax Collected" value={formatMoney(summary.totalTax)} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-[#121212] mb-4">Revenue by Day</h3>
        <RevenueByDayChart data={revenueByDay} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-[#121212] mb-4">Best Sellers</h3>
          <SellerBarList items={bestSellers} barColor="bg-[var(--color-brand)]" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-[#121212] mb-4">Worst Sellers</h3>
          <SellerBarList items={worstSellers} barColor="bg-gray-400" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-[#121212] mb-4">Revenue by Payment Method</h3>
        {byPaymentMethod.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions in this range.</p>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <PaymentDonut data={byPaymentMethod} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              {byPaymentMethod.map((m) => (
                <div key={m.method} className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-medium text-gray-500 mb-1">{m.method}</p>
                  <p className="text-lg font-bold text-[#121212]">{formatMoney(m.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-bold text-[#121212]">Sales Log</h3>
          <div className="relative sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              aria-label="Search sales by sale number or customer"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 outline-none focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)]"
              placeholder="Search sale # or customer..."
            />
          </div>
        </div>
        <div
          className="overflow-x-auto w-full"
          tabIndex={0}
          role="region"
          aria-label="Sales log"
        >
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-3">Sale</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Edit</th>
                <th className="px-6 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {logRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {logSearch ? "No sales match your search." : "No sales found in the selected range."}
                  </td>
                </tr>
              ) : (
                logRows.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {sale.id}
                      {!!sale.editHistory?.length && (
                        <span
                          title={`Edited ${sale.editHistory.length} time${sale.editHistory.length === 1 ? "" : "s"}`}
                          className="ml-2 inline-block px-1.5 py-0.5 rounded-full bg-orange-50 text-[var(--color-brand-text)] text-[10px] font-bold uppercase tracking-wide"
                        >
                          Edited
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{formatDateTime(sale.createdAt)}</td>
                    <td className="px-6 py-3 text-gray-600">{sale.type}</td>
                    <td className="px-6 py-3 text-gray-800">{sale.customerName}</td>
                    <td className="px-6 py-3 text-gray-600">{sale.paymentMethod}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatMoney(sale.total)}</td>
                    <td className="px-6 py-3 text-right">
                      {/* A linked sale's order is its only editor. */}
                      {!sale.orderId && onSaveSaleEdit && (
                        <button
                          onClick={() => setEditingSale(sale)}
                          title="Edit sale details"
                          aria-label={`Edit sale ${sale.id}`}
                          className="p-2 rounded-lg text-gray-500 hover:text-[#562D07] hover:bg-orange-50 transition-colors"
                        >
                          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => onReprintSale?.(sale)}
                        title="View / Print Receipt"
                        aria-label={`View receipt for sale ${sale.id}`}
                        className="p-2 rounded-lg text-gray-500 hover:text-[var(--color-brand-text)] hover:bg-orange-50 transition-colors"
                      >
                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
