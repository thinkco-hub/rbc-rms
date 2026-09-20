import React from "react";
import { PAYMENT_METHODS } from "../../utils/orders";
import type { CartItem, ConfirmModalState, ISODate } from "../../types/domain";

interface OrderConfirmationModalProps {
  modal: ConfirmModalState;
  cart: CartItem[];
  cartTotal: number;
  todayISO: ISODate;
  onFieldChange: (
    field: Exclude<keyof ConfirmModalState, "isOpen">,
    value: string
  ) => void;
  onClose: () => void;
  onConfirm: () => void;
  disabled: boolean;
}

export default function OrderConfirmationModal({
  modal,
  cart,
  cartTotal,
  todayISO,
  onFieldChange,
  onClose,
  onConfirm,
  disabled,
}: OrderConfirmationModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-[#F17D0C]">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#121212]">
            Confirm Order
          </h2>
        </div>
        <p className="text-gray-500 text-sm mb-6 ml-13">
          Please double-check the order details below.
        </p>

        <div className="max-h-[30vh] overflow-y-auto mb-6 bg-gray-50 rounded-lg p-3 border border-gray-100">
          <ul className="divide-y divide-gray-200">
            {cart.map((item) => (
              <li
                key={item.id}
                className="py-3 flex justify-between text-sm"
              >
                <span className="font-medium text-gray-800">
                  <span className="text-gray-500 mr-2">{item.qty}x</span>{" "}
                  {item.name}
                </span>
                <span className="font-bold text-gray-900">
                  ₱{(item.price * item.qty).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-between items-center mb-6 text-xl font-bold text-[#121212] px-2">
          <span>Total to Charge:</span>
          <span className="text-[#F17D0C]">₱{cartTotal.toFixed(2)}</span>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Name
            </label>
            <input
              type="text"
              placeholder="Enter customer name..."
              value={modal.customerName}
              onChange={(e) => onFieldChange("customerName", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Contact
            </label>
            <input
              type="tel"
              placeholder="09XX XXX XXXX"
              value={modal.customerContact}
              onChange={(e) => onFieldChange("customerContact", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Delivery Date
          </label>
          <input
            type="date"
            min={todayISO}
            value={modal.deliveryDate}
            onChange={(e) => onFieldChange("deliveryDate", e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            {modal.deliveryDate > todayISO
              ? "This order will be tracked in Orders (production & delivery)."
              : "Set a later date to track this order in Orders."}
          </p>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onFieldChange("paymentMethod", method)}
                className={`py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  modal.paymentMethod === method
                    ? "border-[#F17D0C] bg-orange-50 text-[#F17D0C]"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notes on Order
          </label>
          <textarea
            rows={2}
            placeholder="Special instructions, allergies, packaging..."
            value={modal.notes}
            onChange={(e) => onFieldChange("notes", e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={disabled}
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-white font-bold transition-colors ${
              disabled
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-[#F17D0C] hover:bg-[#d86b06]"
            }`}
          >
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
}
