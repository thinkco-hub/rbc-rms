from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import MenuItem, RawMaterial
from apps.inventory.services import consume_stock
from apps.recipes.models import Recipe

from .models import ProductionConsumption, ProductionRun

QTY_STEP = Decimal("0.001")
COST_STEP = Decimal("0.01")


class InsufficientStockError(ValidationError):
    """Raised when a run cannot be completed; `shortfalls` lists every short ingredient."""

    def __init__(self, shortfalls):
        self.shortfalls = shortfalls
        names = ", ".join(item["name"] for item in shortfalls)
        super().__init__(f"Insufficient stock for: {names}.")


def required_ingredients(recipe, planned_quantity):
    """Raw material needs for `planned_quantity` units, scaled from the recipe yield."""
    if recipe.yield_quantity <= 0:
        raise ValidationError("Recipe yield must be greater than zero.")
    scale = Decimal(str(planned_quantity)) / recipe.yield_quantity
    return [
        (line.raw_material_id, (line.quantity_required * scale).quantize(QTY_STEP, ROUND_HALF_UP))
        for line in recipe.recipeingredient_set.order_by("pk")
    ]


def find_shortfalls(recipe, planned_quantity, lock=False):
    """Ingredients whose current stock cannot cover the run (FR-3.3.3)."""
    needs = required_ingredients(recipe, planned_quantity)
    materials = RawMaterial.objects.filter(pk__in=[pk for pk, _ in needs])
    if lock:
        materials = materials.select_for_update().order_by("pk")
    by_id = {m.pk: m for m in materials}
    shortfalls = []
    for material_id, required in needs:
        material = by_id[material_id]
        if material.current_stock < required:
            shortfalls.append({
                "raw_material_id": material_id,
                "name": material.name,
                "unit": material.unit,
                "required": required,
                "in_stock": material.current_stock,
                "shortfall": required - material.current_stock,
            })
    return shortfalls


def schedule_run(recipe_id, planned_quantity, planned_date, emp=None):
    planned_quantity = Decimal(str(planned_quantity))
    if planned_quantity <= 0:
        raise ValidationError("Planned quantity must be greater than zero.")
    recipe = Recipe.objects.select_related("menu_item").get(pk=recipe_id)
    return ProductionRun.objects.create(
        menu_item=recipe.menu_item,
        recipe=recipe,
        emp=emp,
        planned_quantity=planned_quantity,
        planned_date=planned_date,
    )


@transaction.atomic
def complete_run(run_id, emp=None, actual_quantity=None):
    """
    Complete a run: deduct recipe ingredients FIFO, record consumption cost and
    add the produced quantity to finished-goods stock. All-or-nothing: if any
    ingredient is short, nothing is consumed and InsufficientStockError is raised.
    """
    run = ProductionRun.objects.select_for_update().select_related("recipe").get(pk=run_id)
    if run.status != ProductionRun.STATUS_SCHEDULED:
        raise ValidationError(f"Only scheduled runs can be completed (run is {run.status}).")

    produced = Decimal(str(actual_quantity)) if actual_quantity is not None else run.planned_quantity
    if produced < 0:
        raise ValidationError("Actual quantity cannot be negative.")

    shortfalls = find_shortfalls(run.recipe, run.planned_quantity, lock=True)
    if shortfalls:
        raise InsufficientStockError(shortfalls)

    for material_id, required in required_ingredients(run.recipe, run.planned_quantity):
        if required <= 0:
            continue
        _, _, total_cost = consume_stock(material_id, required)
        ProductionConsumption.objects.create(
            production=run,
            raw_material_id=material_id,
            quantity_consumed=required,
            unit_cost=(total_cost / required).quantize(COST_STEP, ROUND_HALF_UP),
            total_cost=total_cost.quantize(COST_STEP, ROUND_HALF_UP),
        )

    menu_item = MenuItem.objects.select_for_update().get(pk=run.menu_item_id)
    menu_item.stock_quantity += produced
    menu_item.save(update_fields=["stock_quantity"])

    run.status = ProductionRun.STATUS_COMPLETED
    run.actual_quantity = produced
    run.completed_date = timezone.localdate()
    if emp is not None:
        run.emp = emp
    run.save(update_fields=["status", "actual_quantity", "completed_date", "emp"])
    return run


@transaction.atomic
def cancel_run(run_id):
    run = ProductionRun.objects.select_for_update().get(pk=run_id)
    if run.status != ProductionRun.STATUS_SCHEDULED:
        raise ValidationError("Only scheduled runs can be cancelled.")
    run.status = ProductionRun.STATUS_CANCELLED
    run.save(update_fields=["status"])
    return run
