import React from "react";
import EndOfDayClosing from "../components/reports/EndOfDayClosing";
import { RequireTab } from "../components/RequireAccess";
import { useClosingSlice, usePosSlice } from "../store/slices";
import { useShell } from "./shell";

export default function ReportsClosingRoute() {
  const { currentUser } = useShell();
  const { sales } = usePosSlice();
  const { expenses, dayClosings, addExpense, deleteExpense, closeDay } = useClosingSlice();

  return (
    <RequireTab role={currentUser.role} tab="reports-closing">
      <EndOfDayClosing
        sales={sales}
        expenses={expenses}
        dayClosings={dayClosings}
        onAddExpense={addExpense}
        onDeleteExpense={deleteExpense}
        onCloseDay={closeDay}
      />
    </RequireTab>
  );
}
