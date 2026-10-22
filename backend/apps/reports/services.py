"""
Sales & reporting aggregation (FR-3.8.1–3.8.5).

Revenue is recognised from POS transactions on the local date of their
`transaction_timestamp` (pre-orders are paid at checkout, so they count on the
day the money was taken, not the delivery date). Refunds count on the day they
were processed. Orders-module payments are not included: `record_payment` keeps
no payment date, so they cannot be attributed to a business day.

Figures:
    gross_sales   = Σ transaction totals (tax inclusive — what the till took)
    net_sales     = gross_sales − tax − refunds
    gross_profit  = net_sales − COGS
    net_profit    = gross_profit − expenses
"""

from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Case, Count, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from apps.core.models import Expense
from apps.inventory.models import ClosingInventory
from apps.pos.models import PaymentMethod, PosRefund, PosTransaction, PosTransactionItem

from .models import DayClosing

ZERO = Decimal("0.00")
CENT = Decimal("0.01")
MAX_RANGE_DAYS = 731
GRANULARITIES = ("day", "week", "month")

# Voided and still-pending checkouts never took money.
REVENUE_STATUSES = (
    PosTransaction.Status.COMPLETED,
    PosTransaction.Status.PARTIALLY_REFUNDED,
    PosTransaction.Status.REFUNDED,
)

_MONEY = DecimalField(max_digits=14, decimal_places=2)


def _sum(field):
    return Coalesce(Sum(field), Value(ZERO), output_field=_MONEY)


def _q(amount):
    return (amount or ZERO).quantize(CENT)


def validate_range(start, end):
    if start > end:
        raise ValidationError("start must be on or before end.")
    if (end - start).days >= MAX_RANGE_DAYS:
        raise ValidationError(f"Date range cannot exceed {MAX_RANGE_DAYS} days.")


# ---------- Base querysets ----------

def sales_between(start, end):
    return PosTransaction.objects.filter(
        status__in=REVENUE_STATUSES,
        transaction_timestamp__date__gte=start,
        transaction_timestamp__date__lte=end,
    )


def refunds_between(start, end):
    return (
        PosRefund.objects.filter(status=PosRefund.Status.COMPLETED)
        .annotate(refund_date=TruncDate(Coalesce("processed_at", "created_at")))
        .filter(refund_date__gte=start, refund_date__lte=end)
    )


def sale_lines_between(start, end):
    return PosTransactionItem.objects.filter(
        transaction__status__in=REVENUE_STATUSES,
        transaction__transaction_timestamp__date__gte=start,
        transaction__transaction_timestamp__date__lte=end,
    )


# ---------- Per-day rollup (the building block for every report) ----------

def _empty_day():
    return {
        "transaction_count": 0,
        "gross_sales": ZERO,
        "tax_amount": ZERO,
        "refunds": ZERO,
        "cogs": ZERO,
        "cogs_incomplete": False,
        "total_expenses": ZERO,
    }


def _finish(row):
    row["net_sales"] = row["gross_sales"] - row["tax_amount"] - row["refunds"]
    row["gross_profit"] = row["net_sales"] - row["cogs"]
    row["net_profit"] = row["gross_profit"] - row["total_expenses"]
    return row


def daily_rollup(start, end):
    """{date: figures} for every date in [start, end], zero-filled."""
    days = {start + timedelta(days=i): _empty_day() for i in range((end - start).days + 1)}

    sales = (
        sales_between(start, end)
        .annotate(day=TruncDate("transaction_timestamp"))
        .values("day")
        .annotate(
            transaction_count=Count("pk"),
            gross_sales=_sum("total_amount"),
            tax_amount=_sum("tax_amount"),
        )
    )
    for row in sales:
        day = days[row["day"]]
        day["transaction_count"] = row["transaction_count"]
        day["gross_sales"] = row["gross_sales"]
        day["tax_amount"] = row["tax_amount"]

    cogs = (
        sale_lines_between(start, end)
        .annotate(day=TruncDate("transaction__transaction_timestamp"))
        .values("day")
        .annotate(cogs=_sum("total_cogs"), uncosted=Count("pk", filter=Q(total_cogs__isnull=True)))
    )
    for row in cogs:
        days[row["day"]]["cogs"] = row["cogs"]
        days[row["day"]]["cogs_incomplete"] = row["uncosted"] > 0

    for row in refunds_between(start, end).values("refund_date").annotate(total=_sum("amount")):
        days[row["refund_date"]]["refunds"] = row["total"]

    expenses = (
        Expense.objects.filter(expense_date__gte=start, expense_date__lte=end)
        .values("expense_date")
        .annotate(total=_sum("amount"))
    )
    for row in expenses:
        days[row["expense_date"]]["total_expenses"] = row["total"]

    return {day: _finish(figures) for day, figures in days.items()}


