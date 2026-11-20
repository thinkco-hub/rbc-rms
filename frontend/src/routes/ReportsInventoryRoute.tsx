import React from "react";
import ClosingInventory from "../components/reports/ClosingInventory";
import { RequireTab } from "../components/RequireAccess";
import { useClosingSlice, useCatalogueSlice, useVisibleIngredients } from "../store/slices";
import { useShell } from "./shell";

export default function ReportsInventoryRoute() {
  const { currentUser } = useShell();
  const { stockItems } = useCatalogueSlice();
  const ingredients = useVisibleIngredients();
  const { inventoryCounts } = useClosingSlice();

  return (
    <RequireTab role={currentUser.role} tab="reports-inventory">
      <ClosingInventory
        menuInventory={stockItems}
        ingredients={ingredients}
        inventoryCounts={inventoryCounts}
      />
    </RequireTab>
  );
}
