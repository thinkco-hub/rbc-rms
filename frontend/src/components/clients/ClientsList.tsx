import React, { useState } from "react";
import ClientFormModal from "./ClientFormModal";
import { SearchIcon } from "../icons";
import type { Client, ClientFormData, ClientId, Order } from "../../types/domain";

interface ClientsListProps {
  clients: Client[];
  orders: Order[];
  onAdd: (data: ClientFormData) => void;
  onUpdate: (id: ClientId, data: Partial<ClientFormData>) => void;
  onView: (client: Client) => void;
}

export default function ClientsList({ clients, orders, onAdd, onUpdate, onView }: ClientsListProps) {
  const [search, setSearch] = useState("");
  const [modalState, setModalState] = useState<{ isOpen: boolean; editing: Client | null }>({
    isOpen: false,
    editing: null,
  });

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const orderCount = (clientId: ClientId) => orders.filter((o) => o.clientId === clientId).length;

  const handleSave = (data: ClientFormData) => {
    if (modalState.editing) onUpdate(modalState.editing.id, data);
    else onAdd(data);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      {modalState.isOpen && (
        <ClientFormModal
          initial={modalState.editing}
          onClose={() => setModalState({ isOpen: false, editing: null })}
          onSave={handleSave}
        />
      )}

      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">Clients</h2>
          <p className="text-gray-500 mt-1">Client records and standing order preferences.</p>
        </div>
        <button
          onClick={() => setModalState({ isOpen: true, editing: null })}
          className="px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          + Add Client
        </button>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 shadow-sm flex">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border-none focus:ring-0 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
            placeholder="Search clients..."
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Standing Order</th>
                <th className="px-6 py-4 text-right">Orders</th>
                <th className="px-4 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No clients found.
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <div>{client.contact || "—"}</div>
                      {client.email && <div className="text-xs text-gray-400">{client.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{client.standingOrder || "—"}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{orderCount(client.id)}</td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setModalState({ isOpen: true, editing: client })}
                        className="text-gray-500 hover:bg-gray-100 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onView(client)}
                        className="text-[#F17D0C] hover:bg-orange-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                      >
                        View
                      </button>
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
