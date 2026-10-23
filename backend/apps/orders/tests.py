from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.inventory.models import MenuItem

from .models import Client, Order


class OrderManagementApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_superuser(
            username="orders-test",
            email="orders-test@example.com",
            password="test-password",
        )
        self.client.force_authenticate(self.user)
        self.client_record = Client.objects.create(
            name="Test Cafe",
            contact_info="09170000000",
            email="test@example.com",
        )
        self.menu_item = MenuItem.objects.create(
            name="Test Bread",
            selling_price=Decimal("120.00"),
            stock_quantity=Decimal("10.00"),
        )

    def test_client_crud_and_order_creation(self):
        response = self.client.post(
            "/api/v1/orders/clients/",
            {"name": "New Cafe", "contact": "09171111111", "email": "new@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        client_id = response.data["id"]

        response = self.client.post(
            "/api/v1/orders/orders/",
            {
                "client_id": client_id,
                "requested_delivery_date": "2026-10-10",
                "notes": "Morning delivery",
                "items": [{"menu_item_id": self.menu_item.pk, "quantity": "2"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["unit_price"], "120.00")

    def test_delivery_deducts_stock_once_and_records_delivery(self):
        order = Order.objects.create(client=self.client_record)
        order.items.create(
            menu_item=self.menu_item,
            quantity=Decimal("2.00"),
            unit_price=self.menu_item.selling_price,
        )

        response = self.client.post(
            f"/api/v1/orders/orders/{order.pk}/mark_delivered/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.menu_item.refresh_from_db()
        self.assertEqual(self.menu_item.stock_quantity, Decimal("8.00"))
        order.refresh_from_db()
        self.assertEqual(order.status, Order.STATUS_DELIVERED)
        self.assertIsNotNone(order.delivered_at)
