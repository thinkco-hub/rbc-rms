import React from "react";
import OrdersList from "../orders/OrdersList";
import OrderDetail from "../orders/OrderDetail";
import type {
  Client,
  CreateOrderData,
  MenuItemStock,
  Order,
  OrderDeliveryInput,
  OrderId,
  OrderPaymentInput,
  OrderStatus,
} from "../../types/domain";

interface OrdersViewProps {
  orders: Order[];
  clients: Client[];
  menuInventory: MenuItemStock[];
  viewingOrder: Order | null;
  onViewOrder: (order: Order | null) => void;
  onCreate: (data: CreateOrderData) => void;
  onAdvanceStatus: (id: OrderId, status: OrderStatus | null) => void;
  onScheduleDelivery: (id: OrderId, input: OrderDeliveryInput) => void;
  onMarkDelivered: (id: OrderId) => void;
  onRecordPayment: (id: OrderId, input: OrderPaymentInput) => void;
  onGoToProduction: () => void;
}

export default function OrdersView({
  orders,
  clients,
  menuInventory,
  viewingOrder,
  onViewOrder,
  onCreate,
  onAdvanceStatus,
  onScheduleDelivery,
  onMarkDelivered,
  onRecordPayment,
  onGoToProduction,
}: OrdersViewProps) {
  if (!viewingOrder) {
    return (
      <OrdersList
        orders={orders}
        clients={clients}
        menuInventory={menuInventory}
        onCreate={onCreate}
        onView={onViewOrder}
      />
    );
  }

  return (
    <OrderDetail
      order={viewingOrder}
      client={clients.find((c) => c.id === viewingOrder.clientId)}
      menuInventory={menuInventory}
      onBack={() => onViewOrder(null)}
      onAdvanceStatus={onAdvanceStatus}
      onScheduleDelivery={onScheduleDelivery}
      onMarkDelivered={onMarkDelivered}
      onRecordPayment={onRecordPayment}
      onGoToProduction={onGoToProduction}
    />
  );
}
