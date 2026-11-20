import { useState } from "react";
import SearchField from "../common/SearchField";
import { getAuditLog } from "../../utils/auditLog";
import { toISODate, todayISO } from "../../utils/dates";
import { roleLabel } from "../../utils/permissions";
import type { AuditActionType, AuditLogEntry } from "../../types/domain";

const ACTION_LABELS: Record<AuditActionType, string> = {
  "auth.login.success": "Login",
  "auth.login.failure": "Failed login",
  "auth.login.lockout": "Login lockout",
  "auth.logout": "Logout",
  "user.role_changed": "User role changed",
  "user.deactivated": "Account deactivated",
  "user.created": "Account created",
  "user.reactivated": "Account reactivated",
  "sale.completed": "POS sale completed",
  "sale.edited": "Sale details edited",
  "order.created": "Order created",
  "order.edited": "Order details edited",
  "order.payment_recorded": "Order payment recorded",
  "order.status_advanced": "Order status changed",
  "order.delivery_scheduled": "Order delivery scheduled",
  "order.delivered": "Order delivered",
  "inventory.ingredient_added": "Ingredient added",
  "inventory.ingredient_updated": "Ingredient updated",
  "inventory.restocked": "Stock restocked",
  "inventory.count_submitted": "Inventory count submitted",
  "inventory.count_resolved": "Inventory count resolved",
  "inventory.reconciliation_applied": "Reconciliation applied",
  "production.run_scheduled": "Production run scheduled",
  "production.run_completed": "Production run completed",
  "production.run_deleted": "Production run deleted",
  "client.created": "Client added",
  "client.updated": "Client updated",
  "recipe.saved": "Recipe saved",
  "recipe.pricing_rule_updated": "Pricing rule updated",
  "closing.day_closed": "Day closed",
  "closing.expense_added": "Expense added",
  "closing.expense_deleted": "Expense deleted",
};

const WARNING_ACTIONS: ReadonlySet<AuditActionType> = new Set([
  "auth.login.failure",
  "auth.login.lockout",
]);

export default function AuditLogsView() {
  // Read once on mount: the view is only mounted while its tab is open, so each visit is a fresh read.
  const [entries] = useState<AuditLogEntry[]>(() => getAuditLog());
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(() => todayISO());

  const query = search.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const matchDate = !dateFilter || toISODate(new Date(entry.timestamp)) === dateFilter;
    const matchSearch =
      !query ||
      entry.userName.toLowerCase().includes(query) ||
      ACTION_LABELS[entry.action].toLowerCase().includes(query) ||
      (entry.entityId ?? "").toLowerCase().includes(query) ||
      (entry.details ?? "").toLowerCase().includes(query);
    return matchDate && matchSearch;
  });

  const today = todayISO();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8">
        <h2 className="text-3xl font-bold text-[#121212]">Audit Logs</h2>
        <p className="text-gray-500 mt-1">
          Sign-ins and changes made by users across the system.
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 flex flex-col md:flex-row items-center gap-2 shadow-sm">
        <SearchField
          value={search}
          onChange={setSearch}
          ariaLabel="Search audit logs by user, action or details"
          placeholder="Search user, action or details..."
        />
        <div className="w-full h-px md:w-px md:h-8 bg-gray-200 my-2 md:my-0 block"></div>
        <div className="flex items-center gap-2 w-full md:w-auto px-2">
          <label htmlFor="audit-date-filter" className="text-sm text-gray-500 font-medium whitespace-nowrap">Date:</label>
          <input
            id="audit-date-filter"
            type="date"
            value={dateFilter}
            max={today}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-600 focus:ring-1 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none flex-1 md:flex-none cursor-pointer"
          />
          {dateFilter !== today && (
            <button
              onClick={() => setDateFilter(today)}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        {dateFilter ? ` on ${dateFilter}` : ""}
      </p>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div
          className="overflow-x-auto w-full"
          tabIndex={0}
          role="region"
          aria-label="Audit log entries"
        >
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                <th scope="col" className="px-6 py-4">Time</th>
                <th scope="col" className="px-6 py-4">User</th>
                <th scope="col" className="px-6 py-4">Action</th>
                <th scope="col" className="px-6 py-4">Entity</th>
                <th scope="col" className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No activity found for the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{entry.userName}</div>
                      {entry.userRole && (
                        <div className="text-xs text-gray-500">{roleLabel(entry.userRole)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                          WARNING_ACTIONS.has(entry.action)
                            ? "bg-red-50 text-red-700"
                            : "bg-orange-50 text-[#562D07]"
                        }`}
                      >
                        {ACTION_LABELS[entry.action]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      {entry.entityType
                        ? `${entry.entityType}${entry.entityId ? ` ${entry.entityId}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-800">{entry.details ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
