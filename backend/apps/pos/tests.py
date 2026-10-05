from decimal import Decimal
from types import SimpleNamespace

from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIRequestFactory

from apps.accounts.models import Employee, Role
from apps.inventory.models import MenuItem
from apps.accounts.permissions import PosPermission

from .models import PaymentMethod, PosRefund, PosRefundItem, PosTransaction, PosTransactionItem


class PosModelTests(TestCase):
	def setUp(self):
		self.role, _ = Role.objects.get_or_create(role_name="Cashier")
		self.user = User.objects.create_user(username="cashier@example.test", password="secret")
		self.employee = Employee.objects.create(
			user=self.user,
			role=self.role,
			first_name="Casey",
			last_name="Cashier",
			email=self.user.username,
		)
		self.product = MenuItem.objects.create(
			name="Croissant",
			unit="each",
			selling_price=120,
		)
		self.sale = PosTransaction.objects.create(
			cashier=self.employee,
			subtotal=120,
			tax_amount=6,
			tax_rate=5,
			total_amount=126,
			payment_method=PaymentMethod.CASH,
			payment_status=PosTransaction.PaymentStatus.PAID,
			amount_paid=126,
			status=PosTransaction.Status.COMPLETED,
			idempotency_key="checkout-001",
		)
		self.line = PosTransactionItem.objects.create(
			transaction=self.sale,
			menu_item=self.product,
			item_name="Croissant",
			unit="each",
			quantity=1,
			unit_price=120,
			discount_amount=0,
			line_total=120,
			unit_cogs=20,
			total_cogs=20,
		)

	def test_line_keeps_historical_snapshot_and_product_relationship(self):
		self.product.name = "New Product Name"
		self.product.unit = "box"
		self.product.selling_price = 200
		self.product.save()

		self.line.refresh_from_db()
		self.assertEqual(self.line.menu_item, self.product)
		self.assertEqual(self.line.item_name, "Croissant")
		self.assertEqual(self.line.unit, "each")
		self.assertEqual(self.line.unit_price, Decimal("120.00"))

	def test_idempotency_key_is_unique_when_provided(self):
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				PosTransaction.objects.create(
					subtotal=1,
					total_amount=1,
					payment_method=PaymentMethod.CASH,
					idempotency_key="checkout-001",
				)

	def test_refund_records_actor_and_returned_line_quantity(self):
		refund = PosRefund.objects.create(
			transaction=self.sale,
			actor=self.employee,
			amount=63,
			payment_method=PaymentMethod.CASH,
			status=PosRefund.Status.COMPLETED,
			reason="One item returned",
		)
		refund_item = PosRefundItem.objects.create(
			refund=refund,
			transaction_item=self.line,
			quantity=0.5,
			amount=63,
		)

		self.assertEqual(refund.transaction, self.sale)
		self.assertEqual(refund.actor, self.employee)
		self.assertEqual(refund.items.get(), refund_item)

	def test_refund_amount_must_be_positive(self):
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				PosRefund.objects.create(transaction=self.sale, amount=0)

	def test_refund_item_quantity_must_be_positive_and_unique_per_refund(self):
		refund = PosRefund.objects.create(transaction=self.sale, amount=63)
		PosRefundItem.objects.create(
			refund=refund,
			transaction_item=self.line,
			quantity=0.5,
			amount=63,
		)

		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				PosRefundItem.objects.create(
					refund=refund,
					transaction_item=self.line,
					quantity=0.5,
					amount=63,
				)

		other_refund = PosRefund.objects.create(transaction=self.sale, amount=1)
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				PosRefundItem.objects.create(
					refund=other_refund,
					transaction_item=self.line,
					quantity=0,
					amount=0,
				)


