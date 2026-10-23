import { useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  ClientId, CreateOrderData, Order, OrderDeliveryInput, OrderId, OrderItem,
  OrderPaymentInput, OrderStatus, PaymentMethod, Sale,
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
  pending: "Pending", in_production: "In Production", ready: "Ready", delivered: "Delivered",
};
const statusToApi: Record<OrderStatus, BackendOrder["status"]> = {
  Pending: "pending", "In Production": "in_production", Ready: "ready", Delivered: "delivered",
};
const toId = (id: number) => `#${id}`;
const clientId = (id: number | null): ClientId | null =>
  id === null ? null : `CL-${String(id).padStart(3, "0")}`;
const backendClientId = (id: ClientId | null) => id ? Number(id.replace(/^CL-/, "")) : null;

const toOrder = (order: BackendOrder): Order => ({
  id: toId(order.id),
  clientId: clientId(order.client_id),
  customerName: order.customer_name || undefined,
  items: order.items.map((item): OrderItem => ({
    menuItemId: String(item.menu_item_id),
    qty: Number(item.quantity),
    unitPrice: Number(item.unit_price),
  })),
  requestedDate: order.requested_delivery_date || order.created_at,
  status: statusToUi[order.status],
  notes: order.notes,
  deliveryDate: order.delivery?.scheduled_date || null,
  assignedTo: order.delivery?.assigned_staff || null,
  createdAt: order.created_at,
  deliveredAt: order.delivered_at,
  paymentMethod: order.payment_method,
  amountPaid: Number(order.amount_paid),
});

const backendOrderId = (id: OrderId) => Number(id.replace(/^#/, ""));

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  useEffect(() => {
    api.get<BackendOrder[]>("/api/v1/orders/orders/")
      .then((data) => setOrders(data.map(toOrder)))
      .catch(() => setOrders([]));
  }, []);

  const replaceOrder = (updated: BackendOrder) => {
    const order = toOrder(updated);
    setOrders((prev) => prev.map((item) => item.id === order.id ? order : item));
    setViewingOrder((prev) => prev?.id === order.id ? order : prev);
  };

  const createOrder = async (data: CreateOrderData) => {
    const created = await api.post<BackendOrder>("/api/v1/orders/orders/", {
      client_id: backendClientId(data.clientId),
      requested_delivery_date: data.requestedDate,
      notes: data.notes,
      items: data.items.map((item) => ({
        menu_item_id: Number(item.menuItemId),
        quantity: item.qty,
      })),
    });
    setOrders((prev) => [toOrder(created), ...prev]);
  };

  const createOrderFromSale = async (sale: Sale) => {
    const created = await api.post<BackendOrder>("/api/v1/orders/orders/", {
      client_id: null,
      customer_name: sale.customerName,
      requested_delivery_date: new Date().toISOString().slice(0, 10),
      notes: sale.notes ? `Placed via POS Pre-Order — ${sale.notes}` : "Placed via POS Pre-Order",
      items: sale.items.map((item) => ({ menu_item_id: Number(item.id), quantity: item.qty })),
    });
    setOrders((prev) => [toOrder(created), ...prev]);
  };

  const orderRequest = async (id: OrderId, action: string, body: unknown) => {
    const updated = await api.post<BackendOrder>(`/api/v1/orders/orders/${backendOrderId(id)}/${action}/`, body);
    replaceOrder(updated);
  };

  const recordOrderPayment = (id: OrderId, input: OrderPaymentInput) =>
    orderRequest(id, "record_payment", input);
  const advanceOrderStatus = (id: OrderId, status: OrderStatus | null) =>
    status && orderRequest(id, "advance_status", { status: statusToApi[status] });
  const scheduleOrderDelivery = (id: OrderId, input: OrderDeliveryInput) =>
    orderRequest(id, "schedule_delivery", { delivery_date: input.deliveryDate, assigned_to: input.assignedTo });
  const markOrderDelivered = (id: OrderId) => orderRequest(id, "mark_delivered", {});

  return {
    orders, viewingOrder, setViewingOrder, createOrder, createOrderFromSale,
    recordOrderPayment, advanceOrderStatus, scheduleOrderDelivery, markOrderDelivered,
    clearViewingOrder: () => setViewingOrder(null),
  };
}
