import React from "react";
import ProductionRunsList from "../production/ProductionRunsList";
import type {
  IngredientStock,
  MenuItemStock,
  ProductionRun,
  ProductionRunId,
  Recipe,
  ScheduleRunData,
} from "../../types/domain";

interface ProductionViewProps {
  productionRuns: ProductionRun[];
  recipes: Recipe[];
  menuInventory: MenuItemStock[];
  ingredients: IngredientStock[];
  onSchedule: (data: ScheduleRunData) => void;
  onComplete: (id: ProductionRunId) => void;
  onDelete: (id: ProductionRunId) => void;
}

export default function ProductionView({
  productionRuns,
  recipes,
  menuInventory,
  ingredients,
  onSchedule,
  onComplete,
  onDelete,
}: ProductionViewProps) {
  return (
    <ProductionRunsList
      productionRuns={productionRuns}
      recipes={recipes}
      menuInventory={menuInventory}
      ingredients={ingredients}
      onSchedule={onSchedule}
      onComplete={onComplete}
      onDelete={onDelete}
    />
  );
}
