import React, { useState } from "react";
import type { FormEvent } from "react";
import type { Client, CreateOrderData, MenuItemStock } from "../../types/domain";

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = () => ({ menuItemId: "", qty: "" });

interface CreateOrderModalProps {
  clients: Client[];
  menuInventory: MenuItemStock[];
  onClose: () => void;
  onCreate: (data: CreateOrderData) => void;
}

export default function CreateOrderModal({ clients, menuInventory, onClose, onCreate }: CreateOrderModalProps) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [requestedDate, setRequestedDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ menuItemId: string; qty: string }>>([emptyLine()]);

  const updateLine = (idx: number, field: "menuItemId" | "qty", value: string) =>
    setItems((prev) => prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line)));
  const addLine = () => setItems((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const cleanItems = items
    .filter((l) => l.menuItemId && l.qty)
    .map((l) => {
      const menuItem = menuInventory.find((m) => m.id === l.menuItemId);
      return {
        menuItemId: l.menuItemId,
        qty: parseFloat(l.qty) || 0,
        unitPrice: menuItem ? menuItem.price : 0,
      };
    });
  const total = cleanItems.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!clientId || !requestedDate || cleanItems.length === 0) return;
    onCreate({ clientId, requestedDate, notes, items: cleanItems });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold text-[#121212] mb-6">New Order</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              >
                {clients.length === 0 && <option value="">No clients yet</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Requested Date</label>
              <input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">Items</label>
              <button
                type="button"
                onClick={addLine}
                className="text-sm font-bold text-[#F17D0C] hover:underline"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={line.menuItemId}
                    onChange={(e) => updateLine(idx, "menuItemId", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 text-sm"
                  >
                    <option value="">Select item...</option>
                    {menuInventory.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (₱{m.price})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={(e) => updateLine(idx, "qty", e.target.value)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-gray-400 hover:text-red-500 p-1.5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
            />
          </div>

          <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">Order Total</span>
            <span className="text-lg font-bold text-[#F17D0C]">₱{total.toFixed(2)}</span>
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
            disabled={clients.length === 0}
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Create Order
          </button>
        </div>
      </form>
    </div>
  );
}
