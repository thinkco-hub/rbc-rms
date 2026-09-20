import type {
  ClosingInventoryReport,
  ClosingInventoryRow,
  DateRange,
  IngredientStock,
  InventoryCount,
  InventoryItemCategory,
  ISODate,
  MenuItemStock,
  MonthKey,
  StockItem,
} from "../types/domain";
import { computeDiscrepancy } from "./counts";

// ---- Date helpers (ISO "YYYY-MM-DD" keys, computed in local time) ----

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

// Weeks run Monday–Sunday (ISO).
export function getWeekRange(anchorISO: ISODate): DateRange {
  const d = parseISODate(anchorISO);
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + offsetToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

export function getMonthRange(monthKey: MonthKey): DateRange {
  const [y, m] = monthKey.split("-").map(Number);
  return {
    start: toISODate(new Date(y, m - 1, 1)),
    end: toISODate(new Date(y, m, 0)),
  };
}

export function shiftWeekRange(range: DateRange, delta: number): DateRange {
  const start = parseISODate(range.start);
  start.setDate(start.getDate() + delta * 7);
  return getWeekRange(toISODate(start));
}

export function shiftMonthKey(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---- Labels ----

export function formatWeekLabel(range: DateRange): string {
  const start = parseISODate(range.start);
  const end = parseISODate(range.end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `Week of ${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    { ...opts, year: "numeric" }
  )}`;
}

export function formatMonthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// ---- Closing inventory computation ----

// Latest physical count (from the Closing Count form) dated on or before the period end.
export function getLatestCountAtOrBefore(
  counts: InventoryCount[],
  itemId: string,
  itemType: InventoryItemCategory,
  endDate: ISODate
): InventoryCount | null {
  const matches = counts.filter(
    (c) => c.itemId === itemId && c.itemType === itemType && c.date <= endDate
  );
  if (matches.length === 0) return null;
  return matches.reduce<InventoryCount | null>(
    (latest, c) => (!latest || c.date > latest.date ? c : latest),
    null
  );
}

function buildRow(
  item: StockItem,
  itemType: InventoryItemCategory,
  periodEnd: ISODate,
  countsInPeriod: InventoryCount[],
  inventoryCounts: InventoryCount[]
): ClosingInventoryRow {
  const latest = getLatestCountAtOrBefore(inventoryCounts, item.id, itemType, periodEnd);
  const closingQty = latest ? latest.countedQty : item.qty;
  const unitValue =
    itemType === "menu"
      ? (item as MenuItemStock).price || 0
      : (item as IngredientStock).unitCost || 0;
  const periodCounts = countsInPeriod.filter(
    (c) => c.itemId === item.id && c.itemType === itemType
  );
  const discrepancyQty = periodCounts.reduce(
    (sum, c) => sum + (c.discrepancy ?? computeDiscrepancy(c.countedQty, c.systemQty)),
    0
  );

  return {
    id: item.id,
    name: item.name,
    category: itemType === "menu" ? "Menu Item" : "Raw Material",
    unit: (item as Partial<IngredientStock>).unit || "pcs",
    systemQty: item.qty,
    closingQty,
    closingSource: latest ? "counted" : "system",
    lastCountDate: latest ? latest.date : null,
    unitValue,
    closingValue: closingQty * unitValue,
    periodCountCount: periodCounts.length,
    discrepancyQty,
  };
}

export function computeClosingInventory(
  period: DateRange,
  menuInventory: MenuItemStock[],
  ingredients: IngredientStock[],
  inventoryCounts: InventoryCount[]
): ClosingInventoryReport {
  const countsInPeriod = inventoryCounts.filter(
    (c) => c.date >= period.start && c.date <= period.end
  );

  const menuRows = menuInventory.map((item) =>
    buildRow(item, "menu", period.end, countsInPeriod, inventoryCounts)
  );
  const ingredientRows = ingredients.map((item) =>
    buildRow(item, "ingredient", period.end, countsInPeriod, inventoryCounts)
  );

  const rows = [...menuRows, ...ingredientRows];
  const sumValue = (list: ClosingInventoryRow[]): number =>
    list.reduce((sum, r) => sum + r.closingValue, 0);
  const netDiscrepancyQty = rows.reduce((sum, r) => sum + r.discrepancyQty, 0);
  const netDiscrepancyValue = rows.reduce((sum, r) => sum + r.discrepancyQty * r.unitValue, 0);

  return {
    period,
    menuRows,
    ingredientRows,
    rows,
    summary: {
      totalValue: sumValue(rows),
      menuValue: sumValue(menuRows),
      ingredientValue: sumValue(ingredientRows),
      countedItems: rows.filter((r) => r.closingSource === "counted").length,
      systemItems: rows.filter((r) => r.closingSource === "system").length,
      netDiscrepancyQty,
      netDiscrepancyValue,
    },
  };
}

// ---- CSV export ----

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function closingInventoryToCSV(result: ClosingInventoryReport): string {
  const header: unknown[] = [
    "Item ID",
    "Item",
    "Category",
    "Unit",
    "System Qty",
    "Closing Qty",
    "Source",
    "Last Counted",
    "Unit Value",
    "Closing Value",
    "Discrepancy (Period)",
  ];
  const rowToCells = (r: ClosingInventoryRow): unknown[] => [
    r.id,
    r.name,
    r.category,
    r.unit,
    r.systemQty,
    r.closingQty,
    r.closingSource === "counted" ? "Counted" : "System",
    r.lastCountDate || "",
    r.unitValue.toFixed(2),
    r.closingValue.toFixed(2),
    r.discrepancyQty,
  ];

  const lines: unknown[][] = [header, ...result.rows.map(rowToCells)];
  lines.push([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "TOTAL CLOSING VALUE",
    result.summary.totalValue.toFixed(2),
    result.summary.netDiscrepancyQty,
  ]);
  return lines.map((row) => row.map(csvEscape).join(",")).join("\n");
}