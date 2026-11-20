import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import App from "./App";
import { AnnouncerProvider, useAnnounce } from "./components/common/Announcer";
import { PATH_BY_TAB } from "./routes";
import { canAccessTab } from "./utils/permissions";
import type { NavTabId } from "./types/domain";
import { renderShell, signIn, signInAsCashier } from "./test/render-shell";

const sidebar = () => screen.getByRole("complementary");

/** The router's own address, printed for the assertions a visible screen cannot make. */
function PathnameProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

/** Presses the browser's Back, the one move the app itself cannot make for the user. */
function PopProbe() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Browser back</button>;
}

/**
 * renderShell plus the probes, for tests that have to name the URL they landed
 * on. `behind` seeds history before the start point, which is what lets a test
 * tell a pop from a push.
 */
function renderShellAt(path: string, behind: string[] = []) {
  return render(
    <MemoryRouter initialEntries={[...behind, path]} initialIndex={behind.length}>
      <App />
      <PathnameProbe />
      <PopProbe />
    </MemoryRouter>
  );
}

const pathInAddressBar = () => screen.getByTestId("pathname").textContent;

/** useNavigation reads the width when it mounts, so this runs before rendering. */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

afterEach(() => setViewportWidth(1024));

/** Admin is the only tier whose Inventory group has a submenu to expand. */
async function signInAsAdmin(user: UserEvent) {
  await signIn(user, "admin@rbc.test", "admin123");
}

/** Sidebar labels stay plain text whether the links are buttons or anchors. */
async function openTab(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(within(sidebar()).getByText(label));
}

/** The catalogue renders a phone list and a tablet grid from one array, so both match. */
async function addProduct(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  times: number
) {
  for (let i = 0; i < times; i++) {
    const [card] = screen.getAllByRole("button", { name: new RegExp(name) });
    await user.click(card);
  }
}

describe("app shell state identity", () => {
  it("keeps POS ticket lines and an open overlay across a tab switch", async () => {
    const user = userEvent.setup();
    renderShell();
    await signInAsCashier(user);
    await screen.findByText("Point of Sale");

    await openTab(user, "Point of Sale");
    await addProduct(user, "Butter Croissants", 2);
    await addProduct(user, "Pain au Chocolat", 1);

    expect(screen.getByText("₱240.00")).toBeInTheDocument();
    await screen.findAllByLabelText("Remove one Pain au Chocolat");

    await user.click(screen.getByRole("button", { name: "Add customer" }));
    expect(
      screen.getByLabelText("Cancel and return to the ticket")
    ).toBeInTheDocument();

    // The cashier has no Clients tab, so the roster and its create button are
    // not offered at the counter — the ticket takes a typed name instead.
    expect(
      screen.getByRole("heading", { name: "Add customer to ticket" })
    ).toBeInTheDocument();
    const ticketName = screen.getByPlaceholderText("Enter customer name...");
    expect(ticketName).toBeInTheDocument();
    expect(screen.queryByLabelText("Search customers")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add new customer" })).toBeNull();
    await user.type(ticketName, "Ampara Catering");

    await openTab(user, "Orders");
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.queryByText("Current Ticket")).toBeNull();

    await openTab(user, "Point of Sale");

    // Reseeding from src/data/initial*.ts would empty the ticket here; clearing
    // the shell overlays on navigation would close the picker.
    expect(screen.getByText("₱240.00")).toBeInTheDocument();
    await screen.findAllByLabelText("Remove one Pain au Chocolat");
    expect(
      screen.getByLabelText("Cancel and return to the ticket")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter customer name...")).toHaveValue(
      "Ampara Catering"
    );

    await user.click(screen.getByRole("button", { name: "Save to ticket" }));
    expect(screen.queryByPlaceholderText("Enter customer name...")).toBeNull();
    expect(screen.getByText("Ampara Catering")).toBeInTheDocument();
    // The ticket owns the name; no client record was created for it.
    expect(within(sidebar()).queryByText("Clients")).toBeNull();
  });

  /**
   * The same overlay for a role that does own the Clients tab still reads the
   * roster. Without it the assertion above would pass on a picker that had been
   * replaced for everybody.
   */
  it("gives a role with the Clients tab the customer roster at the counter", async () => {
    const user = userEvent.setup();
    renderShell();
    await signInAsAdmin(user);
    await screen.findByText("Point of Sale");

    await openTab(user, "Point of Sale");
    await user.click(screen.getByRole("button", { name: "Add customer" }));

    expect(screen.getByLabelText("Search customers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add new customer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save to ticket" })).toBeNull();
  });
});

