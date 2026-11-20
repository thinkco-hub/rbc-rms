import React, { useId } from "react";
import Modal from "../common/Modal";
import SelectField from "../common/SelectField";
import type { RestockModalState, StockItem } from "../../types/domain";

interface RestockModalProps {
  modal: RestockModalState;
  items: StockItem[];
  onItemChange: (itemId: string) => void;
  onAmountChange: (amount: string) => void;
  onQuickAdd: (delta: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  disabled: boolean;
}

export default function RestockModal({
  modal,
  items,
  onItemChange,
  onAmountChange,
  onQuickAdd,
  onClose,
  onConfirm,
  disabled,
}: RestockModalProps) {
  const headingId = useId();
  const itemFieldId = useId();
  const amountFieldId = useId();
  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto overscroll-contain animate-fadeIn"
    >
        <h2 id={headingId} className="text-2xl font-bold text-[#121212] mb-1">
          Restock{" "}
          {modal.category === "menu" ? "Menu Item" : "Ingredient"}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Select an item and add the received stock amount.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor={itemFieldId} className="block text-sm font-semibold text-gray-700 mb-1">
              Item to Restock
            </label>
            <SelectField
              id={itemFieldId}
              className="w-full pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
              value={modal.selectedItemId}
              onChange={(e) => onItemChange(e.target.value)}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Current: {item.qty})
                </option>
              ))}
            </SelectField>
          </div>

          <div>
            <label htmlFor={amountFieldId} className="block text-sm font-semibold text-gray-700 mb-1">
              Quantity to Add
            </label>
            <input
              id={amountFieldId}
              type="number"
              min="1"
              placeholder="Enter amount..."
              value={modal.amountToAdd}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
            />
          </div>

          {/* Quick Increment Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onQuickAdd(5)}
              className="flex-1 py-2 bg-orange-50 text-[var(--color-brand-text)] font-bold rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              + 5
            </button>
            <button
              onClick={() => onQuickAdd(10)}
              className="flex-1 py-2 bg-orange-50 text-[var(--color-brand-text)] font-bold rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              + 10
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={`flex-1 py-3 rounded-xl text-white font-bold transition-colors ${
              disabled
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-[#562D07] hover:bg-[#3a1d04]"
            }`}
          >
            Confirm Restock
          </button>
        </div>
    </Modal>
  );
}
