from django.db import models
from apps.inventory.models import MenuItem

class Client(models.Model):
    client_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255, blank=True)
    contact_info = models.CharField(max_length=150, blank=True)

class Order(models.Model):
    order_id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, default="pending")
    requested_delivery_date = models.DateField(null=True, blank=True)

class OrderItem(models.Model):
    order_item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)

class Delivery(models.Model):
    delivery_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    scheduled_date = models.DateField()
    assigned_staff = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, default="scheduled")