import csv
from datetime import date, datetime
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import ReportsPermission
from apps.core.models import Expense

from . import services
from .models import DayClosing
from .serializers import CloseDaySerializer, DayClosingSerializer, ExpenseSerializer


def _plain(value):
    """Match the rest of the API: money as "12.34" strings, dates as ISO."""
    if isinstance(value, Decimal):
        return format(value.quantize(services.CENT), "f")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return value


def _as_validation_error(exc):
    return ValidationError({"detail": exc.messages})


def _date_param(request, name, default):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return default
    try:
        return services.parse_iso_date(raw, name)
    except DjangoValidationError as exc:
        raise _as_validation_error(exc)


def _range_params(request):
    default_start, default_end = services.default_range()
    start = _date_param(request, "start", default_start)
    end = _date_param(request, "end", default_end)
    try:
        services.validate_range(start, end)
    except DjangoValidationError as exc:
        raise _as_validation_error(exc)
    return start, end


class ReportsAPIView(APIView):
    permission_classes = [ReportsPermission]


class DaySummaryView(ReportsAPIView):
    """GET ?date=YYYY-MM-DD — end-of-day profit for one business date (FR-3.8.1)."""

    def get(self, request):
        business_date = _date_param(request, "date", timezone.localdate())
        summary = services.day_summary(business_date)
        summary["expenses"] = ExpenseSerializer(summary["expenses"], many=True).data
        closing = summary["closing"]
        summary["closing"] = DayClosingSerializer(closing).data if closing else None
        summary["is_closed"] = closing is not None
        return Response(_plain(summary))


class SalesReportView(ReportsAPIView):
    """GET ?start&end&granularity=day|week|month — chart series (FR-3.8.2)."""

    def get(self, request):
        start, end = _range_params(request)
        granularity = request.query_params.get("granularity", "day")
        try:
            report = services.sales_timeseries(start, end, granularity)
        except DjangoValidationError as exc:
            raise _as_validation_error(exc)
        return Response(_plain(report))


class DiscrepancyReportView(ReportsAPIView):
    """GET ?start&end — inventory count and cash variances (FR-3.8.4)."""

    def get(self, request):
        start, end = _range_params(request)
        return Response(_plain(services.discrepancies(start, end)))


# Leading characters that make spreadsheet apps evaluate a cell as a formula.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_cell(value):
    if isinstance(value, str):
        return f"'{value}" if value.startswith(_FORMULA_PREFIXES) else value
    plain = _plain(value)
    return "" if plain is None else plain


class ExportReportView(ReportsAPIView):
    """
    GET ?start&end&kind=transactions|daily — CSV download (FR-3.8.3).

    `transactions` is one row per POS sale; `daily` is the end-of-day rollup
    for every date in the range.
    """

    def get(self, request):
        start, end = _range_params(request)
        kind = request.query_params.get("kind", "transactions")
        if kind == "transactions":
            header, rows = self._transactions(start, end)
        elif kind == "daily":
            header, rows = self._daily(start, end)
        else:
            raise ValidationError({"kind": "kind must be 'transactions' or 'daily'."})

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="sales-{kind}-{start.isoformat()}-to-{end.isoformat()}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(header)
        for row in rows:
            writer.writerow([_csv_cell(value) for value in row])
        return response

    def _transactions(self, start, end):
        header = [
            "transaction_id", "timestamp", "cashier", "customer_name", "payment_method",
            "status", "subtotal", "discount", "tax", "total", "refunded", "cogs",
        ]
        sales = (
            services.sales_between(start, end)
            .select_related("cashier")
            .annotate(cogs=Sum("postransactionitem__total_cogs"))
            .order_by("transaction_timestamp", "transaction_id")
        )
        sales = list(sales)
        refunded = services.refunded_by_transaction([sale.pk for sale in sales])
        rows = (
            [
                sale.pk,
                timezone.localtime(sale.transaction_timestamp),
                str(sale.cashier) if sale.cashier else "",
                sale.customer_name,
                sale.payment_method,
                sale.status,
                sale.subtotal,
                sale.discount_amount,
                sale.tax_amount,
                sale.total_amount,
                refunded.get(sale.pk, services.ZERO),
                sale.cogs,
            ]
            for sale in sales
        )
        return header, rows

    def _daily(self, start, end):
        fields = [
            "transaction_count", "gross_sales", "tax_amount", "refunds", "net_sales",
            "cogs", "cogs_incomplete", "gross_profit", "total_expenses", "net_profit",
        ]
        rollup = services.daily_rollup(start, end)
        rows = ([day, *(figures[field] for field in fields)] for day, figures in rollup.items())
        return ["date", *fields], rows


class ExpenseViewSet(viewsets.ModelViewSet):
    """Operating expenses; frozen once their date has been closed."""

    serializer_class = ExpenseSerializer
    permission_classes = [ReportsPermission]

    def get_queryset(self):
        queryset = Expense.objects.select_related("emp").order_by("-expense_date", "-expense_id")
        if "date" in self.request.query_params:
            return queryset.filter(expense_date=_date_param(self.request, "date", None))
        if "start" in self.request.query_params or "end" in self.request.query_params:
            start, end = _range_params(self.request)
            return queryset.filter(expense_date__gte=start, expense_date__lte=end)
        return queryset

    def _ensure_open(self, *dates):
        for business_date in dates:
            if services.is_day_closed(business_date):
                raise ValidationError(
                    {"detail": [f"{business_date.isoformat()} is closed; its expenses can no longer change."]}
                )

    def perform_create(self, serializer):
        self._ensure_open(serializer.validated_data["expense_date"])
        serializer.save(emp=getattr(self.request.user, "employee", None))

    def perform_update(self, serializer):
        self._ensure_open(
            serializer.instance.expense_date,
            serializer.validated_data.get("expense_date", serializer.instance.expense_date),
        )
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_open(instance.expense_date)
        instance.delete()


class DayClosingViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """List locked closings; POST {business_date, counted_cash?, notes?} closes a day."""

    queryset = DayClosing.objects.select_related("closed_by").order_by("-business_date")
    serializer_class = DayClosingSerializer
    permission_classes = [ReportsPermission]

    def create(self, request, *args, **kwargs):
        input_serializer = CloseDaySerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data
        try:
            closing = services.close_day(
                data["business_date"],
                closed_by=getattr(request.user, "employee", None),
                counted_cash=data.get("counted_cash"),
                notes=data.get("notes", ""),
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(closing).data, status=status.HTTP_201_CREATED)
