import React, { useMemo, useState } from "react";
import { computeDailyClosing } from "../../utils/closing";
import { getRevenueByPaymentMethod } from "../../utils/sales";
import type { FormEvent } from "react";
import type { DayClosing, Expense, ExpenseData, ExpenseId, Sale, DayClosingData } from "../../types/domain";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface EndOfDayClosingProps {
  sales: Sale[];
  expenses: Expense[];
  dayClosings: DayClosing[];
  onAddExpense: (data: ExpenseData) => void;
  onDeleteExpense: (id: ExpenseId) => void;
  onCloseDay: (data: DayClosingData) => void;
}

export default function EndOfDayClosing({
  sales,
  expenses,
  dayClosings,
  onAddExpense,
  onDeleteExpense,
  onCloseDay,
}: EndOfDayClosingProps) {
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const closing = useMemo(() => computeDailyClosing(date, sales, expenses), [date, sales, expenses]);
  const alreadyClosed = dayClosings.find((c) => c.date === date);
  const paymentBreakdown = useMemo(() => getRevenueByPaymentMethod(closing.daySales), [closing.daySales]);

  const handleAddExpense = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return;
    onAddExpense({ date, description: description.trim(), amount: parsed });
    setDescription("");
    setAmount("");
  };

  const handleCloseDay = () => {
    onCloseDay({
      date,
      grossSales: closing.grossSales,
      totalExpenses: closing.totalExpenses,
      netProfit: closing.netProfit,
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#121212]">End-of-Day Closing</h2>
          <p className="text-gray-500 mt-1">Log expenses and close out the day's register.</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-1 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none bg-white shadow-sm"
        />
      </header>

      {alreadyClosed && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold text-green-700">
            {date} is already closed — net profit ₱{alreadyClosed.netProfit.toFixed(2)}, closed at{" "}
            {new Date(alreadyClosed.closedAt).toLocaleTimeString()}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Gross Sales</p>
          <p className="text-2xl font-bold text-[#121212]">₱{closing.grossSales.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">{closing.daySales.length} transaction(s)</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-500">₱{closing.totalExpenses.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">{closing.dayExpenses.length} entr{closing.dayExpenses.length === 1 ? "y" : "ies"}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm font-medium mb-1">Net Profit</p>
          <p className={`text-2xl font-bold ${closing.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            ₱{closing.netProfit.toFixed(2)}
          </p>
        </div>
      </div>

      {paymentBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-base font-bold text-[#121212] mb-4">Sales by Payment Method</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {paymentBreakdown.map((m) => (
              <div key={m.method} className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 mb-1">{m.method}</p>
                <p className="text-lg font-bold text-[#121212]">₱{m.revenue.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-base font-bold text-[#121212] mb-4">Expenses for {date}</h3>

        {!alreadyClosed && (
          <form onSubmit={handleAddExpense} className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              placeholder="Description (e.g. flour delivery)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none"
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="sm:w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              + Add Expense
            </button>
          </form>
        )}

        {closing.dayExpenses.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No expenses logged for this date.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {closing.dayExpenses.map((exp) => (
              <li key={exp.id} className="py-3 flex justify-between items-center text-sm">
                <span className="text-gray-700">{exp.description}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">₱{Number(exp.amount).toFixed(2)}</span>
                  {!alreadyClosed && (
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove expense"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!alreadyClosed && (
        <button
          onClick={handleCloseDay}
          className="w-full py-3.5 rounded-xl text-white font-bold shadow-lg bg-[#F17D0C] hover:bg-[#d86b06] transition-colors"
        >
          Close {date} — Lock In Net Profit of ₱{closing.netProfit.toFixed(2)}
        </button>
      )}

      {dayClosings.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-8">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-base font-bold text-[#121212]">Closing History</h3>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-700 bg-gray-50/50 uppercase tracking-wider">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Gross Sales</th>
                  <th className="px-6 py-3 text-right">Expenses</th>
                  <th className="px-6 py-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {dayClosings
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-medium text-gray-900">{c.date}</td>
                      <td className="px-6 py-3 text-right text-gray-700">₱{c.grossSales.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right text-red-500">₱{c.totalExpenses.toFixed(2)}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${c.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ₱{c.netProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
