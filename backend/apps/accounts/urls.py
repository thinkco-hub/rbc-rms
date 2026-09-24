from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import EmployeeViewSet, LoginView, LogoutView, MeView, RoleViewSet

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("roles", RoleViewSet, basename="role")

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
] + router.urls
