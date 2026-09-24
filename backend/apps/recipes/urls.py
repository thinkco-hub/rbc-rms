from rest_framework.routers import DefaultRouter

from .views import RecipeViewSet

router = DefaultRouter()
router.register("", RecipeViewSet, basename="recipe")

urlpatterns = router.urls