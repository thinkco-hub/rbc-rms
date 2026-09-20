from django.db import models
from apps.orders.models import Order
from apps.inventory.models import MenuItem

class PosTransaction(models.Model):
    transaction_id = models.AutoField(primary_key=True)
    cashier = models.ForeignKey("accounts.Employee", on_delete=models.SET_NULL, null=True)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default="completed")
    voided_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)

class PosTransactionItem(models.Model):
    transaction_item_id = models.AutoField(primary_key=True)
    transaction = models.ForeignKey(PosTransaction, on_delete=models.CASCADE)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cogs = models.DecimalField(max_digits=12, decimal_places=2)
    total_cogs = models.DecimalField(max_digits=12, decimal_places=2)