import React from "react";
import type { ItemSalesLine } from "../../types/domain";

export default function SellerBarList({
  items,
  barColor = "bg-[#F17D0C]",
}: {
  items: ItemSalesLine[];
  barColor?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No item sales in this range.</p>;
  }

  const maxQty = Math.max(...items.map((i) => i.qty), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const widthPct = Math.max(4, (item.qty / maxQty) * 100);
        return (
          <li key={item.id}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-semibold text-gray-800 truncate pr-2">{item.name}</span>
              <span className="text-xs font-bold text-gray-900 whitespace-nowrap">
                {item.qty} sold · ₱{item.revenue.toFixed(0)}
              </span>
            </div>
            <div className="h-[10px] bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
