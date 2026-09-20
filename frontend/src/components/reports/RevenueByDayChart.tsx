import React, { useState } from "react";
import type { ISODate, RevenueByDay } from "../../types/domain";

function niceCeil(value: number) {
  if (value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const residual = value / magnitude;
  let niceResidual;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
}

function formatShortDate(dateStr: ISODate) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const CHART_HEIGHT = 200;
const GRID_STEPS = 4;

export default function RevenueByDayChart({ data }: { data: RevenueByDay[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
        No sales in this range.
      </div>
    );
  }

  const maxRevenue = niceCeil(Math.max(...data.map((d) => d.revenue)));
  const gridValues = Array.from({ length: GRID_STEPS + 1 }, (_, i) => (maxRevenue / GRID_STEPS) * (GRID_STEPS - i));

  return (
    <div className="relative">
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-[11px] text-gray-400 pr-2 shrink-0 w-12 text-right" style={{ height: CHART_HEIGHT }}>
          {gridValues.map((v, i) => (
            <span key={i} className="leading-none -translate-y-1/2">
              ₱{v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v.toFixed(0)}
            </span>
          ))}
        </div>

        {/* Plot area */}
        <div className="relative flex-1 min-w-0">
          {/* gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between" style={{ height: CHART_HEIGHT }}>
            {gridValues.map((_, i) => (
              <div key={i} className="border-t border-gray-100 w-full" />
            ))}
          </div>

          {/* bars */}
          <div className="relative flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
            {data.map((d, idx) => {
              const barHeight = Math.max(2, (d.revenue / maxRevenue) * CHART_HEIGHT);
              const isHovered = hoverIdx === idx;
              return (
                <div
                  key={d.date}
                  className="flex-1 h-full flex items-end justify-center relative min-w-0"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                  onFocus={() => setHoverIdx(idx)}
                  onBlur={() => setHoverIdx(null)}
                  tabIndex={0}
                >
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 z-10 bg-[#121212] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none">
                      <div className="font-bold">₱{d.revenue.toFixed(2)}</div>
                      <div className="text-gray-300">{formatShortDate(d.date)}</div>
                    </div>
                  )}
                  <div
                    className={`w-full max-w-[24px] rounded-t-[4px] transition-colors ${
                      isHovered ? "bg-[#F17D0C]" : "bg-[#F3B978]"
                    }`}
                    style={{ height: barHeight }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex mt-2">
        <div className="shrink-0 w-12" />
        <div className="flex-1 flex gap-1 min-w-0">
          {data.map((d, idx) => (
            <div key={d.date} className="flex-1 text-center min-w-0">
              {(data.length <= 14 || idx % Math.ceil(data.length / 14) === 0) && (
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatShortDate(d.date)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