describe("sign-out", () => {
  it("starts the next sign-in on the default tab, not the tab just left", async () => {
    const user = userEvent.setup();
    renderShell("/pos");
    await signInAsCashier(user);
    await screen.findByRole("heading", { name: "Current Ticket" });

    await user.click(within(sidebar()).getByText("Log Out"));
    await screen.findByRole("button", { name: "Log In" });

    // The URL is the only thing that outlives the session, so a sign-out that
    // leaves it on /pos puts the next user straight back on the POS tab.
    await signInAsCashier(user);
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current Ticket" })).toBeNull();
  });
});

describe("nested routes", () => {
  /**
   * The disclosure is only reachable in the drawer: the collapsed desktop rail
   * hides its submenus and their toggles, so these run at a phone width with the
   * drawer open rather than against a rail that shows nothing.
   */
  async function openDrawerAtPhoneWidth(user: UserEvent) {
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    return screen.getByRole("dialog", { name: "Navigation" });
  }

  it("opens the Inventory submenu for a nested route loaded cold", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderShell("/inventory/reconciliation");
    await signInAsAdmin(user);

    await screen.findByRole("heading", { name: "Inventory Reconciliation" });
    const drawer = await openDrawerAtPhoneWidth(user);
    // Nothing clicked a toggle here: the route is what opened the group.
    expect(
      within(drawer).getByRole("button", { name: "Toggle inventory submenu" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(drawer).getByRole("link", { name: "Reconciliation" })
    ).toBeInTheDocument();
  });

  it("takes Closing Count off the stock tables and back, URL and all", async () => {
    const user = userEvent.setup();
    renderShellAt("/inventory");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Inventory: Menu Items" });

    await user.click(screen.getByRole("button", { name: "Closing Count" }));
    expect(
      await screen.findByRole("heading", { name: "Closing Inventory Count" })
    ).toBeInTheDocument();
    expect(pathInAddressBar()).toBe("/inventory/closing-count");

    await user.click(screen.getByRole("button", { name: "Back to Inventory" }));
    expect(
      await screen.findByRole("heading", { name: "Inventory: Menu Items" })
    ).toBeInTheDocument();
    expect(pathInAddressBar()).toBe("/inventory");
  });

  it("closes the phone drawer when a nested screen is chosen from it", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderShellAt("/inventory");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Inventory: Menu Items" });

    const drawer = await openDrawerAtPhoneWidth(user);
    await user.click(within(drawer).getByRole("link", { name: "Reconciliation" }));

    expect(
      await screen.findByRole("heading", { name: "Inventory Reconciliation" })
    ).toBeInTheDocument();
    expect(pathInAddressBar()).toBe("/inventory/reconciliation");
    // Off-canvas is the only thing that hides the drawer, so the transform is
    // the state under test — the submenu link itself stays in the document.
    expect(drawer.className).toContain("-translate-x-full");
    expect(drawer).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps a clicked group closed on the very route that would open it", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderShellAt("/inventory");
    await signInAsAdmin(user);

    const drawer = await openDrawerAtPhoneWidth(user);
    await within(drawer).findByRole("link", { name: "Reconciliation" });
    // The toggle sits beside the link: it expands the group without navigating.
    await user.click(
      within(drawer).getByRole("button", { name: "Toggle inventory submenu" })
    );

    expect(within(drawer).queryByRole("link", { name: "Reconciliation" })).toBeNull();
    expect(pathInAddressBar()).toBe("/inventory");
  });

  it("keeps the Reports header's layout utilities as separate classes", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const drawer = await openDrawerAtPhoneWidth(user);
    // A missing space once fused these into one dead token, justify-betweenitems-center.
    expect(within(drawer).getByRole("button", { name: "Reports" })).toHaveClass(
      "justify-between",
      "items-center"
    );
  });

  it("stacks submenu links as full-width rows", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const drawer = await openDrawerAtPhoneWidth(user);
    await user.click(within(drawer).getByRole("button", { name: "Reports" }));
    // Inline anchors ignore w-full and the vertical padding: the links flowed
    // side by side and the panel's overflow-hidden clipped them.
    expect(within(drawer).getByRole("link", { name: "Sales Dashboard" })).toHaveClass(
      "block",
      "w-full"
    );
  });
});

