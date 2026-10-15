from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.inventory.models import MenuItem

from .models import Client, OrderItem
from .services import create_pos_pre_order, resolve_pos_customer


class PosCustomerResolutionTests(TestCase):
	def test_creates_customer_from_pos_name_and_contact(self):
		client, created = resolve_pos_customer("  Jordan   Baker ", " 555 0100 ")

		self.assertTrue(created)
		self.assertEqual(client.name, "Jordan Baker")
		self.assertEqual(client.contact_info, "555 0100")

	def test_contact_resolution_is_case_and_whitespace_insensitive(self):
		existing = Client.objects.create(name="Existing Name", contact_info="555 0100")

		client, created = resolve_pos_customer("Updated Name", " 555   0100 ")

		self.assertFalse(created)
		self.assertEqual(client.pk, existing.pk)
		self.assertEqual(client.name, "Existing Name")

	def test_duplicate_contacts_resolve_to_lowest_client_id(self):
		first = Client.objects.create(name="First Record", contact_info="555-0100")
		Client.objects.create(name="Duplicate Record", contact_info=" 555-0100 ")

		client, created = resolve_pos_customer("New Name", "555-0100")

		self.assertFalse(created)
		self.assertEqual(client.pk, first.pk)

	def test_missing_contact_resolves_only_contactless_matching_name(self):
		with_contact = Client.objects.create(name="Same Name", contact_info="555-0100")
		without_contact = Client.objects.create(name=" Same   Name ", contact_info="")

		client, created = resolve_pos_customer("same name", "")

		self.assertFalse(created)
		self.assertEqual(client.pk, without_contact.pk)
		self.assertNotEqual(client.pk, with_contact.pk)


class PosPreOrderServiceTests(TestCase):
	def setUp(self):
		self.croissant = MenuItem.objects.create(name="Croissant", selling_price=120)
		self.loaf = MenuItem.objects.create(name="Loaf", selling_price=200)

	def test_creates_pending_order_and_item_lines_for_future_delivery(self):
		delivery_date = timezone.localdate() + timedelta(days=3)
		client, _ = resolve_pos_customer("Jordan Baker", "555-0100")

		order = create_pos_pre_order(
			customer_name="Jordan Baker",
			customer_contact="555-0100",
			delivery_date=delivery_date,
			items=[
				{"menu_item": self.croissant, "quantity": Decimal("2.00")},
				{"menu_item": self.loaf, "quantity": Decimal("1.00")},
			],
		)

		self.assertEqual(order.client_id, client.pk)
		self.assertEqual(order.status, "pending")
		self.assertEqual(order.requested_delivery_date, delivery_date)
		self.assertCountEqual(
			list(order.orderitem_set.values_list("menu_item_id", "quantity")),
			[(self.croissant.pk, Decimal("2.00")), (self.loaf.pk, Decimal("1.00"))],
		)

	def test_rejects_missing_or_nonfuture_delivery_date(self):
		for delivery_date in (None, timezone.localdate()):
			with self.assertRaises(ValidationError):
				create_pos_pre_order(
					customer_name="Jordan Baker",
					customer_contact="555-0100",
					delivery_date=delivery_date,
					items=[{"menu_item": self.croissant, "quantity": Decimal("1.00")}],
				)
		self.assertFalse(Client.objects.exists())
		self.assertFalse(OrderItem.objects.exists())
