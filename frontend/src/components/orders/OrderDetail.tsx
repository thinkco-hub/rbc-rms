import React, { useState } from "react";
import OrderStatusBadge from "./OrderStatusBadge";
import PaymentStatusBadge from "./PaymentStatusBadge";
import { CalendarIcon } from "../icons";
import {
  computeAmountDue,
  computeOrderTotal,
  getOrderShortfalls,
  getPaymentStatus,
  nextStatus,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from "../../utils/orders";
import type { FormEvent } from "react";
import type {
  Client,
  MenuItemStock,
  Order,
  OrderDeliveryInput,
  OrderId,
  OrderItem,
  OrderPaymentInput,
  OrderStatus,
  PaymentMethod,
} from "../../types/domain";

const STATUS_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  Pending: "Mark In Production",
  "In Production": "Mark Ready",
};

function ScheduleDeliveryModal({
  order,
  onClose,
  onSchedule,
}: {
  order: Order;
  onClose: () => void;
  onSchedule: (data: OrderDeliveryInput) => void;
}) {
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryDate || "");
  const [assignedTo, setAssignedTo] = useState(order.assignedTo || "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!deliveryDate || !assignedTo) return;
    onSchedule({ deliveryDate, assignedTo });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn"
      >
        <h2 className="text-2xl font-bold text-[#121212] mb-6">Schedule Delivery</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Assigned Staff / Driver</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              required
            />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function RecordPaymentModal({
  order,
  onClose,
  onRecord,
}: {
  order: Order;
  onClose: () => void;
  onRecord: (data: OrderPaymentInput) => void;
}) {
  const amountDue = computeAmountDue(order);
  const [method, setMethod] = useState<PaymentMethod>(order.paymentMethod || PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState(amountDue > 0 ? amountDue.toFixed(2) : "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!method || isNaN(parsed) || parsed <= 0) return;
    onRecord({ method, amount: parsed });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn"
      >
        <h2 className="text-2xl font-bold text-[#121212] mb-6">Record Payment</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Received</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Amount due: ₱{amountDue.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

interface OrderDetailProps {
  order: Order;
  client: Client | undefined;
  menuInventory: MenuItemStock[];
  onBack: () => void;
  onAdvanceStatus: (id: OrderId, status: OrderStatus | null) => void;
  onScheduleDelivery: (id: OrderId, data: OrderDeliveryInput) => void;
  onMarkDelivered: (id: OrderId) => void;
  onRecordPayment: (id: OrderId, data: OrderPaymentInput) => void;
  onGoToProduction: () => void;
}

export default function OrderDetail({
  order,
  client,
  menuInventory,
  onBack,
  onAdvanceStatus,
  onScheduleDelivery,
  onMarkDelivered,
  onRecordPayment,
  onGoToProduction,
}: OrderDetailProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const shortfalls = order.status !== "Delivered" ? getOrderShortfalls(order, menuInventory) : [];
  const total = computeOrderTotal(order);
  const amountDue = computeAmountDue(order);
  const paymentStatus = getPaymentStatus(order);
  const advanceLabel = STATUS_ACTION_LABEL[order.status];

  const itemName = (line: OrderItem) =>
    menuInventory.find((m) => m.id === line.menuItemId)?.name || line.name || line.menuItemId;

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      {isScheduling && (
        <ScheduleDeliveryModal
          order={order}
          onClose={() => setIsScheduling(false)}
          onSchedule={(data) => onScheduleDelivery(order.id, data)}
        />
      )}

      {isRecordingPayment && (
        <RecordPaymentModal
          order={order}
          onClose={() => setIsRecordingPayment(false)}
          onRecord={(data) => onRecordPayment(order.id, data)}
        />
      )}

      <div className="flex items-center text-[15px] mb-6 text-gray-500 font-medium tracking-wide">
        <button onClick={onBack} className="hover:text-[#F17D0C] transition-colors">
          Orders
        </button>
        <span className="mx-2 text-gray-400">&gt;</span>
        <span className="text-[#121212] font-bold">Order Details</span>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center bg-[#eef0f2] hover:bg-gray-300 rounded-lg transition-colors text-gray-700 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7M3 12h18" />
              </svg>
            </button>
            <h2 className="text-[32px] font-bold text-[#121212] leading-none">Order {order.id}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={paymentStatus} />
            {amountDue > 0 && (
              <button
                onClick={() => setIsRecordingPayment(true)}
                className="px-4 py-1.5 rounded-full border border-gray-300 bg-white text-gray-800 text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors"
              >
                Record Payment
              </button>
            )}
            {advanceLabel && (
              <button
                onClick={() => onAdvanceStatus(order.id, nextStatus(order.status))}
                className="px-4 py-1.5 rounded-full border border-gray-300 bg-white text-gray-800 text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors"
              >
                {advanceLabel}
              </button>
            )}
            {order.status === "Ready" && (
              <>
                <button
                  onClick={() => setIsScheduling(true)}
                  className="px-4 py-1.5 rounded-full border border-gray-300 bg-white text-gray-800 text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors"
                >
                  {order.deliveryDate ? "Reschedule Delivery" : "Schedule Delivery"}
                </button>
                <button
                  onClick={() => onMarkDelivered(order.id)}
                  className="px-4 py-1.5 rounded-full bg-[#562D07] hover:bg-[#3a1d04] text-white text-sm font-semibold shadow-sm transition-colors"
                >
                  Mark Delivered
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-gray-500 text-[15px] font-medium tracking-wide md:ml-14">
          Requested for {order.requestedDate}
        </p>
      </div>

      {shortfalls.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-bold text-red-700 mb-2">
            Insufficient finished-goods stock for {shortfalls.length} item(s)
          </p>
          <ul className="text-sm text-red-600 space-y-1 mb-3">
            {shortfalls.map((s) => (
              <li key={s.menuItemId}>
                {s.name}: need {s.requestedQty}, have {s.available} (short {s.shortfall})
              </li>
            ))}
          </ul>
          <button
            onClick={onGoToProduction}
            className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
          >
            Go to Production Runs
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200">
        <div className="flex-1 p-6 flex flex-col items-start">
          <p className="text-xs font-bold text-gray-800 mb-4 tracking-wide">Client</p>
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-[#ffb74d] text-white flex items-center justify-center mr-4">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-[#121212]">{client ? client.name : order.customerName || "—"}</p>
              <p className="text-xs text-gray-400 font-medium">
                {client?.contact || (order.customerName ? "Walk-in / POS customer" : "No contact on file")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col md:items-center">
          <div className="w-full max-w-[220px]">
            <p className="text-xs font-bold text-gray-800 mb-4 tracking-wide">Delivery</p>
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-[#ffb74d] text-white flex items-center justify-center mr-4">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-base font-bold text-[#121212]">{order.deliveryDate || "Not scheduled"}</p>
                <p className="text-xs text-gray-400 font-medium">{order.assignedTo || "—"}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col md:items-end">
          <div className="w-full max-w-[200px]">
            <p className="text-xs font-bold text-gray-800 mb-4 tracking-wide">Total Amount</p>
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-full bg-[#ffb74d] text-white flex items-center justify-center mr-4">
                <span className="text-2xl font-bold font-serif">₱</span>
              </div>
              <div>
                <p className="text-base font-bold text-[#121212]">₱{total.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-[#121212] mb-6">Order Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <th className="pb-4 font-medium">Item</th>
                  <th className="pb-4 text-center font-medium">Quantity</th>
                  <th className="pb-4 text-right font-medium">Unit Price</th>
                  <th className="pb-4 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="text-sm border-b border-gray-200">
                {order.items.map((line, idx) => (
                  <tr key={idx}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
                        <span className="font-medium text-gray-800">{itemName(line)}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center text-gray-700">{line.qty}</td>
                    <td className="py-4 text-right text-gray-700">₱{line.unitPrice.toFixed(2)}</td>
                    <td className="py-4 text-right font-semibold text-gray-900">
                      ₱{(line.qty * line.unitPrice).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-6">
            <div className="w-64 space-y-3 text-sm">
              <div className="flex justify-between font-bold text-base pt-2">
                <span className="text-gray-800">Total Amount</span>
                <span className="text-gray-900">₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center mb-8">
            <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            <h3 className="text-base font-bold text-[#121212]">Order Status Timeline</h3>
          </div>
          <div className="relative space-y-8 pl-1">
            <div className="absolute top-2 bottom-2 left-[15px] w-0.5 bg-gray-200 z-0"></div>
            {ORDER_STATUSES.map((status) => {
              const currentIdx = ORDER_STATUSES.indexOf(order.status);
              const stepIdx = ORDER_STATUSES.indexOf(status);
              const reached = stepIdx <= currentIdx;
              return (
                <div key={status} className="relative flex items-start gap-5 z-10">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 flex-shrink-0 ${
                      reached ? "bg-blue-500 ring-blue-100" : "bg-gray-400 ring-gray-100"
                    }`}
                  >
                    {reached ? (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-2 h-0.5 bg-white rounded-full"></div>
                    )}
                  </div>
                  <div className="pt-0.5">
                    <h4 className="font-bold text-sm text-gray-900 leading-none">{status}</h4>
                    {status === "Delivered" && order.deliveredAt && (
                      <p className="text-[10px] text-gray-400 mt-1.5 leading-none">{order.deliveredAt}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-orange-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-base font-bold text-[#121212]">Order Notes</h3>
          </div>
          <div className="bg-[#fff6ef] rounded-lg p-4 text-sm text-[#562D07] font-medium">
            {order.notes || "No notes for this order."}
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-orange-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-base font-bold text-[#121212]">Additional Information</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-500 font-medium">Order ID</span>
              <span className="text-gray-900 font-medium">{order.id}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-500 font-medium">Created At</span>
              <span className="text-gray-900 font-medium text-xs text-right">{order.createdAt}</span>
            </div>
            {order.deliveredAt && (
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-500 font-medium">Delivered At</span>
                <span className="text-gray-900 font-medium text-xs text-right">{order.deliveredAt}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-500 font-medium">Payment Method</span>
              <span className="text-gray-900 font-medium text-xs text-right">{order.paymentMethod || "—"}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-500 font-medium">Amount Paid</span>
              <span className="text-gray-900 font-medium text-xs text-right">₱{(order.amountPaid || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Amount Due</span>
              <span className="text-gray-900 font-medium text-xs text-right">₱{amountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