describe("phone drawer focus", () => {
  it("keeps a closed drawer out of the accessibility tree and returns focus on Escape", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const hamburger = screen.getByRole("button", { name: "Open navigation" });
    // byRole skips hidden nodes, so the closed panel is read off the DOM.
    const panel = document.querySelector('[role="complementary"]');
    if (!(panel instanceof HTMLElement)) throw new Error("No sidebar");
    // Off-canvas is not enough: the closed drawer must not be a landmark or a
    // source of tab stops for the page behind it.
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "true");

    await user.click(hamburger);
    const open = screen.getByRole("dialog", { name: "Navigation" });
    expect(open).toHaveAttribute("aria-modal", "true");
    expect(open).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
    expect(hamburger).toHaveFocus();
  });

  it("leaves the pinned desktop rail in the page, open drawer state or not", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const rail = sidebar();
    expect(rail).not.toHaveAttribute("inert");
    expect(rail).not.toHaveAttribute("aria-hidden");
    expect(rail).toHaveAttribute("role", "complementary");
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull();
  });
});

describe("desktop rail expansion", () => {
  it("keeps the rail open while the pointer clicks its far-edge chevron", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const rail = sidebar();
    expect(
      within(rail).queryByRole("button", { name: "Toggle inventory submenu" })
    ).toBeNull();

    // Explicit enter/leave pairs: user-event's pointer synthesis emits a
    // null-relatedTarget mouseout in jsdom, which no browser dispatches.
    fireEvent.mouseOver(rail, { relatedTarget: document.body });
    const toggle = within(rail).getByRole("button", {
      name: "Toggle inventory submenu",
    });
    // The chevron sits past the collapsed rail's 80px: reaching it must not
    // collapse the rail under the cursor.
    fireEvent.mouseOver(toggle, { relatedTarget: rail });
    fireEvent.mouseDown(toggle);
    fireEvent.click(toggle);
    expect(
      within(rail).getByRole("link", { name: "Reconciliation" })
    ).toBeInTheDocument();

    fireEvent.mouseOut(rail, { relatedTarget: document.body });
    expect(
      within(rail).queryByRole("button", { name: "Toggle inventory submenu" })
    ).toBeNull();
  });

  it("opens the rail for keyboard focus and closes it when focus leaves", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const rail = sidebar();
    const reports = within(rail).getByRole("button", { name: "Reports" });
    fireEvent.focusIn(reports);
    expect(
      within(rail).getByRole("button", { name: "Toggle inventory submenu" })
    ).toBeInTheDocument();

    fireEvent.focusOut(reports, { relatedTarget: document.body });
    expect(
      within(rail).queryByRole("button", { name: "Toggle inventory submenu" })
    ).toBeNull();
  });

  it("veils the page behind the open rail and dismisses it on scrim click", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const rail = sidebar();
    // The gutter is what keeps the content beside the rail from moving.
    const gutter = document.querySelector(".w-20.flex-shrink-0");
    expect(gutter).not.toBeNull();

    fireEvent.mouseOver(rail, { relatedTarget: document.body });
    const scrim = document.querySelector(".bg-black\\/50");
    if (!scrim) throw new Error("No rail scrim");
    expect(gutter).not.toBeNull();

    fireEvent.click(scrim);
    expect(
      within(rail).queryByRole("button", { name: "Toggle inventory submenu" })
    ).toBeNull();
    expect(document.querySelector(".bg-black\\/50")).toBeNull();
  });

  it("gives the Chams rail the same veil and dismiss", async () => {
    const user = userEvent.setup();
    renderShellAt("/chams");
    await signInAsAdmin(user);
    await screen.findByRole("button", { name: /Chams Ledger/ });

    const rail = sidebar();
    expect(rail.className).toContain("w-20");
    fireEvent.mouseOver(rail, { relatedTarget: document.body });
    expect(rail.className).toContain("w-72");

    const scrim = document.querySelector(".bg-black\\/50");
    if (!scrim) throw new Error("No rail scrim");
    fireEvent.click(scrim);
    expect(rail.className).toContain("w-20");
    expect(document.querySelector(".bg-black\\/50")).toBeNull();
  });
});

