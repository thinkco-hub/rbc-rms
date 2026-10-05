from rest_framework.routers import DefaultRouter

from .views import PosProductViewSet, PosTransactionViewSet

router = DefaultRouter()
router.register("products", PosProductViewSet, basename="pos-product")
router.register("transactions", PosTransactionViewSet, basename="pos-transaction")

urlpatterns = router.urls