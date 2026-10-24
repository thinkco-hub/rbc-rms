from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import MenuItem, RawMaterial, RestockReminder
from apps.orders.models import Client, Delivery, Order, OrderItem
from apps.production.models import ProductionRun
from apps.production.services import cancel_run, schedule_run
from apps.recipes.models import Recipe

from .google_client import GoogleCalendarError
from .models import CalendarEvent, GoogleCalendarConnection
from .services import build_event, resync_all, sync_record

GOOGLE_SETTINGS = {
    "GOOGLE_OAUTH_CLIENT_ID": "client-id",
    "GOOGLE_OAUTH_CLIENT_SECRET": "client-secret",
    "FRONTEND_URL": "http://frontend.test",
}


class FakeCalendar:
    """In-memory stand-in for CalendarClient, shared across instances."""

    def __init__(self):
        self.events = {}
        self.next_id = 1
        self.fail_with = None

    def client(self, connection):
        return self

    def _maybe_fail(self):
        if self.fail_with:
            raise self.fail_with

    def insert_event(self, body):
        self._maybe_fail()
        event_id = f"evt{self.next_id}"
        self.next_id += 1
        self.events[event_id] = body
        return {"id": event_id, "htmlLink": f"https://calendar.test/{event_id}"}

    def update_event(self, event_id, body):
        self._maybe_fail()
        if event_id not in self.events:
            raise GoogleCalendarError("gone", status=404)
        self.events[event_id] = body
        return {"id": event_id, "htmlLink": f"https://calendar.test/{event_id}"}

    def delete_event(self, event_id):
        self._maybe_fail()
        self.events.pop(event_id, None)


@override_settings(**GOOGLE_SETTINGS)
class CalendarSyncTestCase(TestCase):
    def setUp(self):
        self.fake = FakeCalendar()
        patcher = mock.patch("apps.calendar_sync.services.CalendarClient", side_effect=self.fake.client)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.connection = GoogleCalendarConnection.objects.create(
            google_email="bakery@example.com", refresh_token="refresh"
        )
        self.item = MenuItem.objects.create(name="Ensaymada", unit="pcs", selling_price=50)
        self.recipe = Recipe.objects.create(menu_item=self.item, yield_quantity=10)
        self.flour = RawMaterial.objects.create(name="Flour", unit="kg", supplier="Mill Co")
        self.day = timezone.localdate() + timedelta(days=3)

    def mapping(self, event_type, reference_id):
        return CalendarEvent.objects.get(event_type=event_type, reference_id=reference_id)


class ProductionRunSyncTests(CalendarSyncTestCase):
    def test_scheduling_a_run_creates_an_all_day_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            run = schedule_run(self.recipe.pk, 24, self.day)

        mapping = self.mapping(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk)
        self.assertEqual(mapping.status, CalendarEvent.STATUS_ACTIVE)
        event = self.fake.events[mapping.google_event_id]
        self.assertEqual(event["summary"], "Production: Ensaymada × 24 pcs")
        self.assertEqual(event["start"], {"date": self.day.isoformat()})
        self.assertEqual(event["end"], {"date": (self.day + timedelta(days=1)).isoformat()})
        self.assertEqual(event["extendedProperties"]["private"]["rbc_reference_id"], str(run.pk))

    def test_completing_a_run_updates_the_same_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            run = schedule_run(self.recipe.pk, 24, self.day)
        with self.captureOnCommitCallbacks(execute=True):
            run.status = ProductionRun.STATUS_COMPLETED
            run.actual_quantity = Decimal("20")
            run.completed_date = self.day
            run.save()

        self.assertEqual(len(self.fake.events), 1)
        event = next(iter(self.fake.events.values()))
        self.assertTrue(event["summary"].startswith("✓ Production: Ensaymada × 20"))

    def test_cancelling_a_run_removes_the_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            run = schedule_run(self.recipe.pk, 24, self.day)
        with self.captureOnCommitCallbacks(execute=True):
            cancel_run(run.pk)

        self.assertEqual(self.fake.events, {})
        self.assertEqual(self.mapping(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk).status, CalendarEvent.STATUS_DELETED)

    def test_event_deleted_in_google_is_recreated_on_update(self):
        with self.captureOnCommitCallbacks(execute=True):
            run = schedule_run(self.recipe.pk, 24, self.day)
        self.fake.events.clear()

        sync_record(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk)

        self.assertEqual(len(self.fake.events), 1)
        self.assertEqual(self.mapping(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk).status, CalendarEvent.STATUS_ACTIVE)


