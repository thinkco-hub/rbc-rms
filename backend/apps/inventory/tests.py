from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import ClosingInventory, CostLayer, MenuItem, RawMaterial
from .services import (
	apply_all_pending_counts,
	apply_closing_count,
	consume_stock,
	dismiss_closing_count,
	receive_stock,
	restock_menu_item,
	submit_closing_count,
)


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


class MenuItemRestockTests(TestCase):
	def setUp(self):
		self.item = MenuItem.objects.create(name="Cake", stock_quantity=5, selling_price=100)

	def test_restock_adds_to_stock_quantity(self):
		item = restock_menu_item(self.item.pk, 3)
		self.assertEqual(item.stock_quantity, Decimal("8.00"))

	def test_restock_rejects_non_positive_quantity(self):
		with self.assertRaises(ValidationError):
			restock_menu_item(self.item.pk, 0)


class ClosingInventoryReconciliationTests(TestCase):
	def setUp(self):
		self.item = MenuItem.objects.create(name="Cake", stock_quantity=10, selling_price=100)

	def test_matching_count_is_auto_applied(self):
		record = submit_closing_count(self.item.pk, 10, date(2026, 3, 1))
		self.assertEqual(record.discrepancy_quantity, Decimal("0.00"))
		self.assertEqual(record.status, ClosingInventory.STATUS_APPLIED)

	def test_discrepancy_is_flagged_pending_until_resolved(self):
		record = submit_closing_count(self.item.pk, 7, date(2026, 3, 1))
		self.assertEqual(record.discrepancy_quantity, Decimal("-3.00"))
		self.assertEqual(record.status, ClosingInventory.STATUS_PENDING)
		self.item.refresh_from_db()
		self.assertEqual(self.item.stock_quantity, Decimal("10.00"))

	def test_apply_adjusts_system_stock_and_locks_the_record(self):
		record = submit_closing_count(self.item.pk, 7, date(2026, 3, 1))
		applied = apply_closing_count(record.pk)
		self.item.refresh_from_db()
		self.assertEqual(self.item.stock_quantity, Decimal("7.00"))
		self.assertEqual(applied.status, ClosingInventory.STATUS_APPLIED)
		with self.assertRaises(ValidationError):
			apply_closing_count(record.pk)

	def test_dismiss_leaves_system_stock_unchanged(self):
		record = submit_closing_count(self.item.pk, 7, date(2026, 3, 1))
		dismissed = dismiss_closing_count(record.pk)
		self.item.refresh_from_db()
		self.assertEqual(self.item.stock_quantity, Decimal("10.00"))
		self.assertEqual(dismissed.status, ClosingInventory.STATUS_DISMISSED)

	def test_apply_all_resolves_every_pending_count(self):
		other = MenuItem.objects.create(name="Bread", stock_quantity=4, selling_price=50)
		submit_closing_count(self.item.pk, 7, date(2026, 3, 1))
		submit_closing_count(other.pk, 6, date(2026, 3, 1))

		applied = apply_all_pending_counts()

		self.assertEqual(len(applied), 2)
		self.assertFalse(ClosingInventory.objects.filter(status=ClosingInventory.STATUS_PENDING).exists())
		self.item.refresh_from_db()
		other.refresh_from_db()
		self.assertEqual(self.item.stock_quantity, Decimal("7.00"))
		self.assertEqual(other.stock_quantity, Decimal("6.00"))


class InventoryApiPermissionTests(TestCase):
	def test_inventory_api_requires_admin_access(self):
		response = APIClient().get("/api/v1/inventory/raw-materials/")

		self.assertIn(response.status_code, (401, 403))
