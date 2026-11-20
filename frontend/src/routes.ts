import type { NavTabId } from "./types/domain";

/** The Chams stock ledger is a separate screen, not a tab of Reid's HQ. */
export const CHAMS_PATH = "/chams";

/**
 * The URL for every tab. The Record is exhaustive by type, so adding a member
 * to NavTabId without giving it a path here is a compile error — that is what
 * keeps this table, the route table and permissions.ts from drifting apart.
 *
 * The keys stay the permission keys in src/utils/permissions.ts; only the URL
 * spelling differs (user-management is /roles, the grouped tabs nest).
 */
export const PATH_BY_TAB: Record<NavTabId, string> = {
  dashboard: "/",
  pos: "/pos",
  orders: "/orders",
  clients: "/clients",
  inventory: "/inventory",
  "inventory-closing-count": "/inventory/closing-count",
  "inventory-reconciliation": "/inventory/reconciliation",
  recipes: "/recipes",
  "production-runs": "/production-runs",
  calendar: "/calendar",
  "reports-dashboard": "/reports",
  "reports-closing": "/reports/closing",
  "reports-inventory": "/reports/inventory",
  "audit-logs": "/audit-logs",
  "user-management": "/roles",
};

const TAB_BY_PATH: Record<string, NavTabId> = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab as NavTabId])
);

/** "/pos/" and "/pos" are the same route to the router, so parse them the same way. */
function normalize(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * The tab owning a path, by exact lookup. Null for the Chams ledger, for a record
 * URL like `/orders/%231042`, and for an unknown path. Do not widen it to a
 * longest match: Dashboard owns `/`, so every typo would resolve to it and the
 * catch-all route would stop being reachable.
 */
export function tabFromPath(pathname: string): NavTabId | null {
  return TAB_BY_PATH[normalize(pathname)] ?? null;
}

/**
 * Whether `pathname` is `path` or a route nested under it. "/inventory-nope"
 * owns nothing under "/inventory", so the boundary is a slash, not a prefix.
 */
export function isWithinPath(path: string, pathname: string): boolean {
  const target = normalize(pathname);
  return target === path || target.startsWith(`${path}/`);
}

/**
 * The one place an order URL is built. Order ids are minted as `#1042`, and a
 * bare `#` truncates the URL to path `/orders/` plus a fragment, so the
 * `:orderId` route would never match. Client and recipe ids are already
 * URL-safe, which is why this helper is orders-only.
 */
export const orderPath = (orderId: string): string =>
  `/orders/${encodeURIComponent(orderId)}`;

export function isChamsPath(pathname: string): boolean {
  return normalize(pathname) === CHAMS_PATH;
}
