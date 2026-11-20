/** The currency mark every DOM money render shares. */
export const MONEY_SYMBOL = "₱";

/** Peso amounts in the DOM: two decimals, no thousands grouping. */
export function formatMoney(value: number): string {
  return `${MONEY_SYMBOL}${value.toFixed(2)}`;
}

/**
 * Peso amounts for the jsPDF receipt. Its built-in WinAnsi fonts cannot render
 * the peso sign, so the PDF uses an ASCII prefix instead.
 */
export function formatMoneyAscii(value: number): string {
  return `Php${value.toFixed(2)}`;
}
