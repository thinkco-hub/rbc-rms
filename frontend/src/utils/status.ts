import type {
  CountResolution,
  CountStatus,
  ProductionRunDisposition,
  StockStatus,
} from "../types/domain";

// ---- Production runs ----

export const RUN_STATUS_LABELS: Record<ProductionRunDisposition, string> = {
  scheduled: "Scheduled",
  insufficient: "Insufficient Stock",
  completed: "Completed",
};

export const RUN_STATUS_BADGE_CLASSES: Record<ProductionRunDisposition, string> = {
  scheduled: "border-blue-300 bg-blue-50 text-blue-700",
  insufficient: "border-red-300 bg-red-50 text-red-700",
  completed: "border-green-300 bg-green-50 text-green-700",
};

// ---- Stock levels ----

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out: "Out of Stock",
  low: "Low Stock",
  ok: "In Stock",
};

export const STOCK_STATUS_BADGE_CLASSES: Record<StockStatus, string> = {
  out: "bg-red-50 text-red-700",
  low: "bg-orange-50 text-[var(--color-brand-text)]",
  ok: "bg-[#562D07]/10 text-[#562D07]",
};

// ---- Inventory count reconciliation ----

export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  pending: "Pending",
  resolved: "Resolved",
};

export const COUNT_STATUS_BADGE_CLASSES: Record<CountStatus, string> = {
  pending: "text-orange-700 bg-orange-50",
  resolved: "text-gray-600 bg-gray-100",
};

export const COUNT_RESOLUTION_LABELS: Record<CountResolution, string> = {
  match: "Match",
  applied: "Applied",
  dismissed: "Dismissed",
};
