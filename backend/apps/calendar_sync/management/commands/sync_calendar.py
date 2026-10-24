from django.core.management.base import BaseCommand

from apps.calendar_sync.services import resync_all


class Command(BaseCommand):
    help = "Push upcoming production runs, deliveries and restock reminders to Google Calendar and retry failed syncs."

    def handle(self, *args, **options):
        counts = resync_all()
        self.stdout.write(
            f"Synced {counts['synced']}, removed {counts['removed']}, failed {counts['failed']}."
        )
