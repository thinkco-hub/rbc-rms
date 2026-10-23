from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F

from .models import ClosingInventory, CostLayer, FinishedGoodsCostLayer, MenuItem, RawMaterial

QTY_STEP = Decimal("0.01")
COST_STEP = Decimal("0.01")


class InsufficientFinishedGoodsStock(ValidationError):
    """Raised when one or more menu items cannot cover a requested deduction."""

    def __init__(self, shortfalls):
        self.shortfalls = shortfalls
        names = ", ".join(item["name"] for item in shortfalls)
        super().__init__(f"Insufficient finished-goods stock for: {names}.")


class FinishedGoodsCostUnavailable(ValidationError):
    """Raised when FIFO reaches stock whose historical unit cost is unknown."""


class FinishedGoodsInventoryMismatch(ValidationError):
    """Raised when MenuItem stock and remaining cost-layer quantities disagree."""


def _decimal_value(value, label):
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"{label} must be a valid decimal number.")
    if not decimal_value.is_finite():
        raise ValidationError(f"{label} must be a finite decimal number.")
    return decimal_value


def _finished_goods_quantity(value):
    quantity = _decimal_value(value, "Quantity")
    if quantity != quantity.quantize(QTY_STEP):
        raise ValidationError("Finished-goods quantities support at most two decimal places.")
    return quantity


def _finished_goods_unit_cost(value):
    unit_cost = _decimal_value(value, "Unit cost")
    if unit_cost != unit_cost.quantize(COST_STEP):
        raise ValidationError("Unit cost supports at most two decimal places.")
    return unit_cost


def _locked_finished_goods_layers(menu_item_ids):
    return list(
        FinishedGoodsCostLayer.objects.select_for_update()
        .filter(menu_item_id__in=menu_item_ids, quantity_remaining__gt=0)
        .order_by("menu_item_id", "created_at", "finished_goods_cost_layer_id")
    )


def _group_layers_by_menu_item(layers):
    grouped = {}
    for layer in layers:
        grouped.setdefault(layer.menu_item_id, []).append(layer)
    return grouped


def _assert_finished_goods_layer_balance(menu_item, layers):
    layer_quantity = sum(
        (layer.quantity_remaining for layer in layers),
        Decimal("0.00"),
    )
    if layer_quantity != menu_item.stock_quantity:
        raise FinishedGoodsInventoryMismatch(
            f"Finished-goods layers for {menu_item.name} total {layer_quantity}, "
            f"but menu stock is {menu_item.stock_quantity}."
        )


@transaction.atomic
def add_finished_goods_stock(menu_item_id, quantity, unit_cost, source_type, source_reference=""):
    """Add finished stock and its cost provenance as one locked operation."""
    quantity = _finished_goods_quantity(quantity)
    if quantity <= 0:
        raise ValidationError("Quantity must be greater than zero.")
    if unit_cost is not None:
        unit_cost = _finished_goods_unit_cost(unit_cost)
        if unit_cost < 0:
            raise ValidationError("Unit cost cannot be negative.")
    if source_type not in {
        FinishedGoodsCostLayer.SOURCE_PRODUCTION,
        FinishedGoodsCostLayer.SOURCE_RESTOCK,
        FinishedGoodsCostLayer.SOURCE_ADJUSTMENT,
    }:
        raise ValidationError("Unsupported finished-goods cost-layer source.")

    menu_item = MenuItem.objects.select_for_update().get(pk=menu_item_id)
    layers = _locked_finished_goods_layers([menu_item.pk])
    _assert_finished_goods_layer_balance(menu_item, layers)

    layer = FinishedGoodsCostLayer.objects.create(
        menu_item=menu_item,
        quantity=quantity,
        quantity_remaining=quantity,
        unit_cost=unit_cost,
        source_type=source_type,
        source_reference=source_reference,
    )
    MenuItem.objects.filter(pk=menu_item.pk).update(
        stock_quantity=F("stock_quantity") + quantity,
    )
    menu_item.refresh_from_db()
    return menu_item, layer


