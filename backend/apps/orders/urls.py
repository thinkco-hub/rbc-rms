from rest_framework.routers import DefaultRouter

from .views import ClientViewSet, OrderViewSet

router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("orders", OrderViewSet, basename="order")

urlpatterns = router.urls
