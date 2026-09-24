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
    closing_inventory_id = models.AutoField(primary_key=True)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
    emp = models.ForeignKey("accounts.Employee", on_delete=models.SET_NULL, null=True)
    inventory_date = models.DateField()
    expected_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    actual_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    discrepancy_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    submitted_at = models.DateTimeField(auto_now_add=True)