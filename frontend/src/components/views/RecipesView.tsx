import React from "react";
import RecipesList from "../recipes/RecipesList";
import RecipeEditor from "../recipes/RecipeEditor";
import type {
  IngredientStock,
  MenuItemStock,
  PricingRuleInput,
  PricingRules,
  Recipe,
  RecipeInput,
} from "../../types/domain";

interface RecipesViewProps {
  recipes: Recipe[];
  ingredients: IngredientStock[];
  menuInventory: MenuItemStock[];
  pricingRules: PricingRules;
  viewingRecipe: Recipe | null;
  isCreatingRecipe: boolean;
  onViewRecipe: (recipe: Recipe | null) => void;
  onCreateRecipe: () => void;
  onEditRule: (data: PricingRuleInput) => void;
  onCancelEdit: () => void;
  onSave: (recipe: RecipeInput) => void;
}

export default function RecipesView({
  recipes,
  ingredients,
  menuInventory,
  pricingRules,
  viewingRecipe,
  isCreatingRecipe,
  onViewRecipe,
  onCreateRecipe,
  onEditRule,
  onCancelEdit,
  onSave,
}: RecipesViewProps) {
  if (viewingRecipe || isCreatingRecipe) {
    return (
      <RecipeEditor
        recipe={viewingRecipe}
        ingredients={ingredients}
        pricingRules={pricingRules}
        onCancel={onCancelEdit}
        onSave={onSave}
      />
    );
  }

  return (
    <RecipesList
      recipes={recipes}
      ingredients={ingredients}
      menuInventory={menuInventory}
      pricingRules={pricingRules}
      onEditRule={onEditRule}
      onEdit={onViewRecipe}
      onCreate={onCreateRecipe}
    />
  );
}
