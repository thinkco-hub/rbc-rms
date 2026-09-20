import { useState } from "react";
import { initialOrders } from "../data/initialOrders";
import type {
  ClientId,
  CreateOrderData,
  Order,
  OrderDeliveryInput,
  OrderId,
  OrderItem,
  OrderPaymentInput,
  OrderStatus,
  Sale,
} from "../types/domain";

// Monotonic order-number counter. Seeds past the highest seeded order so new
// IDs never collide with the initial data (or with each other after deletes).
let nextOrderSeq = 1048 + initialOrders.length;
const nextOrderId = (): OrderId => `#${nextOrderSeq++}`;

/** Shared order construction for createOrder / createOrderFromSale. */
const buildOrder = (
  id: OrderId,
  data: Omit<CreateOrderData, "clientId"> & {
    clientId: ClientId | null;
    customerName?: string;
  }
): Order => ({
  id,
  clientId: data.clientId,
  customerName: data.customerName,
  items: data.items,
  requestedDate: data.requestedDate,
  status: "Pending",
  notes: data.notes,
  deliveryDate: null,
  assignedTo: null,
  createdAt: new Date().toISOString().slice(0, 10),
  deliveredAt: null,
  paymentMethod: null,
  amountPaid: 0,
});

interface UseOrdersOptions {
  /**
   * Inventory-owned deduction applied when an order is delivered. Injected by
   * the app shell so stock updates stay owned by useInventory.
   */
  deductOrderLines: (lines: OrderItem[]) => void;
}

/**
 * Owns the orders feature: the order list and the order detail panel
 * (viewingOrder), including payment recording, status changes, scheduling
 * and delivery.
 */
export function useOrders({ deductOrderLines }: UseOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const createOrder = (data: CreateOrderData) => {
    setOrders((prev) => [buildOrder(nextOrderId(), data), ...prev]);
  };

  const createOrderFromSale = (sale: Sale) => {
    const today = new Date().toISOString().slice(0, 10);
    const order: Order = buildOrder(nextOrderId(), {
      clientId: null,
      customerName: sale.customerName,
      items: sale.items.map((item) => ({
        menuItemId: item.id,
        name: item.name,
        qty: item.qty,
        unitPrice: item.price,
      })),
      requestedDate: today,
      notes: sale.notes
        ? `Placed via POS Pre-Order — ${sale.notes}`
        : "Placed via POS Pre-Order",
    });
    setOrders((prev) => [
      {
        ...order,
        deliveryDate: sale.deliveryDate,
        paymentMethod: sale.paymentMethod,
        amountPaid: sale.total,
      },
      ...prev,
    ]);
  };

  /**
   * Applies a patch to `orders`, mirroring it into `viewingOrder` if shown.
   * The patch may be a plain object or a function of the current order so the
   * two states can never drift apart.
   */
  const patchOrder = (
    id: OrderId,
    patch: Partial<Order> | ((order: Order) => Partial<Order>)
  ) => {
    const apply = (o: Order): Order => ({
      ...o,
      ...(typeof patch === "function" ? patch(o) : patch),
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? apply(o) : o)));
    setViewingOrder((prev) => (prev && prev.id === id ? apply(prev) : prev));
  };

  const recordOrderPayment = (id: OrderId, { method, amount }: OrderPaymentInput) => {
    patchOrder(id, (o) => ({
      paymentMethod: method,
      amountPaid: (o.amountPaid || 0) + amount,
    }));
  };

  const advanceOrderStatus = (id: OrderId, status: OrderStatus | null) => {
    if (!status) return;
    patchOrder(id, { status });
  };

  const scheduleOrderDelivery = (
    id: OrderId,
    { deliveryDate, assignedTo }: OrderDeliveryInput
  ) => {
    patchOrder(id, { deliveryDate, assignedTo });
  };

  const markOrderDelivered = (id: OrderId) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const deliveredAt = new Date().toISOString().slice(0, 10);

    deductOrderLines(order.items);

    patchOrder(id, { status: "Delivered", deliveredAt });
  };

  const clearViewingOrder = () => setViewingOrder(null);

  return {
    orders,
    viewingOrder,
    setViewingOrder,
    createOrder,
    createOrderFromSale,
    recordOrderPayment,
    advanceOrderStatus,
    scheduleOrderDelivery,
    markOrderDelivered,
    clearViewingOrder,
  };
}