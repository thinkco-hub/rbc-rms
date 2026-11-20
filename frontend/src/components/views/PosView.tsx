import React, { useState } from "react";
import DeleteConfirmDialog from "../common/DeleteConfirmDialog";
import { useAnnounce } from "../common/Announcer";
import PosMobile from "../pos/PosMobile";
import SelectField from "../common/SelectField";
import TicketLineItem from "../pos/TicketLineItem";
import { SearchIcon } from "../icons";
import { POS_CATEGORIES } from "../../data/initialCatalogue";
import { formatMoney } from "../../utils/money";
import type {
  CartItem,
  PosCategory,
  PosProduct,
  TicketCustomer,
} from "../../types/domain";

interface PosViewProps {
  posCategory: PosCategory;
  setPosCategory: (category: PosCategory) => void;
  posSearch: string;
  setPosSearch: (search: string) => void;
  filteredPosProducts: PosProduct[];
  addToCart: (product: PosProduct) => void;
  cart: CartItem[];
  adjustCartQty: (id: string, delta: number) => void;
  isTicketViewOpen: boolean;
  openTicketView: () => void;
  closeTicketView: () => void;
  clearTicket: () => void;
  cartSubtotal: number;
  cartTax: number;
  cartTotal: number;
  customer: TicketCustomer | null;
  onRemoveCustomer: () => void;
  onAddCustomer: () => void;
  openConfirmModal: () => void;
}

/**
 * The POS screen. Each breakpoint owns its own tree: a phone gets the product
 * list with the ticket reached as its own screen (PosMobile), while a tablet or
 * counter terminal gets products and ticket side by side so the cashier can
 * ring up and watch the ticket at the same time.
 */
