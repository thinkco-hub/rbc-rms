import React, { useState } from "react";
import CreateOrderModal from "./CreateOrderModal";
import OrderCardList from "./OrderCardList";
import OrderStatusBadge from "./OrderStatusBadge";
import PaymentStatusBadge from "./PaymentStatusBadge";
import SearchField from "../common/SearchField";
import { formatMoney } from "../../utils/money";
import { computeOrderTotal, getPaymentStatus, hasShortfall, ORDER_STATUSES } from "../../utils/orders";
import type { Client, CreateOrderData, MenuItemStock, Order, OrderStatus } from "../../types/domain";

interface OrdersListProps {
  orders: Order[];
  clients: Client[];
  menuInventory: MenuItemStock[];
  onView: (order: Order) => void;
  /** Present when the session may create client orders from this screen. */
  onCreate?: (data: CreateOrderData) => unknown;
}

export default function OrdersList({
  orders,
  clients,
  menuInventory,
  onView,
  onCreate,
}: OrdersListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
  const [dateFilter, setDateFilter] = useState("");

  const clientName = (order: Order) =>
    clients.find((c) => c.id === order.clientId)?.name || order.customerName || "—";

  const filtered = orders.filter((order) => {
    const matchStatus = statusFilter === "All" || order.status === statusFilter;
    const matchDate = !dateFilter || order.requestedDate === dateFilter;
    const matchSearch =
      !search ||
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      clientName(order).toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchDate && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Orders</h2>
          <p className="text-gray-500 mt-1">Manage all customer orders and production status.</p>
        </div>
        {onCreate && (
          <button
            onClick={() => setIsCreating(true)}
            disabled={clients.length === 0}
            title={clients.length === 0 ? "Add a client before creating an order" : undefined}
            className="px-4 py-2.5 rounded-lg bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)] text-white font-bold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            + New Order
          </button>
        )}
      </header>

      {isCreating && onCreate && (
        <CreateOrderModal
          clients={clients}
          menuInventory={menuInventory}
          onClose={() => setIsCreating(false)}
          onCreate={(data) => {
            void onCreate(data);
            setIsCreating(false);
          }}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 flex flex-col md:flex-row items-center gap-2 shadow-sm">
        <SearchField
          value={search}
          onChange={setSearch}
          ariaLabel="Search orders by client or order number"
          placeholder="Search client or order #..."
        />
        <div className="w-full h-px md:w-px md:h-8 bg-gray-200 my-2 md:my-0 block"></div>
        <div className="flex items-center gap-2 w-full md:w-auto px-2">
          <label htmlFor="orders-date-filter" className="text-sm text-gray-500 font-medium whitespace-nowrap">Filter Date:</label>
          <input
            id="orders-date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-600 focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none flex-1 md:flex-none cursor-pointer"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              aria-label="Clear date filter"
              className="text-gray-500 hover:text-red-500 p-1 transition-colors"
              title="Clear Date Filter"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6">
        {(["All", ...ORDER_STATUSES] as Array<OrderStatus | "All">).map((tab) => {
          const count = tab === "All" ? orders.length : orders.filter((o) => o.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-1.5 rounded border text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {/* Container-query breakpoint: below 1024px the table swaps to a card list. */}
      <div className="@container">
        {/* Desktop table — original structure and styling preserved; hidden only at <1024px container width. */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden @max-[1024px]:hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Requested Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No orders found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const shortfall = order.status !== "Delivered" && hasShortfall(order, menuInventory);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">{order.id}</td>
                      <td className="px-6 py-4 text-gray-800">{clientName(order)}</td>
                      <td className="px-6 py-4 text-gray-600">{order.items.length} item(s)</td>
                      <td className="px-6 py-4 text-gray-800 font-medium">{order.requestedDate}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <OrderStatusBadge status={order.status} />
                          {shortfall && (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold whitespace-nowrap">
                              Shortfall
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <PaymentStatusBadge status={getPaymentStatus(order)} />
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatMoney(computeOrderTotal(order))}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => onView(order)}
                          aria-label={`View order ${order.id}`}
                          className="text-gray-500 hover:text-[var(--color-brand-text)] transition-colors p-2 rounded-md hover:bg-orange-50"
                          title="View Order Details"
                        >
                          <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>

        {/* Tablet/mobile (<1024px container): stacked card list with accordion + bottom sheet. */}
        <OrderCardList orders={filtered} menuInventory={menuInventory} getClientName={clientName} onView={onView} />
      </div>
    </div>
  );
}
