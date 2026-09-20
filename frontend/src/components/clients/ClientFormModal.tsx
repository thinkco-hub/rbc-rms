import React, { useState } from "react";
import type { FormEvent } from "react";
import type { Client, ClientFormData } from "../../types/domain";

interface ClientFormModalProps {
  initial: Client | null;
  onClose: () => void;
  onSave: (data: ClientFormData) => void;
}

export default function ClientFormModal({ initial, onClose, onSave }: ClientFormModalProps) {
  const [form, setForm] = useState<ClientFormData>(
    initial || { name: "", contact: "", email: "", address: "", standingOrder: "" }
  );

  const update = (field: keyof ClientFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn"
      >
        <h2 className="text-2xl font-bold text-[#121212] mb-6">
          {initial ? "Edit Client" : "Add Client"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Client / Business Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Number</label>
              <input
                type="text"
                value={form.contact}
                onChange={(e) => update("contact", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Standing Order Preferences
            </label>
            <textarea
              value={form.standingOrder}
              onChange={(e) => update("standingOrder", e.target.value)}
              rows={3}
              placeholder="e.g. 20 Butter Croissants every Monday"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800"
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
            Save Client
          </button>
        </div>
      </form>
    </div>
  );
}
