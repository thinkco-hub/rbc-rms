import React from "react";
import OrderStatusBadge from "../orders/OrderStatusBadge";
import { CalendarIcon } from "../icons";
import { computeOrderTotal } from "../../utils/orders";
import type { Client, NavTabId, Order, Quantity } from "../../types/domain";

interface DashboardViewProps {
  orders: Order[];
  clients: Client[];
  /** Merged finished-goods and raw-material stock below target. */
  lowStockAlerts: Array<{
    id: string;
    name: string;
    qty: Quantity;
    target: Quantity;
    type: string;
    unit?: string;
  }>;
  pendingOrdersCount: number;
  readyOrdersCount: number;
  onNavClick: (tab: NavTabId) => void;
  onViewOrder: (order: Order) => void;
}

export default function DashboardView({
  orders,
  clients,
  lowStockAlerts,
  pendingOrdersCount,
  readyOrdersCount,
  onNavClick,
  onViewOrder,
}: DashboardViewProps) {
  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Dashboard</h2>
          <p className="text-gray-500 mt-1">
            Overview of your bakery operations today.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center text-sm font-medium text-gray-600">
          <CalendarIcon className="w-4 h-4 mr-2 text-[#F17D0C]" />
          May 20, 2026
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">
              +12.5%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">
            Today's Revenue
          </h3>
          <p className="text-2xl font-bold text-[#121212]">₱ 14,350.00</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">
            Pending Orders
          </h3>
          <p className="text-2xl font-bold text-[#121212]">
            {pendingOrdersCount}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            {lowStockAlerts.length > 0 && (
              <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-full">
                Action Req
              </span>
            )}
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">
            Low Stock Alerts
          </h3>
          <p className="text-2xl font-bold text-[#121212]">
            {lowStockAlerts.length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-500">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-gray-500 text-sm font-medium mb-1">
            Ready for Dispatch
          </h3>
          <p className="text-2xl font-bold text-[#121212]">
            {readyOrdersCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#121212]">
              Recent Orders
            </h3>
            <button
              onClick={() => onNavClick("orders")}
              className="text-sm text-[#F17D0C] font-medium hover:underline"
            >
              View All
            </button>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Order #</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {orders.slice(0, 4).map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-orange-50/50 transition-colors cursor-pointer"
                    onClick={() => onViewOrder(order)}
                  >
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {order.id}
                    </td>
                    <td className="px-5 py-4 text-gray-800">
                      {clients.find((c) => c.id === order.clientId)?.name || order.customerName || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-900 text-right">
                      ₱{computeOrderTotal(order).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#121212] flex items-center">
              Inventory Alerts
              <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                {lowStockAlerts.length}
              </span>
            </h3>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
            {lowStockAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-gray-400">
                <svg
                  className="w-12 h-12 mb-3 text-green-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="font-medium">
                  All stock levels are optimal.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {lowStockAlerts.map((item) => (
                  <li
                    key={item.id}
                    className="p-5 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">
                        {item.name}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        {item.id} • {item.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold text-red-600 block leading-tight">
                          {item.qty} {item.unit || ""}
                        </span>
                        <span className="text-xs text-gray-400">
                          Target: {item.target}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