class DeliverySyncTests(CalendarSyncTestCase):
    def setUp(self):
        super().setUp()
        self.client_record = Client.objects.create(name="Café Uno", address="1 Main St", contact_info="0917")
        self.order = Order.objects.create(client=self.client_record, notes="Ring the bell")
        OrderItem.objects.create(order=self.order, menu_item=self.item, quantity=12, unit_price=50)

    def test_scheduling_a_delivery_creates_event_with_items_and_address(self):
        with self.captureOnCommitCallbacks(execute=True):
            delivery = Delivery.objects.create(order=self.order, scheduled_date=self.day, assigned_staff="Ana")

        event = self.fake.events[self.mapping(CalendarEvent.TYPE_DELIVERY, delivery.pk).google_event_id]
        self.assertEqual(event["summary"], f"Delivery: Order #{self.order.pk} — Café Uno")
        self.assertEqual(event["location"], "1 Main St")
        self.assertIn("12 × Ensaymada", event["description"])
        self.assertIn("Assigned to: Ana", event["description"])

    def test_marking_order_delivered_updates_delivery_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            delivery = Delivery.objects.create(order=self.order, scheduled_date=self.day)
        with self.captureOnCommitCallbacks(execute=True):
            self.order.status = Order.STATUS_DELIVERED
            self.order.save(update_fields=["status"])

        event = self.fake.events[self.mapping(CalendarEvent.TYPE_DELIVERY, delivery.pk).google_event_id]
        self.assertTrue(event["summary"].startswith("✓ Delivery"))

    def test_deleting_the_order_removes_the_delivery_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            Delivery.objects.create(order=self.order, scheduled_date=self.day)
        with self.captureOnCommitCallbacks(execute=True):
            OrderItem.objects.filter(order=self.order).delete()
            self.order.delete()

        self.assertEqual(self.fake.events, {})


class RestockReminderSyncTests(CalendarSyncTestCase):
    def test_pending_reminder_with_date_gets_a_popup_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            reminder = RestockReminder.objects.create(
                raw_material=self.flour, quantity_needed=25, target_date=self.day
            )

        event = self.fake.events[self.mapping(CalendarEvent.TYPE_RESTOCK_REMINDER, reminder.pk).google_event_id]
        self.assertEqual(event["summary"], "Restock: Flour (25 kg)")
        self.assertIn("Supplier: Mill Co", event["description"])
        self.assertFalse(event["reminders"]["useDefault"])

    def test_reminder_without_target_date_is_not_synced(self):
        with self.captureOnCommitCallbacks(execute=True):
            RestockReminder.objects.create(raw_material=self.flour, quantity_needed=25)
        self.assertEqual(self.fake.events, {})
        self.assertFalse(CalendarEvent.objects.exists())

    def test_completing_a_reminder_removes_its_event(self):
        with self.captureOnCommitCallbacks(execute=True):
            reminder = RestockReminder.objects.create(
                raw_material=self.flour, quantity_needed=25, target_date=self.day
            )
        with self.captureOnCommitCallbacks(execute=True):
            reminder.status = "completed"
            reminder.save()
        self.assertEqual(self.fake.events, {})


class FailureAndRetryTests(CalendarSyncTestCase):
    def test_google_failure_is_recorded_and_does_not_break_the_operation(self):
        self.fake.fail_with = GoogleCalendarError("Google API 503", status=503)
        with self.captureOnCommitCallbacks(execute=True):
            run = schedule_run(self.recipe.pk, 24, self.day)

        self.assertTrue(ProductionRun.objects.filter(pk=run.pk).exists())
        mapping = self.mapping(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk)
        self.assertEqual(mapping.status, CalendarEvent.STATUS_FAILED)
        self.assertIn("503", mapping.last_error)

    def test_resync_all_retries_failures_and_backfills_upcoming(self):
        self.fake.fail_with = GoogleCalendarError("down")
        with self.captureOnCommitCallbacks(execute=True):
            run = schedule_run(self.recipe.pk, 24, self.day)
        self.fake.fail_with = None
        RestockReminder.objects.create(raw_material=self.flour, quantity_needed=5, target_date=self.day)
        past = ProductionRun.objects.create(
            menu_item=self.item, recipe=self.recipe, planned_quantity=1, planned_date=date(2020, 1, 1)
        )

        counts = resync_all()

        self.assertEqual(counts, {"synced": 2, "removed": 0, "failed": 0})
        self.assertEqual(self.mapping(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk).status, CalendarEvent.STATUS_ACTIVE)
        self.assertFalse(CalendarEvent.objects.filter(reference_id=past.pk, event_type="production_run").exists())

    def test_nothing_happens_when_not_connected(self):
        self.connection.delete()
        with self.captureOnCommitCallbacks(execute=True):
            schedule_run(self.recipe.pk, 24, self.day)
        self.assertFalse(CalendarEvent.objects.exists())

    def test_build_event_returns_none_for_missing_record(self):
        self.assertIsNone(build_event(CalendarEvent.TYPE_DELIVERY, 999999))


