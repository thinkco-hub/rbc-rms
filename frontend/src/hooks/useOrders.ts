import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { recordAuditEvent } from "../utils/auditLog";
import { buildEditHistoryEntry, diffField, diffLines } from "../utils/editHistory";
import {
  computeAmountDue,
  isPayableAmount,
  isValidCustomerContact,
} from "../utils/orders";
import { backendClientId, toClientId } from "./useClients";
import type {
  AuditActionType,
  CreateOrderData,
  EditOrderInput,
  FieldEdit,
  Order,
  OrderDeliveryInput,
  OrderId,
  OrderItem,
  OrderPaymentInput,
  OrderStatus,
  PaymentMethod,
  User,
} from "../types/domain";

interface BackendOrderItem {
  id: number;
  menu_item_id: number;
  quantity: string | number;
  unit_price: string | number;
}

interface BackendOrder {
  id: number;
  client_id: number | null;
  customer_name: string;
  status: "pending" | "in_production" | "ready" | "delivered";
  requested_delivery_date: string | null;
  notes: string;
  created_at: string;
  delivered_at: string | null;
  payment_method: PaymentMethod | null;
  amount_paid: string | number;
  items: BackendOrderItem[];
  delivery: { scheduled_date: string; assigned_staff: string } | null;
}

const statusToUi: Record<BackendOrder["status"], OrderStatus> = {
  pending: "Pending",
  in_production: "In Production",
  ready: "Ready",
  delivered: "Delivered",
};
const statusToApi: Record<OrderStatus, BackendOrder["status"]> = {
  Pending: "pending",
  "In Production": "in_production",
  Ready: "ready",
  Delivered: "delivered",
};

