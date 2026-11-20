import React, { useId } from "react";
import Modal from "../common/Modal";
import { TicketCustomerFields } from "./TicketCustomerInput";
import { addDaysISO } from "../../utils/dates";
import { formatMoney } from "../../utils/money";
import { PAYMENT_METHODS } from "../../utils/orders";
import type { CartItem, ConfirmModalState, ISODate, SaleType } from "../../types/domain";

const SALE_TYPES: SaleType[] = ["Walk-in", "Order"];

interface OrderConfirmationModalProps {
  modal: ConfirmModalState;
  cart: CartItem[];
  cartTotal: number;
  todayISO: ISODate;
  onFieldChange: (
    field: Exclude<keyof ConfirmModalState, "isOpen" | "saleType">,
    value: string
  ) => void;
  onSaleTypeChange: (saleType: SaleType) => void;
  onClose: () => void;
  onConfirm: () => void;
  disabled: boolean;
  /** Server-side checkout failure (stock, permissions, network). */
  error?: string | null;
  isSubmitting?: boolean;
}

export default function OrderConfirmationModal({
  modal,
  cart,
  cartTotal,
  todayISO,
  onFieldChange,
  onSaleTypeChange,
  onClose,
  onConfirm,
  disabled,
  error,
  isSubmitting,
}: OrderConfirmationModalProps) {
  // An Order must be delivered after today, so the earliest pickable date is tomorrow.
  const tomorrowISO = addDaysISO(todayISO, 1);
  const headingId = useId();
  const deliveryFieldId = useId();
  const notesFieldId = useId();

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain animate-fadeIn"
    >
      <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-[var(--color-brand-strong)]">
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
          <h2 id={headingId} className="text-2xl font-bold text-[#121212]">
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
                  {formatMoney(item.price * item.qty)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-between items-center mb-6 text-xl font-bold text-[#121212] px-2">
          <span>Total to Charge:</span>
          <span className="text-[var(--color-brand-text)]">{formatMoney(cartTotal)}</span>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">Sale Type</p>
          <div className="grid grid-cols-2 gap-2">
            {SALE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onSaleTypeChange(type)}
                className={`py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  modal.saleType === type
                    ? "border-[var(--color-brand-text)] bg-orange-50 text-[var(--color-brand-text)]"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <TicketCustomerFields
            name={modal.customerName}
            contact={modal.customerContact}
            onNameChange={(value) => onFieldChange("customerName", value)}
            onContactChange={(value) => onFieldChange("customerContact", value)}
          />
        </div>

        {modal.saleType === "Order" && (
          <div className="mb-6">
            <label htmlFor={deliveryFieldId} className="block text-sm font-semibold text-gray-700 mb-2">
              Delivery Date
            </label>
            <input
              id={deliveryFieldId}
              type="date"
              min={tomorrowISO}
              value={modal.deliveryDate}
              onChange={(e) => onFieldChange("deliveryDate", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
            />
            {modal.deliveryDate && modal.deliveryDate <= todayISO ? (
              <p role="alert" className="text-xs font-semibold text-red-700 mt-1.5">
                Delivery date must be after today. Choose Walk-in for a same-day sale.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1.5">
                {modal.deliveryDate
                  ? "This order will be tracked in Orders (production & delivery)."
                  : "Pick a delivery date after today to place this order."}
              </p>
            )}
          </div>
        )}

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
                    ? "border-[var(--color-brand-text)] bg-orange-50 text-[var(--color-brand-text)]"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label htmlFor={notesFieldId} className="block text-sm font-semibold text-gray-700 mb-2">
            Notes on Order
          </label>
          <textarea
            id={notesFieldId}
            rows={2}
            placeholder="Special instructions, allergies, packaging..."
            value={modal.notes}
            onChange={(e) => onFieldChange("notes", e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800 resize-none"
          />
        </div>

        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg text-sm font-medium border bg-red-50 text-red-700 border-red-200">
            {error}
          </div>
        )}

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
                : "bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)]"
            }`}
          >
            {isSubmitting ? "Processing…" : "Confirm Order"}
          </button>
        </div>
    </Modal>
  );
}
