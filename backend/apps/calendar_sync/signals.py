"""
Queue a calendar sync whenever a synced record changes, whichever code path
changed it (services, viewsets, admin). The sync itself runs after commit.
"""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.inventory.models import RestockReminder
from apps.orders.models import Delivery, Order
from apps.production.models import ProductionRun

from .models import CalendarEvent, GoogleCalendarConnection
from .services import schedule_sync


def _connected():
    # Cheap guard so unconnected installs don't queue work on every save.
    return GoogleCalendarConnection.objects.exists()


@receiver([post_save, post_delete], sender=ProductionRun)
def production_run_changed(sender, instance, **kwargs):
    if _connected():
        schedule_sync(CalendarEvent.TYPE_PRODUCTION_RUN, instance.pk)


@receiver([post_save, post_delete], sender=Delivery)
def delivery_changed(sender, instance, **kwargs):
    if _connected():
        schedule_sync(CalendarEvent.TYPE_DELIVERY, instance.pk)


@receiver(post_save, sender=Order)
def order_changed(sender, instance, **kwargs):
    # Order status/notes appear on the delivery event; `mark_delivered`
    # updates only the Order, so follow it to its delivery.
    if not _connected():
        return
    delivery_id = Delivery.objects.filter(order_id=instance.pk).values_list("pk", flat=True).first()
    if delivery_id is not None:
        schedule_sync(CalendarEvent.TYPE_DELIVERY, delivery_id)


@receiver([post_save, post_delete], sender=RestockReminder)
def restock_reminder_changed(sender, instance, **kwargs):
    if _connected():
        schedule_sync(CalendarEvent.TYPE_RESTOCK_REMINDER, instance.pk)
