import React from "react";
import ProductionView from "../components/views/ProductionView";
import { RequireTab } from "../components/RequireAccess";
import { useCatalogueSlice, useProductionSlice } from "../store/slices";
import { useShell } from "./shell";

export default function ProductionRoute() {
  const { currentUser } = useShell();
  const { productionRuns, scheduleProductionRun, completeProductionRun, deleteProductionRun } =
    useProductionSlice();
  // Production planning needs an ingredient's identity and stock, not its unit
  // cost; the money is suppressed inside the view instead.
  const { stockItems, ingredients } = useCatalogueSlice();

  return (
    <RequireTab role={currentUser.role} tab="production-runs">
      <ProductionView
        productionRuns={productionRuns}
        catalogue={stockItems}
        ingredients={ingredients}
        onSchedule={scheduleProductionRun}
        onComplete={completeProductionRun}
        onDelete={deleteProductionRun}
      />
    </RequireTab>
  );
}
