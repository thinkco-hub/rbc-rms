import React from "react";
import { useParams } from "react-router";
import RecipeEditor from "../components/recipes/RecipeEditor";
import RecordRoute from "../components/common/RecordRoute";
import { RequireTab } from "../components/RequireAccess";
import {
  useCanViewIngredientCosts,
  useCatalogueSlice,
} from "../store/slices";
import { PATH_BY_TAB } from "../routes";
import type { RecipeInput } from "../types/domain";
import { useShell } from "./shell";

/** `/recipes/:recipeId` — the editor opened on the recipe the URL names. */
export default function RecipeDetailRoute() {
  const { currentUser, backToList, openPath } = useShell();
  const { stockItems, ingredients, pricingRules, saveRecipe } = useCatalogueSlice();
  const canViewIngredientCosts = useCanViewIngredientCosts();
  const { recipeId = "" } = useParams();
  const onBack = () => backToList(PATH_BY_TAB.recipes);

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
      <RecordRoute items={stockItems} id={recipeId} kind="Recipe" onBack={onBack}>
        {(recipe) => (
          <RecipeEditor
            recipe={recipe}
            ingredients={ingredients}
            canViewIngredientCosts={canViewIngredientCosts}
            pricingRules={pricingRules}
            onCancel={onBack}
            onSave={saveAndReturn}
          />
        )}
      </RecordRoute>
    </RequireTab>
  );
}
