import React, { useState } from "react";
import SelectField from "../common/SelectField";
import OrderStatusBadge from "./OrderStatusBadge";
import PaymentStatusBadge from "./PaymentStatusBadge";
import { formatMoney } from "../../utils/money";
import { computeOrderTotal, getPaymentStatus, hasShortfall } from "../../utils/orders";
import type { MenuItemStock, Order } from "../../types/domain";

/** "2026-03-04" -> "Mar 04". Kept locale-independent and short for the card slot. */
export function formatDueDate(iso: string): string {
  const [year, month, day] = iso.split("-").map((part) => parseInt(part, 10));
  if (!year || !month || !day) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1]} ${String(day).padStart(2, "0")}`;
}

type SortKey = "created" | "date" | "total";

interface OrderCardListProps {
  orders: Order[];
  menuInventory: MenuItemStock[];
  getClientName: (order: Order) => string;
  onView: (order: Order) => void;
}

/**
 * Tablet/mobile (< 1024px container width) representation of the orders table:
 * two-line cards with a fixed tabular value slot and an accordion reveal.
 * Rendered inside the parent @container.
 */
export default function OrderCardList({ orders, menuInventory, getClientName, onView }: OrderCardListProps) {
  const [mobileSort, setMobileSort] = useState<SortKey>("created");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const sorted = [...orders].sort((a, b) => {
    if (mobileSort === "total") return computeOrderTotal(b) - computeOrderTotal(a);
    if (mobileSort === "date") return b.requestedDate.localeCompare(a.requestedDate);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <>
      {/* Standalone sort control — replaces desktop column-header sort triggers.
          Arbitrary container widths: Tailwind v4's @lg container size is 512px, not 1024px. */}
      <div className="@max-[1024px]:flex @max-[1024px]:items-center @max-[1024px]:justify-between @max-[1024px]:gap-2 @max-[1024px]:mb-3 @min-[1024px]:hidden">
        <label htmlFor="orders-mobile-sort" className="text-sm font-medium text-gray-500 whitespace-nowrap">
          Sort by
        </label>
        <SelectField
          id="orders-mobile-sort"
          value={mobileSort}
          onChange={(e) => setMobileSort(e.target.value as SortKey)}
          className="pl-3 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none"
        >
          <option value="created">Newest first</option>
          <option value="date">Requested date</option>
          <option value="total">Total amount</option>
        </SelectField>
      </div>

      <div className="hidden @max-[1024px]:grid gap-3">
        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            No orders found matching the selected filters.
          </p>
        ) : (
          sorted.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              clientName={getClientName(order)}
              menuInventory={menuInventory}
              expanded={expandedCardId === order.id}
              onToggle={() => setExpandedCardId(expandedCardId === order.id ? null : order.id)}
              onView={onView}
            />
          ))
        )}
      </div>
    </>
  );
}

interface OrderCardProps {
  order: Order;
  clientName: string;
  menuInventory: MenuItemStock[];
  expanded: boolean;
  onToggle: () => void;
  onView: (order: Order) => void;
}

function OrderCard({ order, clientName, menuInventory, expanded, onToggle, onView }: OrderCardProps) {
  const shortfall = order.status !== "Delivered" && hasShortfall(order, menuInventory);
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Tappable header — expands in place (accordion). */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-4 pt-3.5 pb-2 active:bg-gray-50 transition-colors"
      >
        {/* Line 1: Identity (left) · Primary Value (right, fixed tabular slot). */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{clientName}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{order.id}</p>
          </div>
          <p className="text-lg font-bold text-gray-900 whitespace-nowrap tabular-nums [font-feature-settings:'tnum']">
            {formatMoney(computeOrderTotal(order))}
          </p>
        </div>
        {/* Line 2: State badges + labeled secondary info. */}
        <div className="flex items-center flex-wrap gap-2 mt-2.5">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={getPaymentStatus(order)} />
          {shortfall && (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold whitespace-nowrap">
              Shortfall
            </span>
          )}
          {/* Ambiguous bare dates get an explicit label; status pills stay unlabeled. */}
          <span className="text-xs text-gray-600 ml-auto whitespace-nowrap">
            Requested {formatDueDate(order.requestedDate)}
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Progressive reveal: hidden secondary fields + quick actions. */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
          <dl className="text-sm divide-y divide-gray-100">
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500">Items</dt>
              <dd className="text-gray-800 font-medium text-right">{order.items.length} item(s)</dd>
            </div>
            {order.items.map((item, i) => {
              const name =
                item.name || menuInventory.find((m) => m.id === item.menuItemId)?.name || item.menuItemId;
              return (
                <div key={`${item.menuItemId}-${i}`} className="flex justify-between gap-4 py-2 pl-4">
                  <dt className="text-gray-500 truncate">{name}</dt>
                  <dd className="text-gray-800 tabular-nums [font-feature-settings:'tnum'] whitespace-nowrap">
                    {item.qty} × {formatMoney(item.unitPrice)}
                  </dd>
                </div>
              );
            })}
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500">Amount paid</dt>
              <dd className="text-gray-800 tabular-nums [font-feature-settings:'tnum']">
                {formatMoney(order.amountPaid || 0)}
              </dd>
            </div>
            {order.deliveryDate && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500">Delivery</dt>
                <dd className="text-gray-800">{formatDueDate(order.deliveryDate)}</dd>
              </div>
            )}
            {order.assignedTo && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500">Assigned to</dt>
                <dd className="text-gray-800">{order.assignedTo}</dd>
              </div>
            )}
            {order.notes && (
              <div className="py-2">
                <dt className="text-gray-500">Notes</dt>
                <dd className="text-gray-800 mt-0.5">{order.notes}</dd>
              </div>
            )}
          </dl>
          <button
            onClick={() => onView(order)}
            className="w-full mt-3 px-3 py-2 rounded-lg bg-[#562D07] text-white text-sm font-bold active:bg-[#3a1d04] transition-colors"
          >
            Manage order
          </button>
        </div>
      )}
    </div>
  );
}
