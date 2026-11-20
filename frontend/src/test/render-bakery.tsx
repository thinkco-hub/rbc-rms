import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { initialUsers } from "../data/initialUsers";
import { initialCatalogue } from "../data/initialCatalogue";
import { initialClients } from "../data/initialClients";
import { initialIngredients, initialRestockReminders } from "../data/initialInventory";
import { initialOrders } from "../data/initialOrders";
import { seedFakeApi, signInFake } from "./fake-api";
import { AnnouncerProvider } from "../components/common/Announcer";
import { BakeryProvider } from "../store/BakeryProvider";
import type { BakerySeed } from "../store/BakeryProvider";
import { ShellProvider } from "../routes/shell";
import type { ShellContextValue } from "../routes/shell";
import type { User } from "../types/domain";

const defaultUser =
  initialUsers.find((user) => user.role === "admin") ?? initialUsers[0];

export interface RenderBakeryOptions {
  initialPath?: string;
  currentUser?: User;
  seed?: BakerySeed;
}

/** The shell services a route module reads, without the sign-in screen around them. */
export function fixtureShell(currentUser: User): ShellContextValue {
  const noop = () => {};
  return {
    currentUser,
    users: initialUsers,
    updateUserRole: async () => ({ ok: true }),
    setUserActive: async () => ({ ok: true }),
    createUser: async () => ({ ok: true }),
    logout: noop,
    activeTab: null,
    backToList: noop,
    goToTab: noop,
    openPath: noop,
    isSidebarOpen: false,
    setIsSidebarOpen: noop,
    isInventoryExpanded: false,
    setIsInventoryExpanded: noop,
    isReportsExpanded: false,
    setIsReportsExpanded: noop,
    windowWidth: 1024,
  };
}

/**
 * The src/data collections the store starts from, so a route renders its data on
 * the first frame instead of after the API load. The fake API holds the same
 * records, so a mutation the route makes lands on a matching server row.
 */
export const DEFAULT_SEED: BakerySeed = {
  catalogue: initialCatalogue,
  ingredients: initialIngredients,
  restockReminders: initialRestockReminders,
  clients: initialClients,
  orders: initialOrders,
  sales: [],
};

/** The same tree `renderWithBakery` mounts, for tests that re-render by hand. */
export function bakeryTree(ui: ReactNode, options: RenderBakeryOptions = {}) {
  const { initialPath = "/", currentUser = defaultUser } = options;
  const seed = { ...DEFAULT_SEED, ...options.seed };
  // The fake API serves the same records the store starts from, and checks the
  // session like Django does.
  seedFakeApi(seed);
  signInFake(currentUser.email);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AnnouncerProvider>
        <ShellProvider value={fixtureShell(currentUser)}>
          <BakeryProvider currentUser={currentUser} seed={seed}>
            {ui}
          </BakeryProvider>
        </ShellProvider>
      </AnnouncerProvider>
    </MemoryRouter>
  );
}

/**
 * A route-module harness: memory history, a signed-in fixture and the store.
 * Unlike renderShell it never mounts App, so the test states its own route
 * table and the auth screen never runs.
 */
export function renderWithBakery(ui: ReactNode, options: RenderBakeryOptions = {}) {
  const view = render(bakeryTree(ui, options));
  return {
    ...view,
    /** Re-renders under a different session, the way a role change does. */
    rerenderAs: (currentUser: User) =>
      view.rerender(bakeryTree(ui, { ...options, currentUser })),
  };
}
