from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import MenuItem

from .models import Client, Order, OrderItem


def _normalized_name(value):
	return " ".join((value or "").split()).casefold()


def _normalized_contact(value):
	return "".join((value or "").split()).casefold()


def resolve_pos_customer(name, contact=""):
	"""Resolve a POS customer without adding CRM-wide matching behavior.

	A nonblank normalized contact is the identity key. If legacy duplicates
	exist, the lowest client ID wins. Without contact, resolve only against
	contact-less clients with the same normalized name, again by lowest ID.
	Existing customer records are not rewritten by POS checkout.
	"""
	name = " ".join((name or "").split())
	contact = " ".join((contact or "").split())
	if not name:
		raise ValidationError("Customer name is required for a POS pre-order.")

	clients = Client.objects.all().order_by("client_id")
	if contact:
		normalized_contact = _normalized_contact(contact)
		for client in clients.exclude(contact_info="").iterator():
			if _normalized_contact(client.contact_info) == normalized_contact:
				return client, False
	else:
		normalized_name = _normalized_name(name)
		for client in clients.filter(contact_info="").iterator():
			if _normalized_name(client.name) == normalized_name:
				return client, False

	return Client.objects.create(name=name, contact_info=contact), True


@transaction.atomic
def create_pos_pre_order(*, customer_name, customer_contact, delivery_date, items):
	"""Create only the order side of a future-dated POS sale.

	Call this inside the POS checkout transaction. `items` contains resolved
MenuItem objects and authoritative quantities; OrderItem records the price
locked at checkout. The linked POS transaction lines retain the authoritative
price snapshots.
	"""
	if delivery_date is None or delivery_date <= timezone.localdate():
		raise ValidationError("A POS pre-order requires a future delivery date.")
	if not items:
		raise ValidationError("A POS pre-order requires at least one item.")

	client, _ = resolve_pos_customer(customer_name, customer_contact)
	order = Order.objects.create(
		client=client,
		status="pending",
		requested_delivery_date=delivery_date,
	)
	OrderItem.objects.bulk_create([
		OrderItem(
			order=order,
			menu_item=item["menu_item"],
			quantity=item["quantity"],
			unit_price=item["menu_item"].selling_price,
		)
		for item in items
	])
	return order