from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Recipe
from .serializers import RecipeSerializer
from .services import approve_price


class RecipeViewSet(viewsets.ModelViewSet):
	queryset = Recipe.objects.prefetch_related("recipeingredient_set__raw_material").order_by("name", "pk")
	serializer_class = RecipeSerializer

	@action(detail=True, methods=["post"], url_path="approve-price")
	def approve_price(self, request, pk=None):
		recipe = self.get_object()
		recipe = approve_price(recipe, request.user)
		return Response(self.get_serializer(recipe).data)
