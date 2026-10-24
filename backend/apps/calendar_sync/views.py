import secrets
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import (
    ACCOUNTS_MANAGE,
    INVENTORY_VIEW,
    ORDERS_VIEW,
    PRODUCTION_VIEW,
    _employee_permission_codes,
    require_permission,
)
from apps.inventory.models import RestockReminder
from apps.orders.models import Delivery, Order
from apps.production.models import ProductionRun

from . import google_client
from .google_client import GoogleCalendarError
from .models import CalendarEvent, GoogleCalendarConnection
from .services import disconnect, resync_all

OAUTH_STATE_SESSION_KEY = "google_calendar_oauth_state"
MAX_RANGE_DAYS = 120

# Connecting/disconnecting the business calendar is an owner-level setting.
CalendarManagePermission = require_permission(ACCOUNTS_MANAGE)


def _codes(user):
    if user.is_superuser:
        return {ACCOUNTS_MANAGE, INVENTORY_VIEW, ORDERS_VIEW, PRODUCTION_VIEW}
    return _employee_permission_codes(user) or set()


def _connection_payload(user):
    connection = GoogleCalendarConnection.current()
    return {
        "configured": google_client.is_configured(),
        "connected": connection is not None,
        "google_email": connection.google_email if connection else "",
        "calendar_id": connection.calendar_id if connection else "",
        "connected_at": connection.connected_at if connection else None,
        "failed_count": CalendarEvent.objects.filter(status=CalendarEvent.STATUS_FAILED).count(),
        "can_manage": ACCOUNTS_MANAGE in _codes(user),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def connection_status(request):
    return Response(_connection_payload(request.user))


@api_view(["POST"])
@permission_classes([CalendarManagePermission])
def connect(request):
    """Start the OAuth flow; the frontend sends the browser to `authorization_url` (FR-3.6.1)."""
    if not google_client.is_configured():
        return Response(
            {"detail": "Google OAuth is not configured on the server (GOOGLE_OAUTH_CLIENT_ID/SECRET)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    state = secrets.token_urlsafe(32)
    request.session[OAUTH_STATE_SESSION_KEY] = state
    return Response({"authorization_url": google_client.authorization_url(state)})


def _frontend_redirect(result, message=""):
    query = {"calendar": result}
    if message:
        query["calendar_message"] = message
    return redirect(f"{settings.FRONTEND_URL.rstrip('/')}/?{urlencode(query)}")


@api_view(["GET"])
@permission_classes([CalendarManagePermission])
def oauth_callback(request):
    """Google redirects the browser here after consent."""
    expected_state = request.session.pop(OAUTH_STATE_SESSION_KEY, None)
    if not expected_state or not secrets.compare_digest(expected_state, request.query_params.get("state", "")):
        return _frontend_redirect("error", "Sign-in session expired. Please try connecting again.")
    if request.query_params.get("error"):
        return _frontend_redirect("error", "Google access was not granted.")
    code = request.query_params.get("code")
    if not code:
        return _frontend_redirect("error", "Google did not return an authorization code.")

    try:
        tokens = google_client.exchange_code(code)
    except GoogleCalendarError:
        return _frontend_redirect("error", "Could not complete Google sign-in. Please try again.")
    if not tokens.get("refresh_token"):
        return _frontend_redirect("error", "Google did not grant offline access. Please try again.")

    with transaction.atomic():
        GoogleCalendarConnection.objects.all().delete()
        CalendarEvent.objects.all().delete()
        GoogleCalendarConnection.objects.create(
            google_email=google_client.email_from_id_token(tokens.get("id_token", "")),
            calendar_id=settings.GOOGLE_CALENDAR_ID,
            refresh_token=tokens["refresh_token"],
            access_token=tokens.get("access_token", ""),
            access_token_expires_at=timezone.now() + timedelta(seconds=tokens.get("expires_in", 3600)),
            connected_by=request.user,
        )
    # Backfill everything already scheduled (FR-3.6.2-3.6.4).
    resync_all()
    return _frontend_redirect("connected")


@api_view(["POST"])
@permission_classes([CalendarManagePermission])
def disconnect_view(request):
    disconnect()
    return Response(_connection_payload(request.user))


@api_view(["POST"])
@permission_classes([CalendarManagePermission])
def resync(request):
    """Manual "Sync now": push upcoming records and retry failures (FR-3.6.6)."""
    if GoogleCalendarConnection.current() is None:
        return Response({"detail": "Google Calendar is not connected."}, status=status.HTTP_400_BAD_REQUEST)
    counts = resync_all()
    return Response({**counts, **_connection_payload(request.user)})


def _sync_info(mappings, event_type, reference_id):
    mapping = mappings.get((event_type, reference_id))
    if mapping is None:
        return {"sync_status": "not_synced", "html_link": "", "sync_error": ""}
    return {
        "sync_status": mapping.status,
        "html_link": mapping.html_link,
        "sync_error": mapping.last_error,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def schedule(request):
    """
    Production runs, deliveries and restock reminders in [start, end] with
    their calendar sync status (FR-3.6.5). Each kind is included only if the
    user can view its module.
    """
    today = timezone.localdate()
    start = parse_date(request.query_params.get("start", "")) or today.replace(day=1)
    end = parse_date(request.query_params.get("end", "")) or start + timedelta(days=41)
    if end < start or (end - start).days > MAX_RANGE_DAYS:
        return Response(
            {"detail": f"Use a date range of 0-{MAX_RANGE_DAYS} days."}, status=status.HTTP_400_BAD_REQUEST
        )

    codes = _codes(request.user)
    mappings = {(m.event_type, m.reference_id): m for m in CalendarEvent.objects.all()}
    items = []

    if PRODUCTION_VIEW in codes:
        runs = ProductionRun.objects.select_related("menu_item").filter(planned_date__range=(start, end))
        for run in runs:
            items.append({
                "type": CalendarEvent.TYPE_PRODUCTION_RUN,
                "reference_id": run.pk,
                "date": run.planned_date,
                "title": f"{run.menu_item.name} × {run.planned_quantity.normalize():f}",
                "status": run.status,
                **_sync_info(mappings, CalendarEvent.TYPE_PRODUCTION_RUN, run.pk),
            })

    if ORDERS_VIEW in codes:
        deliveries = Delivery.objects.select_related("order__client").filter(scheduled_date__range=(start, end))
        for delivery in deliveries:
            order = delivery.order
            customer = (order.client.name if order.client else "") or order.customer_name or "Walk-in"
            items.append({
                "type": CalendarEvent.TYPE_DELIVERY,
                "reference_id": delivery.pk,
                "date": delivery.scheduled_date,
                "title": f"Order #{order.pk} — {customer}",
                "status": "delivered" if order.status == Order.STATUS_DELIVERED else delivery.status,
                "order_id": order.pk,
                "assigned_staff": delivery.assigned_staff,
                **_sync_info(mappings, CalendarEvent.TYPE_DELIVERY, delivery.pk),
            })

    if INVENTORY_VIEW in codes:
        reminders = RestockReminder.objects.select_related("raw_material").filter(target_date__range=(start, end))
        for reminder in reminders:
            material = reminder.raw_material
            items.append({
                "type": CalendarEvent.TYPE_RESTOCK_REMINDER,
                "reference_id": reminder.pk,
                "date": reminder.target_date,
                "title": f"{material.name} ({reminder.quantity_needed.normalize():f} {material.unit})",
                "status": reminder.status,
                **_sync_info(mappings, CalendarEvent.TYPE_RESTOCK_REMINDER, reminder.pk),
            })

    items.sort(key=lambda item: (item["date"], item["type"], item["reference_id"]))
    return Response({"start": start, "end": end, "items": items})
