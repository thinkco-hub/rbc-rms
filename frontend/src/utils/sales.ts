import type {
  DateFilterRange,
  DatePreset,
  DatePresetId,
  ISODate,
  ItemSalesLine,
  MenuItemId,
  PaymentMethod,
  RevenueByDay,
  RevenueByPaymentMethod,
  Sale,
  SalesSummary,
} from "../types/domain";

export function saleDateKey(sale: Sale): ISODate {
  return sale.createdAt.slice(0, 10);
}

export function filterSalesByRange(
  sales: Sale[],
  startDate: ISODate | "",
  endDate: ISODate | ""
): Sale[] {
  if (!startDate && !endDate) return sales;
  return sales.filter((sale) => {
    const key = saleDateKey(sale);
    if (startDate && key < startDate) return false;
    if (endDate && key > endDate) return false;
    return true;
  });
}

export const DATE_PRESETS: readonly DatePreset[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 Days" },
  { id: "month", label: "Last 30 Days" },
  { id: "all", label: "All Time" },
];

export function getPresetRange(
  preset: DatePresetId,
  today: Date = new Date()
): DateFilterRange {
  const end = today.toISOString().slice(0, 10);
  if (preset === "all") return { start: "", end: "" };
  if (preset === "today") return { start: end, end };

  const start = new Date(today);
  if (preset === "week") start.setDate(start.getDate() - 6);
  else if (preset === "month") start.setDate(start.getDate() - 29);
  else return { start: "", end: "" };

  return { start: start.toISOString().slice(0, 10), end };
}

export function computeSalesSummary(sales: Sale[]): SalesSummary {
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalTax = sales.reduce((sum, s) => sum + s.tax, 0);
  const totalTransactions = sales.length;
  const avgTicket = totalTransactions ? totalRevenue / totalTransactions : 0;
  return { totalRevenue, totalTax, totalTransactions, avgTicket };
}

export function getItemSalesBreakdown(sales: Sale[]): ItemSalesLine[] {
  const map = new Map<MenuItemId, ItemSalesLine>();
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const existing = map.get(item.id) || {
        id: item.id,
        name: item.name,
        qty: 0,
        revenue: 0,
      };
      existing.qty += item.qty;
      existing.revenue += item.qty * item.price;
      map.set(item.id, existing);
    });
  });
  return Array.from(map.values());
}

export function getBestSellers(sales: Sale[], limit = 5): ItemSalesLine[] {
  return getItemSalesBreakdown(sales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

export function getWorstSellers(sales: Sale[], limit = 5): ItemSalesLine[] {
  return getItemSalesBreakdown(sales)
    .sort((a, b) => a.qty - b.qty)
    .slice(0, limit);
}

export function getRevenueByDay(sales: Sale[]): RevenueByDay[] {
  const map = new Map<ISODate, number>();
  sales.forEach((sale) => {
    const key = saleDateKey(sale);
    map.set(key, (map.get(key) || 0) + sale.total);
  });
  return Array.from(map.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getRevenueByPaymentMethod(sales: Sale[]): RevenueByPaymentMethod[] {
  const map = new Map<PaymentMethod, number>();
  sales.forEach((sale) => {
    map.set(sale.paymentMethod, (map.get(sale.paymentMethod) || 0) + sale.total);
  });
  return Array.from(map.entries()).map(([method, revenue]) => ({ method, revenue }));
}

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function salesToCSV(sales: Sale[]): string {
  const header: unknown[] = [
    "Sale ID",
    "Date",
    "Type",
    "Customer",
    "Payment Method",
    "Items",
    "Subtotal",
    "Tax",
    "Total",
  ];
  const rows = sales.map((sale): unknown[] => [
    sale.id,
    new Date(sale.createdAt).toLocaleString(),
    sale.type,
    sale.customerName,
    sale.paymentMethod,
    sale.items.map((i) => `${i.qty}x ${i.name}`).join("; "),
    sale.subtotal.toFixed(2),
    sale.tax.toFixed(2),
    sale.total.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}