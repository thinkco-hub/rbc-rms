import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  CartItem,
  ConfirmModalState,
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
  onStockUpdated?: () => Promise<unknown>;
}

interface BackendTransactionItem {
  menu_item_id: number;
  item_name: string;
  unit: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
}

interface BackendTransaction {
  id: number;
  status: string;
  payment_method: string;
  payment_reference: string;
  subtotal: string | number;
  discount_amount: string | number;
  tax_rate: string | number | null;
  tax_amount: string | number | null;
  total_amount: string | number;
  customer_name: string;
  customer_contact: string;
  notes: string;
  delivery_date: string | null;
  transaction_timestamp: string | null;
  items: BackendTransactionItem[];
}

function toSale(value: unknown): Sale {
  if (!value || typeof value !== "object") throw new Error("The transaction response was invalid.");
  const transaction = value as BackendTransaction;
  const transactionId = Number(transaction.id);
  if (
    !Number.isSafeInteger(transactionId) || transactionId <= 0 ||
    typeof transaction.status !== "string" ||
    !["Cash", "GCash", "Bank Transfer", "Card"].includes(transaction.payment_method) ||
    typeof transaction.customer_name !== "string" ||
    typeof transaction.customer_contact !== "string" ||
    typeof transaction.notes !== "string" ||
    !Array.isArray(transaction.items)
  ) {
    throw new Error("The transaction response was missing its ID or receipt lines.");
  }
  const items = transaction.items.map((item) => {
    const menuItemId = Number(item.menu_item_id);
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    const lineTotal = Number(item.line_total);
    if (
      !Number.isSafeInteger(menuItemId) || menuItemId <= 0 ||
      !Number.isFinite(qty) || qty <= 0 ||
      !Number.isFinite(price) || price < 0 || !Number.isFinite(lineTotal) || lineTotal < 0 ||
      typeof item.item_name !== "string" || typeof item.unit !== "string"
    ) {
      throw new Error("The transaction response contains an invalid receipt line.");
    }
    return {
      id: String(menuItemId),
      name: item.item_name,
      unit: item.unit,
      qty,
      price,
      lineTotal,
    };
  });
  const subtotal = Number(transaction.subtotal);
  const discount = Number(transaction.discount_amount);
  const total = Number(transaction.total_amount);
  const taxRate = transaction.tax_rate === null ? null : Number(transaction.tax_rate);
  const tax = transaction.tax_amount === null ? null : Number(transaction.tax_amount);
  if (
    !Number.isFinite(subtotal) || subtotal < 0 ||
    !Number.isFinite(discount) || discount < 0 ||
    !Number.isFinite(total) || total < 0 ||
    (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0)) ||
    (tax !== null && (!Number.isFinite(tax) || tax < 0))
  ) {
    throw new Error("The transaction response contains invalid financial values.");
  }
  const createdAt = transaction.transaction_timestamp;
  const deliveryDate = transaction.delivery_date;
  const saleDay = createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return {
    id: String(transactionId),
    type: deliveryDate && deliveryDate > saleDay ? "Pre-Order" : "Walk-in",
    status: transaction.status,
    customerName: transaction.customer_name,
    customerContact: transaction.customer_contact,
    paymentMethod: transaction.payment_method as Sale["paymentMethod"],
    paymentReference: transaction.payment_reference || "",
    items,
    subtotal,
    discount,
    taxRate,
    tax,
    total,
    deliveryDate,
    notes: transaction.notes,
    createdAt,
  };
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function mergeSales(existing: Sale[], loaded: Sale[]): Sale[] {
  const merged = new Map(loaded.map((sale) => [sale.id, sale]));
  for (const sale of existing) {
    if (!merged.has(sale.id)) merged.set(sale.id, sale);
  }
  return [...merged.values()].sort((left, right) =>
    (right.createdAt || "").localeCompare(left.createdAt || "")
  );
}

function checkoutErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Network error. Your cart is still here; retry checkout to safely submit the same sale.";
  }
  if (error.status === 401) return "Your session has expired. Sign in again before completing this sale.";
  if (error.status === 403) return "Your account is not permitted to complete POS sales.";
  if (error.status === 409) return "This checkout key was already used for different sale details. Change the sale details before retrying.";
  const detail = error.details && typeof error.details === "object"
    ? (error.details as { detail?: unknown }).detail
    : error.details;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(String).join(" ");
  if (detail && typeof detail === "object") {
    return Object.values(detail).flatMap((value) => Array.isArray(value) ? value : [value]).map(String).join(" ");
  }
  if (error.status === 400) return "The sale could not be completed. Check stock and sale details, then retry.";
  return error.message;
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

