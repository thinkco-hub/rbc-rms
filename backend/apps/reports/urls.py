from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DayClosingViewSet,
    DaySummaryView,
    DiscrepancyReportView,
    ExpenseViewSet,
    ExportReportView,
    SalesReportView,
)

router = DefaultRouter()
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("closings", DayClosingViewSet, basename="day-closing")

urlpatterns = [
    path("summary/", DaySummaryView.as_view(), name="reports-summary"),
    path("sales/", SalesReportView.as_view(), name="reports-sales"),
    path("discrepancies/", DiscrepancyReportView.as_view(), name="reports-discrepancies"),
    path("export/", ExportReportView.as_view(), name="reports-export"),
    *router.urls,
]
