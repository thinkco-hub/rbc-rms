from django.urls import include, path

urlpatterns = [
    path("accounts/", include("apps.accounts.urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("recipes/", include("apps.recipes.urls")),
    path("production/", include("apps.production.urls")),
    path("orders/", include("apps.orders.urls")),
    path("pos/", include("apps.pos.urls")),
    path("reports/", include("apps.reports.urls")),
]