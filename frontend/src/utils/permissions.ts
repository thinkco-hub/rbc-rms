import type { NavTabId, UserRole } from "../types/domain";

/** Roles in display order (lowest to highest privilege). */
export const ALL_ROLES: readonly UserRole[] = [
  "cashier",
  "kitchen",
  "sales_marketing",
  "research_development",
  "admin",
  "super_admin",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  cashier: "Cashier",
  kitchen: "Kitchen",
  sales_marketing: "Sales and Marketing",
  research_development: "Research and Development",
  admin: "Admin",
  super_admin: "Super Admin / Owner",
};

/** Display name for a role. Tolerates legacy values (e.g. "staff") still present in old audit entries. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

const INVENTORY_TABS: NavTabId[] = ["inventory", "inventory-closing-count"];
const REPORT_TABS: NavTabId[] = ["reports-dashboard", "reports-closing", "reports-inventory"];

const ADMIN_TABS: NavTabId[] = [
  "dashboard",
  "pos",
  "orders",
  "clients",
  ...INVENTORY_TABS,
  "inventory-reconciliation",
  "recipes",
  "production-runs",
  "calendar",
  ...REPORT_TABS,
  "audit-logs",
  "user-management",
];

/**
 * R&D's own set: Admin minus POS, all three Reports entries, Reconciliation,
 * Audit Logs and the Roles view. Listed rather than derived, because every
 * subtraction is an SRS grant decision (FR-3.7.4, FR-3.8.5), not a leftover.
 */
const R_AND_D_TABS: NavTabId[] = [
  "dashboard",
  "orders",
  "clients",
  ...INVENTORY_TABS,
  "recipes",
  "production-runs",
  "calendar",
];

/** Single source of truth for which tabs each role may open. */
const ROLE_TABS: Record<UserRole, ReadonlySet<NavTabId>> = {
  cashier: new Set<NavTabId>(["dashboard", "pos", "orders", "calendar"]),
  sales_marketing: new Set<NavTabId>([
    "dashboard",
    "orders",
    "calendar",
    "clients",
    "production-runs",
    ...INVENTORY_TABS,
    ...REPORT_TABS,
  ]),
  research_development: new Set<NavTabId>(R_AND_D_TABS),
  kitchen: new Set<NavTabId>([
    "dashboard",
    "orders",
    "recipes",
    "production-runs",
    ...INVENTORY_TABS,
  ]),
  admin: new Set<NavTabId>(ADMIN_TABS),
  super_admin: new Set<NavTabId>(ADMIN_TABS),
};

export const DEFAULT_TAB: NavTabId = "dashboard";

export function canAccessTab(role: UserRole, tab: NavTabId): boolean {
  return ROLE_TABS[role].has(tab);
}

export function canAccessReconciliation(role: UserRole): boolean {
  return canAccessTab(role, "inventory-reconciliation");
}

/**
 * Raw materials and the unit costs on their table (FR-3.1.1). An explicit role
 * list, not `canAccessTab(role, "inventory")`: Sales holds the inventory tab but
 * must not reach the cost-entry form.
 */
export function canAccessIngredients(role: UserRole): boolean {
  return (
    role === "kitchen" ||
    role === "research_development" ||
    isAdminTier(role)
  );
}

/** COGS per finished good and the suggested price on the recipe screens (FR-3.2.3). */
export function canViewRecipeCosts(role: UserRole): boolean {
  return role === "research_development" || isAdminTier(role);
}

/** The separate Chams stock ledger: admin tier plus Sales and Marketing (FR-3.9.5). */
export function canAccessChams(role: UserRole): boolean {
  return role === "sales_marketing" || isAdminTier(role);
}

export function canManageRoles(role: UserRole): boolean {
  return canAccessTab(role, "user-management");
}

function isAdminTier(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Whether `actorRole` may move a user from `currentRole` to `newRole`.
 * Admins manage the non-admin roles; only a Super Admin may grant or revoke
 * Admin / Super Admin.
 */
export function canAssignRole(
  actorRole: UserRole,
  currentRole: UserRole,
  newRole: UserRole
): boolean {
  if (!canManageRoles(actorRole)) return false;
  if (isAdminTier(currentRole) || isAdminTier(newRole)) return actorRole === "super_admin";
  return true;
}
