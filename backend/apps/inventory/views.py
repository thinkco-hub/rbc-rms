from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import InventoryPermission

from .models import ClosingInventory, CostLayer, MenuItem, RawMaterial, RestockReminder
from .serializers import (
	ClosingCountSubmitSerializer,
	ClosingInventorySerializer,
	CostLayerSerializer,
	MenuItemRestockSerializer,
	MenuItemSerializer,
	RawMaterialSerializer,
	ReceiptSerializer,
	RestockReminderSerializer,
)
from .services import (
	apply_all_pending_counts,
	apply_closing_count,
	consume_stock,
	dismiss_closing_count,
	receive_stock,
	restock_menu_item,
	submit_closing_count,
)


class RawMaterialViewSet(viewsets.ModelViewSet):
	queryset = RawMaterial.objects.all().order_by("name")
	serializer_class = RawMaterialSerializer
	permission_classes = [InventoryPermission]

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
	permission_classes = [InventoryPermission]

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
	permission_classes = [InventoryPermission]


class RestockReminderViewSet(viewsets.ModelViewSet):
	queryset = RestockReminder.objects.select_related("raw_material").order_by("status", "target_date")
	serializer_class = RestockReminderSerializer
	permission_classes = [InventoryPermission]


class MenuItemViewSet(viewsets.ModelViewSet):
	queryset = MenuItem.objects.all().order_by("name")
	serializer_class = MenuItemSerializer
	permission_classes = [InventoryPermission]

	@action(detail=True, methods=["post"])
	def restock(self, request, pk=None):
		"""Manual restock override for finished goods (FR-3.4.8)."""
		serializer = MenuItemRestockSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			menu_item = restock_menu_item(pk, serializer.validated_data["quantity"])
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(MenuItemSerializer(menu_item).data)


class InventoryAlertViewSet(viewsets.ViewSet):
	permission_classes = [InventoryPermission]

	def list(self, request):
		alerts = RawMaterial.objects.filter(current_stock__lt=F("reorder_threshold"))
		return Response(RawMaterialSerializer(alerts, many=True).data)


class ClosingInventoryViewSet(viewsets.ReadOnlyModelViewSet):
	"""Finished-goods closing counts and the flag → Apply/Dismiss reconciliation workflow (FR-3.4.4-3.4.5)."""

	queryset = ClosingInventory.objects.select_related("menu_item", "emp").order_by("-submitted_at")
	serializer_class = ClosingInventorySerializer
	permission_classes = [InventoryPermission]

	def _employee(self, request):
		return getattr(request.user, "employee", None)

	@action(detail=False, methods=["post"])
	def submit(self, request):
		serializer = ClosingCountSubmitSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		data = serializer.validated_data
		try:
			record = submit_closing_count(
				data["menu_item"].pk,
				data["actual_quantity"],
				data["inventory_date"],
				emp=self._employee(request),
			)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(ClosingInventorySerializer(record).data, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=["post"])
	def apply(self, request, pk=None):
		try:
			record = apply_closing_count(pk)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(ClosingInventorySerializer(record).data)

	@action(detail=True, methods=["post"])
	def dismiss(self, request, pk=None):
		try:
			record = dismiss_closing_count(pk)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(ClosingInventorySerializer(record).data)

	@action(detail=False, methods=["post"], url_path="apply-all")
	def apply_all(self, request):
		records = apply_all_pending_counts()
		return Response(ClosingInventorySerializer(records, many=True).data)