def _period_start(day, granularity):
    if granularity == "week":
        return day - timedelta(days=day.weekday())
    if granularity == "month":
        return day.replace(day=1)
    return day


def sales_timeseries(start, end, granularity="day"):
    """Chart-ready series bucketed by day, ISO week (Monday) or month (FR-3.8.2)."""
    if granularity not in GRANULARITIES:
        raise ValidationError(f"granularity must be one of {', '.join(GRANULARITIES)}.")
    validate_range(start, end)

    buckets = {}
    for day, figures in daily_rollup(start, end).items():
        key = _period_start(day, granularity)
        bucket = buckets.setdefault(key, _empty_day())
        for field in ("transaction_count", "gross_sales", "tax_amount", "refunds", "cogs", "total_expenses"):
            bucket[field] += figures[field]
        bucket["cogs_incomplete"] = bucket["cogs_incomplete"] or figures["cogs_incomplete"]

    series = [{"period_start": key, **_finish(bucket)} for key, bucket in sorted(buckets.items())]
    totals = _empty_day()
    for row in series:
        for field in ("transaction_count", "gross_sales", "tax_amount", "refunds", "cogs", "total_expenses"):
            totals[field] += row[field]
        totals["cogs_incomplete"] = totals["cogs_incomplete"] or row["cogs_incomplete"]

    return {
        "start": start,
        "end": end,
        "granularity": granularity,
        "totals": _finish(totals),
        "series": series,
        "payment_methods": payment_method_breakdown(start, end),
        "top_items": top_items(start, end),
    }


# ---------- Breakdowns ----------

def payment_method_breakdown(start, end):
    sales = {
        row["payment_method"]: row
        for row in sales_between(start, end)
        .values("payment_method")
        .annotate(transaction_count=Count("pk"), gross_sales=_sum("total_amount"))
    }
    # A refund without its own method went back the way it was paid.
    refunds = {
        row["method"]: row["total"]
        for row in refunds_between(start, end)
        .annotate(method=Case(
            When(payment_method="", then=F("transaction__payment_method")),
            default=F("payment_method"),
        ))
        .values("method")
        .annotate(total=_sum("amount"))
    }
    rows = []
    for method in PaymentMethod.values:
        row = sales.get(method)
        if row is None and method not in refunds:
            continue
        gross = row["gross_sales"] if row else ZERO
        refunded = refunds.get(method, ZERO)
        rows.append({
            "payment_method": method,
            "transaction_count": row["transaction_count"] if row else 0,
            "gross_sales": gross,
            "refunds": refunded,
            "net_collected": gross - refunded,
        })
    return rows


def top_items(start, end, limit=10):
    """Best sellers by revenue (pre-tax line totals; refunds not netted out)."""
    rows = (
        sale_lines_between(start, end)
        .values("menu_item_id", "item_name")
        .annotate(
            quantity=_sum("quantity"),
            revenue=_sum("line_total"),
            cogs=_sum("total_cogs"),
        )
        .order_by("-revenue", "item_name")[:limit]
    )
    return [{**row, "gross_profit": row["revenue"] - row["cogs"]} for row in rows]


def refunded_by_transaction(transaction_ids):
    """All-time completed refund totals per transaction, for the export."""
    return {
        row["transaction_id"]: row["total"]
        for row in PosRefund.objects.filter(
            status=PosRefund.Status.COMPLETED,
            transaction_id__in=transaction_ids,
        )
        .values("transaction_id")
        .annotate(total=_sum("amount"))
    }


def expected_cash(start, end):
    cash_sales = sales_between(start, end).filter(payment_method=PaymentMethod.CASH)
    cash_refunds = refunds_between(start, end).filter(
        Q(payment_method=PaymentMethod.CASH)
        | Q(payment_method="", transaction__payment_method=PaymentMethod.CASH)
    )
    sold = cash_sales.aggregate(total=_sum("total_amount"))["total"]
    refunded = cash_refunds.aggregate(total=_sum("amount"))["total"]
    return sold - refunded


