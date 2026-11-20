import { describe, expect, it } from "vitest";
import {
  SALES_TAX_RATE,
  buildOrderFromSale,
  buildSale,
  buildSaleEdit,
  computeSaleTotals,
  linkedSaleView,
  validateCheckout,
} from "./checkout";
import { addDaysISO, todayISO } from "./dates";
import type {
  CartItem,
  ConfirmModalState,
  EditSaleInput,
  Order,
  Sale,
} from "../types/domain";

const CLOCK = new Date(2026, 10, 1, 9, 30, 0);
const TODAY = todayISO(CLOCK);
const TOMORROW = addDaysISO(TODAY, 1);

const CART: CartItem[] = [
  { id: "p1", name: "Butter Croissant", price: 120, category: "Pastries", color: "#F17D0C", qty: 2 },
  { id: "p2", name: "Sourdough Loaf", price: 240, category: "Bread", color: "#562D07", qty: 1 },
];

const state = (overrides: Partial<ConfirmModalState> = {}): ConfirmModalState => ({
  isOpen: true,
  saleType: "Walk-in",
  paymentMethod: "Cash",
  customerName: "Ana Reyes",
  customerContact: "09171234567",
  deliveryDate: "",
  notes: "",
  ...overrides,
});

const builtSale = (overrides: Partial<ConfirmModalState> = {}): Sale => {
  const sale = buildSale(state(overrides), CART, CLOCK);
  if (!sale) throw new Error("Fixture checkout state is supposed to be valid");
  return sale;
};

describe("validateCheckout", () => {
  it("accepts a complete walk-in without a delivery date", () => {
    expect(validateCheckout(state(), CLOCK)).toEqual({ isValid: true, errors: [] });
  });

  it("names every missing field", () => {
    const { isValid, errors } = validateCheckout(
      state({ customerName: "   ", customerContact: "0917", paymentMethod: "" }),
      CLOCK
    );
    expect(isValid).toBe(false);
    expect(errors).toEqual(["customer-name", "customer-contact", "payment-method"]);
  });

  it("accepts an Order only for a delivery date after the clock's today", () => {
    const order = (deliveryDate: string) => state({ saleType: "Order", deliveryDate });

    expect(validateCheckout(order(""), CLOCK).errors).toEqual(["delivery-date"]);
    expect(validateCheckout(order(TODAY), CLOCK).errors).toEqual(["delivery-date"]);
    expect(validateCheckout(order(TOMORROW), CLOCK)).toEqual({ isValid: true, errors: [] });
  });

  it("ignores the delivery date on a walk-in", () => {
    expect(validateCheckout(state({ deliveryDate: TODAY }), CLOCK).isValid).toBe(true);
  });
});

