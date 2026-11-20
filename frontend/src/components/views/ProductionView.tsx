import React from "react";
import ProductionRunsList from "../production/ProductionRunsList";
import type {
  CatalogueItem,
  IngredientStock,
  ProductionRun,
  ProductionRunId,
  ScheduleRunData,
} from "../../types/domain";

interface ProductionViewProps {
  productionRuns: ProductionRun[];
  catalogue: CatalogueItem[];
  ingredients: IngredientStock[];
  onSchedule: (data: ScheduleRunData) => void;
  onComplete: (id: ProductionRunId) => void;
  onDelete: (id: ProductionRunId) => void;
}

export default function ProductionView({
  productionRuns,
  catalogue,
  ingredients,
  onSchedule,
  onComplete,
  onDelete,
}: ProductionViewProps) {
  return (
    <ProductionRunsList
      productionRuns={productionRuns}
      catalogue={catalogue}
      ingredients={ingredients}
      onSchedule={onSchedule}
      onComplete={onComplete}
      onDelete={onDelete}
    />
  );
}
