import React, { useId, useRef, useState } from "react";
import Modal from "../common/Modal";
import ClientFormModal from "../clients/ClientFormModal";
import { SearchIcon } from "../icons";
import type {
  Client,
  ClientFormData,
  TicketCustomer,
} from "../../types/domain";

interface PosCustomerPickerProps {
  clients: Client[];
  attached: TicketCustomer | null;
  onClose: () => void;
  onAttach: (customer: TicketCustomer) => void;
  onCreateClient: (data: ClientFormData) => void;
}

/**
 * Full-screen sheet for putting a customer on the ticket, at every width: the
 * client list wants the room, and the ticket panel it covers is only a side
 * column. Reads from the Clients records, so a name typed once in Clients is
 * reusable at the counter; a walk-in with no record yet is created here and
 * saved to Clients.
 */
export default function PosCustomerPicker({
  clients,
  attached,
  onClose,
  onAttach,
  onCreateClient,
}: PosCustomerPickerProps) {
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const headingId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  const query = search.trim().toLowerCase();
  // Newest first: addClient appends, so the end of the list is the most recent.
  const visible = (query
    ? clients.filter((c) => c.name.toLowerCase().includes(query))
    : [...clients]
  ).reverse();

  const handleCreate = (data: ClientFormData) => {
    onCreateClient(data);
    onAttach({ name: data.name, contact: data.contact });
  };

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      initialFocusRef={searchRef}
      dismissOnBackdrop={false}
      overlayClassName="z-[100] bg-[#FDF9F3]"
      className="w-full h-full flex flex-col animate-fadeIn"
    >
      {isFormOpen && (
        <ClientFormModal
          initial={null}
          onClose={() => setIsFormOpen(false)}
          onSave={handleCreate}
        />
      )}

      <header className="flex-shrink-0 bg-[#562D07] text-[#FDF9F3] p-4 flex items-center gap-3 shadow-md">
        <button
          onClick={onClose}
          aria-label="Cancel and return to the ticket"
          className="min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center rounded-md bg-[#F3B978]/20 hover:bg-[#F3B978]/40 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 id={headingId} className="text-lg font-bold">Add customer to ticket</h2>
      </header>

      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-500" />
          </div>
          <input
            ref={searchRef}
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            aria-label="Search customers"
            className="block w-full min-h-[2.75rem] pl-10 pr-3 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[var(--color-brand-text)] outline-none"
          />
        </div>
      </div>

      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <button
          onClick={() => setIsFormOpen(true)}
          className="w-full min-h-[3rem] px-4 py-3 font-bold text-[var(--color-brand-text)] uppercase tracking-wide text-sm hover:bg-orange-50 active:bg-orange-100 transition-colors"
        >
          Add new customer
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-white">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-gray-500">
            {query
              ? `No customers match "${search.trim()}".`
              : "Your most recent customers will show up here."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                attached={
                  !!attached && attached.name === client.name && attached.contact === client.contact
                }
                onAttach={onAttach}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function ClientRow({
  client,
  attached,
  onAttach,
}: {
  client: Client;
  attached: boolean;
  onAttach: (customer: TicketCustomer) => void;
}) {
  return (
    <li>
      <button
        onClick={() => onAttach({ name: client.name, contact: client.contact })}
        className={`w-full flex items-center gap-3 min-h-[4rem] px-4 py-3 text-left transition-colors ${
          attached ? "bg-orange-50" : "hover:bg-gray-50 active:bg-orange-50"
        }`}
      >
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-gray-800 truncate">{client.name}</span>
          <span className="block text-sm text-gray-500 truncate">
            {client.contact || "No contact number"}
          </span>
        </span>
        {attached && (
          <svg
            className="w-6 h-6 flex-shrink-0 text-[var(--color-brand-text)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </li>
  );
}
