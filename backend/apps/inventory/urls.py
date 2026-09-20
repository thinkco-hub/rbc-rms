from rest_framework.routers import DefaultRouter

from .views import (
    CostLayerViewSet,
    InventoryAlertViewSet,
    MenuItemViewSet,
    RawMaterialViewSet,
    ReceiptViewSet,
    RestockReminderViewSet,
)

router = DefaultRouter()
router.register("raw-materials", RawMaterialViewSet, basename="raw-material")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("cost-layers", CostLayerViewSet, basename="cost-layer")
router.register("reminders", RestockReminderViewSet, basename="reminder")
router.register("menu-items", MenuItemViewSet, basename="menu-item")
router.register("alerts", InventoryAlertViewSet, basename="alert")

urlpatterns = router.urls