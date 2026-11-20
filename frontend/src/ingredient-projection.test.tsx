import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { initialIngredients } from "./data/initialInventory";
import { initialUsers } from "./data/initialUsers";
import { PATH_BY_TAB } from "./routes";
import { ALL_ROLES, ROLE_LABELS, canAccessIngredients, canAccessTab } from "./utils/permissions";
import type { NavTabId, UserRole } from "./types/domain";
import { renderShell, signIn } from "./test/render-shell";

/** Demo passwords, as documented at the top of src/data/initialUsers.ts. */
const PASSWORD_BY_ROLE: Record<UserRole, string> = {
  cashier: "cashier123",
  kitchen: "kitchen123",
  sales_marketing: "sales123",
  research_development: "rnd123",
  admin: "admin123",
  super_admin: "admin123",
};

/**
 * Screens the audit trace found reading the ingredient array. `rendered` waits
 * for something only that screen draws — queried by role, because the sidebar
 * carries the same words as nav links on every page. Without it a screen that
 * never mounted would pass an absence assertion.
 */
const STOCK_SCREENS: Array<{
  tab: NavTabId;
  path: string;
  rendered: () => Promise<HTMLElement>;
}> = [
  {
    tab: "dashboard",
    path: PATH_BY_TAB.dashboard,
    rendered: () => screen.findByRole("heading", { name: "Dashboard" }),
  },
  {
    tab: "inventory",
    path: PATH_BY_TAB.inventory,
    rendered: () => screen.findByRole("button", { name: "Closing Count" }),
  },
  {
    tab: "inventory-closing-count",
    path: PATH_BY_TAB["inventory-closing-count"],
    rendered: () => screen.findByRole("heading", { name: "Closing Inventory Count" }),
  },
  {
    tab: "reports-inventory",
    path: PATH_BY_TAB["reports-inventory"],
    rendered: () => screen.findByRole("heading", { name: "Closing Inventory" }),
  },
];

async function openAs(
  user: UserEvent,
  role: UserRole,
  path: string,
  rendered: () => Promise<HTMLElement>
) {
  renderShell(path);
  const seeded = initialUsers.find((u) => u.role === role);
  if (!seeded) throw new Error(`No seeded user for role ${role}`);
  await signIn(user, seeded.email, PASSWORD_BY_ROLE[role]);
  await rendered();
}

function expectNoRawMaterials() {
  for (const ingredient of initialIngredients) {
    expect(screen.queryByText(ingredient.name)).not.toBeInTheDocument();
  }
  expect(screen.queryByText(/Raw Materials/)).not.toBeInTheDocument();
}

const deniedRoles = ALL_ROLES.filter((role) => !canAccessIngredients(role));

const stockCases = deniedRoles
  .flatMap((role) =>
    STOCK_SCREENS.filter((target) => canAccessTab(role, target.tab)).map((target) => [
      ROLE_LABELS[role],
      role,
      target,
    ] as const)
  );

describe("ingredient projection", () => {
  it.each(stockCases)(
    "shows no raw-material stock to %s (%s)",
    async (_label, role, target) => {
      const user = userEvent.setup();
      await openAs(user, role, target.path, target.rendered);
      expectNoRawMaterials();
    }
  );

  /** Kitchen keeps the recipes tab, but not the money derived from unit costs. */
  it("hides recipe cost from kitchen", async () => {
    const user = userEvent.setup();
    await openAs(user, "kitchen", PATH_BY_TAB.recipes, () =>
      screen.findByRole("heading", { name: "Recipes / BOM" })
    );
    expect(screen.queryByText("COGS / Unit")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested Price")).not.toBeInTheDocument();
    // The catalogue record still lists the recipe under its own name.
    expect(screen.getAllByText("Butter Croissants").length).toBeGreaterThan(0);
  });

  /** FR-3.2.3: R&D owns recipe costing, so the COGS columns are its grant. */
  it("shows COGS to research and development", async () => {
    const user = userEvent.setup();
    await openAs(user, "research_development", PATH_BY_TAB.recipes, () =>
      screen.findByRole("heading", { name: "Recipes / BOM" })
    );
    expect(screen.getByText("COGS / Unit")).toBeInTheDocument();
    expect(screen.getByText("Suggested Price")).toBeInTheDocument();
  });

  it("hides the live cost panel from kitchen but keeps the bill of materials", async () => {
    const user = userEvent.setup();
    await openAs(user, "kitchen", `${PATH_BY_TAB.recipes}/new`, () =>
      screen.findByRole("heading", { name: "Recipe Details" })
    );
    expect(screen.queryByText("Live Cost Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested Prices")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add Ingredient" })).toBeInTheDocument();
  });

  /**
   * The control that keeps the sweeps above honest: a projection that blanked
   * the array for everybody would pass them just as green.
   */
  it("still shows raw-material stock and its value to the admin tier", async () => {
    const user = userEvent.setup();
    await openAs(user, "admin", PATH_BY_TAB["reports-inventory"], () =>
      screen.findByRole("heading", { name: "Closing Inventory" })
    );
    expect(screen.getByText("Raw Materials")).toBeInTheDocument();
    expect(screen.getByText("All-Purpose Flour")).toBeInTheDocument();
    expect(screen.getByText("Raw Materials Value")).toBeInTheDocument();
  });

  /**
   * The other half of the decision: production planning keeps the ingredient
   * rows, because the stock figures it works from are not the restricted money.
   * Starving that array would flip every seeded run to Insufficient Stock — the
   * seed really holds one short run and three feasible ones (measured against the
   * Admin tier, which sees 1 and 3 of the same), so the assert is that a feasible
   * run is still feasible. One "Scheduled" is the status filter chip; the run
   * badges are the rest.
   */
  it("leaves Kitchen's production runs reading real ingredient stock", async () => {
    const user = userEvent.setup();
    await openAs(user, "kitchen", PATH_BY_TAB["production-runs"], () =>
      screen.findByRole("heading", { name: "Production Runs" })
    );
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(1);
  });
});
