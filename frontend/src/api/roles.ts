import type { UserRole } from "../types/domain";

/**
 * Backend role names (seeded by apps/accounts migrations 0003 and 0004) mapped
 * onto the UI's role model. The backend stays the authority: these roles only
 * decide which screens the UI offers, while every API call is still checked
 * server-side against the role's permission codes.
 */
const UI_ROLE_BY_BACKEND: Record<string, UserRole> = {
  Owner: "super_admin",
  Admin: "admin",
  "Head of Kitchen": "kitchen",
  // Staff holds the kitchen's grants (inventory, recipes view, production view).
  Staff: "kitchen",
  Sales: "sales_marketing",
  "R&D": "research_development",
  Cashier: "cashier",
  // The Chams ledger is a Sales-and-Marketing screen in the UI.
  "Chams Branch Reporter": "sales_marketing",
};

/** The backend role a UI role is saved as when an admin assigns it. */
export const BACKEND_ROLE_BY_UI: Record<UserRole, string> = {
  super_admin: "Owner",
  admin: "Admin",
  kitchen: "Head of Kitchen",
  sales_marketing: "Sales",
  research_development: "R&D",
  cashier: "Cashier",
};

/**
 * The UI role for a backend role name. A Django superuser always gets the top
 * tier; an unknown role falls back to the most restricted one.
 */
export function toUiRole(backendRole: string | null | undefined, isSuperuser = false): UserRole {
  if (isSuperuser) return "super_admin";
  return (backendRole && UI_ROLE_BY_BACKEND[backendRole]) || "cashier";
}
