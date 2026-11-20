import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import RecipesRoute from "../routes/RecipesRoute";
import { addDaysISO, todayISO } from "../utils/dates";
import { initialUsers } from "../data/initialUsers";
import {
  useCatalogueSlice,
  useClosingSlice,
  useOrdersSlice,
  usePosSlice,
} from "./slices";
import { renderWithBakery } from "../test/render-bakery";
import type {
  CatalogueItem,
  InventoryCount,
  Order,
  User,
} from "../types/domain";

const ITEM: CatalogueItem = {
  id: "B-101",
  name: "Butter Croissants",
  type: "Menu Item",
  category: "Pastries",
  price: 120,
  qty: 10,
  target: 20,
  shelfLife: "24 Hours",
  color: "bg-amber-400",
  trackedStock: true,
  ingredients: [],
};

const ORDER: Order = {
  id: "#1",
  clientId: null,
  customerName: "Ana Reyes",
  customerContact: "09171234567",
  items: [{ menuItemId: "B-101", name: "Butter Croissants", qty: 2, unitPrice: 120 }],
  requestedDate: "2026-10-30",
  status: "Pending",
  notes: "",
  deliveryDate: null,
  assignedTo: null,
  createdAt: "2026-10-30",
  deliveredAt: null,
  paymentMethod: null,
  amountPaid: 0,
};

/** Drives every slice through its public actions and prints what the assertions pin. */
function StoreProbe() {
  const { orders, markOrderDelivered } = useOrdersSlice();
  const { stockItems } = useCatalogueSlice();
  const pos = usePosSlice();
  const { inventoryCounts, applyAllPendingCounts } = useClosingSlice();

  const linked = pos.sales[0]?.orderId;
  const fillCheckout = () => {
    pos.updateConfirmField("customerName", "Ana Reyes");
    pos.updateConfirmField("customerContact", "09171234567");
    pos.updateConfirmField("paymentMethod", "Cash");
    pos.updateConfirmField("deliveryDate", addDaysISO(todayISO(), 1));
  };

  return (
    <div>
      <div data-testid="orders">
        {orders.map((order) => `${order.id}:${order.status}`).join("|")}
      </div>
      <div data-testid="stock">
        {stockItems.map((item) => `${item.id}:${item.qty}`).join("|")}
      </div>
      <div data-testid="sales">
        {pos.sales.map((sale) => `${sale.id}:${sale.orderId ?? "walk-in"}`).join("|")}
      </div>
      <div data-testid="counts">
        {inventoryCounts.map((count) => `${count.id}:${count.status}`).join("|")}
      </div>
      <div data-testid="linked">
        {linked && orders.some((order) => order.id === linked) ? "linked" : "unlinked"}
      </div>

      <button onClick={() => markOrderDelivered("#1")}>Deliver #1</button>
      <button onClick={() => pos.addToCart(pos.filteredPosProducts[0])}>Add product</button>
      <button onClick={pos.openConfirmModal}>Open checkout</button>
      <button onClick={() => pos.setSaleType("Order")}>Order type</button>
      <button onClick={fillCheckout}>Fill checkout</button>
      <button onClick={pos.completeSale}>Confirm sale</button>
      <button onClick={applyAllPendingCounts}>Apply counts</button>
    </div>
  );
}

function userFor(email: string): User {
  const user = initialUsers.find((entry) => entry.email === email);
  if (!user) throw new Error(`No seeded user ${email}`);
  return user;
}

describe("the seeded store", () => {
  it("starts every slice from the fixture seed", () => {
    renderWithBakery(<StoreProbe />, {
      seed: { catalogue: [ITEM], orders: [ORDER] },
    });

    expect(screen.getByTestId("stock")).toHaveTextContent("B-101:10");
    expect(screen.getByTestId("orders")).toHaveTextContent("#1:Pending");
  });

  it("deducts a delivered order's lines from the same catalogue record", async () => {
    const user = userEvent.setup();
    renderWithBakery(<StoreProbe />, {
      seed: { catalogue: [ITEM], orders: [ORDER] },
    });

    await user.click(screen.getByRole("button", { name: "Deliver #1" }));

    // Delivery deducts stock server-side; the store reloads the catalogue after.
    await waitFor(() => expect(screen.getByTestId("stock")).toHaveTextContent("B-101:8"));
    expect(screen.getByTestId("orders")).toHaveTextContent("#1:Delivered");
  });

  it("creates one sale linked to the order a checkout opens", async () => {
    const user = userEvent.setup();
    renderWithBakery(<StoreProbe />, {
      seed: { catalogue: [ITEM], orders: [] },
    });

    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.click(screen.getByRole("button", { name: "Open checkout" }));
    await user.click(screen.getByRole("button", { name: "Order type" }));
    await user.click(screen.getByRole("button", { name: "Fill checkout" }));
    await user.click(screen.getByRole("button", { name: "Confirm sale" }));

    // The transaction and its order are numbered by the server.
    await waitFor(() => expect(screen.getByTestId("sales")).toHaveTextContent(/^\d+:#\d+$/));
    expect(screen.getByTestId("orders")).toHaveTextContent(/^#\d+:Pending$/);
    expect(screen.getByTestId("linked")).toHaveTextContent("linked");
    // A linked order's stock waits for delivery.
    expect(screen.getByTestId("stock")).toHaveTextContent("B-101:10");
  });

  it("applies a pending reconciliation count to the stock it corrects", async () => {
    const user = userEvent.setup();
    const count: InventoryCount = {
      id: "IC-001",
      itemId: "B-101",
      itemType: "menu",
      date: "2026-10-30",
      systemQty: 10,
      countedQty: 8,
      discrepancy: -2,
      status: "pending",
    };
    renderWithBakery(<StoreProbe />, {
      seed: { catalogue: [ITEM], inventoryCounts: [count] },
    });

    await user.click(screen.getByRole("button", { name: "Apply counts" }));

    expect(screen.getByTestId("stock")).toHaveTextContent("B-101:8");
    expect(screen.getByTestId("counts")).toHaveTextContent("IC-001:resolved");
  });
});

describe("role changes below the provider", () => {
  it("bounces a guarded route when the signed-in role loses its tab", async () => {
    const view = renderWithBakery(
      <Routes>
        <Route path="/" element={<div>Dashboard probe</div>} />
        <Route path="/recipes" element={<RecipesRoute />} />
      </Routes>,
      { initialPath: "/recipes", currentUser: userFor("admin@rbc.test") }
    );

    expect(
      await screen.findByRole("heading", { name: "Recipes / BOM" })
    ).toBeInTheDocument();

    view.rerenderAs(userFor("cashier@rbc.test"));

    expect(await screen.findByText("Dashboard probe")).toBeInTheDocument();
  });
});
