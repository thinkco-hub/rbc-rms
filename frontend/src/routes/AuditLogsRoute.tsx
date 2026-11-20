import React from "react";
import AuditLogsView from "../components/views/AuditLogsView";
import { RequireTab } from "../components/RequireAccess";
import { useShell } from "./shell";

export default function AuditLogsRoute() {
  const { currentUser } = useShell();
  return (
    <RequireTab role={currentUser.role} tab="audit-logs">
      <AuditLogsView />
    </RequireTab>
  );
}