class PosPermissionTests(TestCase):
	def setUp(self):
		self.factory = APIRequestFactory()
		self.permission = PosPermission()

	def _user_with_role(self, role_name):
		role, _ = Role.objects.get_or_create(role_name=role_name)
		user = User.objects.create_user(username=f"{role_name.lower().replace(' ', '-')}@example.test")
		Employee.objects.create(
			user=user,
			role=role,
			first_name=role_name,
			last_name="Test",
			email=user.username,
		)
		return user

	def _allows(self, user, method):
		request = getattr(self.factory, method)("/")
		request.user = user
		return self.permission.has_permission(request, SimpleNamespace())

	def test_cashier_can_view_and_manage_pos(self):
		user = self._user_with_role("Cashier")
		self.assertTrue(self._allows(user, "get"))
		self.assertTrue(self._allows(user, "post"))

	def test_sales_can_view_but_not_manage_pos(self):
		user = self._user_with_role("Sales")
		self.assertTrue(self._allows(user, "get"))
		self.assertFalse(self._allows(user, "post"))

	def test_ungranted_role_cannot_view_or_manage_pos(self):
		user = self._user_with_role("Head of Kitchen")
		self.assertFalse(self._allows(user, "get"))
		self.assertFalse(self._allows(user, "post"))

	def test_seed_grants_only_expected_pos_codes(self):
		for role_name, expected in {
			"Owner": {"pos.view", "pos.manage"},
			"Admin": {"pos.view", "pos.manage"},
			"Cashier": {"pos.view", "pos.manage"},
			"Sales": {"pos.view"},
			"Head of Kitchen": set(),
		}.items():
			role = Role.objects.get(role_name=role_name)
			actual = set(
				role.rolepermission_set.values_list("perm__permission_name", flat=True)
			)
			self.assertEqual(actual & {"pos.view", "pos.manage"}, expected)


class PosFoundationMigrationTests(TransactionTestCase):
	reset_sequences = True
	migrate_from = [
		("accounts", "0006_seed_production_permissions"),
		("inventory", "0005_closinginventory_status"),
		("pos", "0001_initial"),
	]
	migrate_to = [
		("accounts", "0007_seed_pos_permissions"),
		("inventory", "0006_finished_goods_cost_layer"),
		("pos", "0002_pos_foundation"),
	]

	def setUp(self):
		executor = MigrationExecutor(connection)
		executor.migrate(self.migrate_from)
		old_apps = executor.loader.project_state(self.migrate_from).apps
		MenuItemV1 = old_apps.get_model("inventory", "MenuItem")
		PosTransactionV1 = old_apps.get_model("pos", "PosTransaction")
		PosTransactionItemV1 = old_apps.get_model("pos", "PosTransactionItem")

		product = MenuItemV1.objects.create(
			name="Legacy Croissant",
			unit="each",
			stock_quantity=Decimal("7.25"),
			selling_price=Decimal("120.00"),
		)
		self.product_id = product.pk
		transaction_record = PosTransactionV1.objects.create(
			subtotal=Decimal("120.00"),
			total_amount=Decimal("126.00"),
			payment_method="Cash",
			status="completed",
		)
		self.transaction_id = transaction_record.pk
		line = PosTransactionItemV1.objects.create(
			transaction=transaction_record,
			menu_item=product,
			quantity=1,
			unit_price=Decimal("120.00"),
			discount_amount=0,
			line_total=Decimal("120.00"),
			unit_cogs=0,
			total_cogs=0,
		)
		self.line_id = line.pk

		executor = MigrationExecutor(connection)
		executor.migrate(self.migrate_to)
		self.apps_after = executor.loader.project_state(self.migrate_to).apps

	def tearDown(self):
		executor = MigrationExecutor(connection)
		executor.migrate(executor.loader.graph.leaf_nodes())
		super().tearDown()

	def test_migration_preserves_stock_and_marks_cost_and_payment_unknown(self):
		MenuItemV2 = self.apps_after.get_model("inventory", "MenuItem")
		FinishedGoodsCostLayer = self.apps_after.get_model("inventory", "FinishedGoodsCostLayer")
		PosTransaction = self.apps_after.get_model("pos", "PosTransaction")
		PosTransactionItem = self.apps_after.get_model("pos", "PosTransactionItem")

		product = MenuItemV2.objects.get(pk=self.product_id)
		layer = FinishedGoodsCostLayer.objects.get(menu_item_id=self.product_id)
		transaction_record = PosTransaction.objects.get(pk=self.transaction_id)
		line = PosTransactionItem.objects.get(pk=self.line_id)

		self.assertEqual(product.stock_quantity, Decimal("7.25"))
		self.assertEqual(layer.quantity, Decimal("7.25"))
		self.assertEqual(layer.quantity_remaining, Decimal("7.25"))
		self.assertIsNone(layer.unit_cost)
		self.assertEqual(layer.source_type, "opening_balance")
		self.assertEqual(transaction_record.payment_status, "unknown")
		self.assertIsNone(transaction_record.amount_paid)
		self.assertIsNone(transaction_record.tax_amount)
		self.assertIsNone(transaction_record.tax_rate)
		self.assertIsNone(transaction_record.transaction_timestamp)
		self.assertEqual(transaction_record.status, "completed")
		self.assertEqual(line.item_name, "Legacy Croissant")
		self.assertEqual(line.unit, "each")
		self.assertEqual(line.unit_price, Decimal("120.00"))
