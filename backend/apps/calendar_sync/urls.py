from django.urls import path

from . import views

urlpatterns = [
    path("connection/", views.connection_status, name="calendar-connection"),
    path("connect/", views.connect, name="calendar-connect"),
    path("oauth/callback/", views.oauth_callback, name="calendar-oauth-callback"),
    path("disconnect/", views.disconnect_view, name="calendar-disconnect"),
    path("resync/", views.resync, name="calendar-resync"),
    path("schedule/", views.schedule, name="calendar-schedule"),
]
