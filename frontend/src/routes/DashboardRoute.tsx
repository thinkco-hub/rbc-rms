import React from "react";
import { RequireTab } from "../components/RequireAccess";
import DashboardView from "../components/views/DashboardView";
import {
  useCatalogueSlice,
  useClientsSlice,
  useOrdersSlice,
  usePosSlice,
  useVisibleIngredients,
} from "../store/slices";
import { useShell } from "./shell";

export default function DashboardRoute() {
  const { currentUser, goToTab } = useShell();
  const { orders } = useOrdersSlice();
  const { clients } = useClientsSlice();
  const { sales } = usePosSlice();
  const { stockItems } = useCatalogueSlice();
  const ingredients = useVisibleIngredients();

  const pendingOrdersCount = orders.filter((o) => o.status === "Pending").length;
  const readyOrdersCount = orders.filter((o) => o.status === "Ready").length;
  const lowStockAlerts = [...stockItems, ...ingredients].filter(
    (item) => item.qty < item.target
  );

  return (
    <RequireTab role={currentUser.role} tab="dashboard">
      <DashboardView
        orders={orders}
        clients={clients}
        sales={sales}
        lowStockAlerts={lowStockAlerts}
        pendingOrdersCount={pendingOrdersCount}
        readyOrdersCount={readyOrdersCount}
        onNavClick={goToTab}
      />
    </RequireTab>
  );
}
