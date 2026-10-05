from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.models import Employee, Permission, Role, RolePermission
from apps.inventory.models import FinishedGoodsCostLayer, MenuItem
from apps.accounts.permissions import PosPermission

from .models import PaymentMethod, PosRefund, PosRefundItem, PosTransaction, PosTransactionItem
from .services import TAX_RATE

POS_TRANSACTIONS_URL = "/api/v1/pos/transactions/"
POS_PRODUCTS_URL = "/api/v1/pos/products/"


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


class PosCatalogAndCheckoutApiTests(TestCase):
	def setUp(self):
		self.role, _ = Role.objects.get_or_create(role_name="Cashier")
		self._grant(self.role, "pos.view")
		self._grant(self.role, "pos.manage")
		self.user = User.objects.create_user(username="pos-cashier@example.test", password="secret")
		self.employee = Employee.objects.create(
			user=self.user,
			role=self.role,
			first_name="Pat",
			last_name="Cashier",
			email=self.user.username,
		)
		self.client = APIClient()
		self.client.force_authenticate(user=self.user)
		self.product = MenuItem.objects.create(
			name="Test Croissant",
			unit="each",
			category="Pastries",
			stock_quantity=10,
			selling_price=100,
		)
		self.layer = FinishedGoodsCostLayer.objects.create(
			menu_item=self.product,
			quantity=10,
			quantity_remaining=10,
			unit_cost=20,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)

	def _grant(self, role, code):
		permission, _ = Permission.objects.get_or_create(permission_name=code)
		RolePermission.objects.get_or_create(role=role, perm=permission)

	def _payload(self, *, quantity="2.00", key="checkout-test-1", method=PaymentMethod.CASH):
		return {
			"items": [{"menu_item_id": self.product.pk, "quantity": quantity}],
			"customer_name": "Test Customer",
			"customer_contact": "555-0100",
			"payment_method": method,
			"payment_reference": "reference-123",
			"notes": "No substitutions",
			"delivery_date": None,
			"idempotency_key": key,
		}

	def test_pos_catalog_returns_only_sale_catalog_fields(self):
		response = self.client.get(POS_PRODUCTS_URL)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data[0], {
			"id": self.product.pk,
			"name": "Test Croissant",
			"selling_price": "100.00",
			"category": "Pastries",
			"unit": "each",
			"available_stock": "10.00",
		})

	def test_successful_checkout_calculates_and_persists_financial_values(self):
		response = self.client.post(POS_TRANSACTIONS_URL, self._payload(), format="json")

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Decimal(response.data["subtotal"]), Decimal("200.00"))
		self.assertEqual(Decimal(response.data["discount_amount"]), Decimal("0.00"))
		self.assertEqual(Decimal(response.data["tax_rate"]), TAX_RATE)
		self.assertEqual(Decimal(response.data["tax_amount"]), Decimal("10.00"))
		self.assertEqual(Decimal(response.data["total_amount"]), Decimal("210.00"))
		self.assertEqual(Decimal(response.data["amount_paid"]), Decimal("210.00"))
		self.assertEqual(response.data["payment_status"], PosTransaction.PaymentStatus.PAID)
		self.assertEqual(response.data["status"], PosTransaction.Status.COMPLETED)
		self.product.refresh_from_db()
		self.layer.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, Decimal("8.00"))
		self.assertEqual(self.layer.quantity_remaining, Decimal("8.00"))

	def test_tax_rounds_half_cent_using_half_up(self):
		self.product.selling_price = Decimal("1.10")
		self.product.save(update_fields=["selling_price"])
		response = self.client.post(
			POS_TRANSACTIONS_URL,
			self._payload(quantity="1", key="half-cent-tax"),
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Decimal(response.data["tax_amount"]), Decimal("0.06"))
		self.assertEqual(Decimal(response.data["total_amount"]), Decimal("1.16"))

	def test_database_price_is_authoritative_and_financial_inputs_are_rejected(self):
		payload = self._payload()
		payload.update({"subtotal": "0", "tax_amount": "0", "tax_rate": "0", "total_amount": "0"})
		payload["items"][0].update({"item_name": "Free", "unit_price": "0", "unit_cogs": "0"})

		response = self.client.post(POS_TRANSACTIONS_URL, payload, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(PosTransaction.objects.exists())
		self.product.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, Decimal("10.00"))

	def test_insufficient_stock_does_not_create_transaction_or_deduct_stock(self):
		response = self.client.post(
			POS_TRANSACTIONS_URL,
			self._payload(quantity="11"),
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(PosTransaction.objects.exists())
		self.product.refresh_from_db()
		self.layer.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
		self.assertEqual(self.layer.quantity_remaining, Decimal("10.00"))

	def test_unknown_cost_basis_fails_checkout_without_creating_sale(self):
		self.layer.unit_cost = None
		self.layer.save(update_fields=["unit_cost"])

		response = self.client.post(POS_TRANSACTIONS_URL, self._payload(), format="json")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(PosTransaction.objects.exists())
		self.product.refresh_from_db()
		self.layer.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
		self.assertEqual(self.layer.quantity_remaining, Decimal("10.00"))

	def test_duplicate_product_lines_are_aggregated_to_one_sale_line(self):
		payload = self._payload()
		payload["items"] = [
			{"menu_item_id": self.product.pk, "quantity": "1.00"},
			{"menu_item_id": self.product.pk, "quantity": "2.00"},
		]

		response = self.client.post(POS_TRANSACTIONS_URL, payload, format="json")

		self.assertEqual(response.status_code, 201)
		self.assertEqual(len(response.data["items"]), 1)
		line = response.data["items"][0]
		self.assertEqual(Decimal(line["quantity"]), Decimal("3.00"))
		self.assertEqual(Decimal(line["line_total"]), Decimal("300.00"))
		self.assertEqual(Decimal(line["total_cogs"]), Decimal("60.00"))

	def test_checkout_persists_fifo_cogs_and_historical_snapshots(self):
		self.layer.quantity = 2
		self.layer.quantity_remaining = 2
		self.layer.unit_cost = 4
		self.layer.save()
		FinishedGoodsCostLayer.objects.create(
			menu_item=self.product,
			quantity=8,
			quantity_remaining=8,
			unit_cost=10,
			source_type=FinishedGoodsCostLayer.SOURCE_RESTOCK,
		)

		response = self.client.post(
			POS_TRANSACTIONS_URL,
			self._payload(quantity="3"),
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		line = response.data["items"][0]
		self.assertEqual(line["item_name"], "Test Croissant")
		self.assertEqual(line["unit"], "each")
		self.assertEqual(Decimal(line["unit_price"]), Decimal("100.00"))
		self.assertEqual(Decimal(line["unit_cogs"]), Decimal("6.00"))
		self.assertEqual(Decimal(line["total_cogs"]), Decimal("18.00"))
		self.product.name = "Renamed Croissant"
		self.product.unit = "box"
		self.product.selling_price = 500
		self.product.save()
		self.assertEqual(line["item_name"], "Test Croissant")
		self.assertEqual(line["unit"], "each")
		self.assertEqual(Decimal(line["unit_price"]), Decimal("100.00"))

	def test_payment_methods_are_recorded_as_tender(self):
		for index, method in enumerate(PaymentMethod.values):
			response = self.client.post(
				POS_TRANSACTIONS_URL,
				self._payload(quantity="1", key=f"payment-method-{index}", method=method),
				format="json",
			)
			self.assertEqual(response.status_code, 201)
			self.assertEqual(response.data["payment_method"], method)

	def test_invalid_quantities_and_payment_methods_are_rejected(self):
		for index, quantity in enumerate(("0", "-1", "0.001")):
			response = self.client.post(
				POS_TRANSACTIONS_URL,
				self._payload(quantity=quantity, key=f"invalid-qty-{index}"),
				format="json",
			)
			self.assertEqual(response.status_code, 400)

		response = self.client.post(
			POS_TRANSACTIONS_URL,
			self._payload(method="Crypto"),
			format="json",
		)
		self.assertEqual(response.status_code, 400)
		self.assertFalse(PosTransaction.objects.exists())

	def test_idempotent_retry_returns_existing_transaction_without_second_deduction(self):
		payload = self._payload()
		first = self.client.post(POS_TRANSACTIONS_URL, payload, format="json")
		second = self.client.post(POS_TRANSACTIONS_URL, payload, format="json")

		self.assertEqual(first.status_code, 201)
		self.assertEqual(second.status_code, 200)
		self.assertEqual(second.data["id"], first.data["id"])
		self.assertEqual(PosTransaction.objects.count(), 1)
		self.product.refresh_from_db()
		self.layer.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, Decimal("8.00"))
		self.assertEqual(self.layer.quantity_remaining, Decimal("8.00"))

	def test_same_idempotency_key_with_different_payload_conflicts(self):
		first = self.client.post(POS_TRANSACTIONS_URL, self._payload(), format="json")
		second = self.client.post(
			POS_TRANSACTIONS_URL,
			self._payload(quantity="1", key="checkout-test-1"),
			format="json",
		)

		self.assertEqual(first.status_code, 201)
		self.assertEqual(second.status_code, 409)
		self.assertEqual(PosTransaction.objects.count(), 1)

	def test_transaction_history_list_and_detail_return_receipt_data(self):
		created = self.client.post(POS_TRANSACTIONS_URL, self._payload(), format="json")
		listed = self.client.get(POS_TRANSACTIONS_URL)
		detail = self.client.get(f"{POS_TRANSACTIONS_URL}{created.data['id']}/")

		self.assertEqual(listed.status_code, 200)
		self.assertEqual(detail.status_code, 200)
		self.assertEqual(listed.data[0]["id"], created.data["id"])
		self.assertEqual(detail.data["customer_name"], "Test Customer")
		self.assertEqual(detail.data["payment_reference"], "reference-123")
		self.assertEqual(detail.data["notes"], "No substitutions")
		self.assertEqual(len(detail.data["items"]), 1)

	def test_atomic_rollback_if_line_snapshot_write_fails(self):
		with patch(
			"apps.pos.services.PosTransactionItem.objects.bulk_create",
			side_effect=IntegrityError("simulated line insert failure"),
		):
			with self.assertRaises(IntegrityError):
				self.client.post(POS_TRANSACTIONS_URL, self._payload(), format="json")

		self.assertFalse(PosTransaction.objects.exists())
		self.product.refresh_from_db()
		self.layer.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
		self.assertEqual(self.layer.quantity_remaining, Decimal("10.00"))

	def test_sales_role_can_read_catalog_but_cannot_checkout(self):
		sales_role, _ = Role.objects.get_or_create(role_name="Sales")
		self._grant(sales_role, "pos.view")
		sales_user = User.objects.create_user(username="pos-sales@example.test")
		Employee.objects.create(
			user=sales_user,
			role=sales_role,
			first_name="Sam",
			last_name="Sales",
			email=sales_user.username,
		)
		sales_client = APIClient()
		sales_client.force_authenticate(user=sales_user)

		self.assertEqual(sales_client.get(POS_PRODUCTS_URL).status_code, 200)
		self.assertEqual(
			sales_client.post(POS_TRANSACTIONS_URL, self._payload(), format="json").status_code,
			403,
		)

	def test_unauthenticated_requests_are_rejected(self):
		self.assertIn(APIClient().get(POS_PRODUCTS_URL).status_code, (401, 403))
		self.assertIn(APIClient().post(POS_TRANSACTIONS_URL, {}, format="json").status_code, (401, 403))


class PosConcurrentIdempotencyTests(TransactionTestCase):
	reset_sequences = True

	def test_concurrent_retry_creates_one_transaction_and_deducts_once(self):
		role, _ = Role.objects.get_or_create(role_name="Cashier")
		for code in ("pos.view", "pos.manage"):
			permission, _ = Permission.objects.get_or_create(permission_name=code)
			RolePermission.objects.get_or_create(role=role, perm=permission)
		user = User.objects.create_user(username="concurrent-cashier@example.test")
		Employee.objects.create(
			user=user,
			role=role,
			first_name="Concurrent",
			last_name="Cashier",
			email=user.username,
		)
		product = MenuItem.objects.create(
			name="Concurrent Item",
			stock_quantity=5,
			selling_price=10,
		)
		FinishedGoodsCostLayer.objects.create(
			menu_item=product,
			quantity=5,
			quantity_remaining=5,
			unit_cost=2,
			source_type=FinishedGoodsCostLayer.SOURCE_PRODUCTION,
		)
		user_id = user.pk
		product_id = product.pk
		barrier = Barrier(2)
		payload = {
			"items": [{"menu_item_id": product_id, "quantity": "2"}],
			"customer_name": "Retry Customer",
			"payment_method": PaymentMethod.CASH,
			"idempotency_key": "concurrent-checkout",
		}

		def checkout():
			close_old_connections()
			try:
				client = APIClient()
				client.force_authenticate(user=User.objects.get(pk=user_id))
				barrier.wait(timeout=10)
				response = client.post(POS_TRANSACTIONS_URL, payload, format="json")
				return response.status_code, response.data.get("id")
			finally:
				close_old_connections()

		with ThreadPoolExecutor(max_workers=2) as executor:
			results = list(executor.map(lambda _: checkout(), range(2)))

		self.assertCountEqual([result[0] for result in results], [201, 200])
		self.assertEqual(results[0][1], results[1][1])
		self.assertEqual(PosTransaction.objects.filter(idempotency_key="concurrent-checkout").count(), 1)
		product.refresh_from_db()
		self.assertEqual(product.stock_quantity, Decimal("3.00"))
