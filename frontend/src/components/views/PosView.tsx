import React from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { SearchIcon } from "../icons";
import type {
  CartItem,
  ConfirmModalState,
  ISODate,
  PosCategory,
  PosProduct,
} from "../../types/domain";

interface PosViewProps {
  posCategory: PosCategory;
  setPosCategory: (category: PosCategory) => void;
  filteredPosProducts: PosProduct[];
  addToCart: (product: PosProduct) => void;
  cart: CartItem[];
  adjustCartQty: (id: string, delta: number) => void;
  setCart: (cart: CartItem[]) => void;
  cartSubtotal: number;
  cartTax: number;
  cartTotal: number;
  setConfirmModal: (modal: ConfirmModalState) => void;
  todayISO: ISODate;
  windowWidth: number;
  cartWidth: number;
  startResizing: (e: ReactMouseEvent) => void;
}

export default function PosView({
  posCategory,
  setPosCategory,
  filteredPosProducts,
  addToCart,
  cart,
  adjustCartQty,
  setCart,
  cartSubtotal,
  cartTax,
  cartTotal,
  setConfirmModal,
  todayISO,
  windowWidth,
  cartWidth,
  startResizing,
}: PosViewProps) {
  return (
    <div className="flex flex-col-reverse md:flex-row h-full w-full animate-fadeIn">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="bg-white shadow-sm border-b border-gray-200 z-10 flex-shrink-0">
          <div className="p-4 flex items-center gap-4 overflow-x-auto hide-scrollbar">
            {(["All", "Pastries", "Bread", "Cakes", "Drinks"] as const satisfies readonly PosCategory[]).map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setPosCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                    posCategory === cat
                      ? "bg-[#562D07] text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              )
            )}
            <div className="ml-auto flex-shrink-0 hidden md:block relative">
              <input
                type="text"
                placeholder="Search items..."
                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-[#F17D0C] outline-none"
              />
              <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {filteredPosProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`relative w-full aspect-square rounded-xl shadow-sm hover:shadow-md transition-all transform active:scale-95 flex flex-col justify-between p-3 ${product.color} text-white overflow-hidden group`}
              >
                <span className="self-end text-sm font-bold opacity-90 drop-shadow-sm">
                  ₱{product.price}
                </span>
                <span className="self-start text-left text-sm md:text-base font-bold leading-tight drop-shadow-sm group-hover:underline">
                  {product.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Current Ticket / Cart */}
      <div
        className="w-full bg-white border-b md:border-b-0 md:border-l border-gray-200 shadow-md md:shadow-xl flex flex-col max-h-[45vh] md:max-h-none md:h-full flex-shrink-0 z-20 relative"
        style={{
          width:
            windowWidth < 768
              ? "100%"
              : windowWidth < 1024
              ? 260
              : cartWidth,
        }}
      >
        <div
          className="hidden md:block absolute left-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-[#F17D0C] active:bg-[#F17D0C] transition-colors z-50"
          onMouseDown={startResizing}
          title="Drag to resize cart"
        />

        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 text-[#562D07]">
            <svg
              className="w-5 h-5"
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
            <h3 className="font-bold text-lg">Current Ticket</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Clear Ticket"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-white min-h-[100px]">
          {cart.length === 0 ? (
            <div className="py-6 md:h-full flex flex-col items-center justify-center text-gray-400 text-center">
              <svg
                className="w-12 h-12 md:w-16 md:h-16 mb-2 md:mb-4 opacity-20"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
              <p className="font-medium text-base md:text-lg text-gray-500">
                No items added
              </p>
              <p className="text-xs md:text-sm mt-1">
                Tap products to add them to the ticket.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cart.map((item) => (
                <li key={item.id} className="p-4 hover:bg-gray-50 group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-gray-800 text-[15px]">
                      {item.name}
                    </span>
                    <span className="font-bold text-gray-900">
                      ₱{(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500 text-sm">
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <button
                        onClick={() => adjustCartQty(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-600 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20 12H4"
                          />
                        </svg>
                      </button>
                      <span className="w-8 text-center font-bold text-[#121212]">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => adjustCartQty(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-600 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                    </div>
                    <span>
                      {item.qty} x ₱{item.price.toFixed(2)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 p-4 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="space-y-1 md:space-y-2 mb-3 md:mb-4">
            <div className="flex justify-between text-gray-500 text-sm font-medium">
              <span>Subtotal</span>
              <span>₱{cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-sm font-medium border-b border-gray-200 pb-2">
              <span>Tax (5%)</span>
              <span>₱{cartTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#121212] text-lg md:text-xl font-bold pt-1">
              <span>Total</span>
              <span>₱{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() =>
              setConfirmModal({
                isOpen: true,
                paymentMethod: "",
                customerName: "",
                customerContact: "",
                deliveryDate: todayISO,
                notes: "",
              })
            }
            className={`w-full py-3 md:py-4 rounded-xl text-sm md:text-base font-bold shadow-lg transition-all transform active:scale-[0.98] ${
              cart.length > 0
                ? "bg-[#F17D0C] hover:bg-[#d86b06] text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
            }`}
          >
            Order
          </button>
        </div>
      </div>
    </div>
  );
}