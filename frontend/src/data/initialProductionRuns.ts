import type { ProductionRun } from "../types/domain";

// Seed production runs (FR-3.x) — extracted from App.jsx (§7 Phase 4)
export const initialProductionRuns: ProductionRun[] = [
  {
    id: "PR-001",
    recipeId: "B-101",
    plannedQty: 60,
    plannedDate: "2026-08-24",
    notes: "",
    status: "scheduled",
    completedDate: null,
  },
  {
    id: "PR-002",
    recipeId: "B-102",
    plannedQty: 40,
    plannedDate: "2026-08-25",
    notes: "For weekend catering order",
    status: "scheduled",
    completedDate: null,
  },
];