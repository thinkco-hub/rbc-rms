import React from "react";
import ReconciliationReview from "../components/inventory/ReconciliationReview";
import { RequireTab } from "../components/RequireAccess";
import { useClosingSlice, useCatalogueSlice } from "../store/slices";
import { useShell } from "./shell";

export default function ReconciliationRoute() {
  const { currentUser } = useShell();
  const { stockItems, ingredients } = useCatalogueSlice();
  const { inventoryCounts, resolveInventoryCount, applyAllPendingCounts } = useClosingSlice();

  return (
    <RequireTab role={currentUser.role} tab="inventory-reconciliation">
      <ReconciliationReview
        counts={inventoryCounts}
        menuInventory={stockItems}
        ingredients={ingredients}
        onResolve={resolveInventoryCount}
        onApplyAll={applyAllPendingCounts}
      />
    </RequireTab>
  );
}
