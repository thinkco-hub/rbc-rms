import type {
  ChamsBeginning,
  ChamsBranch,
  ChamsCount,
  ChamsMovement,
  ChamsProduct,
  LedgerRow,
  MonthKey,
} from "../types/domain";
import { computeDiscrepancy } from "./counts";

export function monthKey(date: Date = new Date()): MonthKey {
  return date.toISOString().slice(0, 7);
}

export function formatMonthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function shiftMonthKey(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface MonthRecord {
  branchId: string;
  productId: string;
  month: MonthKey;
}

function findRecord<T extends MonthRecord>(
  list: T[],
  branchId: string,
  productId: string,
  month: MonthKey
): T | undefined {
  return list.find(
    (r) => r.branchId === branchId && r.productId === productId && r.month === month
  );
}

function hasTrackedDataAtOrBefore(
  branchId: string,
  productId: string,
  month: MonthKey,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[]
): boolean {
  return (
    beginnings.some(
      (b) => b.branchId === branchId && b.productId === productId && b.month <= month
    ) ||
    movements.some(
      (m) => m.branchId === branchId && m.productId === productId && m.month <= month
    )
  );
}

// FR-3.9.3: Remaining = Beginning + Restocked - Spoilage - Sold
function computeRemainingForMonth(
  branchId: string,
  productId: string,
  month: MonthKey,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[]
): number {
  const beginningRecord = findRecord(beginnings, branchId, productId, month);
  const beginning = beginningRecord ? beginningRecord.openingCount : 0;
  const restocked = computeRestockedForMonth(
    branchId,
    productId,
    month,
    beginnings,
    movements
  );
  const movement =
    findRecord(movements, branchId, productId, month) || { spoilage: 0, sold: 0 };
  return beginning + restocked - (movement.spoilage || 0) - (movement.sold || 0);
}

// FR-3.9.4: previous month's remaining carries over and is added into this
// month's restocked total, on top of whatever the supplier manually restocks.
function computeRestockedForMonth(
  branchId: string,
  productId: string,
  month: MonthKey,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[]
): number {
  const prevMonth = shiftMonthKey(month, -1);
  const carryOver = hasTrackedDataAtOrBefore(
    branchId,
    productId,
    prevMonth,
    beginnings,
    movements
  )
    ? computeRemainingForMonth(branchId, productId, prevMonth, beginnings, movements)
    : 0;
  const movement = findRecord(movements, branchId, productId, month);
  const manualRestocked = movement ? movement.restocked || 0 : 0;
  return carryOver + manualRestocked;
}

export function buildLedgerRow(
  branch: ChamsBranch,
  product: ChamsProduct,
  month: MonthKey,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[],
  counts: ChamsCount[]
): LedgerRow {
  const beginningRecord = findRecord(beginnings, branch.id, product.id, month);
  const beginning = beginningRecord ? beginningRecord.openingCount : 0;
  const restocked = computeRestockedForMonth(
    branch.id,
    product.id,
    month,
    beginnings,
    movements
  );
  const movement =
    findRecord(movements, branch.id, product.id, month) || { spoilage: 0, sold: 0 };
  const spoilage = movement.spoilage || 0;
  const sold = movement.sold || 0;
  const remainingCalculated = beginning + restocked - spoilage - sold;

  const count = findRecord(counts, branch.id, product.id, month);
  const remainingReported = count ? count.remainingReported : null;
  const discrepancy =
    remainingReported == null
      ? null
      : computeDiscrepancy(remainingReported, remainingCalculated);

  // FR-3.9.6: profit = sold quantity x standardized selling price
  const profit = sold * (product.sellingPrice || 0);

  return {
    branchId: branch.id,
    branchName: branch.name,
    productId: product.id,
    productName: product.name,
    month,
    beginning,
    beginningSubmitted: !!beginningRecord,
    restocked,
    spoilage,
    sold,
    profit,
    remainingCalculated,
    remainingReported,
    discrepancy,
    flagged: discrepancy != null && discrepancy !== 0,
    countSubmitted: !!count,
  };
}

export function buildLedgerForMonth(
  branches: ChamsBranch[],
  products: ChamsProduct[],
  month: MonthKey,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[],
  counts: ChamsCount[]
): LedgerRow[] {
  // flatMap avoided: requires ES2019 array lib, not enabled in
  // tsconfig (lib: dom, es2015, es2017.string). Nested forEach below
  // preserves the exact same outer-branches/inner-products iteration
  // order and argument list as the original flatMap call.
  const rows: LedgerRow[] = [];
  branches.forEach((branch) => {
    products.forEach((product) => {
      rows.push(buildLedgerRow(branch, product, month, beginnings, movements, counts));
    });
  });
  return rows;
}

export function computeBranchProfitForMonth(
  branch: ChamsBranch,
  products: ChamsProduct[],
  month: MonthKey,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[],
  counts: ChamsCount[]
): number {
  return products
    .map((product) => buildLedgerRow(branch, product, month, beginnings, movements, counts))
    .reduce((sum, row) => sum + row.profit, 0);
}

export function getBranchProductMonths(
  branch: ChamsBranch,
  product: ChamsProduct,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[],
  counts: ChamsCount[]
): MonthKey[] {
  const set = new Set<MonthKey>();
  beginnings
    .filter((b) => b.branchId === branch.id && b.productId === product.id)
    .forEach((b) => set.add(b.month));
  movements
    .filter((m) => m.branchId === branch.id && m.productId === product.id)
    .forEach((m) => set.add(m.month));
  counts
    .filter((c) => c.branchId === branch.id && c.productId === product.id)
    .forEach((c) => set.add(c.month));
  set.add(monthKey());
  return Array.from(set).sort();
}

export function buildLedgerHistoryForBranchProduct(
  branch: ChamsBranch,
  product: ChamsProduct,
  beginnings: ChamsBeginning[],
  movements: ChamsMovement[],
  counts: ChamsCount[]
): LedgerRow[] {
  return getBranchProductMonths(branch, product, beginnings, movements, counts).map(
    (month) => buildLedgerRow(branch, product, month, beginnings, movements, counts)
  );
}