import { describe, expect, it } from "vitest";
import { closingInventoryToCSV, computeClosingInventory } from "./closingInventory";
import { formatDayLabel, getDayRange, shiftDayRange } from "./dates";
import { csvEscape, salesToCSV } from "./sales";
import type { IngredientStock, InventoryCount, MenuItemStock, Sale } from "../types/domain";

const MENU: MenuItemStock[] = [
  {
    id: "B-101",
    name: "Butter Croissant",
    qty: 10,
    target: 20,
    shelfLife: "1 day",
    type: "Menu Item",
    price: 120,
  },
];

const INGREDIENTS: IngredientStock[] = [
  {
    id: "ING-01",
    name: "+R&D Order",
    qty: 5,
    target: 10,
    unit: "kg",
    type: "Ingredient",
    supplier: "Baker's Supply Depot",
    unitCost: 55,
  },
];

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: "S-0001",
  type: "Walk-in",
  customerName: "Noel",
  customerContact: "09171234567",
  paymentMethod: "Cash",
  items: [
    { id: "B-101", name: "Butter Croissant", price: 120, category: "Pastries", color: "#F17D0C", qty: 1 },
  ],
  subtotal: 120,
  tax: 0,
  total: 120,
  deliveryDate: "2026-10-23",
  notes: "",
  createdAt: "2026-10-23T09:00:00.000Z",
  ...overrides,
});

/**
 * The sales date cell is a locale string that carries a comma, so the line is
 * read as text rather than split into columns.
 */
const salesLine = (value: Partial<Sale>) => salesToCSV([sale(value)]).split("\n")[1];

const report = computeClosingInventory(
  { start: "2026-10-19", end: "2026-10-25" },
  MENU,
  INGREDIENTS,
  []
);

const closingCells = (line: number) => closingInventoryToCSV(report).split("\n")[line].split(",");

describe("CSV formula-prefix guard", () => {
  it("neutralises a formula in the sales customer column", () => {
    expect(salesLine({ customerName: "=1+1" })).toContain(",'=1+1,");
  });

  it("neutralises a formula in the closing inventory item column", () => {
    // Menu rows are emitted first, so the seeded ingredient is the second line.
    expect(closingCells(2)[1]).toBe("'+R&D Order");
  });

  it("leaves ordinary values exactly as they were", () => {
    expect(salesLine({})).toContain(",Noel,");
    expect(salesLine({})).toContain("1x Butter Croissant");
    expect(closingCells(1)[1]).toBe("Butter Croissant");
  });

  /**
   * The quoting rule predates the guard and still has to hold, because a comma
   * inside a cell moves it to the next column whatever the reader is.
   */
  it("keeps quoting for embedded comma, quote and newline", () => {
    expect(csvEscape("Dela Cruz, Jose")).toBe('"Dela Cruz, Jose"');
    expect(csvEscape('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvEscape("two\nlines")).toBe('"two\nlines"');
    expect(csvEscape("=1+1, done")).toBe("\"'=1+1, done\"");
  });

  it("neutralises a trigger hidden behind a leading space or tab", () => {
    expect(csvEscape(" =1+1")).toBe("' =1+1");
    expect(csvEscape("\t@x")).toBe("'\t@x");
  });

  /**
   * The one place the guard deliberately stops short. Discrepancy quantities are
   * negative whenever stock is short; an apostrophe there makes the cell text,
   * and text drops out of every total the recipient draws over that column.
   */
  it("does not turn a negative quantity into text", () => {
    const shortage = closingInventoryToCSV({
      ...report,
      rows: report.rows.map((row) => ({ ...row, discrepancyQty: -12 })),
    })
      .split("\n")[1]
      .split(",");
    expect(shortage[shortage.length - 1]).toBe("-12");
  });
});

const dailyCounts: InventoryCount[] = [
  {
    id: "C-1",
    itemId: "B-101",
    itemType: "menu",
    date: "2026-10-24",
    systemQty: 10,
    countedQty: 8,
    discrepancy: -2,
    status: "resolved",
  },
  {
    id: "C-2",
    itemId: "B-101",
    itemType: "menu",
    date: "2026-10-25",
    systemQty: 10,
    countedQty: 6,
    discrepancy: -4,
    status: "resolved",
  },
];

describe("daily closing inventory (FR-3.8.3)", () => {
  it("bounds a single-day period at that date on both sides", () => {
    expect(getDayRange("2026-10-25")).toEqual({ start: "2026-10-25", end: "2026-10-25" });
    expect(shiftDayRange({ start: "2026-10-25", end: "2026-10-25" }, -1).start).toBe("2026-10-24");
    expect(shiftDayRange({ start: "2026-10-31", end: "2026-10-31" }, 1).start).toBe("2026-11-01");
  });

  it("labels the day period", () => {
    expect(formatDayLabel("2026-10-25")).toContain("Oct 25, 2026");
  });

  /**
   * A day view is the count log narrowed to that date: the day-before count
   * supplies neither the closing qty nor the period discrepancy.
   */
  it("counts only counts dated inside the day", () => {
    const day = computeClosingInventory(
      { start: "2026-10-25", end: "2026-10-25" },
      MENU,
      INGREDIENTS,
      dailyCounts
    );
    expect(day.rows[0].closingQty).toBe(6);
    expect(day.rows[0].discrepancyQty).toBe(-4);
    const cells = closingInventoryToCSV(day).split("\n")[1].split(",");
    expect(cells[5]).toBe("6");
    expect(cells[cells.length - 1]).toBe("-4");
  });
});