export default function PosView({
  posCategory,
  setPosCategory,
  posSearch,
  setPosSearch,
  filteredPosProducts,
  addToCart,
  cart,
  adjustCartQty,
  isTicketViewOpen,
  openTicketView,
  closeTicketView,
  clearTicket,
  cartSubtotal,
  cartTax,
  cartTotal,
  customer,
  onRemoveCustomer,
  onAddCustomer,
  openConfirmModal,
}: PosViewProps) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const announce = useAnnounce();

  const confirmClear = () => {
    clearTicket();
    setIsClearConfirmOpen(false);
    announce("Ticket cleared.");
  };

  return (
    <>
      <PosMobile
        posCategory={posCategory}
        setPosCategory={setPosCategory}
        posSearch={posSearch}
        setPosSearch={setPosSearch}
        filteredPosProducts={filteredPosProducts}
        addToCart={addToCart}
        cart={cart}
        adjustCartQty={adjustCartQty}
        isTicketViewOpen={isTicketViewOpen}
        openTicketView={openTicketView}
        closeTicketView={closeTicketView}
        cartSubtotal={cartSubtotal}
        cartTax={cartTax}
        cartTotal={cartTotal}
        customer={customer}
        onRemoveCustomer={onRemoveCustomer}
        onConfirmOrder={openConfirmModal}
      />

      <div className="hidden md:flex md:flex-row h-full w-full animate-fadeIn">
        <div className="flex-1 basis-0 grow-[75] flex flex-col min-h-0 overflow-hidden">
          <div className="bg-white shadow-sm border-b border-gray-200 z-10 flex-shrink-0">
            <div className="p-4 flex items-center gap-4">
              <SelectField
                value={posCategory}
                onChange={(e) => setPosCategory(e.target.value as PosCategory)}
                aria-label="Filter items by category"
                className="min-h-[2.75rem] w-56 pl-3 bg-gray-100 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-[var(--color-brand-text)] outline-none"
              >
                {POS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "All" ? "All items" : cat}
                  </option>
                ))}
              </SelectField>
              <div className="ml-auto flex-shrink-0 relative">
                <input
                  type="text"
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  placeholder="Search items..."
                  aria-label="Search POS items"
                  className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-[var(--color-brand-text)] outline-none"
                />
                <SearchIcon className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredPosProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`relative w-full aspect-square rounded-xl shadow-sm hover:shadow-md transition-all transform active:scale-95 flex flex-col justify-end ${product.color} overflow-hidden group`}
                >
                  {/* Any catalogue colour can be the swatch, so the label brings its own plate. */}
                  <span className="flex flex-col gap-0.5 bg-white px-3 py-2 text-left border-t border-black/10">
                    <span className="text-base font-bold leading-tight text-[#121212] group-hover:underline">
                      {product.name}
                    </span>
                    <span className="text-sm font-bold text-[var(--color-brand-text)]">
                      {formatMoney(product.price)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Current Ticket / Cart */}
        <div className="@container w-full min-w-[240px] basis-0 grow-[25] h-full bg-white border-l border-gray-200 shadow-xl flex flex-col z-20 relative [--tk-title:clamp(1.05rem,4.5cqw,1.45rem)] [--tk-body:clamp(0.95rem,3.6cqw,1.15rem)] [--tk-pad:clamp(0.85rem,4cqw,1.4rem)]">
          <div className="p-[var(--tk-pad)] border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2 text-[#562D07] text-[length:var(--tk-title)]">
              <svg
                className="w-[1.15em] h-[1.15em] flex-shrink-0"
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
              <h2 className="font-bold text-[length:var(--tk-title)]">
                Current Ticket
              </h2>
            </div>
            <button
              onClick={() => setIsClearConfirmOpen(true)}
              disabled={cart.length === 0}
              className={`transition-colors p-[0.5em] min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center rounded-lg ${
                cart.length > 0
                  ? "text-gray-500 hover:text-red-500 hover:bg-red-50"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              title="Clear Ticket"
              aria-label="Clear Ticket"
            >
              <svg
                className="w-[1.4em] h-[1.4em]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
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

          {/* Ticket customer. Its own row rather than a header control: the panel
              narrows to 240px on a small tablet and the title has to stay legible. */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-white p-[var(--tk-pad)] text-[length:var(--tk-body)]">
            {customer ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onAddCustomer}
                  title={`Change the ticket customer, currently ${customer.name}`}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-[0.72em] font-semibold uppercase tracking-wide text-gray-500">
                    Customer
                  </p>
                  <p className="truncate font-bold text-gray-800">{customer.name}</p>
                </button>
                <button
                  onClick={onRemoveCustomer}
                  aria-label={`Remove ${customer.name} from the ticket`}
                  className="flex-shrink-0 min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center rounded-lg text-gray-500 hover:text-red-500 hover:bg-gray-100 transition-colors"
                >
                  <svg
                    className="w-[1.15em] h-[1.15em]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={onAddCustomer}
                className="w-full min-h-[2.75rem] px-2 rounded-lg border border-dashed border-gray-300 flex items-center justify-center gap-2 font-bold text-[#562D07] hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-[1.15em] h-[1.15em] flex-shrink-0"
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
                Add customer
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-white min-h-[100px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center">
                <svg
                  className="w-[clamp(3.5rem,22cqw,5.5rem)] h-[clamp(3.5rem,22cqw,5.5rem)] mb-[clamp(0.6rem,2.5cqw,1.2rem)] opacity-20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
                <p className="font-medium text-[length:var(--tk-title)] text-gray-500">
                  No items added
                </p>
                <p className="text-[length:var(--tk-body)] mt-1">
                  Tap products to add them to the ticket.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <TicketLineItem
                    key={item.id}
                    item={item}
                    onAdjustQty={adjustCartQty}
                    className="p-[var(--tk-pad)] text-[length:var(--tk-body)]"
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 p-[var(--tk-pad)] flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="space-y-[0.4em] mb-[var(--tk-pad)]">
              <div className="flex justify-between text-gray-500 text-[length:var(--tk-body)] font-medium">
                <span>Subtotal</span>
                <span>{formatMoney(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[length:var(--tk-body)] font-medium border-b border-gray-200 pb-[0.5em]">
                <span>Tax (5%)</span>
                <span>{formatMoney(cartTax)}</span>
              </div>
              <div className="flex justify-between text-[#121212] text-[length:var(--tk-title)] font-bold pt-[0.25em]">
                <span>Total</span>
                <span>{formatMoney(cartTotal)}</span>
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={openConfirmModal}
              className={`w-full min-h-[3rem] py-[var(--tk-pad)] rounded-xl text-[length:var(--tk-title)] font-bold shadow-lg transition-all transform active:scale-[0.98] ${
                cart.length > 0
                  ? "bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)] text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
              }`}
            >
              Order
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
