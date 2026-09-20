import React, { useEffect, useState } from "react";
import { formatMonthLabel, monthKey } from "../../utils/ledger";
import type { FormEvent } from "react";
import type { ChamsBeginning, ChamsBranch, ChamsProduct, MonthKey } from "../../types/domain";

const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return monthKey(d);
});

interface BeginningInventoryFormProps {
  branches: ChamsBranch[];
  products: ChamsProduct[];
  beginnings: ChamsBeginning[];
  onSubmit: (data: {
    branchId: string;
    productId: string;
    month: MonthKey;
    openingCount: number;
  }) => void;
}

export default function BeginningInventoryForm({ branches, products, beginnings, onSubmit }: BeginningInventoryFormProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [month, setMonth] = useState(MONTH_OPTIONS[0]);
  const [openingCount, setOpeningCount] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState("");

  useEffect(() => {
    const existing = beginnings.find(
      (b) => b.branchId === branchId && b.productId === productId && b.month === month
    );
    setOpeningCount(existing ? String(existing.openingCount) : "0");
    setHasExisting(!!existing);
  }, [branchId, productId, month, beginnings]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ branchId, productId, month, openingCount: parseFloat(openingCount) || 0 });
    setSubmittedMsg(`Beginning inventory for ${formatMonthLabel(month)} saved.`);
    setTimeout(() => setSubmittedMsg(""), 4000);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#1B2A4A]">Beginning Inventory</h2>
        <p className="text-[#1B2A4A]/70 mt-1 font-medium text-sm md:text-base">
          Set up the opening stock count for a branch, siopao type, and month — used to onboard a new branch/siopao
          type or correct an error. Ongoing months carry stock forward automatically through Restocked.
        </p>
      </header>

      {submittedMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg px-4 py-3 mb-4">
          {submittedMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B5BA5] focus:border-[#3B5BA5] outline-none text-gray-800"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Siopao Type</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B5BA5] focus:border-[#3B5BA5] outline-none text-gray-800"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B5BA5] focus:border-[#3B5BA5] outline-none text-gray-800"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Opening Count</label>
          <input
            type="number"
            min="0"
            step="any"
            value={openingCount}
            onChange={(e) => setOpeningCount(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B5BA5] focus:border-[#3B5BA5] outline-none text-gray-800"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            {hasExisting
              ? "This month already has a confirmed opening count. Editing and saving will overwrite it."
              : "No opening count set for this combo/month yet — defaults to 0. Only set this to onboard a new branch/siopao type or to correct an error."}
          </p>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold bg-[#1B2A4A] hover:bg-[#12203a] transition-colors"
        >
          Save Beginning Inventory
        </button>
      </form>
    </div>
  );
}
