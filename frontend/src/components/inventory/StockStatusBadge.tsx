import React from "react";
import { STOCK_STATUS_BADGE_CLASSES, STOCK_STATUS_LABELS } from "../../utils/status";
import { getStockStatus } from "../../utils/stock";
import type { StockItem } from "../../types/domain";

export default function StockStatusBadge({ item }: { item: StockItem }) {
  const status = getStockStatus(item);
  const text =
    status === "low"
      ? `Low (Need ${item.target - item.qty})`
      : STOCK_STATUS_LABELS[status];

  return (
    <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${STOCK_STATUS_BADGE_CLASSES[status]}`}>
      {text}
    </span>
  );
}
