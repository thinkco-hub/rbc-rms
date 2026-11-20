import React, { useState } from "react";
import ScheduleRunModal from "./ScheduleRunModal";
import RunDetailModal from "./RunDetailModal";
import DeleteConfirmDialog from "../common/DeleteConfirmDialog";
import { useAnnounce } from "../common/Announcer";
import SearchField from "../common/SearchField";
import { getRunStatus } from "../../utils/production";
import {
  RUN_STATUS_BADGE_CLASSES,
  RUN_STATUS_LABELS,
} from "../../utils/status";
import type {
  CatalogueItem,
  IngredientStock,
  ProductionRun,
  ProductionRunDisposition,
  ProductionRunId,
  ScheduleRunData,
} from "../../types/domain";

const STAT_CARDS: Array<{ key: "all" | ProductionRunDisposition; label: string; iconBg: string }> = [
  { key: "all", label: "Total Runs", iconBg: "bg-gray-100 text-gray-500" },
  { key: "scheduled", label: RUN_STATUS_LABELS.scheduled, iconBg: "bg-blue-50 text-blue-500" },
  { key: "insufficient", label: RUN_STATUS_LABELS.insufficient, iconBg: "bg-red-50 text-red-500" },
  { key: "completed", label: RUN_STATUS_LABELS.completed, iconBg: "bg-green-50 text-green-500" },
];

interface ProductionRunsListProps {
  productionRuns: ProductionRun[];
  catalogue: CatalogueItem[];
  ingredients: IngredientStock[];
  onSchedule: (data: ScheduleRunData) => void;
  onComplete: (id: ProductionRunId) => void;
  onDelete: (id: ProductionRunId) => void;
}

export default function ProductionRunsList({
  productionRuns,
  catalogue,
  ingredients,
  onSchedule,
  onComplete,
  onDelete,
}: ProductionRunsListProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | ProductionRunDisposition>("all");
  const [search, setSearch] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<ProductionRunId | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductionRun | null>(null);
  const announce = useAnnounce();

  const withStatus = productionRuns.map((run) => {
    const recipe = catalogue.find((r) => r.id === run.recipeId) || null;
    return {
      run,
      recipe,
      status: (recipe ? getRunStatus(run, recipe, ingredients) : "scheduled") as ProductionRunDisposition,
    };
  });

  const counts: Record<"all" | ProductionRunDisposition, number> = {
    all: withStatus.length,
    scheduled: 0,
    insufficient: 0,
    completed: 0,
  };
  withStatus.forEach(({ status }) => {
    counts[status] += 1;
  });

  const query = search.toLowerCase();
  const filtered = withStatus.filter((entry) => {
    const { recipe, status } = entry;
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (!search) return true;
    return (recipe?.name ?? "").toLowerCase().includes(query);
  });

  const sorted = [...filtered].sort((a, b) => a.run.plannedDate.localeCompare(b.run.plannedDate));

  const groupedByDate: Array<{ date: string; entries: typeof withStatus }> = [];
  sorted.forEach((entry) => {
    const lastGroup = groupedByDate[groupedByDate.length - 1];
    if (lastGroup && lastGroup.date === entry.run.plannedDate) {
      lastGroup.entries.push(entry);
    } else {
      groupedByDate.push({ date: entry.run.plannedDate, entries: [entry] });
    }
  });

  const selectedEntry = withStatus.find((entry) => entry.run.id === selectedRunId);
  const selectedModalEntry =
    selectedEntry && selectedEntry.recipe ? { ...selectedEntry, recipe: selectedEntry.recipe } : null;

  const handleSchedule = (data: ScheduleRunData) => {
    onSchedule(data);
    setIsScheduling(false);
    announce(`Production run scheduled for ${data.plannedDate}.`);
  };

  const handleComplete = (id: ProductionRunId) => {
    onComplete(id);
    setSelectedRunId(null);
    announce("Production run completed.");
  };

  const pendingRecipe = pendingDelete
    ? catalogue.find((recipe) => recipe.id === pendingDelete.recipeId)
    : undefined;

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    onDelete(pendingDelete.id);
    setPendingDelete(null);
    setSelectedRunId(null);
    announce(`${pendingRecipe ? pendingRecipe.name : "Production run"} deleted.`);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      {isScheduling && (
        <ScheduleRunModal recipes={catalogue} onClose={() => setIsScheduling(false)} onSchedule={handleSchedule} />
      )}
      {selectedModalEntry && (
        <RunDetailModal
          run={selectedModalEntry.run}
          recipe={selectedModalEntry.recipe}
          ingredients={ingredients}
          onClose={() => setSelectedRunId(null)}
          onComplete={handleComplete}
          onDelete={() => setPendingDelete(selectedModalEntry.run)}
        />
      )}
      {pendingDelete && (
        <DeleteConfirmDialog
          title="Delete this run?"
          message={`Deleting ${
            pendingRecipe
              ? `${pendingRecipe.name} (${pendingDelete.plannedQty} ${pendingRecipe.yieldUnit})`
              : "this scheduled run"
          } is irreversible and cannot be undone.`}
          confirmLabel="Delete run"
          onConfirm={confirmPendingDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#121212]">Production Runs</h2>
          <p className="text-gray-500 mt-1">Schedule batches and track them against ingredient stock.</p>
        </div>
        <button
          onClick={() => setIsScheduling(true)}
          disabled={catalogue.length === 0}
          className="px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
        >
          + Schedule Production Run
        </button>
      </header>

      {catalogue.length === 0 && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          No recipes yet — create one under Recipes before scheduling a production run.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {STAT_CARDS.map((card) => {
          const isActive = statusFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setStatusFilter(card.key)}
              className={`text-left bg-white p-4 md:p-5 rounded-2xl border shadow-sm transition-all ${
                isActive ? "border-[var(--color-brand-text)] ring-2 ring-[var(--color-brand-text)]/30" : "border-gray-100 hover:border-gray-300"
              }`}
            >
              <p className="text-gray-500 text-xs md:text-sm font-medium mb-0.5">{card.label}</p>
              <p className="text-xl md:text-2xl font-bold text-[#121212]">{counts[card.key]}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-2 mb-6 flex shadow-sm">
        <SearchField
          value={search}
          onChange={setSearch}
          ariaLabel="Search production runs by recipe name"
          placeholder="Search recipes..."
        />
      </div>

      {groupedByDate.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          No production runs in this view.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <div key={group.date} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-700">{group.date}</h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {group.entries.map(({ run, recipe, status }) => (
                      <tr key={run.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900">{recipe ? recipe.name : "—"}</td>
                        <td className="px-5 py-4 text-gray-600">
                          {run.plannedQty} {recipe ? recipe.yieldUnit : ""}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-3 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${RUN_STATUS_BADGE_CLASSES[status]}`}
                          >
                            {RUN_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedRunId(run.id)}
                            aria-label={`${status === "completed" ? "View" : "View or complete"} ${recipe ? recipe.name : "run"} for ${run.plannedDate}`}
                            className="text-gray-500 hover:text-[var(--color-brand-text)] hover:bg-orange-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                          >
                            {status === "completed" ? "View" : "View / Complete"}
                          </button>
                          {status !== "completed" && (
                            <button
                              onClick={() => setPendingDelete(run)}
                              aria-label={`Delete ${recipe ? recipe.name : "run"} for ${run.plannedDate}`}
                              className="text-gray-500 hover:text-red-500 hover:bg-red-50 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
