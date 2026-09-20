from django.db import models
from apps.inventory.models import MenuItem, RawMaterial

class Recipe(models.Model):
    recipe_id = models.AutoField(primary_key=True)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)

class RecipeIngredient(models.Model):
    recipe_ingredient_id = models.AutoField(primary_key=True)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.PROTECT)
    quantity_required = models.DecimalField(max_digits=12, decimal_places=3)