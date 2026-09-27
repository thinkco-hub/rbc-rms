from decimal import Decimal

from django.test import TestCase

from apps.inventory.models import MenuItem, RawMaterial
from apps.inventory.services import receive_stock

from .models import Recipe, RecipeIngredient
from .services import calculate_recipe_cost, calculate_suggested_price


class RecipePricingTests(TestCase):
	def setUp(self):
		self.material = RawMaterial.objects.create(name="Flour", unit="kg")
		receive_stock(self.material.pk, 10, 20)
		self.menu_item = MenuItem.objects.create(name="Bread", selling_price=50)
		self.recipe = Recipe.objects.create(
			menu_item=self.menu_item,
			name="Bread recipe",
			yield_quantity=2,
			target_margin_percent=40,
		)
		RecipeIngredient.objects.create(
			recipe=self.recipe,
			raw_material=self.material,
			quantity_required=2,
		)

	def test_cogs_and_suggested_price_use_fifo_cost(self):
		total_cost, unit_cost = calculate_recipe_cost(self.recipe)

		self.assertEqual(total_cost, Decimal("40.000"))
		self.assertEqual(unit_cost, Decimal("20.000"))
		self.assertEqual(calculate_suggested_price(unit_cost, 40), Decimal("33.33333333333333333333333333"))
