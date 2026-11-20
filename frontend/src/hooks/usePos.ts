import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { toOrderId } from "./useOrders";
import { recordAuditEvent } from "../utils/auditLog";
import { computeSaleTotals, validateCheckout } from "../utils/checkout";
import { DEFAULT_POS_COLOR } from "../utils/catalogue";
import { todayISO } from "../utils/dates";
import { formatMoney } from "../utils/money";
import { toContactDigits } from "../utils/orders";
import type {
  CartItem,
  ConfirmModalState,
  PaymentMethod,
  PosCategory,
  PosProduct,
  Sale,
  SaleType,
  TicketCustomer,
  User,
} from "../types/domain";

const EMPTY_CONFIRM_MODAL: ConfirmModalState = {
  isOpen: false,
  saleType: "Walk-in",
  paymentMethod: "",
  customerName: "",
  customerContact: "",
  deliveryDate: "",
  notes: "",
};

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "GCash", "Bank Transfer", "Card"];

interface BackendTransactionItem {
  menu_item_id: number;
  item_name: string;
  quantity: string | number;
  unit_price: string | number;
}

interface BackendTransaction {
  id: number;
  order_id: number | null;
  payment_method: string;
  subtotal: string | number;
  tax_amount: string | number | null;
  total_amount: string | number;
  customer_name: string;
  customer_contact: string;
  notes: string;
  delivery_date: string | null;
  transaction_timestamp: string | null;
  items: BackendTransactionItem[];
}

function toSale(tx: BackendTransaction, productsById: Map<string, PosProduct>): Sale {
  if (!tx || typeof tx !== "object" || !Array.isArray(tx.items)) {
    throw new Error("The transaction response was invalid.");
  }
  const createdAt = tx.transaction_timestamp || new Date().toISOString();
  const saleDay = createdAt.slice(0, 10);
  const isOrder = tx.order_id !== null || (!!tx.delivery_date && tx.delivery_date > saleDay);
  return {
    id: String(tx.id),
    orderId: tx.order_id !== null ? toOrderId(tx.order_id) : undefined,
    type: isOrder ? "Order" : "Walk-in",
    customerName: tx.customer_name,
    customerContact: tx.customer_contact,
    paymentMethod: PAYMENT_METHODS.includes(tx.payment_method as PaymentMethod)
      ? (tx.payment_method as PaymentMethod)
      : "Cash",
    items: tx.items.map((item): CartItem => {
      const id = String(item.menu_item_id);
      const product = productsById.get(id);
      return {
        id,
        name: item.item_name,
        price: Number(item.unit_price),
        category: product?.category ?? "Pastries",
        color: product?.color ?? DEFAULT_POS_COLOR,
        qty: Number(item.quantity),
      };
    }),
    subtotal: Number(tx.subtotal),
    tax: tx.tax_amount === null ? 0 : Number(tx.tax_amount),
    total: Number(tx.total_amount),
    deliveryDate: tx.delivery_date || saleDay,
    notes: tx.notes,
    createdAt,
  };
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function checkoutErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Network error. Your cart is still here; retry checkout to safely submit the same sale.";
  }
  if (error.status === 401) return "Your session has expired. Sign in again before completing this sale.";
  if (error.status === 403) return "Your account is not permitted to complete POS sales.";
  if (error.status === 409) {
    return "This checkout key was already used for different sale details. Change the sale details before retrying.";
  }
  const details = error.details;
  const detail =
    details && typeof details === "object" ? (details as { detail?: unknown }).detail ?? details : details;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const flat = Object.values(detail)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map(String)
      .join(" ");
    if (flat) return flat;
  }
  return "The sale could not be completed. Check stock and sale details, then retry.";
}