describe("order detail routes", () => {
  it("opens a clicked row at its own URL", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const [firstRow] = screen.getAllByRole("button", { name: /^View order #/ });
    await user.click(firstRow);

    // The id has to survive as a path segment. /orders/ plus a "#1042" fragment
    // leaves the list on screen and reads to a cashier as an inert button.
    expect(pathInAddressBar()).toBe("/orders/%231042");
    expect(
      await screen.findByRole("heading", { name: "Order #1042" })
    ).toBeInTheDocument();
  });

  it("opens the same record when its URL is loaded cold", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders/%231042");
    await signInAsAdmin(user);

    expect(
      await screen.findByRole("heading", { name: "Order #1042" })
    ).toBeInTheDocument();
  });

  it("names an id this device's list does not have", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders/%239999");
    await signInAsAdmin(user);

    expect(
      await screen.findByRole("heading", { name: "Order #9999 not found" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to list" }));
    expect(pathInAddressBar()).toBe("/orders");
    expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
  });
});

/** The active half of Sidebar's `itemCls`, which NavLink picks per route. */
const ACTIVE_ITEM = "bg-[#F3B978]/20";

/** The record panel's own breadcrumb, which sits beside other buttons of its name. */
const panelBack = (label: string) =>
  within(screen.getByRole("main")).getByRole("button", { name: label });

describe("sidebar on a record URL", () => {
  it("keeps the record's own tab highlighted", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders/%231042");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Order #1042" });

    expect(within(sidebar()).getByRole("link", { name: "Orders" }).className).toContain(
      ACTIVE_ITEM
    );
    // Dashboard alone keeps `end`: "/" prefixes every route, so dropping it
    // there would light Dashboard up from anywhere.
    expect(within(sidebar()).getByRole("link", { name: "Dashboard" }).className).not.toContain(
      ACTIVE_ITEM
    );
  });
});

describe("record dismissal", () => {
  it("pops a record back to its list, so browser Back does not re-open it", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders", ["/"]);
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Orders" });

    const [firstRow] = screen.getAllByRole("button", { name: /^View order #/ });
    await user.click(firstRow);
    expect(pathInAddressBar()).toBe("/orders/%231042");

    await user.click(panelBack("Orders"));
    expect(pathInAddressBar()).toBe("/orders");

    // A push would leave the record on the history stack, so Back would land on
    // the order this test has already dismissed.
    await user.click(screen.getByRole("button", { name: "Browser back" }));
    expect(pathInAddressBar()).toBe("/");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  /**
   * A typed or bookmarked record is the first entry in the stack, so there is
   * nothing to pop: leaving it has to be a navigation to the list, or the
   * dismissal walks out of the app and the reload signs the staff member out.
   */
  it("lands a cold-loaded record on its list instead of out of the app", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders/%231042");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Order #1042" });

    await user.click(panelBack("Orders"));
    expect(pathInAddressBar()).toBe("/orders");
    expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
  });
});

describe("client record routes", () => {
  it("opens a clicked client at its own URL", async () => {
    const user = userEvent.setup();
    renderShellAt("/clients");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Clients" });

    const [firstClient] = screen.getAllByRole("button", { name: /^View / });
    await user.click(firstClient);

    expect(pathInAddressBar()).toBe("/clients/CL-001");
    expect(await screen.findByRole("heading", { name: "Cafe Luna" })).toBeInTheDocument();
  });

  it("opens the same client when its URL is loaded cold", async () => {
    const user = userEvent.setup();
    renderShellAt("/clients/CL-001");
    await signInAsAdmin(user);

    expect(await screen.findByRole("heading", { name: "Cafe Luna" })).toBeInTheDocument();
    expect(screen.getByText("09171234567")).toBeInTheDocument();
  });

  /** Plan Verification 6, the Phase 4 half: the click-through out of a record. */
  it("reaches an order from inside a client and pops back to that client", async () => {
    const user = userEvent.setup();
    renderShellAt("/clients/CL-001");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Cafe Luna" });

    await user.click(screen.getByText("#1042"));
    expect(pathInAddressBar()).toBe("/orders/%231042");
    expect(await screen.findByRole("heading", { name: "Order #1042" })).toBeInTheDocument();

    await user.click(panelBack("Orders"));
    expect(pathInAddressBar()).toBe("/clients/CL-001");
    expect(await screen.findByRole("heading", { name: "Cafe Luna" })).toBeInTheDocument();
  });
});

