from django.db import models


class DayClosing(models.Model):
    """
    Locked end-of-day figures (FR-3.8.1). Once a business date is closed its
    numbers are frozen here — later refunds or edits show up in the live
    summary but never silently rewrite what was signed off — and expenses for
    that date can no longer be added, edited or removed.
    """

    day_closing_id = models.AutoField(primary_key=True)
    business_date = models.DateField(unique=True)
    closed_at = models.DateTimeField(auto_now_add=True)
    closed_by = models.ForeignKey(
        "accounts.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="day_closings",
    )
    transaction_count = models.PositiveIntegerField(default=0)
    gross_sales = models.DecimalField(max_digits=14, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2)
    refunds = models.DecimalField(max_digits=14, decimal_places=2)
    net_sales = models.DecimalField(max_digits=14, decimal_places=2)
    cogs = models.DecimalField(max_digits=14, decimal_places=2)
    # True when some sold lines had no FIFO cost (e.g. pre-orders not yet
    # fulfilled), so `cogs` / `gross_profit` understate/overstate reality.
    cogs_incomplete = models.BooleanField(default=False)
    gross_profit = models.DecimalField(max_digits=14, decimal_places=2)
    total_expenses = models.DecimalField(max_digits=14, decimal_places=2)
    net_profit = models.DecimalField(max_digits=14, decimal_places=2)
    expected_cash = models.DecimalField(max_digits=14, decimal_places=2)
    counted_cash = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    # counted - expected: negative is a shortage, positive an overage.
    cash_discrepancy = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-business_date"]
