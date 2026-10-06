from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import OrdersPermission
from apps.inventory.models import MenuItem

from .models import Client, Delivery, Order, OrderItem
from .serializers import (
    ClientSerializer,
    DeliveryInputSerializer,
    OrderSerializer,
    PaymentSerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by("name")
    serializer_class = ClientSerializer
    permission_classes = [OrdersPermission]


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [OrdersPermission]
    queryset = Order.objects.select_related("client").prefetch_related(
        Prefetch("items", queryset=OrderItem.objects.select_related("menu_item")),
        "delivery",
    ).order_by("-created_at", "-order_id")

    @action(detail=True, methods=["post"])
    def advance_status(self, request, pk=None):
        order = self.get_object()
        status_value = request.data.get("status")
        valid_statuses = {choice[0] for choice in Order.STATUS_CHOICES}
        if status_value not in valid_statuses:
            return Response({"detail": "Invalid order status."}, status=status.HTTP_400_BAD_REQUEST)
        if order.status == Order.STATUS_DELIVERED:
            return Response({"detail": "Delivered orders cannot change status."}, status=status.HTTP_400_BAD_REQUEST)
        order.status = status_value
        order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def schedule_delivery(self, request, pk=None):
        serializer = DeliveryInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = self.get_object()
        Delivery.objects.update_or_create(
            order=order,
            defaults={
                "scheduled_date": serializer.validated_data["delivery_date"],
                "assigned_staff": serializer.validated_data["assigned_to"],
                "status": "scheduled",
            },
        )
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = self.get_object()
        order.payment_method = serializer.validated_data["method"]
        order.amount_paid += serializer.validated_data["amount"]
        order.save(update_fields=["payment_method", "amount_paid"])
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def mark_delivered(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=pk)
            if order.status == Order.STATUS_DELIVERED:
                return Response(self.get_serializer(order).data)
            for item in order.items.select_related("menu_item"):
                menu_item = MenuItem.objects.select_for_update().get(pk=item.menu_item_id)
                if menu_item.stock_quantity < item.quantity:
                    return Response(
                        {"detail": f"Insufficient stock for {menu_item.name}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                menu_item.stock_quantity -= item.quantity
                menu_item.save(update_fields=["stock_quantity"])
            order.status = Order.STATUS_DELIVERED
            order.delivered_at = timezone.localdate()
            order.save(update_fields=["status", "delivered_at"])
        return Response(self.get_serializer(order).data)