describe("recipe record routes", () => {
  it("opens the editor on the recipe its URL names", async () => {
    const user = userEvent.setup();
    renderShellAt("/recipes/B-101");
    await signInAsAdmin(user);

    expect(await screen.findByText("Edit Recipe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Butter Croissants")).toBeInTheDocument();
  });

  it("opens an empty editor on the new recipe path", async () => {
    const user = userEvent.setup();
    renderShellAt("/recipes");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Recipes / BOM" });

    await user.click(screen.getByRole("button", { name: "+ New Recipe" }));
    expect(pathInAddressBar()).toBe("/recipes/new");
    expect(await screen.findByText("New Recipe")).toBeInTheDocument();
  });

  it("saves onto the list and leaves the saved editor off the history stack", async () => {
    const user = userEvent.setup();
    renderShellAt("/recipes", ["/"]);
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Recipes / BOM" });

    const [firstRecipe] = screen.getAllByRole("button", { name: /^Edit / });
    await user.click(firstRecipe);
    expect(pathInAddressBar()).toBe("/recipes/B-101");

    await user.click(screen.getByRole("button", { name: "Save Recipe" }));
    expect(pathInAddressBar()).toBe("/recipes");

    // The save replaced the editor entry. A push would put Back on a form that
    // has already been saved.
    await user.click(screen.getByRole("button", { name: "Browser back" }));
    expect(pathInAddressBar()).toBe("/recipes");
    expect(await screen.findByRole("heading", { name: "Recipes / BOM" })).toBeInTheDocument();
  });

  it("cancels a cold-loaded editor onto the list rather than out of the app", async () => {
    const user = userEvent.setup();
    renderShellAt("/recipes/new");
    await signInAsAdmin(user);
    await screen.findByText("New Recipe");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(pathInAddressBar()).toBe("/recipes");
    expect(await screen.findByRole("heading", { name: "Recipes / BOM" })).toBeInTheDocument();
  });
});

/**
 * The paths a cashier may not open, read off PATH_BY_TAB rather than typed out
 * here. A leaf that was never wrapped has to fail this sweep, and a hand-written
 * list would carry the same blind spot as the missing guard.
 */
const cashierDeniedPaths = (Object.keys(PATH_BY_TAB) as NavTabId[])
  .filter((tab) => !canAccessTab("cashier", tab))
  .map((tab) => PATH_BY_TAB[tab]);

describe("route access guards", () => {
  it.each(cashierDeniedPaths)("signing in as a cashier off %s lands on the dashboard", async (path) => {
    const user = userEvent.setup();
    renderShellAt(path);
    await signInAsCashier(user);

    // The guard navigates while mounting, so the dashboard is awaited before the
    // address is read; an unwrapped leaf would sit on its own path and time out.
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(pathInAddressBar()).toBe("/");
  });

  /**
   * The sweep above cannot generate these: a detail path is not a tab, so
   * PATH_BY_TAB structurally misses every one of them. A leaf whose guard was
   * forgotten would open the record and leave the suite green.
   */
  it.each(["/clients/CL-001", "/recipes/B-101", "/recipes/new"])(
    "a cashier typing %s lands on the dashboard",
    async (path) => {
      const user = userEvent.setup();
      renderShellAt(path);
      await signInAsCashier(user);

      await screen.findByRole("heading", { name: "Dashboard" });
      expect(pathInAddressBar()).toBe("/");
    }
  );

  // ROLE_TABS.cashier includes "orders", so the order leaf is the one detail
  // route a cashier reaches. Pinned here because a guard that bounced it would
  // look identical to a guard that was never written.
  it("opens an order record for a cashier", async () => {
    const user = userEvent.setup();
    renderShellAt("/orders/%231042");
    await signInAsCashier(user);

    expect(
      await screen.findByRole("heading", { name: "Order #1042" })
    ).toBeInTheDocument();
    expect(pathInAddressBar()).toBe("/orders/%231042");
  });
});

/**
 * The splat used to be a root-level `<Navigate replace>`, so a typo teleported
 * staff to Dashboard before they could read their own URL. These pin what the
 * screen replaces and the neighbours it must not disturb.
 */
