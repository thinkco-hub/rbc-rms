import React, { useId } from "react";
import Modal from "../common/Modal";
import { toContactDigits } from "../../utils/orders";
import type { FormEvent } from "react";
import type { TicketCustomer } from "../../types/domain";

interface TicketCustomerFieldsProps {
  name: string;
  contact: string;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
}

/**
 * The free-text half of putting a customer on a ticket, lifted out of the order
 * confirmation modal so the checkout form and the ticket form are one shape.
 */
export function TicketCustomerFields({
  name,
  contact,
  onNameChange,
  onContactChange,
}: TicketCustomerFieldsProps) {
  const fieldId = useId();
  const nameId = `${fieldId}-name`;
  const contactId = `${fieldId}-contact`;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={nameId} className="block text-sm font-semibold text-gray-700 mb-2">
          Customer Name
        </label>
        <input
          id={nameId}
          type="text"
          placeholder="Enter customer name..."
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
        />
      </div>
      <div>
        <label htmlFor={contactId} className="block text-sm font-semibold text-gray-700 mb-2">
          Customer Contact
        </label>
        <input
          id={contactId}
          type="tel"
          inputMode="numeric"
          placeholder="09XXXXXXXXX"
          value={contact}
          onChange={(e) => onContactChange(toContactDigits(e.target.value))}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
        />
      </div>
    </div>
  );
}

interface TicketCustomerInputProps {
  name: string;
  contact: string;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onClose: () => void;
  onAttach: (customer: TicketCustomer) => void;
}

/**
 * The customer step for a role with no Clients tab. PosCustomerPicker reads the
 * client roster and can create one; this does neither — it is the same two
 * fields, so a cashier can put a name on a ticket without reaching the
 * collection. useClients.addClient refuses that role at the mutation, so the
 * absence of a roster is not the only thing standing there. The fields are
 * controlled by the pos slice so the draft outlives this route.
 */
export default function TicketCustomerInput({
  name,
  contact,
  onNameChange,
  onContactChange,
  onClose,
  onAttach,
}: TicketCustomerInputProps) {
  const isSaveDisabled = !name.trim() && !contact;
  const headingId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isSaveDisabled) return;
    onAttach({ name: name.trim(), contact });
  };

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      dismissOnBackdrop={false}
      overlayClassName="z-[100] bg-[#FDF9F3]"
      className="w-full h-full flex flex-col animate-fadeIn"
    >
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

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-lg mx-auto">
          <TicketCustomerFields
            name={name}
            contact={contact}
            onNameChange={onNameChange}
            onContactChange={onContactChange}
          />
          <p className="text-xs text-gray-500 mt-3">
            Saved to this ticket only. No client record is created.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaveDisabled}
              className={`flex-1 py-3 rounded-xl text-white font-bold transition-colors ${
                isSaveDisabled
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)]"
              }`}
            >
              Save to ticket
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
