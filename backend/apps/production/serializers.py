from rest_framework import serializers

from apps.recipes.models import Recipe

from .models import ProductionConsumption, ProductionRun


class ProductionConsumptionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="consumption_id", read_only=True)
    raw_material_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductionConsumption
        fields = ["id", "raw_material_id", "quantity_consumed", "unit_cost", "total_cost"]


class ProductionRunSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="production_id", read_only=True)
    menu_item_id = serializers.IntegerField(read_only=True)
    recipe_id = serializers.IntegerField(read_only=True)
    emp_id = serializers.IntegerField(read_only=True)
    consumptions = ProductionConsumptionSerializer(
        source="productionconsumption_set", many=True, read_only=True
    )

    class Meta:
        model = ProductionRun
        fields = [
            "id",
            "menu_item_id",
            "recipe_id",
            "emp_id",
            "planned_quantity",
            "actual_quantity",
            "planned_date",
            "completed_date",
            "status",
            "consumptions",
        ]
        read_only_fields = ["actual_quantity", "completed_date", "status"]


class ScheduleRunSerializer(serializers.Serializer):
    recipe_id = serializers.PrimaryKeyRelatedField(source="recipe", queryset=Recipe.objects.all())
    planned_quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    planned_date = serializers.DateField()

    def validate_planned_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Planned quantity must be greater than zero.")
        return value


class CompleteRunSerializer(serializers.Serializer):
    actual_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)

    def validate_actual_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Actual quantity cannot be negative.")
        return value
