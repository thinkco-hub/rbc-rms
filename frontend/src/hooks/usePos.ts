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
import { api, ApiError } from "../api/client";

const EMPTY_CONFIRM_MODAL: ConfirmModalState = {
  isOpen: false,
  paymentMethod: "",
  customerName: "",
  customerContact: "",
  deliveryDate: "",
  notes: "",
};

interface UsePosOptions {
  isActive: boolean;
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
const CATEGORY_COLORS: Record<string, string> = {
  Pastries: "bg-amber-500",
  Bread: "bg-stone-500",
  Cakes: "bg-rose-500",
  Drinks: "bg-teal-700",
};

function catalogErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign in again to load POS products.";
    if (error.status === 403) return "Your account does not have permission to view POS products.";
    if (error.status >= 500) return "The POS catalog is temporarily unavailable. Try again shortly.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not load POS products.";
}

function toPosProduct(value: unknown): PosProduct {
  if (!value || typeof value !== "object") throw new Error("The POS catalog returned an invalid product.");
  const item = value as Record<string, unknown>;
  const id = Number(item.id);
  const price = Number(item.selling_price);
  const availableStock = Number(item.available_stock);
  if (
    !Number.isSafeInteger(id) || id <= 0 ||
    typeof item.name !== "string" ||
    !Number.isFinite(price) || price < 0 ||
    typeof item.category !== "string" ||
    typeof item.unit !== "string" ||
    !Number.isFinite(availableStock) || availableStock < 0
  ) {
    throw new Error("The POS catalog returned a product with invalid fields.");
  }
  return {
    id: String(id),
    name: item.name,
    price,
    category: item.category,
    unit: item.unit,
    availableStock,
    color: CATEGORY_COLORS[item.category] || "bg-[#562D07]",
  };
}

export function usePos({ isActive, createOrderFromSale }: UsePosOptions) {
  const [posCategory, setPosCategory] = useState<PosCategory>("All");
  const [posProducts, setPosProducts] = useState<PosProduct[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(EMPTY_CONFIRM_MODAL);
  const [sales, setSales] = useState<Sale[]>([]);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  // --- RESIZABLE TICKET STATE ---
  const [cartWidth, setCartWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const retryCatalogLoad = () => setCatalogRevision((revision) => revision + 1);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    setIsCatalogLoading(true);
    setCatalogError(null);
    setPosProducts([]);
    api.get<unknown>("/api/v1/pos/products/")
      .then((response) => {
        if (!Array.isArray(response)) throw new Error("The POS catalog response was not a product list.");
        const products = response.map(toPosProduct);
        if (!cancelled) setPosProducts(products);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPosProducts([]);
          setCatalogError(catalogErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setIsCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, catalogRevision]);

  useEffect(() => {
    if (isCatalogLoading || catalogError) return;
    const productsById = new Map(posProducts.map((product) => [product.id, product]));
    setCart((current) => current.flatMap((item) => {
      const latest = productsById.get(item.id);
      return latest ? [{ ...item, ...latest }] : [];
    }));
  }, [catalogError, isCatalogLoading, posProducts]);

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
      if (product.availableStock <= (existing?.qty ?? 0)) return prevCart;
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
            if (newQty <= 0) return null;
            if (newQty > item.availableStock) return item;
            return { ...item, qty: newQty };
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
    isCatalogLoading,
    catalogError,
    retryCatalogLoad,
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