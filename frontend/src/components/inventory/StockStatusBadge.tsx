import React from "react";
import { getStockStatus } from "../../utils/stock";
import type { StockItem } from "../../types/domain";

const STYLES = {
  out: "bg-red-50 text-red-600",
  low: "bg-[#F17D0C]/10 text-[#F17D0C]",
  ok: "bg-[#562D07]/10 text-[#562D07]",
};

export default function StockStatusBadge({ item }: { item: StockItem }) {
  const status = getStockStatus(item);
  let text = "In Stock";
  if (status === "out") text = "Out of Stock";
  else if (status === "low") text = `Low (Need ${item.target - item.qty})`;

  return (
    <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${STYLES[status]}`}>
      {text}
    </span>
  );
}
