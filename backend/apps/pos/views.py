from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from apps.accounts.permissions import PosPermission
from apps.inventory.models import MenuItem

from .models import PosTransaction
from .serializers import PosCheckoutSerializer, PosProductSerializer, PosTransactionSerializer
from .services import IdempotencyConflict, complete_sale


class PosProductViewSet(viewsets.ReadOnlyModelViewSet):
	queryset = MenuItem.objects.all().order_by("name", "pk")
	serializer_class = PosProductSerializer
	permission_classes = [PosPermission]
	http_method_names = ["get", "head", "options"]


class PosTransactionViewSet(
	mixins.ListModelMixin,
	mixins.RetrieveModelMixin,
	viewsets.GenericViewSet,
):
	queryset = PosTransaction.objects.prefetch_related("postransactionitem_set").order_by(
		F("transaction_timestamp").desc(nulls_last=True), "-transaction_id"
	)
	serializer_class = PosTransactionSerializer
	permission_classes = [PosPermission]
	http_method_names = ["get", "post", "head", "options"]

	def create(self, request, *args, **kwargs):
		input_serializer = PosCheckoutSerializer(data=request.data)
		input_serializer.is_valid(raise_exception=True)
		try:
			pos_transaction, created = complete_sale(
				input_serializer.validated_data,
				cashier=getattr(request.user, "employee", None),
			)
		except IdempotencyConflict as exc:
			return Response({"detail": exc.messages}, status=status.HTTP_409_CONFLICT)
		except DjangoValidationError as exc:
			detail = exc.message_dict if hasattr(exc, "message_dict") else exc.messages
			return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)

		output_serializer = self.get_serializer(pos_transaction)
		return Response(
			output_serializer.data,
			status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
		)
