from django.db import models
from apps.inventory.models import MenuItem

class Client(models.Model):
    client_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255, blank=True)
    contact_info = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    standing_order = models.TextField(blank=True)

class Order(models.Model):
    STATUS_PENDING = "pending"
    STATUS_IN_PRODUCTION = "in_production"
    STATUS_READY = "ready"
    STATUS_DELIVERED = "delivered"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_IN_PRODUCTION, "In Production"),
        (STATUS_READY, "Ready"),
        (STATUS_DELIVERED, "Delivered"),
    )
    PAYMENT_CHOICES = (
        ("Cash", "Cash"),
        ("GCash", "GCash"),
        ("Bank Transfer", "Bank Transfer"),
        ("Card", "Card"),
    )

    order_id = models.AutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    requested_delivery_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    customer_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateField(auto_now_add=True)
    delivered_at = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, null=True, blank=True)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)

class OrderItem(models.Model):
    order_item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

class Delivery(models.Model):
    delivery_id = models.AutoField(primary_key=True)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="delivery")
    scheduled_date = models.DateField()
    assigned_staff = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, default="scheduled")