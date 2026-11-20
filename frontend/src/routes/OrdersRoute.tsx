import React from "react";
import OrdersList from "../components/orders/OrdersList";
import { RequireTab } from "../components/RequireAccess";
import { useCatalogueSlice, useClientsSlice, useOrdersSlice } from "../store/slices";
import { orderPath } from "../routes";
import { useShell } from "./shell";

export default function OrdersRoute() {
  const { currentUser, openPath } = useShell();
  const { orders, createOrder, error, clearError } = useOrdersSlice();
  const { clients } = useClientsSlice();
  const { stockItems } = useCatalogueSlice();

  return (
    <RequireTab role={currentUser.role} tab="orders">
      {error && (
        <div role="alert" className="max-w-6xl mx-auto mb-4 px-4 py-3 rounded-lg text-sm font-medium border bg-red-50 text-red-700 border-red-200 flex justify-between gap-4">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold" aria-label="Dismiss error">×</button>
        </div>
      )}
      <OrdersList
        orders={orders}
        clients={clients}
        menuInventory={stockItems}
        onView={(order) => openPath(orderPath(order.id))}
        onCreate={createOrder}
      />
    </RequireTab>
  );
}
