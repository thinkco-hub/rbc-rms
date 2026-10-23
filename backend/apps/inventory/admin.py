from django.contrib import admin

from .models import ClosingInventory, CostLayer, MenuItem, RawMaterial, RestockReminder


@admin.register(RawMaterial)
class RawMaterialAdmin(admin.ModelAdmin):
    list_display = ("raw_material_id", "name", "unit", "current_stock", "reorder_threshold")


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ("menu_item_id", "name", "stock_quantity", "reorder_threshold", "selling_price")


@admin.register(CostLayer)
class CostLayerAdmin(admin.ModelAdmin):
    list_display = ("cost_layer_id", "raw_material", "quantity_remaining", "unit_cost", "received_date")


@admin.register(RestockReminder)
class RestockReminderAdmin(admin.ModelAdmin):
    list_display = ("restock_reminder_id", "raw_material", "quantity_needed", "target_date", "status")


@admin.register(ClosingInventory)
class ClosingInventoryAdmin(admin.ModelAdmin):
    list_display = (
        "closing_inventory_id",
        "menu_item",
        "inventory_date",
        "expected_quantity",
        "actual_quantity",
        "discrepancy_quantity",
        "status",
    )
    list_filter = ("status",)
