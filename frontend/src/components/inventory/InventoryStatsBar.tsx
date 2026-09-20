import React from "react";
import { getStockStatus } from "../../utils/stock";
import type { StockItem, StockStatus } from "../../types/domain";

const CARD_STYLES = {
  all: {
    label: "Total Items",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    ),
    iconBg: "bg-gray-100 text-gray-500",
  },
  ok: {
    label: "In Stock",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
    iconBg: "bg-green-50 text-green-500",
  },
  low: {
    label: "Low Stock",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    ),
    iconBg: "bg-[#F17D0C]/10 text-[#F17D0C]",
  },
  out: {
    label: "Out of Stock",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    ),
    iconBg: "bg-red-50 text-red-500",
  },
};

interface InventoryStatsBarProps {
  items: StockItem[];
  activeFilter: "all" | StockStatus;
  onFilterChange: (filter: "all" | StockStatus) => void;
}

export default function InventoryStatsBar({ items, activeFilter, onFilterChange }: InventoryStatsBarProps) {
  const counts: Record<"all" | StockStatus, number> = { all: items.length, ok: 0, low: 0, out: 0 };
  items.forEach((item) => {
    counts[getStockStatus(item)] += 1;
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {(["all", "ok", "low", "out"] as const).map((key) => {
        const style = CARD_STYLES[key];
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={`text-left bg-white p-4 md:p-5 rounded-2xl border shadow-sm transition-all ${
              isActive
                ? "border-[#F17D0C] ring-2 ring-[#F17D0C]/30"
                : "border-gray-100 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center ${style.iconBg}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {style.icon}
                </svg>
              </div>
            </div>
            <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">{style.label}</p>
            <p className="text-xl md:text-2xl font-bold text-[#121212]">{counts[key]}</p>
          </button>
        );
      })}
    </div>
  );
}
