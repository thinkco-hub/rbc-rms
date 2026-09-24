from rest_framework import serializers

from apps.inventory.models import MenuItem, RawMaterial

from .models import Recipe, RecipeIngredient
from .services import calculate_recipe_cost, calculate_suggested_price


class RecipeIngredientSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="recipe_ingredient_id", read_only=True)
    raw_material_id = serializers.PrimaryKeyRelatedField(
        source="raw_material", queryset=RawMaterial.objects.all()
    )
    unit = serializers.CharField(source="raw_material.unit", read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ["id", "raw_material_id", "quantity_required", "unit"]

    def validate_quantity_required(self, value):
        if value <= 0:
            raise serializers.ValidationError("Ingredient quantity must be greater than zero.")
        return value


class RecipeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="recipe_id", read_only=True)
    menu_item_id = serializers.PrimaryKeyRelatedField(
        source="menu_item", queryset=MenuItem.objects.all()
    )
    ingredients = RecipeIngredientSerializer(
        source="recipeingredient_set", many=True
    )
    total_cost = serializers.SerializerMethodField()
    cost_per_unit = serializers.SerializerMethodField()
    suggested_price = serializers.DecimalField(read_only=True, max_digits=12, decimal_places=2)

    class Meta:
        model = Recipe
        fields = [
            "id",
            "menu_item_id",
            "name",
            "yield_quantity",
            "yield_unit",
            "target_margin_percent",
            "suggested_price",
            "ingredients",
            "total_cost",
            "cost_per_unit",
        ]

    def validate_yield_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Recipe yield must be greater than zero.")
        return value

    def validate_target_margin_percent(self, value):
        if value < 0 or value >= 100:
            raise serializers.ValidationError("Target margin must be between 0 and 99.99 percent.")
        return value

    def _cost(self, recipe):
        try:
            return calculate_recipe_cost(recipe)
        except Exception:
            return None, None

    def get_total_cost(self, recipe):
        total_cost, _ = self._cost(recipe)
        return total_cost

    def get_cost_per_unit(self, recipe):
        _, cost_per_unit = self._cost(recipe)
        return cost_per_unit

    def create(self, validated_data):
        ingredients = validated_data.pop("recipeingredient_set")
        recipe = Recipe.objects.create(**validated_data)
        self._replace_ingredients(recipe, ingredients)
        self._update_suggested_price(recipe)
        return recipe

    def update(self, instance, validated_data):
        ingredients = validated_data.pop("recipeingredient_set", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if ingredients is not None:
            self._replace_ingredients(instance, ingredients)
        self._update_suggested_price(instance)
        return instance

    def _replace_ingredients(self, recipe, ingredients):
        RecipeIngredient.objects.filter(recipe=recipe).delete()
        RecipeIngredient.objects.bulk_create(
            [RecipeIngredient(recipe=recipe, **ingredient) for ingredient in ingredients]
        )

    def _update_suggested_price(self, recipe):
        try:
            _, cost_per_unit = calculate_recipe_cost(recipe)
            recipe.suggested_price = calculate_suggested_price(
                cost_per_unit, recipe.target_margin_percent
            )
        except Exception:
            recipe.suggested_price = None
        recipe.save(update_fields=["suggested_price"])
