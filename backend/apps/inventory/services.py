from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F

from .models import ClosingInventory, CostLayer, MenuItem, RawMaterial


@transaction.atomic
def receive_stock(raw_material_id, quantity, unit_cost, received_date=None):
    quantity = Decimal(str(quantity))
    unit_cost = Decimal(str(unit_cost))
    if quantity <= 0:
        raise ValidationError("Receipt quantity must be greater than zero.")
    if unit_cost < 0:
        raise ValidationError("Unit cost cannot be negative.")

    material = RawMaterial.objects.select_for_update().get(pk=raw_material_id)
    layer = CostLayer.objects.create(
        raw_material=material,
        quantity_remaining=quantity,
        unit_cost=unit_cost,
        **({"received_date": received_date} if received_date else {}),
    )
    RawMaterial.objects.filter(pk=material.pk).update(
        current_stock=F("current_stock") + quantity,
        unit_cost=unit_cost,
    )
    material.refresh_from_db()
    return material, layer


@transaction.atomic
def consume_stock(raw_material_id, quantity):
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise ValidationError("Consumption quantity must be greater than zero.")

    material = RawMaterial.objects.select_for_update().get(pk=raw_material_id)
    layers = list(
        CostLayer.objects.select_for_update()
        .filter(raw_material=material, quantity_remaining__gt=0)
        .order_by("received_date", "pk")
    )
    if sum((layer.quantity_remaining for layer in layers), Decimal("0")) < quantity:
        raise ValidationError("Insufficient stock for FIFO consumption.")

    remaining = quantity
    total_cost = Decimal("0")
    allocations = []
    for layer in layers:
        if remaining <= 0:
            break
        consumed = min(layer.quantity_remaining, remaining)
        layer.quantity_remaining -= consumed
        layer.save(update_fields=["quantity_remaining"])
        allocations.append({"layer": layer, "quantity": consumed, "unit_cost": layer.unit_cost})
        total_cost += consumed * layer.unit_cost
        remaining -= consumed

    RawMaterial.objects.filter(pk=material.pk).update(
        current_stock=F("current_stock") - quantity,
    )
    material.refresh_from_db()
    return material, allocations, total_cost


def calculate_fifo_cost(raw_material, quantity):
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise ValidationError("Cost quantity must be greater than zero.")

    layers = raw_material.costlayer_set.filter(quantity_remaining__gt=0).order_by("received_date", "pk")
    remaining = quantity
    total_cost = Decimal("0")
    for layer in layers:
        if remaining <= 0:
            break
        allocated = min(layer.quantity_remaining, remaining)
        total_cost += allocated * layer.unit_cost
        remaining -= allocated
    if remaining > 0:
        raise ValidationError("Insufficient stock to calculate FIFO cost.")
    return total_cost


@transaction.atomic
def restock_menu_item(menu_item_id, quantity):
    """Manual restock override for finished goods (FR-3.4.8) — not FIFO-costed."""
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise ValidationError("Restock quantity must be greater than zero.")
    menu_item = MenuItem.objects.select_for_update().get(pk=menu_item_id)
    MenuItem.objects.filter(pk=menu_item.pk).update(stock_quantity=F("stock_quantity") + quantity)
    menu_item.refresh_from_db()
    return menu_item


@transaction.atomic
def submit_closing_count(menu_item_id, actual_quantity, inventory_date, emp=None):
    """Log a finished-goods physical count against system stock (FR-3.4.4)."""
    actual_quantity = Decimal(str(actual_quantity))
    if actual_quantity < 0:
        raise ValidationError("Counted quantity cannot be negative.")

    menu_item = MenuItem.objects.select_for_update().get(pk=menu_item_id)
    expected = menu_item.stock_quantity
    discrepancy = actual_quantity - expected
    # A count that matches system stock has nothing to reconcile.
    status = ClosingInventory.STATUS_APPLIED if discrepancy == 0 else ClosingInventory.STATUS_PENDING
    return ClosingInventory.objects.create(
        menu_item=menu_item,
        emp=emp,
        inventory_date=inventory_date,
        expected_quantity=expected,
        actual_quantity=actual_quantity,
        discrepancy_quantity=discrepancy,
        status=status,
    )


@transaction.atomic
def apply_closing_count(closing_inventory_id):
    """Adjust system stock to match the counted quantity (FR-3.4.5)."""
    record = ClosingInventory.objects.select_for_update().get(pk=closing_inventory_id)
    if record.status != ClosingInventory.STATUS_PENDING:
        raise ValidationError("Only pending counts can be applied.")
    MenuItem.objects.filter(pk=record.menu_item_id).update(stock_quantity=record.actual_quantity)
    record.status = ClosingInventory.STATUS_APPLIED
    record.save(update_fields=["status"])
    return record


@transaction.atomic
def dismiss_closing_count(closing_inventory_id):
    """Discard a count, keeping system stock as-is (FR-3.4.5)."""
    record = ClosingInventory.objects.select_for_update().get(pk=closing_inventory_id)
    if record.status != ClosingInventory.STATUS_PENDING:
        raise ValidationError("Only pending counts can be dismissed.")
    record.status = ClosingInventory.STATUS_DISMISSED
    record.save(update_fields=["status"])
    return record


@transaction.atomic
def apply_all_pending_counts():
    pending_ids = list(
        ClosingInventory.objects.filter(status=ClosingInventory.STATUS_PENDING)
        .order_by("pk")
        .values_list("pk", flat=True)
    )
    return [apply_closing_count(pk) for pk in pending_ids]
