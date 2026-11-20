import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  DEFAULT_TAB,
  canAccessChams,
  canAccessIngredients,
  canAccessReconciliation,
  canAccessTab,
  canViewRecipeCosts,
} from "./permissions";
import type { NavTabId, UserRole } from "../types/domain";

/**
 * Listing every tab by key means TypeScript fails the file if a NavTabId is
 * added or renamed without re-checking the matrix, so the assertions below
 * always cover all of them.
 */
const ALL_TABS: Record<NavTabId, true> = {
  dashboard: true,
  pos: true,
  orders: true,
  clients: true,
  inventory: true,
  "inventory-closing-count": true,
  "inventory-reconciliation": true,
  recipes: true,
  "production-runs": true,
  calendar: true,
  "reports-dashboard": true,
  "reports-closing": true,
  "reports-inventory": true,
  "audit-logs": true,
  "user-management": true,
};

const TAB_IDS = Object.keys(ALL_TABS) as NavTabId[];

/** Every role x tab pair: allowed here, denied everywhere else. */
const ALLOWED_TABS: Record<UserRole, NavTabId[]> = {
  cashier: ["dashboard", "pos", "orders", "calendar"],
  kitchen: [
    "dashboard",
    "orders",
    "recipes",
    "production-runs",
    "inventory",
    "inventory-closing-count",
  ],
  sales_marketing: [
    "dashboard",
    "orders",
    "clients",
    "production-runs",
    "calendar",
    "inventory",
    "inventory-closing-count",
    "reports-dashboard",
    "reports-closing",
    "reports-inventory",
  ],
  research_development: [
    "dashboard",
    "orders",
    "clients",
    "inventory",
    "inventory-closing-count",
    "recipes",
    "production-runs",
    "calendar",
  ],
  admin: TAB_IDS,
  super_admin: TAB_IDS,
};

const sorted = (tabs: NavTabId[]) => [...tabs].sort();

describe("canAccessTab", () => {
  it.each(ALL_ROLES)("%s may open exactly its own tabs", (role) => {
    const allowed = TAB_IDS.filter((tab) => canAccessTab(role, tab));
    expect(sorted(allowed)).toEqual(sorted(ALLOWED_TABS[role]));
  });

  // The shell sends a role that loses its current tab to DEFAULT_TAB, so a
  // redirect there can never bounce.
  it.each(ALL_ROLES)("%s can always open the default tab", (role) => {
    expect(canAccessTab(role, DEFAULT_TAB)).toBe(true);
  });

  it("defaults to the dashboard", () => {
    expect(DEFAULT_TAB).toBe("dashboard");
  });
});

describe("feature-level access", () => {
  it("grants Chams to Sales and Marketing and the admin tier only", () => {
    expect(ALL_ROLES.filter(canAccessChams)).toEqual(["sales_marketing", "admin", "super_admin"]);
  });

  it("grants Reconciliation to the admin tier only", () => {
    expect(ALL_ROLES.filter(canAccessReconciliation)).toEqual(["admin", "super_admin"]);
  });

  /**
   * The set the App ingredient projection fails closed on. Kitchen sees the
   * rows because FR-3.1.1 gives the Head of Kitchen unit cost as an editable
   * field; Sales is deliberately absent despite holding the inventory tab, so
   * the cost-entry form stays out of reach.
   */
  it("grants Ingredients to Kitchen, R&D and the admin tier", () => {
    expect(ALL_ROLES.filter(canAccessIngredients)).toEqual([
      "kitchen",
      "research_development",
      "admin",
      "super_admin",
    ]);
  });

  it("grants recipe costs to R&D and the admin tier", () => {
    expect(ALL_ROLES.filter(canViewRecipeCosts)).toEqual([
      "research_development",
      "admin",
      "super_admin",
    ]);
  });
});
