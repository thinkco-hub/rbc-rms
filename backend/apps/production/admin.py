from django.contrib import admin

from .models import ProductionConsumption, ProductionRun


@admin.register(ProductionRun)
class ProductionRunAdmin(admin.ModelAdmin):
    list_display = ("production_id", "menu_item", "recipe", "status", "planned_date", "completed_date")
    list_filter = ("status",)


@admin.register(ProductionConsumption)
class ProductionConsumptionAdmin(admin.ModelAdmin):
    list_display = ("consumption_id", "production", "raw_material", "quantity_consumed", "total_cost")
