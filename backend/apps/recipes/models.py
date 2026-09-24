from django.db import models
from apps.inventory.models import MenuItem, RawMaterial

class Recipe(models.Model):
    APPROVAL_PENDING = "pending"
    APPROVAL_APPROVED = "approved"
    APPROVAL_REJECTED = "rejected"
    APPROVAL_STATUS_CHOICES = (
        (APPROVAL_PENDING, "Pending"),
        (APPROVAL_APPROVED, "Approved"),
        (APPROVAL_REJECTED, "Rejected"),
    )

    recipe_id = models.AutoField(primary_key=True)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
    name = models.CharField(max_length=150, blank=True)
    yield_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    yield_unit = models.CharField(max_length=20, default="pcs")
    target_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=40)
    suggested_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    approved_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default=APPROVAL_PENDING,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_recipes",
    )

class RecipeIngredient(models.Model):
    recipe_ingredient_id = models.AutoField(primary_key=True)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.PROTECT)
    quantity_required = models.DecimalField(max_digits=12, decimal_places=3)