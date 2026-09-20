import type { Quantity } from "../types/domain";

export function computeDiscrepancy(countedQty: Quantity, systemQty: Quantity): number {
  return countedQty - systemQty;
}

export function discrepancyLabel(discrepancy: number): string {
  if (discrepancy === 0) return "Match";
  return discrepancy > 0 ? `+${discrepancy} Overage` : `${discrepancy} Shortage`;
}