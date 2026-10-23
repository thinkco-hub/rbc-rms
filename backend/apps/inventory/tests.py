from datetime import date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.core.exceptions import ValidationError
from django.db import IntegrityError, close_old_connections, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import ClosingInventory, CostLayer, FinishedGoodsCostLayer, MenuItem, RawMaterial
from .services import (
	FinishedGoodsCostUnavailable,
	FinishedGoodsInventoryMismatch,
	InsufficientFinishedGoodsStock,
	apply_all_pending_counts,
	apply_closing_count,
	consume_stock,
	deduct_finished_goods_stock,
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
		FinishedGoodsCostLayer.objects.create(
			menu_item=self.item,
			quantity=5,
			quantity_remaining=5,
			unit_cost=10,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)

	def test_restock_adds_to_stock_quantity(self):
		item = restock_menu_item(self.item.pk, 3, 12)
		self.assertEqual(item.stock_quantity, Decimal("8.00"))
		self.assertEqual(
			sum(
				FinishedGoodsCostLayer.objects.filter(menu_item=self.item).values_list(
					"quantity_remaining", flat=True
				),
				Decimal("0.00"),
			),
			Decimal("8.00"),
		)
		self.assertEqual(
			FinishedGoodsCostLayer.objects.get(source_type=FinishedGoodsCostLayer.SOURCE_RESTOCK).unit_cost,
			Decimal("12.00"),
		)

	def test_restock_rejects_non_positive_quantity(self):
		with self.assertRaises(ValidationError):
			restock_menu_item(self.item.pk, 0, 12)

	def test_restock_requires_explicit_cost_basis(self):
		with self.assertRaises(ValidationError):
			restock_menu_item(self.item.pk, 1, None)
		self.item.refresh_from_db()
		self.assertEqual(self.item.stock_quantity, Decimal("5.00"))


class FinishedGoodsDeductionTests(TestCase):
	def setUp(self):
		self.cake = MenuItem.objects.create(name="Cake", stock_quantity=5, selling_price=100)
		self.bread = MenuItem.objects.create(name="Bread", stock_quantity=1, selling_price=50)
		self.cake_layer = FinishedGoodsCostLayer.objects.create(
			menu_item=self.cake,
			quantity=5,
			quantity_remaining=5,
			unit_cost=4,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)
		self.bread_layer = FinishedGoodsCostLayer.objects.create(
			menu_item=self.bread,
			quantity=1,
			quantity_remaining=1,
			unit_cost=3,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)

	def test_successful_deduction_returns_cost_and_source_layer(self):
		result = deduct_finished_goods_stock([
			{"menu_item_id": self.cake.pk, "quantity": 2},
		])

		self.cake.refresh_from_db()
		self.cake_layer.refresh_from_db()
		self.assertEqual(self.cake.stock_quantity, Decimal("3.00"))
		self.assertEqual(self.cake_layer.quantity_remaining, Decimal("3.00"))
		allocation = result["allocations"][0]
		self.assertEqual(allocation["quantity"], Decimal("2.00"))
		self.assertEqual(allocation["unit_cost"], Decimal("4.00"))
		self.assertEqual(allocation["total_cogs"], Decimal("8.00"))
		self.assertEqual(allocation["cost_layer"], self.cake_layer)
		self.assertEqual(result["total_cogs"], Decimal("8.00"))

	def test_duplicate_lines_are_aggregated(self):
		result = deduct_finished_goods_stock([
			{"menu_item_id": self.cake.pk, "quantity": 1},
			{"menu_item_id": self.cake.pk, "quantity": 2},
		])

		self.cake.refresh_from_db()
		self.cake_layer.refresh_from_db()
		self.assertEqual(self.cake.stock_quantity, Decimal("2.00"))
		self.assertEqual(self.cake_layer.quantity_remaining, Decimal("2.00"))
		self.assertEqual(sum(row["quantity"] for row in result["allocations"]), Decimal("3.00"))

	def test_insufficient_stock_rolls_back_every_product_and_layer(self):
		with self.assertRaises(InsufficientFinishedGoodsStock):
			deduct_finished_goods_stock([
				{"menu_item_id": self.cake.pk, "quantity": 2},
				{"menu_item_id": self.bread.pk, "quantity": 2},
			])

		self.cake.refresh_from_db()
		self.bread.refresh_from_db()
		self.cake_layer.refresh_from_db()
		self.bread_layer.refresh_from_db()
		self.assertEqual(self.cake.stock_quantity, Decimal("5.00"))
		self.assertEqual(self.bread.stock_quantity, Decimal("1.00"))
		self.assertEqual(self.cake_layer.quantity_remaining, Decimal("5.00"))
		self.assertEqual(self.bread_layer.quantity_remaining, Decimal("1.00"))

	def test_outer_transaction_rollback_restores_stock_and_cost_layers(self):
		with self.assertRaises(RuntimeError):
			with transaction.atomic():
				deduct_finished_goods_stock([
					{"menu_item_id": self.cake.pk, "quantity": 2},
				])
				raise RuntimeError("force enclosing operation rollback")

		self.cake.refresh_from_db()
		self.cake_layer.refresh_from_db()
		self.assertEqual(self.cake.stock_quantity, Decimal("5.00"))
		self.assertEqual(self.cake_layer.quantity_remaining, Decimal("5.00"))

	def test_unknown_cost_basis_rejects_all_deductions_without_zero_cost(self):
		unknown_item = MenuItem.objects.create(name="Muffin", stock_quantity=2, selling_price=25)
		unknown_layer = FinishedGoodsCostLayer.objects.create(
			menu_item=unknown_item,
			quantity=2,
			quantity_remaining=2,
			unit_cost=None,
			source_type=FinishedGoodsCostLayer.SOURCE_OPENING_BALANCE,
		)

		with self.assertRaises(FinishedGoodsCostUnavailable):
			deduct_finished_goods_stock([
				{"menu_item_id": self.cake.pk, "quantity": 1},
				{"menu_item_id": unknown_item.pk, "quantity": 1},
			])

		self.cake.refresh_from_db()
		self.cake_layer.refresh_from_db()
		unknown_item.refresh_from_db()
		unknown_layer.refresh_from_db()
		self.assertEqual(self.cake.stock_quantity, Decimal("5.00"))
		self.assertEqual(self.cake_layer.quantity_remaining, Decimal("5.00"))
		self.assertEqual(unknown_item.stock_quantity, Decimal("2.00"))
		self.assertEqual(unknown_layer.quantity_remaining, Decimal("2.00"))

	def test_fifo_partial_then_complete_layer_consumption(self):
		self.cake_layer.quantity = 2
		self.cake_layer.quantity_remaining = 2
		self.cake_layer.unit_cost = 4
		self.cake_layer.save()
		newer_layer = FinishedGoodsCostLayer.objects.create(
			menu_item=self.cake,
			quantity=3,
			quantity_remaining=3,
			unit_cost=10,
			source_type=FinishedGoodsCostLayer.SOURCE_RESTOCK,
		)

		partial = deduct_finished_goods_stock([{"menu_item_id": self.cake.pk, "quantity": 3}])
		self.assertEqual(
			[(a["quantity"], a["unit_cost"], a["total_cogs"]) for a in partial["allocations"]],
			[(Decimal("2.00"), Decimal("4.00"), Decimal("8.00")),
			 (Decimal("1.00"), Decimal("10.00"), Decimal("10.00"))],
		)
		self.cake_layer.refresh_from_db()
		newer_layer.refresh_from_db()
		self.assertEqual(self.cake_layer.quantity_remaining, Decimal("0.00"))
		self.assertEqual(newer_layer.quantity_remaining, Decimal("2.00"))

		complete = deduct_finished_goods_stock([{"menu_item_id": self.cake.pk, "quantity": 2}])
		newer_layer.refresh_from_db()
		self.cake.refresh_from_db()
		self.assertEqual(newer_layer.quantity_remaining, Decimal("0.00"))
		self.assertEqual(self.cake.stock_quantity, Decimal("0.00"))
		self.assertEqual(complete["total_cogs"], Decimal("20.00"))

	def test_layer_stock_mismatch_is_rejected(self):
		self.cake_layer.quantity_remaining = 4
		self.cake_layer.save(update_fields=["quantity_remaining"])
		with self.assertRaises(FinishedGoodsInventoryMismatch):
			deduct_finished_goods_stock([{"menu_item_id": self.cake.pk, "quantity": 1}])


class ConcurrentFinishedGoodsDeductionTests(TransactionTestCase):
	reset_sequences = True

	def test_competing_deductions_cannot_oversell_stock(self):
		item = MenuItem.objects.create(name="Loaf", stock_quantity=5, selling_price=80)
		FinishedGoodsCostLayer.objects.create(
			menu_item=item,
			quantity=5,
			quantity_remaining=5,
			unit_cost=20,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)
		barrier = Barrier(2)

		def attempt_deduction():
			close_old_connections()
			try:
				barrier.wait(timeout=10)
				deduct_finished_goods_stock([{"menu_item_id": item.pk, "quantity": 4}])
				return "deducted"
			except InsufficientFinishedGoodsStock:
				return "insufficient"
			finally:
				close_old_connections()

		with ThreadPoolExecutor(max_workers=2) as executor:
			results = list(executor.map(lambda _: attempt_deduction(), range(2)))

		item.refresh_from_db()
		layer = FinishedGoodsCostLayer.objects.get(menu_item=item)
		self.assertCountEqual(results, ["deducted", "insufficient"])
		self.assertEqual(item.stock_quantity, Decimal("1.00"))
		self.assertEqual(layer.quantity_remaining, Decimal("1.00"))


class FinishedGoodsCostLayerTests(TestCase):
	def setUp(self):
		self.item = MenuItem.objects.create(name="Croissant", selling_price=120)

	def test_unknown_cost_layer_preserves_quantity_and_source(self):
		layer = FinishedGoodsCostLayer.objects.create(
			menu_item=self.item,
			quantity=5,
			quantity_remaining=5,
			unit_cost=None,
			source_type=FinishedGoodsCostLayer.SOURCE_OPENING_BALANCE,
		)

		self.assertEqual(layer.menu_item, self.item)
		self.assertEqual(layer.quantity, Decimal("5.00"))
		self.assertEqual(layer.quantity_remaining, Decimal("5.00"))
		self.assertIsNone(layer.unit_cost)

	def test_layer_rejects_invalid_quantity_ranges(self):
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				FinishedGoodsCostLayer.objects.create(
					menu_item=self.item,
					quantity=0,
					quantity_remaining=0,
					source_type=FinishedGoodsCostLayer.SOURCE_ADJUSTMENT,
				)

		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				FinishedGoodsCostLayer.objects.create(
					menu_item=self.item,
					quantity=2,
					quantity_remaining=3,
					source_type=FinishedGoodsCostLayer.SOURCE_ADJUSTMENT,
				)

	def test_menu_item_is_protected_while_cost_layer_exists(self):
		FinishedGoodsCostLayer.objects.create(
			menu_item=self.item,
			quantity=1,
			quantity_remaining=1,
			unit_cost=10,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)

		with self.assertRaises(ProtectedError):
			self.item.delete()


class ClosingInventoryReconciliationTests(TestCase):
	def setUp(self):
		self.item = MenuItem.objects.create(name="Cake", stock_quantity=10, selling_price=100)
		FinishedGoodsCostLayer.objects.create(
			menu_item=self.item,
			quantity=10,
			quantity_remaining=10,
			unit_cost=25,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)

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
		FinishedGoodsCostLayer.objects.create(
			menu_item=other,
			quantity=4,
			quantity_remaining=4,
			unit_cost=10,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)
		submit_closing_count(self.item.pk, 7, date(2026, 3, 1))
		submit_closing_count(other.pk, 6, date(2026, 3, 1))

		applied = apply_all_pending_counts()

		self.assertEqual(len(applied), 2)
		self.assertFalse(ClosingInventory.objects.filter(status=ClosingInventory.STATUS_PENDING).exists())
		self.item.refresh_from_db()
		other.refresh_from_db()
		self.assertEqual(self.item.stock_quantity, Decimal("7.00"))
		self.assertEqual(other.stock_quantity, Decimal("6.00"))

	def test_upward_count_creates_explicit_unknown_cost_adjustment_layer(self):
		record = submit_closing_count(self.item.pk, 12, date(2026, 3, 1))

		apply_closing_count(record.pk)

		self.item.refresh_from_db()
		layers = list(FinishedGoodsCostLayer.objects.filter(menu_item=self.item))
		self.assertEqual(self.item.stock_quantity, Decimal("12.00"))
		self.assertEqual(
			sum((layer.quantity_remaining for layer in layers), Decimal("0.00")),
			self.item.stock_quantity,
		)
		adjustment = next(layer for layer in layers if layer.source_type == FinishedGoodsCostLayer.SOURCE_ADJUSTMENT)
		self.assertIsNone(adjustment.unit_cost)


class InventoryApiPermissionTests(TestCase):
	def test_inventory_api_requires_admin_access(self):
		response = APIClient().get("/api/v1/inventory/raw-materials/")

		self.assertIn(response.status_code, (401, 403))
