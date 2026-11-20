import React from "react";
import ClientsList from "../components/clients/ClientsList";
import { RequireTab } from "../components/RequireAccess";
import { useClientsSlice, useOrdersSlice } from "../store/slices";
import { PATH_BY_TAB } from "../routes";
import { useShell } from "./shell";

export default function ClientsRoute() {
  const { currentUser, openPath } = useShell();
  const { clients, addClient, updateClient } = useClientsSlice();
  const { orders } = useOrdersSlice();

  return (
    <RequireTab role={currentUser.role} tab="clients">
      <ClientsList
        clients={clients}
        orders={orders}
        onAdd={addClient}
        onUpdate={updateClient}
        onView={(client) => openPath(`${PATH_BY_TAB.clients}/${client.id}`)}
      />
    </RequireTab>
  );
}
