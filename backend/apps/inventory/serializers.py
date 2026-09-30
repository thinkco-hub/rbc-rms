from rest_framework import serializers

from .models import ClosingInventory, CostLayer, MenuItem, RawMaterial, RestockReminder


class RawMaterialSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="raw_material_id", read_only=True)

    class Meta:
        model = RawMaterial
        fields = [
            "id",
            "name",
            "unit",
            "supplier",
            "unit_cost",
            "current_stock",
            "reorder_threshold",
        ]
        read_only_fields = ["current_stock"]

    def validate_unit_cost(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit cost cannot be negative.")
        return value


class MenuItemRestockSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Restock quantity must be greater than zero.")
        return value


class ClosingInventorySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="closing_inventory_id", read_only=True)
    menu_item_id = serializers.IntegerField(read_only=True)
    emp_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ClosingInventory
        fields = [
            "id",
            "menu_item_id",
            "emp_id",
            "inventory_date",
            "expected_quantity",
            "actual_quantity",
            "discrepancy_quantity",
            "status",
            "submitted_at",
        ]
        read_only_fields = ["expected_quantity", "discrepancy_quantity", "status", "submitted_at"]


class ClosingCountSubmitSerializer(serializers.Serializer):
    menu_item_id = serializers.PrimaryKeyRelatedField(source="menu_item", queryset=MenuItem.objects.all())
    actual_quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    inventory_date = serializers.DateField()

    def validate_actual_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Counted quantity cannot be negative.")
        return value


class CostLayerSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="cost_layer_id", read_only=True)
    raw_material_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CostLayer
        fields = ["id", "raw_material_id", "quantity_remaining", "unit_cost", "received_date"]


class RestockReminderSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="restock_reminder_id", read_only=True)
    raw_material_id = serializers.PrimaryKeyRelatedField(
        source="raw_material", queryset=RawMaterial.objects.all()
    )

    class Meta:
        model = RestockReminder
        fields = ["id", "raw_material_id", "note", "quantity_needed", "target_date", "status"]

    def validate_quantity_needed(self, value):
        if value <= 0:
            raise serializers.ValidationError("Reminder quantity must be greater than zero.")
        return value


class MenuItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="menu_item_id", read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "name",
            "unit",
            "selling_price",
            "stock_quantity",
            "reorder_threshold",
            "category",
            "shelf_life",
        ]


class ReceiptSerializer(serializers.Serializer):
    raw_material_id = serializers.PrimaryKeyRelatedField(
        source="raw_material", queryset=RawMaterial.objects.all()
    )
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    received_date = serializers.DateField(required=False)

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Receipt quantity must be greater than zero.")
        return value

    def validate_unit_cost(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit cost cannot be negative.")
        return value
