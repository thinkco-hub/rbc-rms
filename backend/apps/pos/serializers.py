from django.utils import timezone
from rest_framework import serializers

from apps.inventory.models import MenuItem

from .models import PaymentMethod, PosTransaction, PosTransactionItem


class StrictSerializer(serializers.Serializer):
	"""Reject unknown fields so client financial/product snapshots cannot sneak in."""

	def to_internal_value(self, data):
		if hasattr(data, "keys"):
			unknown_fields = set(data.keys()) - set(self.fields)
			if unknown_fields:
				raise serializers.ValidationError({
					field: "Unexpected field."
					for field in sorted(unknown_fields)
				})
		return super().to_internal_value(data)


class PosProductSerializer(serializers.ModelSerializer):
	id = serializers.IntegerField(source="menu_item_id", read_only=True)
	available_stock = serializers.DecimalField(
		source="stock_quantity",
		max_digits=12,
		decimal_places=2,
		read_only=True,
	)

	class Meta:
		model = MenuItem
		fields = ["id", "name", "selling_price", "category", "unit", "available_stock"]


class CheckoutLineInputSerializer(StrictSerializer):
	menu_item_id = serializers.IntegerField(min_value=1)
	quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)

	def validate_quantity(self, value):
		if value <= 0:
			raise serializers.ValidationError("Quantity must be greater than zero.")
		return value


class PosCheckoutSerializer(StrictSerializer):
	items = CheckoutLineInputSerializer(many=True, allow_empty=False)
	customer_name = serializers.CharField(max_length=150, trim_whitespace=True)
	customer_contact = serializers.CharField(max_length=150, allow_blank=True, required=False, default="")
	payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
	payment_reference = serializers.CharField(max_length=255, allow_blank=True, required=False, default="")
	notes = serializers.CharField(allow_blank=True, required=False, default="")
	delivery_date = serializers.DateField(required=False, allow_null=True)
	idempotency_key = serializers.CharField(max_length=64, trim_whitespace=True)

	def validate_customer_name(self, value):
		if not value:
			raise serializers.ValidationError("Customer name is required.")
		return value

	def validate_delivery_date(self, value):
		if value is not None and value < timezone.localdate():
			raise serializers.ValidationError("Delivery date cannot be in the past.")
		return value

	def validate_idempotency_key(self, value):
		if not value:
			raise serializers.ValidationError("Idempotency key is required.")
		return value

	def validate(self, attrs):
		if not attrs.get("customer_name", "").strip():
			raise serializers.ValidationError({"customer_name": "Customer name is required."})
		return attrs


class PosTransactionItemSerializer(serializers.ModelSerializer):
	menu_item_id = serializers.IntegerField(read_only=True)

	class Meta:
		model = PosTransactionItem
		fields = [
			"menu_item_id",
			"item_name",
			"unit",
			"quantity",
			"unit_price",
			"discount_amount",
			"line_total",
			"unit_cogs",
			"total_cogs",
		]


class PosTransactionSerializer(serializers.ModelSerializer):
	id = serializers.IntegerField(source="transaction_id", read_only=True)
	items = PosTransactionItemSerializer(source="postransactionitem_set", many=True, read_only=True)

	class Meta:
		model = PosTransaction
		fields = [
			"id",
			"status",
			"payment_status",
			"payment_method",
			"payment_reference",
			"amount_paid",
			"subtotal",
			"discount_amount",
			"tax_rate",
			"tax_amount",
			"total_amount",
			"customer_name",
			"customer_contact",
			"notes",
			"delivery_date",
			"transaction_timestamp",
			"items",
		]