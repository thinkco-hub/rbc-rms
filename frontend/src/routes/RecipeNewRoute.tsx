import React from "react";
import RecipeEditor from "../components/recipes/RecipeEditor";
import { RequireTab } from "../components/RequireAccess";
import {
  useCanViewIngredientCosts,
  useCatalogueSlice,
} from "../store/slices";
import { PATH_BY_TAB } from "../routes";
import type { RecipeInput } from "../types/domain";
import { useShell } from "./shell";

export default function RecipeNewRoute() {
  const { currentUser, backToList, openPath } = useShell();
  const { ingredients, pricingRules, saveRecipe } = useCatalogueSlice();
  const canViewIngredientCosts = useCanViewIngredientCosts();

  // Both editor routes save and leave for the list. The replace is load-bearing:
  // without it browser Back walks into an editor that already saved.
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const saveAndReturn = async (recipe: RecipeInput) => {
    try {
      await saveRecipe(recipe);
      openPath(PATH_BY_TAB.recipes, { replace: true });
    } catch (err) {
      // Stay in the editor so nothing typed is lost.
      setSaveError(err instanceof Error ? err.message : "Could not save the recipe.");
    }
  };

  return (
    <RequireTab role={currentUser.role} tab="recipes">
      {saveError && (
        <div role="alert" className="max-w-6xl mx-auto mb-4 px-4 py-3 rounded-lg text-sm font-medium border bg-red-50 text-red-700 border-red-200">
          Could not save the recipe: {saveError}
        </div>
      )}
      <RecipeEditor
        recipe={null}
        ingredients={ingredients}
        canViewIngredientCosts={canViewIngredientCosts}
        pricingRules={pricingRules}
        onCancel={() => backToList(PATH_BY_TAB.recipes)}
        onSave={saveAndReturn}
      />
    </RequireTab>
  );
}