export function usePos({ isActive, onStockUpdated }: UsePosOptions) {
  const [posCategory, setPosCategory] = useState<PosCategory>("All");
  const [posProducts, setPosProducts] = useState<PosProduct[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(EMPTY_CONFIRM_MODAL);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const pendingCheckoutRef = useRef<{ signature: string; key: string } | null>(null);
  const catalogRequestRef = useRef(0);

  // --- RESIZABLE TICKET STATE ---
  const [cartWidth, setCartWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const refreshCatalog = useCallback(async () => {
    const requestId = ++catalogRequestRef.current;
    setIsCatalogLoading(true);
    setCatalogError(null);
    try {
      const response = await api.get<unknown>("/api/v1/pos/products/");
      if (!Array.isArray(response)) throw new Error("The POS catalog response was not a product list.");
      const products = response.map(toPosProduct);
      if (requestId === catalogRequestRef.current) {
        setPosProducts(products);
        const productsById = new Map(products.map((product) => [product.id, product]));
        setCart((current) => current.map((item) => ({
          ...item,
          ...(productsById.get(item.id) || { availableStock: 0 }),
        })));
      }
    } catch (error) {
      if (requestId === catalogRequestRef.current) {
        setPosProducts([]);
        setCatalogError(catalogErrorMessage(error));
      }
    } finally {
      if (requestId === catalogRequestRef.current) setIsCatalogLoading(false);
    }
  }, []);

  const retryCatalogLoad = refreshCatalog;

  useEffect(() => {
    if (!isActive) return;
    void refreshCatalog();
    return () => {
      catalogRequestRef.current += 1;
    };
  }, [isActive, refreshCatalog]);

  useEffect(() => {
    let cancelled = false;
    api.get<unknown>("/api/v1/pos/transactions/")
      .then((response) => {
        if (!Array.isArray(response)) throw new Error("The transaction history response was not a list.");
        const loadedSales = response.map(toSale);
        if (!cancelled) setSales((existing) => mergeSales(existing, loadedSales));
      })
      .catch((error: unknown) => {
        if (!cancelled) setSalesError(checkoutErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setCheckoutError(null);
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
    setCheckoutError(null);
    if (delta > 0 && (isCatalogLoading || catalogError)) return;
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
  const completeSale = async () => {
    if (isSubmittingRef.current || cart.length === 0) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setCheckoutError(null);
    const checkout = {
      items: cart.map((item) => ({
        menu_item_id: Number(item.id),
        quantity: item.qty.toFixed(2),
      })),
      customer_name: confirmModal.customerName.trim(),
      customer_contact: confirmModal.customerContact.trim(),
      payment_method: confirmModal.paymentMethod,
      payment_reference: "",
      notes: confirmModal.notes.trim(),
      delivery_date: confirmModal.deliveryDate || null,
    };
    const signature = JSON.stringify(checkout);
    if (!pendingCheckoutRef.current || pendingCheckoutRef.current.signature !== signature) {
      pendingCheckoutRef.current = { signature, key: createIdempotencyKey() };
    }

    try {
      const response = await api.post<unknown>("/api/v1/pos/transactions/", {
        ...checkout,
        idempotency_key: pendingCheckoutRef.current.key,
      });
      const sale = toSale(response);
      setSales((previous) => mergeSales(previous, [sale]));
      setSalesError(null);
      setCart([]);
      setConfirmModal(EMPTY_CONFIRM_MODAL);
      setReceipt(sale);
      pendingCheckoutRef.current = null;
      await refreshCatalog();
      try {
        await onStockUpdated?.();
      } catch {
        // The sale is already committed; a later view entry will reload inventory.
      }
    } catch (error) {
      setCheckoutError(checkoutErrorMessage(error));
      if (error instanceof ApiError && error.status === 400) void refreshCatalog();
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const updateConfirmField = (
    field: Exclude<keyof ConfirmModalState, "isOpen">,
    value: string
  ) => {
    setCheckoutError(null);
    setConfirmModal((prev) => ({ ...prev, [field]: value }));
  };

  const closeConfirmModal = () => {
    setCheckoutError(null);
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
    isSubmitting,
    checkoutError,
    salesLoading,
    salesError,
  };
}