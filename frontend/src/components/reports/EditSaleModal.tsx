import React, { useId, useState } from "react";
import Modal from "../common/Modal";
import EditHistoryList from "../common/EditHistoryList";
import SelectField from "../common/SelectField";
import { computeSaleTotals } from "../../utils/checkout";
import { formatMoney } from "../../utils/money";
import type { FormEvent } from "react";
import { isValidCustomerContact, toContactDigits } from "../../utils/orders";
import type { CartItem, EditSaleInput, PosProduct, Sale } from "../../types/domain";

interface Line {
  item: CartItem;
  qty: string;
}

const toLine = (item: CartItem): Line => ({ item, qty: String(item.qty) });

const emptyLine = (products: PosProduct[]): Line => ({
  item: { ...products[0], qty: 1 },
  qty: "",
});

interface EditSaleModalProps {
  sale: Sale;
  products: PosProduct[];
  onClose: () => void;
  onSave: (input: EditSaleInput) => void;
}

export default function EditSaleModal({ sale, products, onClose, onSave }: EditSaleModalProps) {
  const headingId = useId();
  const nameFieldId = useId();
  const contactFieldId = useId();
  const [customerName, setCustomerName] = useState(sale.customerName);
  const [customerContact, setCustomerContact] = useState(sale.customerContact);
  const [lines, setLines] = useState<Line[]>(sale.items.map(toLine));

  const updateQty = (idx: number, qty: string) =>
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, qty } : line)));
  const changeItem = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, item: { ...product, qty: line.item.qty } } : line)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine(products)]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const cleanLines = lines.filter((l) => (parseFloat(l.qty) || 0) >= 1);
  const cleanItems: CartItem[] = cleanLines.map((l) => ({
    ...l.item,
    qty: parseFloat(l.qty) || 0,
  }));
  const canSave =
    !!customerName.trim() && isValidCustomerContact(customerContact) && cleanItems.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      customerName: customerName.trim(),
      customerContact: customerContact.trim(),
      items: cleanItems,
    });
  };

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      overlayClassName="z-[100] bg-black/50 backdrop-blur-sm px-4"
      className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto overscroll-contain"
    >
      <form onSubmit={handleSubmit}>
        <h2 id={headingId} className="text-2xl font-bold text-[#121212] mb-1">Edit Sale {sale.id}</h2>
        <p className="text-xs text-gray-500 mb-6">
          Totals (incl. 5% tax), reports and reprinted receipts follow the edited items.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={nameFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Customer Name</label>
              <input
                id={nameFieldId}
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                required
              />
            </div>
            <div>
              <label htmlFor={contactFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Contact Number</label>
              <input
                id={contactFieldId}
                type="tel"
                value={customerContact}
                onChange={(e) => setCustomerContact(toContactDigits(e.target.value))}
                placeholder="11-digit mobile number"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                required
              />
              {customerContact.length > 0 && !isValidCustomerContact(customerContact) && (
                <p className="text-xs text-gray-500 mt-1">Enter the full 11-digit number.</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="block text-sm font-semibold text-gray-700">Items</span>
              <button
                type="button"
                onClick={addLine}
                className="text-sm font-bold text-[var(--color-brand-text)] hover:underline"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <SelectField
                    value={line.item.id}
                    onChange={(e) => changeItem(idx, e.target.value)}
                    aria-label={`Item ${idx + 1}`}
                    wrapperClassName="flex-1"
                    className="w-full pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800 text-sm"
                  >
                    {!products.some((p) => p.id === line.item.id) && (
                      <option value={line.item.id}>{line.item.name}</option>
                    )}
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatMoney(p.price)})
                      </option>
                    ))}
                  </SelectField>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    aria-label={`Quantity for item ${idx + 1}`}
                    value={line.qty}
                    onChange={(e) => updateQty(idx, e.target.value)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    aria-label={`Remove item ${idx + 1}`}
                    className="text-gray-500 hover:text-red-500 p-1.5 transition-colors"
                  >
                    <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">New Total (incl. tax)</span>
            <span className="text-lg font-bold text-[var(--color-brand-text)]">
              {formatMoney(computeSaleTotals(cleanItems).total)}
            </span>
          </div>

          {sale.editHistory && sale.editHistory.length > 0 && (
            <div>
              <span className="block text-sm font-semibold text-gray-700 mb-2">Edit History</span>
              <EditHistoryList entries={sale.editHistory} />
            </div>
          )}
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
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
