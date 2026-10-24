from django.contrib import admin

from .models import CalendarEvent, GoogleCalendarConnection


@admin.register(GoogleCalendarConnection)
class GoogleCalendarConnectionAdmin(admin.ModelAdmin):
    list_display = ["google_email", "calendar_id", "connected_by", "connected_at"]
    exclude = ["refresh_token", "access_token"]


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ["event_type", "reference_id", "status", "last_synced_at", "google_event_id"]
    list_filter = ["event_type", "status"]