@transaction.atomic
def deduct_finished_goods_stock(lines):
    """Deduct multiple menu-item quantities FIFO, all-or-nothing.

    `lines` is an iterable of mappings with `menu_item_id` and `quantity` keys.
    Raises before mutation if stock, layer alignment, or cost provenance is invalid.
    """
    quantities = {}
    for line in lines:
        try:
            menu_item_id = int(line["menu_item_id"])
        except (KeyError, TypeError, ValueError):
            raise ValidationError("Each deduction line needs a valid menu_item_id.")
        quantity = _finished_goods_quantity(line.get("quantity"))
        if quantity <= 0:
            raise ValidationError("Deduction quantities must be greater than zero.")
        quantities[menu_item_id] = quantities.get(menu_item_id, Decimal("0.00")) + quantity
    if not quantities:
        raise ValidationError("At least one deduction line is required.")

    menu_item_ids = sorted(quantities)
    menu_items = list(
        MenuItem.objects.select_for_update()
        .filter(pk__in=menu_item_ids)
        .order_by("pk")
    )
    by_id = {item.pk: item for item in menu_items}
    missing_ids = [item_id for item_id in menu_item_ids if item_id not in by_id]
    if missing_ids:
        raise ValidationError({"menu_item_id": f"Unknown menu item(s): {missing_ids}."})

    shortfalls = []
    for menu_item_id in menu_item_ids:
        item = by_id[menu_item_id]
        if item.stock_quantity < quantities[menu_item_id]:
            shortfalls.append({
                "menu_item_id": menu_item_id,
                "name": item.name,
                "requested": quantities[menu_item_id],
                "in_stock": item.stock_quantity,
            })
    if shortfalls:
        raise InsufficientFinishedGoodsStock(shortfalls)

    layers = _locked_finished_goods_layers(menu_item_ids)
    layers_by_item = _group_layers_by_menu_item(layers)
    for menu_item_id in menu_item_ids:
        _assert_finished_goods_layer_balance(by_id[menu_item_id], layers_by_item.get(menu_item_id, []))

    planned_allocations = []
    for menu_item_id in menu_item_ids:
        remaining = quantities[menu_item_id]
        for layer in layers_by_item.get(menu_item_id, []):
            if remaining <= 0:
                break
            allocated = min(layer.quantity_remaining, remaining)
            if layer.unit_cost is None:
                raise FinishedGoodsCostUnavailable(
                    f"Cost basis unavailable for FIFO layer {layer.pk} of "
                    f"{by_id[menu_item_id].name}."
                )
            total_cogs = (allocated * layer.unit_cost).quantize(COST_STEP, ROUND_HALF_UP)
            planned_allocations.append({
                "menu_item_id": menu_item_id,
                "quantity": allocated,
                "unit_cost": layer.unit_cost,
                "total_cogs": total_cogs,
                "cost_layer": layer,
            })
            remaining -= allocated
        if remaining > 0:
            raise FinishedGoodsInventoryMismatch(
                f"Cost layers do not cover the requested stock for {by_id[menu_item_id].name}."
            )

    for allocation in planned_allocations:
        layer = allocation["cost_layer"]
        layer.quantity_remaining -= allocation["quantity"]
        layer.save(update_fields=["quantity_remaining", "updated_at"])
    for menu_item_id in menu_item_ids:
        MenuItem.objects.filter(pk=menu_item_id).update(
            stock_quantity=F("stock_quantity") - quantities[menu_item_id],
        )

    total_cogs = sum(
        (allocation["total_cogs"] for allocation in planned_allocations),
        Decimal("0.00"),
    )
    return {"allocations": planned_allocations, "total_cogs": total_cogs}


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


def restock_menu_item(menu_item_id, quantity, unit_cost):
    """Add manually restocked finished goods with an explicit unit cost."""
    if unit_cost is None:
        raise ValidationError("Unit cost is required for finished-goods restocking.")
    menu_item, _ = add_finished_goods_stock(
        menu_item_id,
        quantity,
        unit_cost,
        FinishedGoodsCostLayer.SOURCE_RESTOCK,
    )
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
    """Reconcile stock and cost-layer quantities to a physical count."""
    record = ClosingInventory.objects.select_for_update().get(pk=closing_inventory_id)
    if record.status != ClosingInventory.STATUS_PENDING:
        raise ValidationError("Only pending counts can be applied.")
    menu_item = MenuItem.objects.select_for_update().get(pk=record.menu_item_id)
    layers = _locked_finished_goods_layers([menu_item.pk])
    _assert_finished_goods_layer_balance(menu_item, layers)
    difference = record.actual_quantity - menu_item.stock_quantity
    if difference > 0:
        FinishedGoodsCostLayer.objects.create(
            menu_item=menu_item,
            quantity=difference,
            quantity_remaining=difference,
            unit_cost=None,
            source_type=FinishedGoodsCostLayer.SOURCE_ADJUSTMENT,
            source_reference=f"Closing count {record.pk}; cost unknown",
        )
    elif difference < 0:
        remaining = -difference
        for layer in layers:
            if remaining <= 0:
                break
            reduced = min(layer.quantity_remaining, remaining)
            layer.quantity_remaining -= reduced
            layer.save(update_fields=["quantity_remaining", "updated_at"])
            remaining -= reduced
    MenuItem.objects.filter(pk=menu_item.pk).update(stock_quantity=record.actual_quantity)
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
