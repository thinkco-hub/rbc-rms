from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F

from .models import CostLayer, RawMaterial


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
