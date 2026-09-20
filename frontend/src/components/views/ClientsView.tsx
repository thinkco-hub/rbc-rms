import React from "react";
import ClientsList from "../clients/ClientsList";
import ClientDetail from "../clients/ClientDetail";
import type {
  Client,
  ClientFormData,
  ClientId,
  Order,
} from "../../types/domain";

interface ClientsViewProps {
  clients: Client[];
  orders: Order[];
  viewingClient: Client | null;
  onView: (client: Client | null) => void;
  onAdd: (data: ClientFormData) => void;
  onUpdate: (id: ClientId, data: Partial<ClientFormData>) => void;
  onViewOrder: (order: Order) => void;
}

export default function ClientsView({
  clients,
  orders,
  viewingClient,
  onView,
  onAdd,
  onUpdate,
  onViewOrder,
}: ClientsViewProps) {
  if (!viewingClient) {
    return (
      <ClientsList
        clients={clients}
        orders={orders}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onView={onView}
      />
    );
  }

  return (
    <ClientDetail
      client={viewingClient}
      orders={orders}
      onBack={() => onView(null)}
      onViewOrder={onViewOrder}
    />
  );
}
