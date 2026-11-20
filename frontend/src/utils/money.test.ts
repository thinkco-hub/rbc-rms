import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyAscii } from "./money";

describe("formatMoney", () => {
  it("always shows two decimals", () => {
    expect(formatMoney(0)).toBe("₱0.00");
    expect(formatMoney(120)).toBe("₱120.00");
    expect(formatMoney(12.5)).toBe("₱12.50");
  });

  it("does not group thousands", () => {
    expect(formatMoney(1234.5)).toBe("₱1234.50");
    expect(formatMoney(1234567)).toBe("₱1234567.00");
  });

  it("rounds to cents", () => {
    expect(formatMoney(99.999)).toBe("₱100.00");
    expect(formatMoney(-5)).toBe("₱-5.00");
  });
});

describe("formatMoneyAscii", () => {
  it("uses the PDF-safe prefix", () => {
    expect(formatMoneyAscii(240)).toBe("Php240.00");
  });

  it("matches the DOM amount, differing only in the currency mark", () => {
    const value = 1234.5;
    expect(formatMoneyAscii(value).slice(3)).toBe(formatMoney(value).slice(1));
  });
});
