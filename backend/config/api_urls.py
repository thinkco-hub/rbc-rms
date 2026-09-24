from django.urls import include, path

urlpatterns = [
    path("inventory/", include("apps.inventory.urls")),
    path("recipes/", include("apps.recipes.urls")),
]