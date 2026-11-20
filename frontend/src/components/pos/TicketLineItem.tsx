import React from "react";
import { formatMoney } from "../../utils/money";
import type { CartItem } from "../../types/domain";

interface TicketLineItemProps {
  item: CartItem;
  onAdjustQty: (id: string, delta: number) => void;
  /**
   * Padding and text size come from the host: the desktop panel drives them
   * from its container tokens, the mobile ticket view sets them per breakpoint.
   * Everything below is sized in em so it follows whichever the host picks.
   */
  className?: string;
}

export default function TicketLineItem({
  item,
  onAdjustQty,
  className = "",
}: TicketLineItemProps) {
  return (
    <li className={`group hover:bg-gray-50 ${className}`}>
      <div className="flex justify-between items-start mb-[0.8em]">
        <span className="font-bold text-gray-800">{item.name}</span>
        <span className="font-bold text-gray-900">
          {formatMoney(item.price * item.qty)}
        </span>
      </div>
      <div className="flex justify-between items-center text-gray-500">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <button
            onClick={() => onAdjustQty(item.id, -1)}
            aria-label={`Remove one ${item.name}`}
            className="w-[2.9em] h-[2.9em] min-h-[2.75rem] flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <svg
              className="w-[1.5em] h-[1.5em]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span className="w-[2.2em] text-center font-bold text-[#121212]">
            {item.qty}
          </span>
          <button
            onClick={() => onAdjustQty(item.id, 1)}
            aria-label={`Add one ${item.name}`}
            className="w-[2.9em] h-[2.9em] min-h-[2.75rem] flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <svg
              className="w-[1.5em] h-[1.5em]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
        <span>x {formatMoney(item.price)}</span>
      </div>
    </li>
  );
}
