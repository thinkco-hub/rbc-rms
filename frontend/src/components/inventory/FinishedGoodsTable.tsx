import React, { useState } from "react";
import InventoryStatsBar from "./InventoryStatsBar";
import StockStatusBadge from "./StockStatusBadge";
import { SearchIcon } from "../icons";
import { groupByStatus, getStockStatus, STOCK_STATUS_LABELS } from "../../utils/stock";
import type { MenuItemStock, StockStatus } from "../../types/domain";

interface FinishedGoodsTableProps {
  menuInventory: MenuItemStock[];
  onRestock: (itemId: string) => void;
}

export default function FinishedGoodsTable({ menuInventory, onRestock }: FinishedGoodsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");

  const searched = menuInventory.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );
  const filtered =
    statusFilter === "all" ? searched : searched.filter((item) => getStockStatus(item) === statusFilter);
  const groups = groupByStatus(filtered);

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#562D07]">Inventory: Menu Items</h2>
          <p className="text-[#562D07]/70 mt-1 font-medium text-sm md:text-base">
            Track finished baked goods ready for dispatch
          </p>
        </div>
      </header>

      <InventoryStatsBar items={menuInventory} activeFilter={statusFilter} onFilterChange={setStatusFilter} />

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 shadow-sm flex">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border-none focus:ring-0 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
            placeholder="Search items by name or ID..."
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-[#F3B978] mb-6 md:mb-8 overflow-hidden w-full">
        <div className="px-4 md:px-6 py-4 border-b border-[#F3B978] bg-[#F3B978]/20">
          <h2 className="text-base md:text-lg font-bold text-[#562D07]">📦 Finished Goods Stock</h2>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#FDF9F3] border-b border-[#F3B978] text-sm text-[#562D07]/80">
                <th className="px-4 md:px-6 py-3 font-semibold">Pastry Type</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Batch ID</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Qty Ready</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Shelf Life</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Status</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3B978]/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500">
                    No items match your search.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <React.Fragment key={group.status}>
                    {statusFilter === "all" && (
                      <tr>
                        <td
                          colSpan={6}
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
                        <td className="px-4 md:px-6 py-4 font-bold text-[#121212] text-lg">{item.qty}</td>
                        <td className="px-4 md:px-6 py-4 text-sm text-[#562D07]/70 font-medium">
                          {item.shelfLife}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <StockStatusBadge item={item} />
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <button
                            onClick={() => onRestock(item.id)}
                            className="text-[#F17D0C] hover:bg-orange-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
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