# ---------- Discrepancies (FR-3.8.4) ----------

def discrepancies(start, end):
    """Inventory count mismatches and end-of-day cash variances in the range."""
    validate_range(start, end)
    counts = (
        ClosingInventory.objects.filter(inventory_date__gte=start, inventory_date__lte=end)
        .exclude(discrepancy_quantity=0)
        .select_related("menu_item", "emp")
        .order_by("-inventory_date", "-submitted_at")
    )
    inventory_rows = []
    shortage_value = overage_value = ZERO
    for record in counts:
        value = _q(record.discrepancy_quantity * record.menu_item.selling_price)
        if value < 0:
            shortage_value += value
        else:
            overage_value += value
        inventory_rows.append({
            "closing_inventory_id": record.pk,
            "inventory_date": record.inventory_date,
            "menu_item_id": record.menu_item_id,
            "menu_item_name": record.menu_item.name,
            "unit": record.menu_item.unit,
            "expected_quantity": record.expected_quantity,
            "actual_quantity": record.actual_quantity,
            "discrepancy_quantity": record.discrepancy_quantity,
            "retail_value": value,
            "status": record.status,
            "counted_by": str(record.emp) if record.emp else None,
        })

    closings = DayClosing.objects.filter(
        business_date__gte=start,
        business_date__lte=end,
        cash_discrepancy__isnull=False,
    ).exclude(cash_discrepancy=0)
    cash_rows = [
        {
            "business_date": closing.business_date,
            "expected_cash": closing.expected_cash,
            "counted_cash": closing.counted_cash,
            "cash_discrepancy": closing.cash_discrepancy,
        }
        for closing in closings
    ]

    return {
        "start": start,
        "end": end,
        "inventory": {
            "count": len(inventory_rows),
            "pending_count": sum(1 for row in inventory_rows if row["status"] == ClosingInventory.STATUS_PENDING),
            "shortage_value": shortage_value,
            "overage_value": overage_value,
            "items": inventory_rows,
        },
        "cash": {
            "count": len(cash_rows),
            "net_discrepancy": sum((row["cash_discrepancy"] for row in cash_rows), ZERO),
            "days": cash_rows,
        },
    }


# ---------- End of day (FR-3.8.1) ----------

def day_summary(business_date):
    """Live end-of-day figures for one date, plus its locked closing if any."""
    figures = daily_rollup(business_date, business_date)[business_date]
    closing = DayClosing.objects.select_related("closed_by").filter(business_date=business_date).first()
    return {
        "business_date": business_date,
        **figures,
        "expected_cash": expected_cash(business_date, business_date),
        "payment_methods": payment_method_breakdown(business_date, business_date),
        "top_items": top_items(business_date, business_date, limit=5),
        "expenses": list(
            Expense.objects.filter(expense_date=business_date).order_by("expense_id")
        ),
        "discrepancies": discrepancies(business_date, business_date),
        "closing": closing,
    }


def is_day_closed(business_date):
    return DayClosing.objects.filter(business_date=business_date).exists()


@transaction.atomic
def close_day(business_date, closed_by=None, counted_cash=None, notes=""):
    if business_date > timezone.localdate():
        raise ValidationError("Cannot close a future business date.")

    figures = daily_rollup(business_date, business_date)[business_date]
    expected = expected_cash(business_date, business_date)
    try:
        with transaction.atomic():
            return DayClosing.objects.create(
                business_date=business_date,
                closed_by=closed_by,
                transaction_count=figures["transaction_count"],
                gross_sales=figures["gross_sales"],
                tax_amount=figures["tax_amount"],
                refunds=figures["refunds"],
                net_sales=figures["net_sales"],
                cogs=figures["cogs"],
                cogs_incomplete=figures["cogs_incomplete"],
                gross_profit=figures["gross_profit"],
                total_expenses=figures["total_expenses"],
                net_profit=figures["net_profit"],
                expected_cash=expected,
                counted_cash=counted_cash,
                cash_discrepancy=None if counted_cash is None else counted_cash - expected,
                notes=notes.strip(),
            )
    except IntegrityError:
        raise ValidationError(f"{business_date.isoformat()} is already closed.")


def default_range(today=None):
    """Last 30 days, inclusive of today."""
    today = today or timezone.localdate()
    return today - timedelta(days=29), today


def parse_iso_date(value, label):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{label} must be a date in YYYY-MM-DD form.")
