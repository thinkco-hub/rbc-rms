from decimal import Decimal

from rest_framework import serializers

from apps.inventory.models import MenuItem

from .models import Client, Delivery, Order, OrderItem


class ClientSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="client_id", read_only=True)
    contact = serializers.CharField(source="contact_info", required=False, allow_blank=True)

    class Meta:
        model = Client
        fields = ["id", "name", "contact", "email", "address", "standing_order"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Client name is required.")
        return value


class OrderItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="order_item_id", read_only=True)
    menu_item_id = serializers.PrimaryKeyRelatedField(
        source="menu_item", queryset=MenuItem.objects.all()
    )
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item_id", "quantity", "unit_price"]
        read_only_fields = ["unit_price"]


class DeliverySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="delivery_id", read_only=True)

    class Meta:
        model = Delivery
        fields = ["id", "scheduled_date", "assigned_staff", "status"]


class OrderSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="order_id", read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source="client", queryset=Client.objects.all(), allow_null=True, required=False
    )
    items = OrderItemSerializer(many=True, required=False)
    delivery = DeliverySerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "client_id", "customer_name", "status", "requested_delivery_date", "notes",
            "created_at", "delivered_at", "payment_method", "amount_paid",
            "items", "delivery",
        ]
        read_only_fields = ["status", "created_at", "delivered_at", "amount_paid", "delivery"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one order item is required.")
        return value

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        if not items:
            raise serializers.ValidationError({"items": "At least one order item is required."})
        order = Order.objects.create(**validated_data)
        self._save_items(order, items)
        return order

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items is not None:
            instance.items.all().delete()
            self._save_items(instance, items)
        return instance

    @staticmethod
    def _save_items(order, items):
        for item in items:
            menu_item = item["menu_item"]
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item["quantity"],
                unit_price=menu_item.selling_price,
            )


class PaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=[choice[0] for choice in Order.PAYMENT_CHOICES])
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )


class DeliveryInputSerializer(serializers.Serializer):
    delivery_date = serializers.DateField()
    assigned_to = serializers.CharField(max_length=150, allow_blank=True)
