import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialOrders } from "../data/initialOrders";
import { initialUsers } from "../data/initialUsers";
import { signInFake } from "../test/fake-api";
import { getAuditLog } from "../utils/auditLog";
import { addDaysISO, todayISO } from "../utils/dates";
import { computeAmountDue, computeOrderTotal } from "../utils/orders";
import { useOrders } from "./useOrders";
import type { OrderId } from "../types/domain";

const cashier = initialUsers.find((u) => u.email === "cashier@rbc.test") ?? initialUsers[0];

/** Seeded #1042 is a pending order nobody has paid on yet. */
const TARGET: OrderId = "#1042";

function mountOrders(onStockMoved = vi.fn()) {
  signInFake(cashier.email);
  const view = renderHook(() =>
    useOrders({ onStockMoved, currentUser: cashier, orders: initialOrders })
  );

  const orderOf = (id: OrderId = TARGET) => {
    const order = view.result.current.orders.find((o) => o.id === id);
    if (!order) throw new Error(`Seed data no longer has order ${id}`);
    return order;
  };

  return {
    view,
    orderOf,
    amountPaid: () => orderOf().amountPaid,
    pay: (amount: number) =>
      act(async () => {
        await view.result.current.recordOrderPayment(TARGET, { method: "Cash", amount });
      }),
  };
}

/** The audit log is the durable store the falsified figure would have reached. */
const paymentEvents = () =>
  getAuditLog().filter((entry) => entry.action === "order.payment_recorded");

describe("recordOrderPayment amount bound", () => {
  it("records the outstanding balance and settles the order at its total", async () => {
    const { orderOf, amountPaid, pay } = mountOrders();
    await pay(computeAmountDue(orderOf()));
    expect(amountPaid()).toBe(computeOrderTotal(orderOf()));
  });

  it("refuses an amount above the outstanding balance", async () => {
    const { orderOf, amountPaid, pay } = mountOrders();
    await pay(computeOrderTotal(orderOf()) + 0.01);
    expect(amountPaid()).toBe(0);
    expect(paymentEvents()).toHaveLength(0);
  });

  it("refuses any payment onto a settled order", async () => {
    const { orderOf, amountPaid, pay } = mountOrders();
    await pay(computeAmountDue(orderOf()));
    await pay(1);
    expect(amountPaid()).toBe(computeOrderTotal(orderOf()));
    expect(paymentEvents()).toHaveLength(1);
  });

  it("splits a second payment across the remaining balance only", async () => {
    const { orderOf, amountPaid, pay } = mountOrders();
    const total = computeOrderTotal(orderOf());
    await pay(total / 2);
    expect(amountPaid()).toBe(total / 2);
    await pay(total);
    expect(amountPaid()).toBe(total / 2);
    await pay(total / 2);
    expect(amountPaid()).toBe(total);
  });

  it("refuses zero, negative and non-finite amounts", async () => {
    const { amountPaid, pay } = mountOrders();
    for (const amount of [0, -500, Number.NaN, Number.POSITIVE_INFINITY]) await pay(amount);
    expect(amountPaid()).toBe(0);
    expect(paymentEvents()).toHaveLength(0);
  });
});

describe("createOrder", () => {
  it("adds the server's order to the top of the list", async () => {
    const { view } = mountOrders();
    const due = addDaysISO(todayISO(), 2);

    await act(async () => {
      await view.result.current.createOrder({
        clientId: "CL-001",
        requestedDate: due,
        notes: "Standing order",
        items: [{ menuItemId: "B-101", qty: 5, unitPrice: 120 }],
      });
    });

    expect(view.result.current.orders[0]).toMatchObject({
      clientId: "CL-001",
      requestedDate: due,
      status: "Pending",
      notes: "Standing order",
      items: [{ menuItemId: "B-101", qty: 5, unitPrice: 120 }],
    });
    expect(view.result.current.orders).toHaveLength(initialOrders.length + 1);
  });
});

describe("markOrderDelivered", () => {
  it("asks the store to reload stock once the server delivers, and only once", async () => {
    const onStockMoved = vi.fn();
    const { view, orderOf } = mountOrders(onStockMoved);

    await act(async () => {
      await view.result.current.markOrderDelivered(TARGET);
    });
    await waitFor(() => expect(orderOf().status).toBe("Delivered"));
    await act(async () => {
      await view.result.current.markOrderDelivered(TARGET);
    });

    expect(onStockMoved).toHaveBeenCalledTimes(1);
    expect(orderOf().deliveredAt).toBe(todayISO());
  });

  it("surfaces a server rejection instead of throwing", async () => {
    const { view } = mountOrders();

    let ok = true;
    await act(async () => {
      ok = await view.result.current.advanceOrderStatus("#9999", "Ready");
    });

    expect(ok).toBe(false);
    expect(view.result.current.error).toMatch(/not found/i);
  });
});
