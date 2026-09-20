from django.db import models
from apps.inventory.models import MenuItem, RawMaterial
from apps.recipes.models import Recipe

class ProductionRun(models.Model):
    production_id = models.AutoField(primary_key=True)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    recipe = models.ForeignKey(Recipe, on_delete=models.PROTECT)
    emp = models.ForeignKey("accounts.Employee", on_delete=models.SET_NULL, null=True)
    planned_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    actual_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    planned_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default="scheduled")

class ProductionConsumption(models.Model):
    consumption_id = models.AutoField(primary_key=True)
    production = models.ForeignKey(ProductionRun, on_delete=models.CASCADE)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.PROTECT)
    quantity_consumed = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2)