import React, { useState } from "react";
import { createPortal } from "react-dom";
import OrderStatusBadge from "./OrderStatusBadge";
import PaymentStatusBadge from "./PaymentStatusBadge";
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
 * two-line cards with a fixed tabular value slot, accordion reveal and a
 * bottom sheet for the full record. Rendered inside the parent @container.
 */
export default function OrderCardList({ orders, menuInventory, getClientName, onView }: OrderCardListProps) {
  const [mobileSort, setMobileSort] = useState<SortKey>("created");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [sheetOrderId, setSheetOrderId] = useState<string | null>(null);

  const sorted = [...orders].sort((a, b) => {
    if (mobileSort === "total") return computeOrderTotal(b) - computeOrderTotal(a);
    if (mobileSort === "date") return b.requestedDate.localeCompare(a.requestedDate);
    return b.createdAt.localeCompare(a.createdAt);
  });

  const sheetOrder = sorted.find((o) => o.id === sheetOrderId) || null;

  return (
    <>
      {/* Standalone sort control — replaces desktop column-header sort triggers.
          Arbitrary container widths: Tailwind v4's @lg container size is 512px, not 1024px. */}
      <div className="@max-[1024px]:flex @max-[1024px]:items-center @max-[1024px]:justify-between @max-[1024px]:gap-2 @max-[1024px]:mb-3 @min-[1024px]:hidden">
        <label htmlFor="orders-mobile-sort" className="text-sm font-medium text-gray-500 whitespace-nowrap">
          Sort by
        </label>
        <select
          id="orders-mobile-sort"
          value={mobileSort}
          onChange={(e) => setMobileSort(e.target.value as SortKey)}
          className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 focus:ring-1 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none"
        >
          <option value="created">Newest first</option>
          <option value="date">Due date</option>
          <option value="total">Total amount</option>
        </select>
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
              onOpenSheet={() => {
                setSheetOrderId(order.id);
                setExpandedCardId(null);
              }}
              onView={onView}
            />
          ))
        )}
      </div>

      {sheetOrder && (
        <OrderBottomSheet
          order={sheetOrder}
          clientName={getClientName(sheetOrder)}
          menuInventory={menuInventory}
          onClose={() => setSheetOrderId(null)}
          onOpenFull={(o) => {
            setSheetOrderId(null);
            onView(o);
          }}
        />
      )}
    </>
  );
}

interface OrderCardProps {
  order: Order;
  clientName: string;
  menuInventory: MenuItemStock[];
  expanded: boolean;
  onToggle: () => void;
  onOpenSheet: () => void;
  onView: (order: Order) => void;
}

function OrderCard({ order, clientName, menuInventory, expanded, onToggle, onOpenSheet, onView }: OrderCardProps) {
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
            <p className="text-xs text-gray-400 font-mono mt-0.5">{order.id}</p>
          </div>
          <p className="text-lg font-bold text-gray-900 whitespace-nowrap tabular-nums [font-feature-settings:'tnum']">
            ₱{computeOrderTotal(order).toFixed(2)}
          </p>
        </div>
        {/* Line 2: State badges + labeled secondary info. */}
        <div className="flex items-center flex-wrap gap-2 mt-2.5">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={getPaymentStatus(order)} />
          {shortfall && (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold whitespace-nowrap">
              Shortfall
            </span>
          )}
          {/* Ambiguous bare dates get an explicit label; status pills stay unlabeled. */}
          <span className="text-xs text-gray-600 ml-auto whitespace-nowrap">
            Due {formatDueDate(order.requestedDate)}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
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
                    {item.qty} × ₱{item.unitPrice.toFixed(2)}
                  </dd>
                </div>
              );
            })}
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500">Amount paid</dt>
              <dd className="text-gray-800 tabular-nums [font-feature-settings:'tnum']">
                ₱{(order.amountPaid || 0).toFixed(2)}
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
          <div className="flex gap-2 mt-3">
            <button
              onClick={onOpenSheet}
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 active:bg-gray-100 transition-colors"
            >
              Full record
            </button>
            <button
              onClick={() => onView(order)}
              className="flex-1 px-3 py-2 rounded-lg bg-[#562D07] text-white text-sm font-bold active:bg-[#3a1d04] transition-colors"
            >
              Manage order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderBottomSheetProps {
  order: Order;
  clientName: string;
  menuInventory: MenuItemStock[];
  onClose: () => void;
  onOpenFull: (order: Order) => void;
}

function OrderBottomSheet({ order, clientName, menuInventory, onClose, onOpenFull }: OrderBottomSheetProps) {
  // Portal to <body>: container-type: inline-size on the @container ancestor
  // applies layout containment, which makes it the containing block for
  // position:fixed descendants. Without the portal the sheet would be trapped
  // inside the container instead of covering the viewport.
  return createPortal(
    // Viewport media query, not a container query: the sheet is portalled to
    // <body>, which is not a container, so @max-[1024px]: would never match.
    <div className="hidden max-lg:block fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-slideUp"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="overflow-y-auto px-5 pb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900">{clientName}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{order.id}</p>
            </div>
            <p className="text-xl font-bold text-gray-900 tabular-nums [font-feature-settings:'tnum']">
              ₱{computeOrderTotal(order).toFixed(2)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={getPaymentStatus(order)} />
          </div>
          <dl className="mt-4 text-sm divide-y divide-gray-100">
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500">Due date</dt>
              <dd className="text-gray-800 font-medium">{formatDueDate(order.requestedDate)}</dd>
            </div>
            {order.deliveryDate && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500">Delivery date</dt>
                <dd className="text-gray-800">{formatDueDate(order.deliveryDate)}</dd>
              </div>
            )}
            {order.assignedTo && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500">Assigned to</dt>
                <dd className="text-gray-800">{order.assignedTo}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500">Amount paid</dt>
              <dd className="text-gray-800 tabular-nums [font-feature-settings:'tnum']">
                ₱{(order.amountPaid || 0).toFixed(2)}
              </dd>
            </div>
            {order.paymentMethod && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500">Payment method</dt>
                <dd className="text-gray-800">{order.paymentMethod}</dd>
              </div>
            )}
            <div className="py-2">
              <dt className="text-gray-500">Items</dt>
              <dd className="mt-1 space-y-1">
                {order.items.map((item, i) => {
                  const name =
                    item.name || menuInventory.find((m) => m.id === item.menuItemId)?.name || item.menuItemId;
                  return (
                    <div key={`${item.menuItemId}-${i}`} className="flex justify-between gap-4">
                      <span className="text-gray-800 truncate">{name}</span>
                      <span className="text-gray-800 tabular-nums [font-feature-settings:'tnum'] whitespace-nowrap">
                        {item.qty} × ₱{item.unitPrice.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </dd>
            </div>
            {order.notes && (
              <div className="py-2">
                <dt className="text-gray-500">Notes</dt>
                <dd className="text-gray-800 mt-0.5">{order.notes}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-800">{formatDueDate(order.createdAt.slice(0, 10))}</dd>
            </div>
          </dl>
          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 active:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onOpenFull(order)}
              className="flex-1 px-3 py-2.5 rounded-lg bg-[#562D07] text-white text-sm font-bold active:bg-[#3a1d04] transition-colors"
            >
              Open full view
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}