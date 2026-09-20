import type {
  DailyClosingReport,
  Expense,
  ISODate,
  Sale,
} from "../types/domain";
import { saleDateKey } from "./sales";

export function computeDailyClosing(
  date: ISODate,
  sales: Sale[],
  expenses: Expense[]
): DailyClosingReport {
  const daySales = sales.filter((s) => saleDateKey(s) === date);
  const dayExpenses = expenses.filter((e) => e.date === date);
  const grossSales = daySales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return {
    date,
    daySales,
    dayExpenses,
    grossSales,
    totalExpenses,
    netProfit: grossSales - totalExpenses,
  };
}