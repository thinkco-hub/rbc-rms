import React from "react";
import OrderStatusBadge from "../orders/OrderStatusBadge";
import { computeOrderTotal } from "../../utils/orders";
import type { Client, Order } from "../../types/domain";

interface ClientDetailProps {
  client: Client;
  orders: Order[];
  onBack: () => void;
  onViewOrder: (order: Order) => void;
}

export default function ClientDetail({ client, orders, onBack, onViewOrder }: ClientDetailProps) {
  const clientOrders = [...orders]
    .filter((o) => o.clientId === client.id)
    .sort((a, b) => b.requestedDate.localeCompare(a.requestedDate));

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <div className="flex items-center text-[15px] mb-6 text-gray-500 font-medium tracking-wide">
        <button onClick={onBack} className="hover:text-[#F17D0C] transition-colors">
          Clients
        </button>
        <span className="mx-2 text-gray-400">&gt;</span>
        <span className="text-[#121212] font-bold">{client.name}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#ffb74d] text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#121212]">{client.name}</h2>
            <p className="text-gray-500 text-sm">{clientOrders.length} order(s) on record</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Contact</p>
            <p className="text-gray-900 font-medium">{client.contact || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email</p>
            <p className="text-gray-900 font-medium">{client.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Address</p>
            <p className="text-gray-900 font-medium">{client.address || "—"}</p>
          </div>
        </div>
        {client.standingOrder && (
          <div className="mt-6 bg-[#fff6ef] rounded-lg p-4 text-sm text-[#562D07] font-medium">
            <span className="font-bold">Standing Order: </span>
            {client.standingOrder}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#121212]">Order History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Order #</th>
                <th className="px-5 py-3">Requested Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {clientOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                clientOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => onViewOrder(order)}
                  >
                    <td className="px-5 py-4 font-medium text-gray-900">{order.id}</td>
                    <td className="px-5 py-4 text-gray-600">{order.requestedDate}</td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-gray-900">
                      ₱{computeOrderTotal(order).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
