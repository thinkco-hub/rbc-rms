import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import {
  CHAMS_PATH,
  PATH_BY_TAB,
  isChamsPath,
  isWithinPath,
  orderPath,
  tabFromPath,
} from "./routes";
import { ALL_ROLES, canAccessTab } from "./utils/permissions";
import type { NavTabId } from "./types/domain";

/** Echoes the segment the router matched, so a test can read it back decoded. */
function OrderIdProbe() {
  const { orderId } = useParams();
  return <div data-testid="order-id">{orderId}</div>;
}

const TAB_IDS = Object.keys(PATH_BY_TAB) as NavTabId[];

/**
 * The nested groups. `urlParent` is the tab whose path the children sit under;
 * `stem` is the key the children share, so the table names its own members
 * instead of a hand-typed path list.
 */
const GROUPS: { urlParent: NavTabId; stem: string; children: number }[] = [
  { urlParent: "inventory", stem: "inventory", children: 2 },
  { urlParent: "reports-dashboard", stem: "reports", children: 2 },
];

function childrenOf(group: (typeof GROUPS)[number]): NavTabId[] {
  return TAB_IDS.filter(
    (tab) => tab !== group.urlParent && tab.startsWith(`${group.stem}-`)
  );
}

describe("path <-> NavTabId", () => {
  it("gives every tab exactly one path", () => {
    const paths = TAB_IDS.map((tab) => PATH_BY_TAB[tab]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("parses each tab's path back to the same tab", () => {
    for (const tab of TAB_IDS) {
      expect(tabFromPath(PATH_BY_TAB[tab])).toBe(tab);
    }
  });

  it("uses a leading slash, and no trailing slash below the root", () => {
    for (const tab of TAB_IDS) {
      const path = PATH_BY_TAB[tab];
      expect(path.startsWith("/")).toBe(true);
      if (path === "/") continue;
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("keeps the Chams ledger out of the tab table", () => {
    expect(TAB_IDS.map((tab) => PATH_BY_TAB[tab])).not.toContain(CHAMS_PATH);
    expect(tabFromPath(CHAMS_PATH)).toBeNull();
    expect(isChamsPath(CHAMS_PATH)).toBe(true);
  });

  it("returns no tab for an unknown path", () => {
    expect(tabFromPath("/nope")).toBeNull();
    expect(tabFromPath("/inventory/nope")).toBeNull();
  });

  it("treats a trailing slash as the same route the router matches", () => {
    expect(tabFromPath("/orders/")).toBe("orders");
    expect(tabFromPath("/")).toBe("dashboard");
  });

  it("spells the roles tab as /roles without renaming its permission key", () => {
    expect(PATH_BY_TAB["user-management"]).toBe("/roles");
    for (const role of ALL_ROLES) {
      expect(canAccessTab(role, tabFromPath("/roles")!)).toBe(canAccessTab(role, "user-management"));
    }
  });

  it("nests each group's child paths under the group's own path", () => {
    for (const group of GROUPS) {
      const members = childrenOf(group);
      expect(members).toHaveLength(group.children);
      for (const child of members) {
        expect(PATH_BY_TAB[child].startsWith(`${PATH_BY_TAB[group.urlParent]}/`)).toBe(true);
      }
    }
  });

  it("leaves every tab outside a group on a path that nests nowhere", () => {
    const grouped = GROUPS.flatMap((group) => [group.urlParent, ...childrenOf(group)]);
    for (const tab of TAB_IDS.filter((member) => !grouped.includes(member))) {
      // Dashboard is the root; every other flat tab is one segment below it.
      expect(PATH_BY_TAB[tab].split("/").filter(Boolean).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("the path a group owns", () => {
  it("draws the boundary at a slash, not at a prefix", () => {
    expect(isWithinPath("/inventory", "/inventory")).toBe(true);
    expect(isWithinPath("/inventory", "/inventory/")).toBe(true);
    expect(isWithinPath("/inventory", "/inventory/reconciliation")).toBe(true);
    expect(isWithinPath("/inventory", "/inventory-nope")).toBe(false);
    expect(isWithinPath("/inventory", "/")).toBe(false);
  });
});

describe("the path an order is opened at", () => {
  it("encodes the leading # so it stays part of the path", () => {
    expect(orderPath("#1042")).toBe("/orders/%231042");
  });

  it("hands the :orderId route the seeded id back unchanged", () => {
    render(
      <MemoryRouter initialEntries={[orderPath("#1042")]}>
        <Routes>
          <Route path="orders/:orderId" element={<OrderIdProbe />} />
        </Routes>
      </MemoryRouter>
    );

    // React Router decodes each matched segment before useParams, so a
    // `orders.find(o => o.id === orderId)` in a route element still matches.
    expect(screen.getByTestId("order-id").textContent).toBe("#1042");
  });
});
