from django.apps import AppConfig


class CalendarSyncConfig(AppConfig):
    name = "apps.calendar_sync"

    def ready(self):
        from . import signals  # noqa: F401 — registers the sync receivers.
