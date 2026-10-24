from django.db import models


class GoogleCalendarConnection(models.Model):
    """
    The single Google account the business calendar syncs into (FR-3.6.1).
    One row at most — the app syncs one shared calendar, not per-user ones.
    """

    connection_id = models.AutoField(primary_key=True)
    google_email = models.EmailField(blank=True)
    calendar_id = models.CharField(max_length=255, default="primary")
    refresh_token = models.TextField()
    access_token = models.TextField(blank=True)
    access_token_expires_at = models.DateTimeField(null=True, blank=True)
    connected_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    connected_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def current(cls):
        return cls.objects.order_by("pk").first()


class CalendarEvent(models.Model):
    """Maps one RMS record to the Google event that mirrors it."""

    TYPE_PRODUCTION_RUN = "production_run"
    TYPE_DELIVERY = "delivery"
    TYPE_RESTOCK_REMINDER = "restock_reminder"
    TYPE_CHOICES = (
        (TYPE_PRODUCTION_RUN, "Production run"),
        (TYPE_DELIVERY, "Delivery"),
        (TYPE_RESTOCK_REMINDER, "Restock reminder"),
    )

    STATUS_ACTIVE = "active"
    STATUS_DELETED = "deleted"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Synced"),
        (STATUS_DELETED, "Removed from calendar"),
        (STATUS_FAILED, "Sync failed"),
    )

    calendar_event_id = models.AutoField(primary_key=True)
    event_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    reference_id = models.IntegerField()
    google_event_id = models.CharField(max_length=255, blank=True)
    html_link = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    last_error = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event_type", "reference_id"], name="calendar_event_unique_reference"
            ),
        ]
