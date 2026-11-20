import React from "react";
import { useParams } from "react-router";
import ClientDetail from "../components/clients/ClientDetail";
import RecordRoute from "../components/common/RecordRoute";
import { RequireTab } from "../components/RequireAccess";
import { useClientsSlice, useOrdersSlice } from "../store/slices";
import { PATH_BY_TAB, orderPath } from "../routes";
import { useShell } from "./shell";

/** `/clients/:clientId` — the client record addressed by its own URL. */
export default function ClientDetailRoute() {
  const { currentUser, backToList, openPath } = useShell();
  const { clients } = useClientsSlice();
  const { orders } = useOrdersSlice();
  const { clientId = "" } = useParams();
  const onBack = () => backToList(PATH_BY_TAB.clients);

  return (
    <RequireTab role={currentUser.role} tab="clients">
      <RecordRoute items={clients} id={clientId} kind="Client" onBack={onBack}>
        {(client) => (
          <ClientDetail
            client={client}
            orders={orders}
            onBack={onBack}
            onViewOrder={(order) => openPath(orderPath(order.id))}
          />
        )}
      </RecordRoute>
    </RequireTab>
  );
}
