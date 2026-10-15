from django.db import models
from django.utils import timezone

class RawMaterial(models.Model):
    raw_material_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    unit = models.CharField(max_length=20)
    supplier = models.CharField(max_length=150, blank=True)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reorder_threshold = models.DecimalField(max_digits=12, decimal_places=3, default=0)

class CostLayer(models.Model):
    cost_layer_id = models.AutoField(primary_key=True)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE)
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    received_date = models.DateField(default=timezone.localdate, db_index=True)


class FinishedGoodsCostLayer(models.Model):
    SOURCE_OPENING_BALANCE = "opening_balance"
    SOURCE_PRODUCTION = "production"
    SOURCE_RESTOCK = "restock"
    SOURCE_ADJUSTMENT = "adjustment"
    SOURCE_CHOICES = (
        (SOURCE_OPENING_BALANCE, "Opening balance"),
        (SOURCE_PRODUCTION, "Production"),
        (SOURCE_RESTOCK, "Restock"),
        (SOURCE_ADJUSTMENT, "Adjustment"),
    )

    finished_goods_cost_layer_id = models.AutoField(primary_key=True)
    menu_item = models.ForeignKey(
        "MenuItem",
        on_delete=models.PROTECT,
        related_name="finished_goods_cost_layers",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    source_type = models.CharField(max_length=24, choices=SOURCE_CHOICES)
    source_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "finished_goods_cost_layer_id"]
        indexes = [
            models.Index(
                fields=["menu_item", "created_at", "finished_goods_cost_layer_id"],
                name="fgcl_menu_created_fifo_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="fgcl_quantity_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(quantity_remaining__gte=0)
                    & models.Q(quantity_remaining__lte=models.F("quantity"))
                ),
                name="fgcl_remaining_in_range",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_cost__isnull=True) | models.Q(unit_cost__gte=0),
                name="fgcl_unit_cost_nonnegative_or_unknown",
            ),
        ]


class RestockReminder(models.Model):
    restock_reminder_id = models.AutoField(primary_key=True)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE)
    note = models.TextField(blank=True)
    quantity_needed = models.DecimalField(max_digits=12, decimal_places=3)
    target_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default="pending")

class MenuItem(models.Model):
    menu_item_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    stock_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=20, blank=True)
    reorder_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=50, blank=True)
    shelf_life = models.CharField(max_length=50, blank=True)

class ClosingInventory(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPLIED = "applied"
    STATUS_DISMISSED = "dismissed"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_APPLIED, "Applied"),
        (STATUS_DISMISSED, "Dismissed"),
    )

    closing_inventory_id = models.AutoField(primary_key=True)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
    emp = models.ForeignKey("accounts.Employee", on_delete=models.SET_NULL, null=True)
    inventory_date = models.DateField()
    expected_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    actual_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    discrepancy_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    submitted_at = models.DateTimeField(auto_now_add=True)