export const toOrderId = (id: number): OrderId => `#${id}`;
const backendOrderId = (id: OrderId) => Number(id.replace(/^#/, ""));

function toOrder(order: BackendOrder, previous?: Order): Order {
  return {
    id: toOrderId(order.id),
    clientId: order.client_id === null ? null : toClientId(order.client_id),
    customerName: order.customer_name || undefined,
    // The backend has no contact field on orders; keep what this session knew.
    customerContact: previous?.customerContact,
    items: order.items.map(
      (item): OrderItem => ({
        menuItemId: String(item.menu_item_id),
        qty: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      })
    ),
    requestedDate: (order.requested_delivery_date || order.created_at).slice(0, 10),
    status: statusToUi[order.status],
    notes: order.notes,
    deliveryDate: order.delivery?.scheduled_date || null,
    assignedTo: order.delivery?.assigned_staff || null,
    createdAt: order.created_at.slice(0, 10),
    deliveredAt: order.delivered_at,
    paymentMethod: order.payment_method,
    amountPaid: Number(order.amount_paid),
    editHistory: previous?.editHistory,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.details && typeof err.details === "object") {
    const detail = (err.details as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    const flat = Object.values(err.details as Record<string, unknown>).flat().map(String).join(" ");
    if (flat) return flat;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

interface UseOrdersOptions {
  /** Reloads stock after the server moves it (delivery deducts finished goods). */
  onStockMoved: () => Promise<unknown> | void;
  currentUser: User | null;
  /** Seeded orders; a test fixture replaces the server load. */
  orders?: Order[];
}

/**
 * Owns the orders feature, backed by /api/v1/orders/orders/. Stock deduction on
 * delivery happens server-side (mark_delivered); this hook then asks the
 * catalogue to reload. Which order is on screen is the router's
 * `/orders/:orderId` route, not state held here.
 */
export function useOrders({ onStockMoved, currentUser, orders: seededOrders }: UseOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>(seededOrders ?? []);
  const [error, setError] = useState<string | null>(null);

  const refreshOrders = useCallback(async () => {
    const data = await api.get<BackendOrder[]>("/api/v1/orders/orders/");
    setOrders((prev) => {
      const byId = new Map(prev.map((o) => [o.id, o]));
      return data.map((o) => toOrder(o, byId.get(toOrderId(o.id))));
    });
  }, []);

  useEffect(() => {
    if (seededOrders) return;
    let cancelled = false;
    api
      .get<BackendOrder[]>("/api/v1/orders/orders/")
      .then((data) => {
        if (!cancelled) setOrders(data.map((o) => toOrder(o)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logOrderEvent = (action: AuditActionType, orderId: OrderId, details: string) => {
    if (!currentUser) return;
    recordAuditEvent({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      entityType: "Order",
      entityId: orderId,
      details,
    });
  };

  const replaceOrder = (updated: BackendOrder, patch: Partial<Order> = {}) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === toOrderId(updated.id) ? { ...toOrder(updated, o), ...patch } : o))
    );
  };

  /** Runs one server mutation, surfacing its error instead of throwing. */
  const run = async (fallback: string, fn: () => Promise<void>): Promise<boolean> => {
    try {
      await fn();
      setError(null);
      return true;
    } catch (err) {
      setError(errorMessage(err, fallback));
      return false;
    }
  };

  /** Creates a client order from the Orders screen (FR-3.4). */
  const createOrder = (data: CreateOrderData) =>
    run("Could not create the order.", async () => {
      const created = await api.post<BackendOrder>("/api/v1/orders/orders/", {
        client_id: data.clientId ? backendClientId(data.clientId) : null,
        requested_delivery_date: data.requestedDate,
        notes: data.notes,
        items: data.items.map((item) => ({ menu_item_id: item.menuItemId, quantity: item.qty })),
      });
      const order = toOrder(created);
      setOrders((prev) => [order, ...prev]);
      logOrderEvent("order.created", order.id, `Created order ${order.id}`);
    });

  /**
   * Applies customer-name and item edits to an order. The edit history is kept
   * for this session; the backend stores the edited order itself.
   */
  const editOrder = (id: OrderId, input: EditOrderInput) =>
    run("Could not save the order.", async () => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status === "Delivered") return;
      const isClientOrder = order.clientId !== null;
      if (!isClientOrder && !isValidCustomerContact(input.customerContact)) return;

      const changes: FieldEdit[] = [];
      if (!isClientOrder) {
        const name = diffField("customerName", "Customer name", order.customerName || "", input.customerName);
        if (name) changes.push(name);
        const contact = diffField(
          "customerContact",
          "Contact number",
          order.customerContact || "",
          input.customerContact
        );
        if (contact) changes.push(contact);
      }
      const items = diffLines("items", "Ordered items", order.items, input.items, input.describeItem);
      if (items) changes.push(items);
      if (changes.length === 0) return;

      const updated = await api.patch<BackendOrder>(`/api/v1/orders/orders/${backendOrderId(id)}/`, {
        ...(isClientOrder ? {} : { customer_name: input.customerName.trim() }),
        items: input.items.map((line) => ({ menu_item_id: line.menuItemId, quantity: line.qty })),
      });
      const entry = buildEditHistoryEntry(currentUser?.name || "Unknown", changes);
      replaceOrder(updated, {
        ...(isClientOrder ? {} : { customerContact: input.customerContact.trim() }),
        editHistory: [...(order.editHistory || []), entry],
      });
      logOrderEvent(
        "order.edited",
        id,
        `Edited order ${id}: ${changes.map((c) => `${c.label} "${c.from}" -> "${c.to}"`).join("; ")}`
      );
    });

  const recordOrderPayment = (id: OrderId, { method, amount }: OrderPaymentInput) =>
    run("Could not record the payment.", async () => {
      const order = orders.find((o) => o.id === id);
      if (!order || !isPayableAmount(amount, computeAmountDue(order))) return;
      const updated = await api.post<BackendOrder>(
        `/api/v1/orders/orders/${backendOrderId(id)}/record_payment/`,
        { method, amount }
      );
      replaceOrder(updated);
      logOrderEvent("order.payment_recorded", id, `Recorded payment of ${amount} (${method}) on order ${id}`);
    });

  const advanceOrderStatus = (id: OrderId, status: OrderStatus | null) =>
    run("Could not change the order status.", async () => {
      if (!status) return;
      const updated = await api.post<BackendOrder>(
        `/api/v1/orders/orders/${backendOrderId(id)}/advance_status/`,
        { status: statusToApi[status] }
      );
      replaceOrder(updated);
      logOrderEvent("order.status_advanced", id, `Advanced order ${id} to ${status}`);
    });

  const scheduleOrderDelivery = (id: OrderId, { deliveryDate, assignedTo }: OrderDeliveryInput) =>
    run("Could not schedule the delivery.", async () => {
      const updated = await api.post<BackendOrder>(
        `/api/v1/orders/orders/${backendOrderId(id)}/schedule_delivery/`,
        { delivery_date: deliveryDate, assigned_to: assignedTo }
      );
      replaceOrder(updated);
      logOrderEvent("order.delivery_scheduled", id, `Scheduled delivery for order ${id} on ${deliveryDate}`);
    });

  const markOrderDelivered = (id: OrderId) =>
    run("Could not mark the order delivered.", async () => {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status === "Delivered") return;
      const updated = await api.post<BackendOrder>(
        `/api/v1/orders/orders/${backendOrderId(id)}/mark_delivered/`,
        {}
      );
      replaceOrder(updated);
      logOrderEvent("order.delivered", id, `Marked order ${id} delivered`);
      await onStockMoved();
    });

  return {
    orders,
    error,
    clearError: () => setError(null),
    refreshOrders,
    createOrder,
    editOrder,
    recordOrderPayment,
    advanceOrderStatus,
    scheduleOrderDelivery,
    markOrderDelivered,
  };
}