interface UsePosOptions {
  /** POS projection of the catalogue (posProducts in the store). */
  posProducts: PosProduct[];
  /**
   * Called after the server commits a sale. The backend has already deducted
   * walk-in stock and created the order for an Order-type sale, so the store
   * reloads stock and orders here.
   */
  onSaleCommitted: () => Promise<unknown> | void;
  currentUser: User | null;
  /** Seeded sales; a test fixture replaces the server load. */
  sales?: Sale[];
}

/**
 * Owns the POS feature: product filters, cart, the customer attached to the
 * open ticket, checkout confirmation, completed sales and receipts. Checkout
 * posts to /api/v1/pos/transactions/ with an idempotency key, so a retried
 * request after a network failure cannot record the same sale twice. The
 * backend keeps transactions immutable, so there is no sale edit here.
 */
export function usePos({ posProducts, onSaleCommitted, currentUser, sales: seededSales }: UsePosOptions) {
  const [posCategory, setPosCategory] = useState<PosCategory>("All");
  const [posSearch, setPosSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ticketCustomer, setTicketCustomer] = useState<TicketCustomer | null>(null);
  const [customerDraft, setCustomerDraft] = useState<TicketCustomer>({ name: "", contact: "" });
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isTicketViewOpen, setIsTicketViewOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(EMPTY_CONFIRM_MODAL);
  const [sales, setSales] = useState<Sale[]>(seededSales ?? []);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const pendingCheckoutRef = useRef<{ signature: string; key: string } | null>(null);

  const productsById = new Map(posProducts.map((p) => [p.id, p]));

  useEffect(() => {
    if (seededSales) return;
    let cancelled = false;
    api
      .get<BackendTransaction[]>("/api/v1/pos/transactions/")
      .then((rows) => {
        if (cancelled) return;
        const loaded = rows.map((row) => toSale(row, productsById));
        setSales(loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      })
      .catch((error: unknown) => {
        if (!cancelled) setSalesError(checkoutErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- PRODUCT FILTER & CART TOTALS ---
  const searchQuery = posSearch.trim().toLowerCase();
  const filteredPosProducts = posProducts.filter(
    (p) =>
      (posCategory === "All" || p.category === posCategory) &&
      (!searchQuery || p.name.toLowerCase().includes(searchQuery))
  );

  const { subtotal: cartSubtotal, tax: cartTax, total: cartTotal } = computeSaleTotals(cart);
  const cartQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const today = todayISO();

  // --- CART ACTIONS ---
  const addToCart = (product: PosProduct) => {
    setCheckoutError(null);
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
    setCheckoutError(null);
    const nextCart = cart
      .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
      .filter((item) => item.qty > 0);
    setCart(nextCart);
    if (nextCart.length === 0) setIsTicketViewOpen(false);
  };

  const clearTicket = () => {
    setCart([]);
    setTicketCustomer(null);
    setIsTicketViewOpen(false);
    setCheckoutError(null);
  };

  const openTicketView = () => setIsTicketViewOpen(true);
  const closeTicketView = () => setIsTicketViewOpen(false);

  const attachTicketCustomer = (customer: TicketCustomer) => {
    setTicketCustomer(customer);
    setIsCustomerPickerOpen(false);
  };

  const clearTicketCustomer = () => setTicketCustomer(null);
  const openCustomerPicker = () => {
    if (!isCustomerPickerOpen) {
      setCustomerDraft({
        name: ticketCustomer?.name ?? "",
        contact: ticketCustomer?.contact ?? "",
      });
    }
    setIsCustomerPickerOpen(true);
  };
  const closeCustomerPicker = () => setIsCustomerPickerOpen(false);
  const updateCustomerDraft = (field: keyof TicketCustomer, value: string) =>
    setCustomerDraft((prev) => ({ ...prev, [field]: value }));

  const openConfirmModal = () => {
    setCheckoutError(null);
    setConfirmModal({
      ...EMPTY_CONFIRM_MODAL,
      isOpen: true,
      customerName: ticketCustomer?.name ?? "",
      customerContact: ticketCustomer ? toContactDigits(ticketCustomer.contact) : "",
    });
  };

  // --- CHECKOUT (FR-5, FR-8) ---
  const completeSale = async () => {
    if (isSubmittingRef.current || cart.length === 0) return;
    if (!validateCheckout(confirmModal).isValid || !confirmModal.paymentMethod) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setCheckoutError(null);

    const isOrder = confirmModal.saleType === "Order";
    const checkout = {
      items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.qty.toFixed(2) })),
      customer_name: confirmModal.customerName.trim(),
      customer_contact: confirmModal.customerContact.trim(),
      payment_method: confirmModal.paymentMethod,
      payment_reference: "",
      notes: confirmModal.notes.trim(),
      // The backend opens an order for any sale delivered after today.
      delivery_date: isOrder && confirmModal.deliveryDate ? confirmModal.deliveryDate : null,
    };
    const signature = JSON.stringify(checkout);
    if (!pendingCheckoutRef.current || pendingCheckoutRef.current.signature !== signature) {
      pendingCheckoutRef.current = { signature, key: createIdempotencyKey() };
    }

    try {
      const response = await api.post<BackendTransaction>("/api/v1/pos/transactions/", {
        ...checkout,
        idempotency_key: pendingCheckoutRef.current.key,
      });
      const sale = toSale(response, productsById);
      pendingCheckoutRef.current = null;
      setSales((prev) => [sale, ...prev.filter((s) => s.id !== sale.id)]);
      setSalesError(null);
      if (currentUser) {
        recordAuditEvent({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "sale.completed",
          entityType: "Sale",
          entityId: sale.id,
          details: `${sale.type} sale ${sale.id} completed (${sale.items.length} line${
            sale.items.length === 1 ? "" : "s"
          }, ${formatMoney(sale.total)}, ${sale.paymentMethod})`,
        });
      }
      setCart([]);
      setTicketCustomer(null);
      setIsTicketViewOpen(false);
      setConfirmModal(EMPTY_CONFIRM_MODAL);
      setReceipt(sale);
      try {
        await onSaleCommitted();
      } catch {
        // The sale is committed; the next screen load picks up the new stock.
      }
    } catch (error) {
      setCheckoutError(checkoutErrorMessage(error));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const updateConfirmField = (
    field: Exclude<keyof ConfirmModalState, "isOpen" | "saleType">,
    value: string
  ) => {
    setCheckoutError(null);
    setConfirmModal((prev) => ({ ...prev, [field]: value }));
  };

  const setSaleType = (saleType: SaleType) => {
    setCheckoutError(null);
    setConfirmModal((prev) => ({
      ...prev,
      saleType,
      deliveryDate: saleType === "Walk-in" ? "" : prev.deliveryDate,
    }));
  };

  const closeConfirmModal = () => {
    setCheckoutError(null);
    setConfirmModal(EMPTY_CONFIRM_MODAL);
  };

  const isConfirmOrderDisabled = isSubmitting || !validateCheckout(confirmModal).isValid;

  return {
    posCategory,
    setPosCategory,
    posSearch,
    setPosSearch,
    filteredPosProducts,
    addToCart,
    cart,
    adjustCartQty,
    clearTicket,
    isTicketViewOpen,
    openTicketView,
    closeTicketView,
    ticketCustomer,
    attachTicketCustomer,
    clearTicketCustomer,
    customerDraft,
    updateCustomerDraft,
    isCustomerPickerOpen,
    openCustomerPicker,
    closeCustomerPicker,
    openConfirmModal,
    cartSubtotal,
    cartTax,
    cartTotal,
    cartQty,
    confirmModal,
    updateConfirmField,
    setSaleType,
    closeConfirmModal,
    completeSale,
    isSubmitting,
    checkoutError,
    sales,
    salesError,
    receipt,
    setReceipt,
    todayISO: today,
    isConfirmOrderDisabled,
  };
}
