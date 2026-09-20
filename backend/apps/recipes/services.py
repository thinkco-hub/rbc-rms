from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.inventory.services import calculate_fifo_cost

from .models import Recipe, RecipeIngredient


def calculate_recipe_cost(recipe):
    total_cost = Decimal("0")
    for ingredient in recipe.recipeingredient_set.select_related("raw_material"):
        total_cost += calculate_fifo_cost(ingredient.raw_material, ingredient.quantity_required)
    if recipe.yield_quantity <= 0:
        raise ValidationError("Recipe yield must be greater than zero.")
    return total_cost, total_cost / recipe.yield_quantity


def calculate_suggested_price(cost_per_unit, margin_percent):
    margin = Decimal(str(margin_percent))
    if margin < 0 or margin >= 100:
        raise ValidationError("Target margin must be between 0 and 99.99 percent.")
    return cost_per_unit / (Decimal("1") - (margin / Decimal("100")))


@transaction.atomic
def approve_price(recipe, user):
    recipe.approved_price = recipe.suggested_price
    recipe.approval_status = Recipe.APPROVAL_APPROVED
    recipe.approved_at = timezone.now()
    recipe.approved_by = user
    recipe.save(update_fields=["approved_price", "approval_status", "approved_at", "approved_by"])
    return recipe
