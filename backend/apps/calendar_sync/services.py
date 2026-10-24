"""
Google Calendar sync for production runs, deliveries and restock reminders
(FR-3.6.1-3.6.6).

Sync is reconcile-style: `sync_record` looks at the record's *current* state,
decides whether a calendar event should exist and what it should say, and
makes Google match. That makes it idempotent, so the same call serves create,
update, delete and retry-after-failure.
"""

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import RestockReminder
from apps.orders.models import Delivery, Order
from apps.production.models import ProductionRun

from . import google_client
from .google_client import CalendarClient, GoogleCalendarError
from .models import CalendarEvent, GoogleCalendarConnection

logger = logging.getLogger(__name__)

# Google Calendar colorIds, so the three kinds are distinguishable at a glance.
COLOR_PRODUCTION = "6"  # tangerine
COLOR_DELIVERY = "9"  # blueberry
COLOR_RESTOCK = "11"  # tomato
COLOR_DONE = "8"  # graphite

# All-day reminder offsets count back from 00:00 of the event day, so 15h
# early pops up at 09:00 the day before — time to place the supplier order.
RESTOCK_REMINDER_MINUTES = 15 * 60


def _all_day(day):
    return {"start": {"date": day.isoformat()}, "end": {"date": (day + timedelta(days=1)).isoformat()}}


def _qty(value):
    return f"{value.normalize():f}"


def _base(event_type, reference_id):
    return {
        "extendedProperties": {
            "private": {"rbc_type": event_type, "rbc_reference_id": str(reference_id)},
        },
    }


def _production_event(run_id):
    run = (
        ProductionRun.objects.select_related("menu_item", "emp")
        .filter(pk=run_id)
        .first()
    )
    if run is None or run.status == ProductionRun.STATUS_CANCELLED:
        return None
    done = run.status == ProductionRun.STATUS_COMPLETED
    qty = run.actual_quantity if done and run.actual_quantity is not None else run.planned_quantity
    unit = f" {run.menu_item.unit}" if run.menu_item.unit else ""
    lines = [
        f"Production run #{run.pk}",
        f"Item: {run.menu_item.name}",
        f"Planned quantity: {_qty(run.planned_quantity)}{unit}",
        f"Status: {run.get_status_display()}",
    ]
    if done:
        lines.append(f"Completed {run.completed_date}: {_qty(qty)}{unit} produced")
    if run.emp:
        lines.append(f"Scheduled by: {run.emp}")
    return {
        **_base(CalendarEvent.TYPE_PRODUCTION_RUN, run.pk),
        **_all_day(run.planned_date),
        "summary": f"{'✓ ' if done else ''}Production: {run.menu_item.name} × {_qty(qty)}{unit}",
        "description": "\n".join(lines),
        "colorId": COLOR_DONE if done else COLOR_PRODUCTION,
    }


def _delivery_event(delivery_id):
    delivery = (
        Delivery.objects.select_related("order__client")
        .prefetch_related("order__items__menu_item")
        .filter(pk=delivery_id)
        .first()
    )
    if delivery is None or delivery.status == "cancelled":
        return None
    order = delivery.order
    done = order.status == Order.STATUS_DELIVERED
    customer = (order.client.name if order.client else "") or order.customer_name or "Walk-in"
    lines = [
        f"Order #{order.pk} for {customer}",
        f"Order status: {order.get_status_display()}",
    ]
    if delivery.assigned_staff:
        lines.append(f"Assigned to: {delivery.assigned_staff}")
    if order.client and order.client.contact_info:
        lines.append(f"Contact: {order.client.contact_info}")
    items = list(order.items.all())
    if items:
        lines.append("")
        lines.append("Items:")
        lines.extend(f"• {_qty(i.quantity)} × {i.menu_item.name}" for i in items)
    if order.notes:
        lines.extend(["", f"Notes: {order.notes}"])
    event = {
        **_base(CalendarEvent.TYPE_DELIVERY, delivery.pk),
        **_all_day(delivery.scheduled_date),
        "summary": f"{'✓ ' if done else ''}Delivery: Order #{order.pk} — {customer}",
        "description": "\n".join(lines),
        "colorId": COLOR_DONE if done else COLOR_DELIVERY,
    }
    if order.client and order.client.address:
        event["location"] = order.client.address
    return event


def _restock_event(reminder_id):
    reminder = RestockReminder.objects.select_related("raw_material").filter(pk=reminder_id).first()
    if reminder is None or reminder.target_date is None or reminder.status != "pending":
        return None
    material = reminder.raw_material
    lines = [
        f"Restock {material.name}: {_qty(reminder.quantity_needed)} {material.unit}",
        f"Current stock: {_qty(material.current_stock)} {material.unit}",
    ]
    if material.supplier:
        lines.append(f"Supplier: {material.supplier}")
    if reminder.note:
        lines.extend(["", reminder.note])
    return {
        **_base(CalendarEvent.TYPE_RESTOCK_REMINDER, reminder.pk),
        **_all_day(reminder.target_date),
        "summary": f"Restock: {material.name} ({_qty(reminder.quantity_needed)} {material.unit})",
        "description": "\n".join(lines),
        "colorId": COLOR_RESTOCK,
        "reminders": {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": RESTOCK_REMINDER_MINUTES}],
        },
    }


