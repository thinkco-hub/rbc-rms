import React from "react";
import type { Sale } from "../../types/domain";

interface ReceiptModalProps {
  receipt: Sale;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:bg-white print:static"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="print-receipt bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-fadeIn print:shadow-none print:rounded-none">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#121212]">Sale Complete</h2>
          <p className="text-gray-500 text-sm mt-1">{receipt.id}</p>
          {receipt.type === "Pre-Order" && (
            <p className="text-xs font-semibold text-[#F17D0C] mt-2 bg-orange-50 rounded-full px-3 py-1 inline-block">
              Added to Orders — tracked through production &amp; delivery
            </p>
          )}
        </div>

        <div className="text-sm text-gray-600 space-y-1 mb-4 border-b border-dashed border-gray-300 pb-4">
          <div className="flex justify-between">
            <span>Customer</span>
            <span className="font-semibold text-gray-800">{receipt.customerName}</span>
          </div>
          {receipt.customerContact && (
            <div className="flex justify-between">
              <span>Contact</span>
              <span className="font-semibold text-gray-800">{receipt.customerContact}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Payment Method</span>
            <span className="font-semibold text-gray-800">{receipt.paymentMethod}</span>
          </div>
          {receipt.type === "Pre-Order" && (
            <div className="flex justify-between">
              <span>Delivery Date</span>
              <span className="font-semibold text-gray-800">{receipt.deliveryDate}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Date</span>
            <span className="font-semibold text-gray-800">
              {new Date(receipt.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <ul className="divide-y divide-gray-100 mb-4 max-h-[25vh] overflow-y-auto">
          {receipt.items.map((item) => (
            <li key={item.id} className="py-2 flex justify-between text-sm">
              <span className="text-gray-700">
                <span className="text-gray-400 mr-2">{item.qty}x</span>
                {item.name}
              </span>
              <span className="font-semibold text-gray-900">
                ₱{(item.price * item.qty).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 mb-6 border-t border-dashed border-gray-300 pt-3">
          <div className="flex justify-between text-gray-500 text-sm">
            <span>Subtotal</span>
            <span>₱{receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500 text-sm">
            <span>Tax (5%)</span>
            <span>₱{receipt.tax.toFixed(2)}</span>
          </div>
          <div
            className={`flex justify-between text-lg font-bold text-[#121212] pt-1 ${
              receipt.notes ? "pb-3 border-b border-dashed border-gray-300" : ""
            }`}
          >
            <span>Total</span>
            <span className="text-[#F17D0C]">₱{receipt.total.toFixed(2)}</span>
          </div>
          {receipt.notes && (
            <div className="flex justify-between text-sm pt-1">
              <span className="text-gray-500">Notes</span>
              <span className="font-semibold text-gray-800 text-right max-w-[60%]">
                {receipt.notes}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Exit
          </button>
          <button
            onClick={async () => {
              // Lazy-load jsPDF so it stays out of the initial bundle.
              const { downloadReceiptPdf } = await import(
                "../../utils/receiptPdf"
              );
              downloadReceiptPdf(receipt);
            }}
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#F17D0C] hover:bg-[#d86b06] transition-colors"
          >
            Download Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
