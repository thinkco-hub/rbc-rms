import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialCatalogue } from "../data/initialCatalogue";
import { initialUsers } from "../data/initialUsers";
import { fakeFetch, signInFake } from "../test/fake-api";
import { getAuditLog } from "../utils/auditLog";
import { toPosProducts } from "../utils/catalogue";
import { addDaysISO, todayISO } from "../utils/dates";
import { usePos } from "./usePos";
import type { ConfirmModalState } from "../types/domain";

const cashier = initialUsers.find((u) => u.email === "cashier@rbc.test") ?? initialUsers[0];
const posProducts = toPosProducts(initialCatalogue);
const product = posProducts[0];
const TOMORROW = addDaysISO(todayISO(), 1);

type PosHook = ReturnType<typeof usePos>;

function mountPos() {
  signInFake(cashier.email);
  const onSaleCommitted = vi.fn();
  const view = renderHook(() =>
    usePos({ posProducts, onSaleCommitted, currentUser: cashier, sales: [] })
  );
  return { view, onSaleCommitted };
}

/** Every POST the hook sent to the checkout endpoint. */
function checkoutRequests() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(
      ([url, init]) => String(url).includes("/pos/transactions/") && init?.method === "POST"
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function fillCheckout(
  pos: PosHook,
  overrides: Partial<
    Pick<ConfirmModalState, "saleType" | "paymentMethod" | "customerName" | "customerContact" | "deliveryDate">
  > = {}
) {
  act(() => pos.openConfirmModal());
  act(() => pos.setSaleType(overrides.saleType ?? "Walk-in"));
  act(() => pos.updateConfirmField("customerName", overrides.customerName ?? "Ana Reyes"));
  act(() => pos.updateConfirmField("customerContact", overrides.customerContact ?? "09171234567"));
  act(() => pos.updateConfirmField("paymentMethod", overrides.paymentMethod ?? "Cash"));
  act(() => pos.updateConfirmField("deliveryDate", overrides.deliveryDate ?? ""));
}

async function confirm(view: ReturnType<typeof mountPos>["view"]) {
  await act(async () => {
    await view.result.current.completeSale();
  });
}

async function ringUpAndConfirm(
  view: ReturnType<typeof mountPos>["view"],
  overrides: Parameters<typeof fillCheckout>[1] = {}
) {
  act(() => view.result.current.addToCart(product));
  fillCheckout(view.result.current, overrides);
  await confirm(view);
}

describe("completeSale", () => {
  it("posts a walk-in with no delivery date and asks the store to reload", async () => {
    const { view, onSaleCommitted } = mountPos();
    await ringUpAndConfirm(view);

    expect(checkoutRequests()).toEqual([
      expect.objectContaining({
        items: [{ menu_item_id: product.id, quantity: "1.00" }],
        customer_name: "Ana Reyes",
        payment_method: "Cash",
        delivery_date: null,
      }),
    ]);
    expect(onSaleCommitted).toHaveBeenCalledTimes(1);
    expect(view.result.current.sales).toHaveLength(1);
    expect(view.result.current.sales[0]).toMatchObject({ type: "Walk-in" });
    expect(view.result.current.sales[0].orderId).toBeUndefined();
    expect(view.result.current.cart).toEqual([]);
  });

  it("links an Order-type sale to the order the server opens", async () => {
    const { view, onSaleCommitted } = mountPos();
    act(() => view.result.current.addToCart(product));
    fillCheckout(view.result.current, { saleType: "Order", deliveryDate: TOMORROW });
    expect(view.result.current.isConfirmOrderDisabled).toBe(false);

    await confirm(view);

    expect(checkoutRequests()[0]).toMatchObject({ delivery_date: TOMORROW });
    expect(onSaleCommitted).toHaveBeenCalledTimes(1);
    expect(view.result.current.sales[0]).toMatchObject({
      type: "Order",
      deliveryDate: TOMORROW,
      orderId: expect.stringMatching(/^#\d+$/),
    });
  });

  it("returns the server's sale as the receipt with tax-inclusive totals", async () => {
    const { view } = mountPos();
    await ringUpAndConfirm(view);

    const sale = view.result.current.sales[0];
    expect(view.result.current.receipt).toBe(sale);
    expect(sale.id).toMatch(/^\d+$/);
    expect(sale.subtotal).toBe(product.price);
    expect(sale.tax).toBe(product.price * 0.05);
    expect(sale.total).toBe(product.price * 1.05);
  });

  it("fires one sale.completed audit event", async () => {
    const { view } = mountPos();
    await ringUpAndConfirm(view);

    const events = getAuditLog().filter((entry) => entry.action === "sale.completed");
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe(view.result.current.sales[0].id);
    expect(events[0].userName).toBe(cashier.name);
  });

  it("keeps the cart and reuses the idempotency key when a retry follows a network failure", async () => {
    const { view } = mountPos();
    // The checkout request is sent but its response never arrives.
    vi.mocked(fetch).mockImplementation((input, init) =>
      String(input).includes("/pos/transactions/")
        ? Promise.reject(new TypeError("Failed to fetch"))
        : fakeFetch(input, init)
    );

    await ringUpAndConfirm(view);
    expect(view.result.current.checkoutError).toMatch(/network error/i);
    expect(view.result.current.cart).toHaveLength(1);
    expect(view.result.current.sales).toHaveLength(0);

    vi.mocked(fetch).mockImplementation(fakeFetch);
    await confirm(view);

    const [first, retry] = checkoutRequests();
    expect(retry.idempotency_key).toBe(first.idempotency_key);
    expect(view.result.current.sales).toHaveLength(1);
    expect(view.result.current.checkoutError).toBeNull();
  });
});

describe("checkout guard", () => {
  it("blocks an Order dated today and never posts it", async () => {
    const { view, onSaleCommitted } = mountPos();
    act(() => view.result.current.addToCart(product));
    fillCheckout(view.result.current, { saleType: "Order", deliveryDate: todayISO() });

    expect(view.result.current.isConfirmOrderDisabled).toBe(true);
    await confirm(view);
    expect(checkoutRequests()).toHaveLength(0);
    expect(view.result.current.sales).toHaveLength(0);
    expect(view.result.current.receipt).toBeNull();
    expect(onSaleCommitted).not.toHaveBeenCalled();
  });

  it("blocks an incomplete contact and never posts it", async () => {
    const { view } = mountPos();
    act(() => view.result.current.addToCart(product));
    fillCheckout(view.result.current, { customerContact: "0917" });

    expect(view.result.current.isConfirmOrderDisabled).toBe(true);
    await confirm(view);
    expect(checkoutRequests()).toHaveLength(0);
    expect(view.result.current.sales).toHaveLength(0);
  });
});
