from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import ProductionPermission

from .models import ProductionRun
from .serializers import CompleteRunSerializer, ProductionRunSerializer, ScheduleRunSerializer
from .services import InsufficientStockError, cancel_run, complete_run, find_shortfalls, schedule_run


class ProductionRunViewSet(viewsets.ModelViewSet):
	queryset = (
		ProductionRun.objects.select_related("menu_item", "recipe", "emp")
		.prefetch_related("productionconsumption_set")
		.order_by("-planned_date", "-pk")
	)
	serializer_class = ProductionRunSerializer
	permission_classes = [ProductionPermission]
	# Runs are created via schedule and mutated only through the complete/cancel
	# actions below (FR-3.3.1-3.3.3) — no generic update/delete.
	http_method_names = ["get", "post", "head", "options"]

	def _employee(self, request):
		return getattr(request.user, "employee", None)

	def create(self, request, *args, **kwargs):
		serializer = ScheduleRunSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		data = serializer.validated_data
		try:
			run = schedule_run(
				data["recipe"].pk,
				data["planned_quantity"],
				data["planned_date"],
				emp=self._employee(request),
			)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(ProductionRunSerializer(run).data, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=["get"])
	def shortfalls(self, request, pk=None):
		"""Preview ingredient shortfalls for a scheduled run (FR-3.3.3)."""
		run = self.get_object()
		return Response(find_shortfalls(run.recipe, run.planned_quantity))

	@action(detail=True, methods=["post"])
	def complete(self, request, pk=None):
		serializer = CompleteRunSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			run = complete_run(
				pk,
				emp=self._employee(request),
				actual_quantity=serializer.validated_data.get("actual_quantity"),
			)
		except InsufficientStockError as exc:
			return Response(
				{"detail": str(exc), "shortfalls": exc.shortfalls}, status=status.HTTP_400_BAD_REQUEST
			)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(ProductionRunSerializer(run).data)

	@action(detail=True, methods=["post"])
	def cancel(self, request, pk=None):
		try:
			run = cancel_run(pk)
		except DjangoValidationError as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
		return Response(ProductionRunSerializer(run).data)
