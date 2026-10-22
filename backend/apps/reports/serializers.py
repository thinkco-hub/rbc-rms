from decimal import Decimal

from rest_framework import serializers

from apps.core.models import Expense

from .models import DayClosing


class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="expense_id", read_only=True)
    date = serializers.DateField(source="expense_date")
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    recorded_by = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = ["id", "date", "description", "category", "amount", "recorded_by"]

    def get_recorded_by(self, obj):
        return str(obj.emp) if obj.emp else None

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Description is required.")
        return value


class DayClosingSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="day_closing_id", read_only=True)
    closed_by = serializers.SerializerMethodField()

    class Meta:
        model = DayClosing
        fields = [
            "id",
            "business_date",
            "closed_at",
            "closed_by",
            "transaction_count",
            "gross_sales",
            "tax_amount",
            "refunds",
            "net_sales",
            "cogs",
            "cogs_incomplete",
            "gross_profit",
            "total_expenses",
            "net_profit",
            "expected_cash",
            "counted_cash",
            "cash_discrepancy",
            "notes",
        ]
        read_only_fields = fields

    def get_closed_by(self, obj):
        return str(obj.closed_by) if obj.closed_by else None


class CloseDaySerializer(serializers.Serializer):
    business_date = serializers.DateField()
    counted_cash = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
