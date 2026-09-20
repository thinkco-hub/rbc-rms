import type { StockItem, StockStatus, StockStatusGroup } from "../types/domain";

export function getStockStatus(item: StockItem): StockStatus {
  if (item.qty <= 0) return "out";
  if (item.qty < item.target) return "low";
  return "ok";
}

export const STOCK_STATUS_ORDER: readonly StockStatus[] = ["out", "low", "ok"];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out: "Out of Stock",
  low: "Low Stock",
  ok: "In Stock",
};

export function groupByStatus<T extends StockItem>(items: T[]): Array<{ status: StockStatus; items: T[] }> {
  const groups: Record<StockStatus, T[]> = { out: [], low: [], ok: [] };
  items.forEach((item) => {
    groups[getStockStatus(item)].push(item);
  });
  return STOCK_STATUS_ORDER.map((status) => ({ status, items: groups[status] })).filter(
    (group) => group.items.length > 0
  );
}