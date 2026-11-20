import { todayISO } from "./dates";
import { buildEditHistoryEntry, diffField, diffLines } from "./editHistory";
import { isValidCustomerContact } from "./orders";
import type {
  CartItem,
  CheckoutError,
  CheckoutValidation,
  ConfirmModalState,
  EditSaleInput,
  FieldEdit,
  Order,
  OrderDraft,
  OrderItem,
  Sale,
  SaleId,
  SaleTotals,
} from "../types/domain";

/** VAT applied to every sale subtotal. */
export const SALES_TAX_RATE = 0.05;

/**
 * Monotonic sale-number counter. Unlike a `sales.length` index it survives
 * deletions and cannot repeat a number a receipt has already printed.
 */
let nextSaleSeq = 1;
const nextSaleId = (): SaleId => `SALE-${String(nextSaleSeq++).padStart(4, "0")}`;

export function computeSaleTotals(lines: CartItem[]): SaleTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const tax = subtotal * SALES_TAX_RATE;
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * The one checkout rule: who the sale reaches, how it is paid, and — for an
 * Order — that it is scheduled ahead. The confirm button and the handler both
 * read this, so they cannot disagree about what is submittable.
 */
export function validateCheckout(
  state: ConfirmModalState,
  clock: Date = new Date()
): CheckoutValidation {
  const errors: CheckoutError[] = [];
  if (!state.customerName.trim()) errors.push("customer-name");
  if (!isValidCustomerContact(state.customerContact)) errors.push("customer-contact");
  if (!state.paymentMethod) errors.push("payment-method");
  if (state.saleType === "Order" && !(state.deliveryDate > todayISO(clock))) {
    errors.push("delivery-date");
  }
  return { isValid: errors.length === 0, errors };
}

export function toOrderLines(lines: CartItem[]): OrderItem[] {
  return lines.map((line) => ({
    menuItemId: line.id,
    name: line.name,
    qty: line.qty,
    unitPrice: line.price,
  }));
}

/**
 * Builds the sale record from a validated confirm modal; returns null when the
 * checkout rule rejects the state. The caller adds the order link after the
 * order exists.
 */
export function buildSale(
  state: ConfirmModalState,
  cart: CartItem[],
  clock: Date = new Date()
): Sale | null {
  if (!validateCheckout(state, clock).isValid) return null;
  // validateCheckout rejects an unselected method; this second check narrows
  // the form's "" placeholder out of the sale's PaymentMethod.
  if (!state.paymentMethod) return null;

  const isOrder = state.saleType === "Order";
  return {
    id: nextSaleId(),
    type: state.saleType,
    customerName: state.customerName.trim(),
    customerContact: state.customerContact.trim(),
    paymentMethod: state.paymentMethod,
    items: cart,
    ...computeSaleTotals(cart),
    // Only Orders carry a delivery date; walk-ins are handed over today.
    deliveryDate: isOrder && state.deliveryDate ? state.deliveryDate : todayISO(clock),
    notes: state.notes.trim(),
    createdAt: clock.toISOString(),
  };
}

/**
 * The order half of a POS Order-type transaction, before useOrders mints the
 * id. It is created paid in full: the sale is the payment record.
 */
export function buildOrderFromSale(sale: Sale, clock: Date = new Date()): OrderDraft {
  const today = todayISO(clock);
  return {
    clientId: null,
    customerName: sale.customerName,
    customerContact: sale.customerContact,
    items: toOrderLines(sale.items),
    requestedDate: today,
    status: "Pending",
    notes: sale.notes ? `Placed via POS Order — ${sale.notes}` : "Placed via POS Order",
    deliveryDate: sale.deliveryDate,
    assignedTo: null,
    createdAt: today,
    deliveredAt: null,
    paymentMethod: sale.paymentMethod,
    amountPaid: sale.total,
  };
}

/**
 * What Reports shows for a sale: a walk-in as recorded, an Order-type sale as
 * its linked order currently stands. The order is the only editor for those
 * transactions, so customer, lines and money follow it; the sale keeps its
 * own id, payment method and placement date.
 */
export function linkedSaleView(sale: Sale, orders: Order[]): Sale {
  if (!sale.orderId) return sale;
  const order = orders.find((o) => o.id === sale.orderId);
  if (!order) return sale;

  const items = order.items.map((line): CartItem => {
    const sold = sale.items.find((item) => item.id === line.menuItemId);
    return {
      id: line.menuItemId,
      name: line.name || sold?.name || line.menuItemId,
      price: line.unitPrice,
      qty: line.qty,
      // Catalogue presentation fields; reports only read id, name, qty and price.
      category: sold?.category ?? "Pastries",
      color: sold?.color ?? "",
    };
  });

  return {
    ...sale,
    customerName: order.customerName || sale.customerName,
    customerContact: order.customerContact || sale.customerContact,
    items,
    ...computeSaleTotals(items),
  };
}

export interface SaleEditResult {
  sale: Sale;
  changes: FieldEdit[];
}

/** How one sale line reads in an edit-history entry. */
const describeSaleLine = (line: CartItem) => `${line.qty} × ${line.name}`;

/**
 * A walk-in sale edit, with its history entry and recomputed totals. Linked
 * sales return null: their order is the only editor.
 */
export function buildSaleEdit(
  sale: Sale,
  input: EditSaleInput,
  editedBy: string
): SaleEditResult | null {
  if (sale.orderId) return null;
  if (!input.customerName.trim()) return null;
  if (!isValidCustomerContact(input.customerContact)) return null;

  const changes: FieldEdit[] = [];
  const name = diffField("customerName", "Customer name", sale.customerName, input.customerName);
  if (name) changes.push(name);
  const contact = diffField("customerContact", "Contact number", sale.customerContact, input.customerContact);
  if (contact) changes.push(contact);
  const items = diffLines("items", "Ordered items", sale.items, input.items, describeSaleLine);
  if (items) changes.push(items);
  if (changes.length === 0) return null;

  return {
    sale: {
      ...sale,
      customerName: input.customerName.trim(),
      customerContact: input.customerContact.trim(),
      items: input.items,
      ...computeSaleTotals(input.items),
      editHistory: [...(sale.editHistory ?? []), buildEditHistoryEntry(editedBy, changes)],
    },
    changes,
  };
}
