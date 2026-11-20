import React, { useId, useState } from "react";
import Modal from "../common/Modal";
import InventoryStatsBar from "./InventoryStatsBar";
import StockStatusBadge from "./StockStatusBadge";
import SearchField from "../common/SearchField";
import { formatMoney } from "../../utils/money";
import { STOCK_STATUS_LABELS } from "../../utils/status";
import { groupByStatus, getStockStatus } from "../../utils/stock";
import type { FormEvent } from "react";
import type { IngredientFormData, IngredientStock, StockStatus } from "../../types/domain";

/** Ingredient form state: numeric fields are raw strings while typing. */
type IngredientFormState = Omit<IngredientFormData, "qty" | "target" | "unitCost"> & {
  qty: string;
  target: string;
  unitCost: string;
};

function IngredientFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial: IngredientStock | null;
  onClose: () => void;
  onSave: (data: IngredientFormData) => void;
}) {
  const [form, setForm] = useState<IngredientFormState>(
    initial
      ? {
          name: initial.name,
          qty: String(initial.qty),
          target: String(initial.target),
          unit: initial.unit,
          supplier: initial.supplier,
          unitCost: String(initial.unitCost),
        }
      : {
          name: "",
          qty: "",
          target: "",
          unit: "",
          supplier: "",
          unitCost: "",
        }
  );

  const update = (field: keyof IngredientFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const headingId = useId();
  const nameFieldId = useId();
  const qtyFieldId = useId();
  const unitFieldId = useId();
  const targetFieldId = useId();
  const unitCostFieldId = useId();
  const supplierFieldId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || form.qty === "" || form.target === "" || !form.unit) return;
    onSave({
      ...form,
      qty: parseFloat(form.qty),
      target: parseFloat(form.target),
      unitCost: parseFloat(form.unitCost) || 0,
    });
    onClose();
  };

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      overlayClassName="z-[100] bg-black/50 backdrop-blur-sm px-4"
      className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn"
    >
      <form onSubmit={handleSubmit}>
        <h2 id={headingId} className="text-2xl font-bold text-[#121212] mb-6">
          {initial ? "Edit Ingredient" : "Add Ingredient"}
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor={nameFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
            <input
              id={nameFieldId}
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={qtyFieldId} className="block text-sm font-semibold text-gray-700 mb-1">
                Qty in Stock
              </label>
              <input
                id={qtyFieldId}
                type="number"
                min="0"
                step="any"
                value={form.qty}
                onChange={(e) => update("qty", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                required
              />
            </div>
            <div>
              <label htmlFor={unitFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
              <input
                id={unitFieldId}
                type="text"
                placeholder="kg, Liters..."
                value={form.unit}
                onChange={(e) => update("unit", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={targetFieldId} className="block text-sm font-semibold text-gray-700 mb-1">
                Reorder Threshold
              </label>
              <input
                id={targetFieldId}
                type="number"
                min="0"
                step="any"
                value={form.target}
                onChange={(e) => update("target", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
                required
              />
            </div>
            <div>
              <label htmlFor={unitCostFieldId} className="block text-sm font-semibold text-gray-700 mb-1">
                Unit Cost
              </label>
              <input
                id={unitCostFieldId}
                type="number"
                min="0"
                step="any"
                value={form.unitCost}
                onChange={(e) => update("unitCost", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
              />
            </div>
          </div>
          <div>
            <label htmlFor={supplierFieldId} className="block text-sm font-semibold text-gray-700 mb-1">Supplier</label>
            <input
              id={supplierFieldId}
              type="text"
              value={form.supplier}
              onChange={(e) => update("supplier", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-text)] focus:border-[var(--color-brand-text)] outline-none text-gray-800"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
          >
            Save Ingredient
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface RawMaterialsTableProps {
  ingredients: IngredientStock[];
  onRestock: (itemId: string) => void;
  onAdd: (data: IngredientFormData) => void;
  onUpdate: (id: string, data: Partial<IngredientStock>) => void;
}

export default function RawMaterialsTable({ ingredients, onRestock, onAdd, onUpdate }: RawMaterialsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [modalState, setModalState] = useState<{ isOpen: boolean; editing: IngredientStock | null }>({
    isOpen: false,
    editing: null,
  });

  const searched = ingredients.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );
  const filtered = statusFilter === "all" ? searched : searched.filter((item) => getStockStatus(item) === statusFilter);
  const groups = groupByStatus(filtered);

  const handleSave = (data: IngredientFormData) => {
    if (modalState.editing) {
      onUpdate(modalState.editing.id, data);
    } else {
      onAdd(data);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      {modalState.isOpen && (
        <IngredientFormModal
          initial={modalState.editing}
          onClose={() => setModalState({ isOpen: false, editing: null })}
          onSave={handleSave}
        />
      )}

      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#562D07]">
            Inventory: Raw Materials
          </h2>
          <p className="text-[#562D07]/70 mt-1 font-medium text-sm md:text-base">
            Monitor raw materials required for production
          </p>
        </div>
        <button
          onClick={() => setModalState({ isOpen: true, editing: null })}
          className="px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          + Add Ingredient
        </button>
      </header>

      <InventoryStatsBar items={ingredients} activeFilter={statusFilter} onFilterChange={setStatusFilter} />

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 shadow-sm flex">
        <SearchField
          value={search}
          onChange={setSearch}
          ariaLabel="Search ingredients by name or ID"
          placeholder="Search ingredients by name or ID..."
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-[#F3B978] mb-6 md:mb-8 overflow-hidden w-full">
        <div className="px-4 md:px-6 py-4 border-b border-[#F3B978] bg-[#F3B978]/20">
          <h2 className="text-base md:text-lg font-bold text-[#562D07]">🛒 Raw Materials Stock</h2>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-[#FDF9F3] border-b border-[#F3B978] text-sm text-[#562D07]/80">
                <th className="px-4 md:px-6 py-3 font-semibold">Ingredient Name</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Item ID</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Qty in Stock</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Reorder Threshold</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Supplier</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Unit Cost</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Status</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3B978]/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-gray-500">
                    No ingredients match your search.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <React.Fragment key={group.status}>
                    {statusFilter === "all" && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 md:px-6 py-2 bg-[#FDF9F3] text-xs font-bold uppercase tracking-wider text-[#562D07]/70"
                        >
                          {STOCK_STATUS_LABELS[group.status]} ({group.items.length})
                        </td>
                      </tr>
                    )}
                    {group.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FDF9F3]/50 transition-colors">
                        <td className="px-4 md:px-6 py-4 font-semibold text-[#121212]">{item.name}</td>
                        <td className="px-4 md:px-6 py-4 text-sm text-[#562D07]/70 font-medium">{item.id}</td>
                        <td className="px-4 md:px-6 py-4 font-bold text-[#121212] text-lg">
                          {item.qty} <span className="text-xs font-medium text-gray-500">{item.unit}</span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-[#562D07]/70 font-medium">
                          {item.target} {item.unit}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{item.supplier || "—"}</td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-800 font-medium">
                          {formatMoney(Number(item.unitCost || 0))}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <StockStatusBadge item={item} />
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setModalState({ isOpen: true, editing: item })}
                            aria-label={`Edit ${item.name}`}
                            className="text-gray-500 hover:bg-gray-100 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onRestock(item.id)}
                            aria-label={`Restock ${item.name}`}
                            className="text-[var(--color-brand-text)] hover:bg-orange-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                          >
                            + Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
