from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.inventory.models import CostLayer, MenuItem, RawMaterial
from apps.inventory.services import receive_stock
from apps.recipes.models import Recipe, RecipeIngredient

from .models import ProductionConsumption
from .services import InsufficientStockError, cancel_run, complete_run, find_shortfalls, schedule_run


class ProductionServiceTests(TestCase):
    def setUp(self):
        self.flour = RawMaterial.objects.create(name="Flour", unit="kg")
        self.sugar = RawMaterial.objects.create(name="Sugar", unit="kg")
        self.item = MenuItem.objects.create(name="Cake", selling_price=100)
        # Recipe yields 10 pcs from 2 kg flour + 1 kg sugar.
        self.recipe = Recipe.objects.create(menu_item=self.item, yield_quantity=10)
        RecipeIngredient.objects.create(recipe=self.recipe, raw_material=self.flour, quantity_required=2)
        RecipeIngredient.objects.create(recipe=self.recipe, raw_material=self.sugar, quantity_required=1)

    def _stock(self, flour, sugar):
        if flour:
            receive_stock(self.flour.pk, flour, 10, date(2026, 1, 1))
        if sugar:
            receive_stock(self.sugar.pk, sugar, 20, date(2026, 1, 1))

    def test_complete_run_deducts_recipe_and_adds_finished_goods(self):
        self._stock(10, 10)
        run = schedule_run(self.recipe.pk, 20, date(2026, 2, 1))

        run = complete_run(run.pk)

        self.flour.refresh_from_db()
        self.sugar.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(self.flour.current_stock, Decimal("6.000"))
        self.assertEqual(self.sugar.current_stock, Decimal("8.000"))
        self.assertEqual(self.item.stock_quantity, Decimal("20.00"))
        self.assertEqual(run.status, "completed")
        self.assertEqual(run.actual_quantity, Decimal("20.00"))
        flour_row = ProductionConsumption.objects.get(production=run, raw_material=self.flour)
        self.assertEqual(flour_row.quantity_consumed, Decimal("4.000"))
        self.assertEqual(flour_row.total_cost, Decimal("40.00"))

    def test_partial_batch_scales_ingredients(self):
        self._stock(10, 10)
        run = schedule_run(self.recipe.pk, 5, date(2026, 2, 1))
        complete_run(run.pk)
        self.flour.refresh_from_db()
        self.assertEqual(self.flour.current_stock, Decimal("9.000"))

    def test_insufficient_stock_flags_all_shortfalls_and_changes_nothing(self):
        self._stock(3, 0)
        run = schedule_run(self.recipe.pk, 20, date(2026, 2, 1))  # needs 4 flour, 2 sugar

        with self.assertRaises(InsufficientStockError) as ctx:
            complete_run(run.pk)

        self.assertEqual({s["name"] for s in ctx.exception.shortfalls}, {"Flour", "Sugar"})
        self.flour.refresh_from_db()
        self.item.refresh_from_db()
        run.refresh_from_db()
        self.assertEqual(self.flour.current_stock, Decimal("3.000"))
        self.assertEqual(self.item.stock_quantity, Decimal("0.00"))
        self.assertEqual(run.status, "scheduled")
        self.assertFalse(ProductionConsumption.objects.exists())
        self.assertEqual(CostLayer.objects.get(raw_material=self.flour).quantity_remaining, Decimal("3.000"))

    def test_find_shortfalls_reports_amounts(self):
        self._stock(1, 5)
        (short,) = find_shortfalls(self.recipe, 20)
        self.assertEqual(short["required"], Decimal("4.000"))
        self.assertEqual(short["shortfall"], Decimal("3.000"))

    def test_consumption_uses_fifo_cost(self):
        receive_stock(self.flour.pk, 3, 10, date(2026, 1, 1))
        receive_stock(self.flour.pk, 3, 20, date(2026, 1, 2))
        receive_stock(self.sugar.pk, 5, 1, date(2026, 1, 1))
        run = schedule_run(self.recipe.pk, 20, date(2026, 2, 1))  # 4 flour: 3@10 + 1@20
        complete_run(run.pk)
        row = ProductionConsumption.objects.get(production=run, raw_material=self.flour)
        self.assertEqual(row.total_cost, Decimal("50.00"))
        self.assertEqual(row.unit_cost, Decimal("12.50"))

    def test_run_cannot_be_completed_twice_or_after_cancel(self):
        self._stock(10, 10)
        run = schedule_run(self.recipe.pk, 10, date(2026, 2, 1))
        complete_run(run.pk)
        with self.assertRaises(ValidationError):
            complete_run(run.pk)
        with self.assertRaises(ValidationError):
            cancel_run(run.pk)

        other = schedule_run(self.recipe.pk, 10, date(2026, 2, 2))
        cancel_run(other.pk)
        with self.assertRaises(ValidationError):
            complete_run(other.pk)

    def test_schedule_rejects_non_positive_quantity(self):
        with self.assertRaises(ValidationError):
            schedule_run(self.recipe.pk, 0, date(2026, 2, 1))
