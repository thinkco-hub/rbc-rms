from rest_framework import viewsets

from apps.accounts.permissions import RecipesPermission

from .models import Recipe
from .serializers import RecipeSerializer


class RecipeViewSet(viewsets.ModelViewSet):
	queryset = Recipe.objects.prefetch_related("recipeingredient_set__raw_material").order_by("name", "pk")
	serializer_class = RecipeSerializer
	permission_classes = [RecipesPermission]
