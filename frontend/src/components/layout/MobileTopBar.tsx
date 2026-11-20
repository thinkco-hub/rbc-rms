import React, { useState } from "react";
import type { RefObject } from "react";
import DeleteConfirmDialog from "../common/DeleteConfirmDialog";
import { useAnnounce } from "../common/Announcer";
import type { TicketCustomer } from "../../types/domain";

/** Ticket header shown in place of the app title while the POS tab is open. */
export interface MobileTicketBar {
  /** Units on the ticket, counting a product added three times as three. */
  ticketCount: number;
  customer: TicketCustomer | null;
  onAddCustomer: () => void;
  onClearTicket: () => void;
}

interface MobileTopBarProps {
  onOpenMobileNav: () => void;
  /** The hamburger itself, so the drawer can hand focus back to it on close. */
  triggerRef: RefObject<HTMLButtonElement>;
  /** Pass the ticket details on the POS tab, and null on every other tab. */
  pos: MobileTicketBar | null;
}

/**
 * Header for the drawer layouts (phone and tablet); the shell only renders it
 * while the sidebar is off-canvas. The Chams ledger switch lives in the
 * navigation drawer rather than here, which frees the phone row up for the
 * ticket controls the POS needs within thumb reach at all times.
 */
export default function MobileTopBar({ onOpenMobileNav, triggerRef, pos }: MobileTopBarProps) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const announce = useAnnounce();

  const confirmClear = () => {
    pos?.onClearTicket();
    setIsClearConfirmOpen(false);
    announce("Ticket cleared.");
  };

  return (
    <div className="bg-[#562D07] text-[#FDF9F3] p-4 flex items-center gap-3 shadow-md z-30">
      <button
        ref={triggerRef}
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#562D07] bg-[#F3B978]/20 rounded-md flex-shrink-0"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {pos ? (
        <>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg font-bold">Ticket</span>
            <span className="min-w-[1.75rem] px-1 py-0.5 rounded border border-[#FDF9F3]/40 text-center font-mono text-sm">
              {pos.ticketCount}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={pos.onAddCustomer}
              aria-label={
                pos.customer
                  ? `Change the ticket customer, currently ${pos.customer.name}`
                  : "Add customer to ticket"
              }
              className={`max-w-[9rem] min-h-[2.75rem] px-2 rounded-md flex items-center gap-1.5 transition-colors ${
                pos.customer
                  ? "bg-[#F3B978]/40 hover:bg-[#F3B978]/60"
                  : "bg-[#F3B978]/20 hover:bg-[#F3B978]/40"
              }`}
            >
              {pos.customer ? (
                <>
                  <span className="truncate text-sm font-bold">
                    {pos.customer.name}
                  </span>
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <path d="M20 8v6M23 11h-6" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setIsClearConfirmOpen(true)}
              disabled={pos.ticketCount === 0}
              aria-label="Clear Ticket"
              title="Clear Ticket"
              className={`min-h-[2.75rem] min-w-[2.75rem] px-2 rounded-md flex items-center justify-center transition-colors ${
                pos.ticketCount === 0
                  ? "text-[#FDF9F3]/30 cursor-not-allowed"
                  : "bg-[#F3B978]/20 hover:bg-red-500/60"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          {isClearConfirmOpen && (
            <DeleteConfirmDialog
              title="Clear ticket?"
              message="Removes every item and the customer from the current ticket."
              confirmLabel="Clear Ticket"
              onConfirm={confirmClear}
              onCancel={() => setIsClearConfirmOpen(false)}
            />
          )}
        </>
      ) : (
        <span className="text-lg font-bold">Bakery HQ</span>
      )}
    </div>
  );
}
