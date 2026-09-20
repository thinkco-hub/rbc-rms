from django.db import models

class ChamsInventory(models.Model):
    chams_inventory_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)

class BranchLedger(models.Model):
    branch_ledger_id = models.AutoField(primary_key=True)
    branch = models.ForeignKey(ChamsInventory, on_delete=models.CASCADE, db_column="branch_id")
    month = models.DateField()
    beginning_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    restocked = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    spoilage = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sold = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    remaining = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    branch_submitted_count = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)