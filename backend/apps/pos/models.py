from django.db import models
from apps.orders.models import Order
from apps.inventory.models import MenuItem


class PaymentMethod(models.TextChoices):
    CASH = "Cash", "Cash"
    GCASH = "GCash", "GCash"
    BANK_TRANSFER = "Bank Transfer", "Bank Transfer"
    CARD = "Card", "Card"


class PosTransaction(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        VOIDED = "voided", "Voided"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially refunded"
        REFUNDED = "refunded", "Refunded"

    class PaymentStatus(models.TextChoices):
        UNKNOWN = "unknown", "Unknown"
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially paid"
        PAID = "paid", "Paid"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially refunded"
        REFUNDED = "refunded", "Refunded"

    transaction_id = models.AutoField(primary_key=True)
    cashier = models.ForeignKey("accounts.Employee", on_delete=models.SET_NULL, null=True)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    customer_name = models.CharField(max_length=150, blank=True)
    customer_contact = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    transaction_timestamp = models.DateTimeField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=64, unique=True, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, blank=True, default="")
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
    )
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payment_reference = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        "accounts.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pos_voids",
    )
    void_reason = models.TextField(blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)


class PosTransactionItem(models.Model):
    transaction_item_id = models.AutoField(primary_key=True)
    transaction = models.ForeignKey(PosTransaction, on_delete=models.CASCADE)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    item_name = models.CharField(max_length=150, blank=True)
    unit = models.CharField(max_length=20, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cogs = models.DecimalField(max_digits=12, decimal_places=2)
    total_cogs = models.DecimalField(max_digits=12, decimal_places=2)


class PosRefund(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    refund_id = models.AutoField(primary_key=True)
    transaction = models.ForeignKey(
        PosTransaction,
        on_delete=models.PROTECT,
        related_name="refunds",
    )
    actor = models.ForeignKey(
        "accounts.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pos_refunds",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True)
    payment_reference = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="pos_refund_amount_positive",
            ),
        ]


class PosRefundItem(models.Model):
    refund_item_id = models.AutoField(primary_key=True)
    refund = models.ForeignKey(PosRefund, on_delete=models.CASCADE, related_name="items")
    transaction_item = models.ForeignKey(PosTransactionItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["refund", "transaction_item"],
                name="pos_refund_item_unique_line",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="pos_refund_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name="pos_refund_item_amount_nonnegative",
            ),
        ]