@override_settings(**GOOGLE_SETTINGS)
class CalendarApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser("owner", "owner@example.com", "pw")
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def test_status_when_not_connected(self):
        response = self.api.get("/api/v1/calendar/connection/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["connected"])
        self.assertTrue(response.data["configured"])
        self.assertTrue(response.data["can_manage"])

    def test_connect_returns_google_url_with_state(self):
        response = self.api.post("/api/v1/calendar/connect/")
        self.assertEqual(response.status_code, 200)
        url = response.data["authorization_url"]
        self.assertTrue(url.startswith("https://accounts.google.com/"))
        self.assertIn("access_type=offline", url)
        self.assertIn("calendar.events", url)

    def test_connect_requires_accounts_manage(self):
        plain = User.objects.create_user("staff", password="pw")
        api = APIClient()
        api.force_authenticate(plain)
        self.assertEqual(api.post("/api/v1/calendar/connect/").status_code, 403)

    def test_callback_rejects_bad_state(self):
        self.api.post("/api/v1/calendar/connect/")
        response = self.api.get("/api/v1/calendar/oauth/callback/", {"state": "forged", "code": "x"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("calendar=error", response["Location"])
        self.assertFalse(GoogleCalendarConnection.objects.exists())

    def test_callback_stores_connection_and_backfills(self):
        self.api.post("/api/v1/calendar/connect/")
        state = self.api.session["google_calendar_oauth_state"]
        tokens = {
            "access_token": "at",
            "refresh_token": "rt",
            "expires_in": 3600,
            # header.payload.sig with payload {"email":"bakery@example.com"}
            "id_token": "x.eyJlbWFpbCI6ImJha2VyeUBleGFtcGxlLmNvbSJ9.y",
        }
        with mock.patch("apps.calendar_sync.views.google_client.exchange_code", return_value=tokens), \
                mock.patch("apps.calendar_sync.views.resync_all") as resync:
            response = self.api.get("/api/v1/calendar/oauth/callback/", {"state": state, "code": "abc"})

        self.assertEqual(response["Location"], "http://frontend.test/?calendar=connected")
        connection = GoogleCalendarConnection.current()
        self.assertEqual(connection.google_email, "bakery@example.com")
        self.assertEqual(connection.refresh_token, "rt")
        resync.assert_called_once()

    def test_disconnect_revokes_and_clears(self):
        GoogleCalendarConnection.objects.create(refresh_token="rt")
        CalendarEvent.objects.create(event_type="delivery", reference_id=1, google_event_id="e")
        with mock.patch("apps.calendar_sync.services.google_client.revoke") as revoke:
            response = self.api.post("/api/v1/calendar/disconnect/")
        self.assertFalse(response.data["connected"])
        revoke.assert_called_once_with("rt")
        self.assertFalse(CalendarEvent.objects.exists())

    def test_schedule_lists_all_three_kinds_with_sync_status(self):
        item = MenuItem.objects.create(name="Pandesal", selling_price=5)
        recipe = Recipe.objects.create(menu_item=item, yield_quantity=10)
        day = date(2026, 11, 5)
        run = ProductionRun.objects.create(menu_item=item, recipe=recipe, planned_quantity=100, planned_date=day)
        order = Order.objects.create(customer_name="Walk-in Ben")
        Delivery.objects.create(order=order, scheduled_date=day)
        flour = RawMaterial.objects.create(name="Flour", unit="kg")
        RestockReminder.objects.create(raw_material=flour, quantity_needed=10, target_date=day)
        CalendarEvent.objects.create(
            event_type="production_run", reference_id=run.pk, google_event_id="e", html_link="https://cal/e"
        )

        response = self.api.get("/api/v1/calendar/schedule/", {"start": "2026-11-01", "end": "2026-11-30"})

        self.assertEqual(response.status_code, 200)
        by_type = {item["type"]: item for item in response.data["items"]}
        self.assertEqual(set(by_type), {"production_run", "delivery", "restock_reminder"})
        self.assertEqual(by_type["production_run"]["sync_status"], "active")
        self.assertEqual(by_type["production_run"]["html_link"], "https://cal/e")
        self.assertEqual(by_type["delivery"]["sync_status"], "not_synced")
        self.assertEqual(by_type["delivery"]["title"], f"Order #{order.pk} — Walk-in Ben")

    def test_schedule_rejects_huge_range(self):
        response = self.api.get("/api/v1/calendar/schedule/", {"start": "2026-01-01", "end": "2027-01-01"})
        self.assertEqual(response.status_code, 400)