BUILDERS = {
    CalendarEvent.TYPE_PRODUCTION_RUN: _production_event,
    CalendarEvent.TYPE_DELIVERY: _delivery_event,
    CalendarEvent.TYPE_RESTOCK_REMINDER: _restock_event,
}


def build_event(event_type, reference_id):
    """The Google event body the record should have, or None if it shouldn't be on the calendar."""
    return BUILDERS[event_type](reference_id)


def sync_record(event_type, reference_id, connection=None):
    """
    Make Google match the record's current state. Never raises: failures are
    recorded on the CalendarEvent (status=failed) so `retry_failed` can pick
    them up, and the RMS operation that triggered the sync is unaffected.
    Returns the CalendarEvent mapping, or None when there's nothing to do.
    """
    connection = connection or GoogleCalendarConnection.current()
    if connection is None or not google_client.is_configured():
        return None

    mapping = CalendarEvent.objects.filter(event_type=event_type, reference_id=reference_id).first()
    try:
        body = build_event(event_type, reference_id)
        has_remote = bool(mapping and mapping.google_event_id and mapping.status != CalendarEvent.STATUS_DELETED)
        client = CalendarClient(connection)

        if body is None:
            if mapping is None:
                return None
            if mapping.google_event_id:
                client.delete_event(mapping.google_event_id)
            mapping.status = CalendarEvent.STATUS_DELETED
            mapping.html_link = ""
        else:
            result = None
            if has_remote:
                try:
                    result = client.update_event(mapping.google_event_id, body)
                except GoogleCalendarError as exc:
                    if exc.status not in (404, 410):
                        raise
                    # Someone deleted it in Google — recreate below.
            if result is None:
                result = client.insert_event(body)
            if mapping is None:
                mapping = CalendarEvent(event_type=event_type, reference_id=reference_id)
            mapping.google_event_id = result["id"]
            mapping.html_link = result.get("htmlLink", "")
            mapping.status = CalendarEvent.STATUS_ACTIVE
        mapping.last_error = ""
    except Exception as exc:  # noqa: BLE001 — sync must never break the caller.
        logger.warning("Calendar sync failed for %s %s: %s", event_type, reference_id, exc)
        if mapping is None:
            mapping = CalendarEvent(event_type=event_type, reference_id=reference_id)
        mapping.status = CalendarEvent.STATUS_FAILED
        mapping.last_error = str(exc)[:1000]
    mapping.last_synced_at = timezone.now()
    mapping.save()
    return mapping


def schedule_sync(event_type, reference_id):
    """Queue a sync for after the current transaction commits (a rollback means nothing to sync)."""
    transaction.on_commit(lambda: sync_record(event_type, reference_id))


def _upcoming_references(since):
    yield from (
        (CalendarEvent.TYPE_PRODUCTION_RUN, pk)
        for pk in ProductionRun.objects.filter(planned_date__gte=since).values_list("pk", flat=True)
    )
    yield from (
        (CalendarEvent.TYPE_DELIVERY, pk)
        for pk in Delivery.objects.filter(scheduled_date__gte=since).values_list("pk", flat=True)
    )
    yield from (
        (CalendarEvent.TYPE_RESTOCK_REMINDER, pk)
        for pk in RestockReminder.objects.filter(target_date__gte=since).values_list("pk", flat=True)
    )


def resync_all(since=None):
    """
    Push every record dated `since` onward (default: today) plus every
    previously failed mapping. Used after connecting and as the manual
    "Sync now" / scheduled retry. Returns counts by outcome.
    """
    connection = GoogleCalendarConnection.current()
    if connection is None:
        return {"synced": 0, "removed": 0, "failed": 0}
    since = since or timezone.localdate()
    references = set(_upcoming_references(since))
    references.update(
        CalendarEvent.objects.filter(status=CalendarEvent.STATUS_FAILED).values_list("event_type", "reference_id")
    )
    counts = {"synced": 0, "removed": 0, "failed": 0}
    for event_type, reference_id in sorted(references):
        mapping = sync_record(event_type, reference_id, connection=connection)
        if mapping is None:
            continue
        key = {
            CalendarEvent.STATUS_ACTIVE: "synced",
            CalendarEvent.STATUS_DELETED: "removed",
            CalendarEvent.STATUS_FAILED: "failed",
        }[mapping.status]
        counts[key] += 1
    return counts


def disconnect():
    """Revoke Google access and forget all event mappings (events already in Google stay there)."""
    connection = GoogleCalendarConnection.current()
    if connection is None:
        return
    google_client.revoke(connection.refresh_token)
    with transaction.atomic():
        CalendarEvent.objects.all().delete()
        GoogleCalendarConnection.objects.all().delete()
