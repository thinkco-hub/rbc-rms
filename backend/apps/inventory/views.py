from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CostLayer, MenuItem, RawMaterial, RestockReminder
from .serializers import (
	CostLayerSerializer,
	MenuItemSerializer,
	RawMaterialSerializer,
	ReceiptSerializer,
	RestockReminderSerializer,
)
from .services import consume_stock, receive_stock


class RawMaterialViewSet(viewsets.ModelViewSet):
	queryset = RawMaterial.objects.all().order_by("name")
	serializer_class = RawMaterialSerializer

	@action(detail=True, methods=["get"])
	def cost_layers(self, request, pk=None):
		layers = CostLayer.objects.filter(raw_material_id=pk).order_by("received_date", "pk")
		return Response(CostLayerSerializer(layers, many=True).data)

	@action(detail=True, methods=["post"])
	def consume(self, request, pk=None):
		serializer = ReceiptSerializer(data={
			"raw_material_id": pk,
			"quantity": request.data.get("quantity"),
			"unit_cost": 0,
		})
		serializer.is_valid(raise_exception=True)
		try:
			material, allocations, total_cost = consume_stock(pk, serializer.validated_data["quantity"])
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response({
			"raw_material": RawMaterialSerializer(material).data,
			"allocations": [
				{"cost_layer_id": item["layer"].pk, "quantity": item["quantity"], "unit_cost": item["unit_cost"]}
				for item in allocations
			],
			"total_cost": total_cost,
		})


class ReceiptViewSet(viewsets.ViewSet):
	def create(self, request):
		serializer = ReceiptSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		data = serializer.validated_data
		try:
			material, layer = receive_stock(
				data["raw_material"].pk,
				data["quantity"],
				data["unit_cost"],
				data.get("received_date"),
			)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response({
			"raw_material": RawMaterialSerializer(material).data,
			"cost_layer": CostLayerSerializer(layer).data,
		}, status=status.HTTP_201_CREATED)


class CostLayerViewSet(viewsets.ReadOnlyModelViewSet):
	queryset = CostLayer.objects.select_related("raw_material").order_by("received_date", "pk")
	serializer_class = CostLayerSerializer


class RestockReminderViewSet(viewsets.ModelViewSet):
	queryset = RestockReminder.objects.select_related("raw_material").order_by("status", "target_date")
	serializer_class = RestockReminderSerializer


class MenuItemViewSet(viewsets.ModelViewSet):
	queryset = MenuItem.objects.all().order_by("name")
	serializer_class = MenuItemSerializer


class InventoryAlertViewSet(viewsets.ViewSet):
	def list(self, request):
		alerts = RawMaterial.objects.filter(current_stock__lt=F("reorder_threshold"))
		return Response(RawMaterialSerializer(alerts, many=True).data)
