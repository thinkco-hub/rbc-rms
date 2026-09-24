from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import CostLayer, RawMaterial
from .services import consume_stock, receive_stock


class InventoryServiceTests(TestCase):
	def setUp(self):
		self.material = RawMaterial.objects.create(
			name="Flour",
			unit="kg",
			reorder_threshold=10,
		)

	def test_receipts_are_consumed_in_fifo_order(self):
		receive_stock(self.material.pk, 5, 10, date(2026, 1, 1))
		receive_stock(self.material.pk, 5, 12, date(2026, 1, 2))

		material, allocations, total_cost = consume_stock(self.material.pk, 7)

		self.assertEqual(material.current_stock, Decimal("3.000"))
		self.assertEqual([item["quantity"] for item in allocations], [Decimal("5.000"), Decimal("2.000")])
		self.assertEqual(total_cost, Decimal("74.000"))
		self.assertEqual(
			list(CostLayer.objects.values_list("quantity_remaining", flat=True)),
			[Decimal("0.000"), Decimal("3.000")],
		)

	def test_insufficient_stock_does_not_mutate_layers_or_stock(self):
		receive_stock(self.material.pk, 5, 10)

		with self.assertRaises(ValidationError):
			consume_stock(self.material.pk, 6)

		self.material.refresh_from_db()
		self.assertEqual(self.material.current_stock, Decimal("5.000"))
		self.assertEqual(CostLayer.objects.get().quantity_remaining, Decimal("5.000"))


class InventoryApiPermissionTests(TestCase):
	def test_inventory_api_requires_admin_access(self):
		response = APIClient().get("/api/v1/inventory/raw-materials/")

		self.assertIn(response.status_code, (401, 403))
