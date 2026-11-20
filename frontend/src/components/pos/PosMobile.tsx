import React, { useState } from "react";
import SelectField from "../common/SelectField";
import TicketLineItem from "./TicketLineItem";
import { SearchIcon } from "../icons";
import { POS_CATEGORIES } from "../../data/initialCatalogue";
import { formatMoney } from "../../utils/money";
import type {
  CartItem,
  PosCategory,
  PosProduct,
  TicketCustomer,
} from "../../types/domain";

interface PosMobileProps {
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
  cartSubtotal: number;
  cartTax: number;
  cartTotal: number;
  customer: TicketCustomer | null;
  onRemoveCustomer: () => void;
  onConfirmOrder: () => void;
}

/**
 * Phone layout for the POS: a scrollable product list with the ticket reached
 * as its own screen, mirroring how a cashier works a counter — ring items up,
 * then open the ticket to check it before ordering.
 */
export default function PosMobile({
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
  cartSubtotal,
  cartTax,
  cartTotal,
  customer,
  onRemoveCustomer,
  onConfirmOrder,
}: PosMobileProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setPosSearch("");
  };

  const qtyInCart = (id: string) =>
    cart.find((item) => item.id === id)?.qty ?? 0;

  return (
    <div className="md:hidden flex flex-col h-full w-full min-h-0 animate-fadeIn">
      {isTicketViewOpen ? (
        <>
          <button
            onClick={closeTicketView}
            className="flex-shrink-0 flex items-center gap-2 min-h-[3rem] px-4 text-left font-bold text-[#562D07] hover:bg-gray-200 active:bg-gray-300 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to items
          </button>

          {customer && (
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-y border-gray-200">
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </p>
                <p className="truncate font-bold text-gray-800">{customer.name}</p>
              </div>
              <button
                onClick={onRemoveCustomer}
                aria-label={`Remove ${customer.name} from the ticket`}
                className="flex-shrink-0 min-h-[2.75rem] min-w-[2.75rem] flex items-center justify-center rounded-lg text-gray-500 hover:text-red-500 hover:bg-gray-100 transition-colors"
              >
                <svg
                  className="w-5 h-5"
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
          )}

          <div className="flex-1 min-h-0 overflow-y-auto bg-white">
            <ul className="divide-y divide-gray-100">
              {cart.map((item) => (
                <TicketLineItem
                  key={item.id}
                  item={item}
                  onAdjustQty={adjustCartQty}
                  className="p-4 text-[0.95rem]"
                />
              ))}
            </ul>
          </div>

          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-gray-500 text-[0.95rem] font-medium">
                <span>Subtotal</span>
                <span>{formatMoney(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[0.95rem] font-medium border-b border-gray-200 pb-1.5">
                <span>Tax (5%)</span>
                <span>{formatMoney(cartTax)}</span>
              </div>
              <div className="flex justify-between text-[#121212] text-[1.05rem] font-bold pt-1">
                <span>Total</span>
                <span>{formatMoney(cartTotal)}</span>
              </div>
            </div>
            <TicketButton
              label="Order"
              total={cartTotal}
              disabled={cart.length === 0}
              onClick={onConfirmOrder}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex-shrink-0 p-4 pb-3">
            <TicketButton
              label="Check Ticket"
              total={cartTotal}
              disabled={cart.length === 0}
              onClick={openTicketView}
            />
          </div>

          <div className="flex-shrink-0 bg-white border-y border-gray-200 p-3 flex items-center gap-2">
            <SelectField
              value={posCategory}
              onChange={(e) =>
                setPosCategory(e.target.value as PosCategory)
              }
              aria-label="Filter items by category"
              wrapperClassName="flex-1 min-w-0"
              className="min-h-[2.75rem] w-full pl-3 pr-10 bg-gray-100 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-[var(--color-brand-text)] outline-none"
            >
              {POS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "All" ? "All items" : cat}
                </option>
              ))}
            </SelectField>
            <button
              onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
              aria-pressed={isSearchOpen}
              aria-label={isSearchOpen ? "Close item search" : "Search items"}
              className={`flex-shrink-0 min-h-[2.75rem] min-w-[2.75rem] px-3 rounded-lg border transition-colors flex items-center justify-center ${
                isSearchOpen
                  ? "bg-[#562D07] border-[#562D07] text-white"
                  : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isSearchOpen ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <SearchIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {isSearchOpen && (
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 pb-3">
              <input
                autoFocus
                type="text"
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                placeholder="Search items..."
                aria-label="Search items"
                className="w-full min-h-[2.75rem] px-3 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[var(--color-brand-text)] outline-none"
              />
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto bg-white">
            {filteredPosProducts.length === 0 ? (
              <p className="p-6 text-center text-gray-500">
                No items match. Try a different category or search.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredPosProducts.map((product) => {
                  const qty = qtyInCart(product.id);
                  return (
                    <li key={product.id}>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full flex items-center gap-3 min-h-[4rem] px-4 py-3 text-left hover:bg-gray-50 active:bg-orange-50 transition-colors"
                      >
                        <span className="relative flex-shrink-0">
                          <span
                            aria-hidden="true"
                            className={`block h-12 w-12 rounded-lg ${product.color}`}
                          />
                          {qty > 0 && (
                            <span className="absolute -right-1.5 -bottom-1.5 min-w-[1.4rem] h-[1.4rem] px-1 rounded-full bg-[var(--color-brand-strong)] text-white text-xs font-bold flex items-center justify-center shadow">
                              {qty}
                            </span>
                          )}
                        </span>
                        <span className="flex-1 min-w-0 font-bold text-gray-800 leading-tight">
                          {product.name}
                        </span>
                        <span className="flex-shrink-0 font-bold text-[#121212]">
                          {formatMoney(product.price)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** The wide phone action, pinned above the catalogue and at the foot of the
 *  ticket. The two screens ask for different things, so the label comes from
 *  the caller while the running total stays. */
function TicketButton({
  label,
  total,
  disabled,
  onClick,
}: {
  label: string;
  total: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full min-h-[3.25rem] py-2.5 rounded-xl font-bold shadow-lg transition-all transform active:scale-[0.98] flex flex-col items-center justify-center leading-tight ${
        disabled
          ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
          : "bg-[var(--color-brand-strong)] hover:bg-[var(--color-brand-strong-hover)] text-white"
      }`}
    >
      <span className="text-[1.05rem]">{label}</span>
      <span className="text-[0.95rem]">{formatMoney(total)}</span>
    </button>
  );
}
