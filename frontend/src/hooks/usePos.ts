import { useCallback, useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  CartItem,
  ConfirmModalState,
  PaymentMethod,
  PosCategory,
  PosProduct,
  Sale,
} from "../types/domain";

const EMPTY_CONFIRM_MODAL: ConfirmModalState = {
  isOpen: false,
  paymentMethod: "",
  customerName: "",
  customerContact: "",
  deliveryDate: "",
  notes: "",
};

interface UsePosOptions {
  posProducts: PosProduct[];
  /**
   * Orders-owned pre-order creation for deliveries scheduled after today.
   * Injected by the app shell so order state stays owned by useOrders.
   */
  createOrderFromSale: (sale: Sale) => void;
}

/**
 * Owns the POS feature: product category filter, cart, checkout confirmation
 * modal, completed sales, receipts and the resizable ticket panel.
 */
export function usePos({ posProducts, createOrderFromSale }: UsePosOptions) {
  const [posCategory, setPosCategory] = useState<PosCategory>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(EMPTY_CONFIRM_MODAL);
  const [sales, setSales] = useState<Sale[]>([]);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  // --- RESIZABLE TICKET STATE ---
  const [cartWidth, setCartWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: ReactMouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 300 && newWidth <= 800) {
          setCartWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // --- PRODUCT FILTER & CART TOTALS ---
  const filteredPosProducts =
    posCategory === "All"
      ? posProducts
      : posProducts.filter((p) => p.category === posCategory);

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );
  const cartTax = cartSubtotal * 0.05;
  const cartTotal = cartSubtotal + cartTax;
  const todayISO = new Date().toISOString().slice(0, 10);

  // --- CART ACTIONS ---
  const addToCart = (product: PosProduct) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  const adjustCartQty = (id: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // --- CHECKOUT (FR-5) ---
  const completeSale = () => {
    // Orders scheduled for delivery on a later date are tracked in the Orders view
    const isPreOrder = confirmModal.deliveryDate > todayISO;
    const sale: Sale = {
      id: `SALE-${String(sales.length + 1).padStart(4, "0")}`,
      type: isPreOrder ? "Pre-Order" : "Walk-in",
      customerName: confirmModal.customerName.trim(),
      customerContact: confirmModal.customerContact.trim(),
      // Confirm is disabled until a payment method is chosen (isConfirmOrderDisabled).
      paymentMethod: confirmModal.paymentMethod as PaymentMethod,
      items: cart,
      subtotal: cartSubtotal,
      tax: cartTax,
      total: cartTotal,
      deliveryDate: confirmModal.deliveryDate || todayISO,
      notes: confirmModal.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    setSales((prev) => [sale, ...prev]);
    if (sale.type === "Pre-Order") {
      createOrderFromSale(sale);
    }
    setCart([]);
    setConfirmModal(EMPTY_CONFIRM_MODAL);
    setReceipt(sale);
  };

  const updateConfirmField = (
    field: Exclude<keyof ConfirmModalState, "isOpen">,
    value: string
  ) => {
    setConfirmModal((prev) => ({ ...prev, [field]: value }));
  };

  const closeConfirmModal = () => {
    setConfirmModal(EMPTY_CONFIRM_MODAL);
  };

  const isConfirmOrderDisabled =
    !confirmModal.paymentMethod || !confirmModal.customerName.trim();

  return {
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
    confirmModal,
    setConfirmModal,
    updateConfirmField,
    closeConfirmModal,
    completeSale,
    sales,
    receipt,
    setReceipt,
    cartWidth,
    isResizing,
    startResizing,
    todayISO,
    isConfirmOrderDisabled,
  };
}