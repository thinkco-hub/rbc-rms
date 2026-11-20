import React from "react";
import ReceiptModal from "../components/pos/ReceiptModal";
import ReportsDashboard from "../components/reports/ReportsDashboard";
import { RequireTab } from "../components/RequireAccess";
import { useCatalogueSlice, useOrdersSlice, usePosSlice } from "../store/slices";
import { useShell } from "./shell";

export default function ReportsRoute() {
  const { currentUser } = useShell();
  const { sales, salesError, receipt, setReceipt } = usePosSlice();
  const { orders } = useOrdersSlice();
  const { posProducts } = useCatalogueSlice();

  return (
    <RequireTab role={currentUser.role} tab="reports-dashboard">
      {salesError && (
        <div role="alert" className="max-w-6xl mx-auto mb-4 px-4 py-3 rounded-lg text-sm font-medium border bg-red-50 text-red-700 border-red-200">
          {salesError}
        </div>
      )}
      <ReportsDashboard
        sales={sales}
        orders={orders}
        products={posProducts}
        onReprintSale={setReceipt}
      />

      {/* Reprint is the second way into the receipt, so this route renders it too. */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </RequireTab>
  );
}