describe("computeSaleTotals", () => {
  it("adds the 5% tax on the line subtotal", () => {
    const totals = computeSaleTotals(CART);
    expect(totals.subtotal).toBe(480);
    expect(totals.tax).toBe(480 * SALES_TAX_RATE);
    expect(totals.total).toBe(504);
  });

  it("is zero for no lines", () => {
    expect(computeSaleTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});

describe("buildSale", () => {
  it("returns null when the checkout rule rejects the state", () => {
    expect(buildSale(state({ customerContact: "" }), CART, CLOCK)).toBeNull();
    expect(buildSale(state({ saleType: "Order", deliveryDate: TODAY }), CART, CLOCK)).toBeNull();
  });

  it("writes a walk-in handed over on the clock's date", () => {
    const sale = builtSale({ customerName: "  Ana Reyes  ", notes: "  Gift wrap  " });
    expect(sale).toMatchObject({
      type: "Walk-in",
      customerName: "Ana Reyes",
      customerContact: "09171234567",
      paymentMethod: "Cash",
      items: CART,
      subtotal: 480,
      tax: 24,
      total: 504,
      deliveryDate: TODAY,
      notes: "Gift wrap",
      createdAt: CLOCK.toISOString(),
    });
    expect(sale.id).toMatch(/^SALE-\d{4,}$/);
    expect(sale.orderId).toBeUndefined();
  });

  it("writes an Order with its delivery date", () => {
    expect(builtSale({ saleType: "Order", deliveryDate: TOMORROW })).toMatchObject({
      type: "Order",
      deliveryDate: TOMORROW,
    });
  });

  it("mints increasing sale numbers instead of reusing the sales length", () => {
    const first = builtSale();
    const second = builtSale();
    const numberOf = (sale: Sale) => Number(sale.id.slice("SALE-".length));
    expect(numberOf(second)).toBe(numberOf(first) + 1);
  });
});

describe("buildOrderFromSale", () => {
  it("drafts a paid order without minting an id", () => {
    const sale = builtSale({ saleType: "Order", deliveryDate: TOMORROW, notes: "Birthday" });
    const draft = buildOrderFromSale(sale, CLOCK);

    expect("id" in draft).toBe(false);
    expect(draft).toMatchObject({
      clientId: null,
      customerName: "Ana Reyes",
      customerContact: "09171234567",
      requestedDate: TODAY,
      status: "Pending",
      notes: "Placed via POS Order — Birthday",
      deliveryDate: TOMORROW,
      assignedTo: null,
      createdAt: TODAY,
      deliveredAt: null,
      paymentMethod: "Cash",
      amountPaid: sale.total,
    });
    expect(draft.items).toEqual([
      { menuItemId: "p1", name: "Butter Croissant", qty: 2, unitPrice: 120 },
      { menuItemId: "p2", name: "Sourdough Loaf", qty: 1, unitPrice: 240 },
    ]);
  });

  it("marks an order placed without notes", () => {
    expect(buildOrderFromSale(builtSale(), CLOCK).notes).toBe("Placed via POS Order");
  });
});

describe("linkedSaleView", () => {
  it("returns a walk-in sale as recorded", () => {
    const sale = builtSale();
    expect(linkedSaleView(sale, [])).toBe(sale);
  });

  it("projects the linked order's customer, lines and totals", () => {
    const sale: Sale = { ...builtSale({ saleType: "Order", deliveryDate: TOMORROW }), orderId: "#1050" };
    const order: Order = {
      ...buildOrderFromSale(sale, CLOCK),
      id: "#1050",
      customerName: "Ana R.",
      customerContact: "09170000000",
      items: [
        { ...buildOrderFromSale(sale, CLOCK).items[0], name: "Croissant Box" },
        { menuItemId: "p3", name: "Ube Cake", qty: 1, unitPrice: 500 },
      ],
    };

    const view = linkedSaleView(sale, [order]);
    expect(view).toMatchObject({
      id: sale.id,
      orderId: "#1050",
      type: "Order",
      customerName: "Ana R.",
      customerContact: "09170000000",
      paymentMethod: "Cash",
      createdAt: sale.createdAt,
      deliveryDate: TOMORROW,
    });
    expect(view.items).toEqual([
      { id: "p1", name: "Croissant Box", price: 120, qty: 2, category: "Pastries", color: "#F17D0C" },
      { id: "p3", name: "Ube Cake", price: 500, qty: 1, category: "Pastries", color: "" },
    ]);
    expect(view.subtotal).toBe(740);
    expect(view.tax).toBe(37);
    expect(view.total).toBe(777);
  });

  it("falls back to the sale when its order is not loaded", () => {
    const sale: Sale = { ...builtSale({ saleType: "Order", deliveryDate: TOMORROW }), orderId: "#404" };
    expect(linkedSaleView(sale, [])).toBe(sale);
  });
});

describe("buildSaleEdit", () => {
  const edit = (overrides: Partial<EditSaleInput> = {}): EditSaleInput => ({
    customerName: "Ana R.",
    customerContact: "09171234567",
    items: [{ ...CART[0], qty: 3 }],
    ...overrides,
  });

  it("refuses a linked sale: its order is the only editor", () => {
    const sale: Sale = { ...builtSale({ saleType: "Order", deliveryDate: TOMORROW }), orderId: "#1050" };
    expect(buildSaleEdit(sale, edit(), "Cashier")).toBeNull();
  });

  it("refuses a blank name or an incomplete contact", () => {
    const sale = builtSale();
    expect(buildSaleEdit(sale, edit({ customerName: " " }), "Cashier")).toBeNull();
    expect(buildSaleEdit(sale, edit({ customerContact: "0917" }), "Cashier")).toBeNull();
  });

  it("returns nothing when no field changed", () => {
    const sale = builtSale();
    const input = edit({ customerName: sale.customerName, items: sale.items });
    expect(buildSaleEdit(sale, input, "Cashier")).toBeNull();
  });

  it("rewrites the sale, recomputes totals and records the history entry", () => {
    const sale = builtSale();
    const result = buildSaleEdit(sale, edit(), "Ana Cashier");

    expect(result).not.toBeNull();
    expect(result?.sale).toMatchObject({
      id: sale.id,
      customerName: "Ana R.",
      customerContact: "09171234567",
      subtotal: 360,
      tax: 18,
      total: 378,
    });
    expect(result?.changes.map((change) => change.label)).toEqual([
      "Customer name",
      "Ordered items",
    ]);
    expect(result?.sale.editHistory).toHaveLength(1);
    expect(result?.sale.editHistory?.[0].userName).toBe("Ana Cashier");
  });
});
