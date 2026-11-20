import React from "react";
import ChamsStockLedger from "../components/chams/ChamsStockLedger";
import { RequireChams } from "../components/RequireAccess";
import { PATH_BY_TAB } from "../routes";
import { DEFAULT_TAB } from "../utils/permissions";
import { useShell } from "./shell";

/** The ledger is a separate screen, not a tab, and has its own guard. */
export default function ChamsRoute() {
  const { currentUser, openPath } = useShell();
  return (
    <RequireChams role={currentUser.role}>
      <ChamsStockLedger onSwitchView={() => openPath(PATH_BY_TAB[DEFAULT_TAB])} />
    </RequireChams>
  );
}
