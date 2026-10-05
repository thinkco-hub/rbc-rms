import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.inventory.models import FinishedGoodsCostLayer, MenuItem
from apps.inventory.services import deduct_finished_goods_stock

from .models import PosTransaction, PosTransactionItem

CENT = Decimal("0.01")
TAX_RATE = Decimal("5.00")
ZERO = Decimal("0.00")
MAX_MONEY = Decimal("9999999999.99")


class IdempotencyConflict(ValidationError):
	"""Raised when an idempotency key is reused for a different checkout."""


def _fingerprint(data, cashier_id):
	quantities = {}
	for line in data["items"]:
		menu_item_id = int(line["menu_item_id"])
		quantities[menu_item_id] = quantities.get(menu_item_id, ZERO) + line["quantity"]
	canonical = {
		"items": [
			{"menu_item_id": item_id, "quantity": format(quantity, ".2f")}
			for item_id, quantity in sorted(quantities.items())
		],
		"customer_name": data["customer_name"].strip(),
		"customer_contact": data.get("customer_contact", "").strip(),
		"payment_method": data["payment_method"],
		"cashier_id": cashier_id,
		"payment_reference": data.get("payment_reference", "").strip(),
		"notes": data.get("notes", "").strip(),
		"delivery_date": data.get("delivery_date").isoformat()
		if data.get("delivery_date")
		else None,
	}
	serialized = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
	return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _get_idempotent_transaction(key, fingerprint):
	existing = PosTransaction.objects.filter(idempotency_key=key).first()
	if existing is None:
		return None
	if existing.request_fingerprint != fingerprint:
		raise IdempotencyConflict("Idempotency key was already used for a different checkout.")
	return existing


def _ensure_money_range(amount, label):
	if amount < 0 or amount > MAX_MONEY:
		raise ValidationError(f"{label} is outside the supported monetary range.")
	return amount.quantize(CENT, ROUND_HALF_UP)


@transaction.atomic
def complete_sale(data, cashier=None):
	"""Persist one POS sale and deduct stock/COGS as a single transaction.

	Prices and all financial values are derived from locked database records. A
	unique idempotency-key insert serializes concurrent requests using the same key.
	"""
	key = data["idempotency_key"].strip()
	fingerprint = _fingerprint(data, cashier.pk if cashier is not None else None)
	existing = _get_idempotent_transaction(key, fingerprint)
	if existing is not None:
		return existing, False

	quantities = {}
	for line in data["items"]:
		menu_item_id = int(line["menu_item_id"])
		quantities[menu_item_id] = quantities.get(menu_item_id, ZERO) + line["quantity"]
	menu_item_ids = sorted(quantities)

	try:
		with transaction.atomic():
			pos_transaction = PosTransaction.objects.create(
				cashier=cashier,
				subtotal=ZERO,
				discount_amount=ZERO,
				tax_amount=ZERO,
				tax_rate=TAX_RATE,
				total_amount=ZERO,
				customer_name=data["customer_name"].strip(),
				customer_contact=data.get("customer_contact", "").strip(),
				notes=data.get("notes", "").strip(),
				delivery_date=data.get("delivery_date"),
				transaction_timestamp=timezone.now(),
				idempotency_key=key,
				request_fingerprint=fingerprint,
				payment_method=data["payment_method"],
				payment_status=PosTransaction.PaymentStatus.UNPAID,
				amount_paid=ZERO,
				payment_reference=data.get("payment_reference", "").strip(),
				status=PosTransaction.Status.PENDING,
			)
	except IntegrityError:
		# The nested atomic block rolls back to a savepoint, leaving the outer
		# transaction usable to read the winner of a concurrent idempotency race.
		existing = _get_idempotent_transaction(key, fingerprint)
		if existing is None:
			raise
		return existing, False

	menu_items = list(
		MenuItem.objects.select_for_update()
		.filter(pk__in=menu_item_ids)
		.order_by("pk")
	)
	products_by_id = {item.pk: item for item in menu_items}
	missing_ids = [item_id for item_id in menu_item_ids if item_id not in products_by_id]
	if missing_ids:
		raise ValidationError({"menu_item_id": f"Unknown menu item(s): {missing_ids}."})

	line_totals = {}
	subtotal = ZERO
	for menu_item_id in menu_item_ids:
		item = products_by_id[menu_item_id]
		line_total = _ensure_money_range(
			(item.selling_price * quantities[menu_item_id]).quantize(CENT, ROUND_HALF_UP),
			"Line total",
		)
		line_totals[menu_item_id] = line_total
		subtotal += line_total
	subtotal = _ensure_money_range(subtotal, "Subtotal")
	tax_amount = _ensure_money_range(subtotal * TAX_RATE / Decimal("100"), "Tax")
	total_amount = _ensure_money_range(subtotal + tax_amount, "Total")

	stock_result = deduct_finished_goods_stock([
		{"menu_item_id": item_id, "quantity": quantities[item_id]}
		for item_id in menu_item_ids
	])
	cogs_by_item = {item_id: ZERO for item_id in menu_item_ids}
	for allocation in stock_result["allocations"]:
		cogs_by_item[allocation["menu_item_id"]] += allocation["total_cogs"]

	PosTransactionItem.objects.bulk_create([
		PosTransactionItem(
			transaction=pos_transaction,
			menu_item=products_by_id[item_id],
			item_name=products_by_id[item_id].name,
			unit=products_by_id[item_id].unit,
			quantity=quantities[item_id],
			unit_price=products_by_id[item_id].selling_price,
			discount_amount=ZERO,
			line_total=line_totals[item_id],
			unit_cogs=(cogs_by_item[item_id] / quantities[item_id]).quantize(CENT, ROUND_HALF_UP),
			total_cogs=cogs_by_item[item_id],
		)
		for item_id in menu_item_ids
	])

	pos_transaction.subtotal = subtotal
	pos_transaction.discount_amount = ZERO
	pos_transaction.tax_amount = tax_amount
	pos_transaction.tax_rate = TAX_RATE
	pos_transaction.total_amount = total_amount
	pos_transaction.amount_paid = total_amount
	pos_transaction.payment_status = PosTransaction.PaymentStatus.PAID
	pos_transaction.status = PosTransaction.Status.COMPLETED
	pos_transaction.save(update_fields=[
		"subtotal",
		"discount_amount",
		"tax_amount",
		"tax_rate",
		"total_amount",
		"amount_paid",
		"payment_status",
		"status",
	])
	return pos_transaction, True