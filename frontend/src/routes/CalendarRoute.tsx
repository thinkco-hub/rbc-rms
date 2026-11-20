import React from "react";
import CalendarView from "../components/views/CalendarView";
import { RequireTab } from "../components/RequireAccess";
import { useShell } from "./shell";

export default function CalendarRoute() {
  const { currentUser } = useShell();
  return (
    <RequireTab role={currentUser.role} tab="calendar">
      <CalendarView />
    </RequireTab>
  );
}
