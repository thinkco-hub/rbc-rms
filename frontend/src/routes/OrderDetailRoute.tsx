import React from "react";
import { useParams } from "react-router";
import OrderDetail from "../components/orders/OrderDetail";
import RecordRoute from "../components/common/RecordRoute";
import { RequireTab } from "../components/RequireAccess";
import { useCatalogueSlice, useClientsSlice, useOrdersSlice } from "../store/slices";
import { PATH_BY_TAB } from "../routes";
import { useShell } from "./shell";

/** `/orders/:orderId` — the detail panel addressed by the record instead of by app-shell state. */
export default function OrderDetailRoute() {
  const { currentUser, backToList, goToTab } = useShell();
  const {
    orders,
    editOrder,
    recordOrderPayment,
    advanceOrderStatus,
    scheduleOrderDelivery,
    markOrderDelivered,
    error,
    clearError,
  } = useOrdersSlice();
  const { clients } = useClientsSlice();
  const { stockItems } = useCatalogueSlice();
  const { orderId = "" } = useParams();
  const onBack = () => backToList(PATH_BY_TAB.orders);

  return (
    <RequireTab role={currentUser.role} tab="orders">
      {error && (
        <div role="alert" className="max-w-6xl mx-auto mb-4 px-4 py-3 rounded-lg text-sm font-medium border bg-red-50 text-red-700 border-red-200 flex justify-between gap-4">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold" aria-label="Dismiss error">×</button>
        </div>
      )}
      <RecordRoute items={orders} id={orderId} kind="Order" onBack={onBack}>
        {(order) => (
          <OrderDetail
            order={order}
            client={clients.find((c) => c.id === order.clientId)}
            menuInventory={stockItems}
            onBack={onBack}
            onAdvanceStatus={advanceOrderStatus}
            onScheduleDelivery={scheduleOrderDelivery}
            onMarkDelivered={markOrderDelivered}
            onRecordPayment={recordOrderPayment}
            onEditOrder={editOrder}
            onGoToProduction={() => goToTab("production-runs")}
          />
        )}
      </RecordRoute>
    </RequireTab>
  );
}