describe("unknown route", () => {
  it("names the mistyped path, stays on it, and exits through its own link", async () => {
    const user = userEvent.setup();
    renderShellAt("/ordres");
    await signInAsAdmin(user);

    expect(
      await screen.findByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument();
    // Scoped to the content area: the PathnameProbe prints the same string, and
    // an unscoped query cannot tell the screen's own naming from the probe's.
    expect(within(screen.getByRole("main")).getByText("/ordres")).toBeInTheDocument();

    // The assertion that pins the redirect's removal: the address bar still
    // holds what was typed, so the screen can name it.
    expect(pathInAddressBar()).toBe("/ordres");

    await user.click(screen.getByRole("link", { name: "Go to Dashboard" }));
    expect(pathInAddressBar()).toBe("/");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("keeps the shell on the page around the screen", async () => {
    const user = userEvent.setup();
    renderShellAt("/ordres");
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Page not found" });

    expect(sidebar()).toBeInTheDocument();
  });

  /**
   * A static segment outranks a splat in React Router's match ranking, so the
   * guarded `/roles` leaf still owns the URL. Prove it: rendering a denied tab
   * as a not-found screen would tell a cashier which routes exist behind their
   * role.
   */
  it("bounces a cashier off /roles instead of calling it missing", async () => {
    const user = userEvent.setup();
    renderShellAt("/roles");
    await signInAsCashier(user);

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(pathInAddressBar()).toBe("/");
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });

  it("does not swallow the Chams ledger, which outranks the splat", async () => {
    const user = userEvent.setup();
    renderShellAt("/chams");
    await signInAsAdmin(user);

    // The rail sidebar is the only visible Chams branding at a tablet width:
    // the drawer top bar that repeats it is not rendered on the rail.
    expect(
      await screen.findByRole("button", { name: /Chams Ledger/ })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
    expect(pathInAddressBar()).toBe("/chams");
  });

  /**
   * The crash boundary sits above the shell, so a screen that renders normally
   * must never be handed to it: the boundary hides the very path this screen
   * exists to read back. RecordNotFound has the same rule and already has a
   * test of its own.
   */
  it("leaves an unmatched path to this screen, not to the crash screen", async () => {
    const user = userEvent.setup();
    renderShellAt("/ordres");
    await signInAsAdmin(user);

    expect(
      await screen.findByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" })
    ).not.toBeInTheDocument();
  });
});

describe("page landmarks", () => {
  it("gives the page one heading and a skip link that can focus main", async () => {
    const user = userEvent.setup();
    renderShell();
    await signInAsAdmin(user);
    await screen.findByRole("heading", { name: "Dashboard" });

    // The view title stays an h2; the shell owns the single page heading.
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Reid's Bakery HQ");

    const main = screen.getByRole("main");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      `#${main.id}`
    );
    expect(main).toHaveAttribute("tabindex", "-1");
  });
});

describe("sign-in feedback", () => {
  it("announces a rejected sign-in and describes both fields with it", async () => {
    const user = userEvent.setup();
    renderShell();

    const email = await screen.findByLabelText("Email");
    const password = screen.getByLabelText("Password");
    await user.clear(email);
    await user.type(email, "admin@rbc.test");
    await user.type(password, "not-the-password");
    await user.click(screen.getByRole("button", { name: "Log In" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password.");
    expect(email).toHaveAttribute("aria-describedby", alert.id);
    expect(password).toHaveAttribute("aria-describedby", alert.id);
    expect(document.activeElement).toBe(email);
  });
});

describe("shell announcer", () => {
  function ClearTicket() {
    const announce = useAnnounce();
    return <button onClick={() => announce("Ticket cleared.")}>Clear Ticket</button>;
  }

  function renderAnnouncer() {
    return render(
      <AnnouncerProvider>
        <ClearTicket />
      </AnnouncerProvider>
    );
  }

  it("speaks a mutation through a polite region outside the app root", async () => {
    const user = userEvent.setup();
    renderAnnouncer();

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    // An open dialog sets #root inert, so the region has to live beyond it.
    expect(region.parentElement).toBe(document.body);
    expect(region.textContent).toBe("");

    await user.click(screen.getByRole("button", { name: "Clear Ticket" }));
    expect(region).toHaveTextContent("Ticket cleared.");
  });

  it("re-speaks a repeated message instead of leaving the region untouched", async () => {
    const user = userEvent.setup();
    renderAnnouncer();
    const button = screen.getByRole("button", { name: "Clear Ticket" });

    await user.click(button);
    const spoken = screen.getByRole("status").firstElementChild;
    await user.click(button);

    expect(screen.getByRole("status").firstElementChild).not.toBe(spoken);
    expect(screen.getByRole("status")).toHaveTextContent("Ticket cleared.");
  });
});
