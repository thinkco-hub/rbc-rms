from django.db import models

class CalendarEvent(models.Model):
    calendar_event_id = models.AutoField(primary_key=True)
    event_type = models.CharField(max_length=30)
    reference_id = models.IntegerField()
    google_event_id = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default="active")