import csv
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Employee, Permission, Role, RolePermission
from apps.core.models import Expense
from apps.inventory.models import ClosingInventory, MenuItem
from apps.pos.models import PaymentMethod, PosRefund, PosTransaction, PosTransactionItem

from .models import DayClosing
from .services import close_day, daily_rollup, sales_timeseries

REPORTS_URL = "/api/v1/reports/"
DAY = date(2026, 10, 20)


def _at(day, hour=10):
    return timezone.make_aware(datetime.combine(day, time(hour)))


class ReportsFixtureMixin:
    def setUp(self):
        self.product = MenuItem.objects.create(name="Croissant", unit="pc", selling_price=Decimal("100.00"))

    def make_sale(self, *, day=DAY, total="105.00", tax="5.00", cogs="40.00", method=PaymentMethod.CASH,
                  status=PosTransaction.Status.COMPLETED, customer="Walk-in"):
        sale = PosTransaction.objects.create(
            subtotal=Decimal(total) - Decimal(tax),
            tax_amount=Decimal(tax),
            tax_rate=Decimal("5.00"),
            total_amount=Decimal(total),
            customer_name=customer,
            payment_method=method,
            payment_status=PosTransaction.PaymentStatus.PAID,
            amount_paid=Decimal(total),
            status=status,
            transaction_timestamp=_at(day),
        )
        PosTransactionItem.objects.create(
            transaction=sale,
            menu_item=self.product,
            item_name=self.product.name,
            unit="pc",
            quantity=1,
            unit_price=sale.subtotal,
            line_total=sale.subtotal,
            unit_cogs=None if cogs is None else Decimal(cogs),
            total_cogs=None if cogs is None else Decimal(cogs),
        )
        return sale


class RollupTests(ReportsFixtureMixin, TestCase):
    def test_end_of_day_profit(self):
        self.make_sale()
        self.make_sale(total="210.00", tax="10.00", cogs="80.00", method=PaymentMethod.GCASH)
        self.make_sale(status=PosTransaction.Status.VOIDED)
        self.make_sale(status=PosTransaction.Status.PENDING)
        self.make_sale(day=DAY + timedelta(days=1))
        Expense.objects.create(expense_date=DAY, description="Flour", amount=Decimal("50.00"))

        figures = daily_rollup(DAY, DAY)[DAY]

        self.assertEqual(figures["transaction_count"], 2)
        self.assertEqual(figures["gross_sales"], Decimal("315.00"))
        self.assertEqual(figures["net_sales"], Decimal("300.00"))
        self.assertEqual(figures["cogs"], Decimal("120.00"))
        self.assertEqual(figures["gross_profit"], Decimal("180.00"))
        self.assertEqual(figures["net_profit"], Decimal("130.00"))
        self.assertFalse(figures["cogs_incomplete"])

    def test_refunds_count_on_processed_day_and_reduce_net_sales(self):
        sale = self.make_sale()
        PosRefund.objects.create(
            transaction=sale, amount=Decimal("30.00"), status=PosRefund.Status.COMPLETED,
            processed_at=_at(DAY + timedelta(days=1)),
        )
        PosRefund.objects.create(transaction=sale, amount=Decimal("5.00"), status=PosRefund.Status.FAILED)

        rollup = daily_rollup(DAY, DAY + timedelta(days=1))

        self.assertEqual(rollup[DAY]["refunds"], Decimal("0.00"))
        self.assertEqual(rollup[DAY + timedelta(days=1)]["refunds"], Decimal("30.00"))
        self.assertEqual(rollup[DAY + timedelta(days=1)]["net_sales"], Decimal("-30.00"))

    def test_uncosted_lines_flag_cogs_incomplete(self):
        self.make_sale(cogs=None)
        self.assertTrue(daily_rollup(DAY, DAY)[DAY]["cogs_incomplete"])

    def test_weekly_buckets_start_on_monday_and_zero_fill(self):
        monday = date(2026, 10, 19)
        self.make_sale(day=monday)
        self.make_sale(day=monday + timedelta(days=6))
        self.make_sale(day=monday + timedelta(days=7))

        report = sales_timeseries(monday, monday + timedelta(days=13), "week")

        self.assertEqual([row["period_start"] for row in report["series"]], [monday, monday + timedelta(days=7)])
        self.assertEqual([row["transaction_count"] for row in report["series"]], [2, 1])
        self.assertEqual(report["totals"]["gross_sales"], Decimal("315.00"))

    def test_close_day_snapshots_figures_and_cash_discrepancy(self):
        self.make_sale()
        self.make_sale(method=PaymentMethod.CARD)

        closing = close_day(DAY, counted_cash=Decimal("100.00"))

        self.assertEqual(closing.expected_cash, Decimal("105.00"))
        self.assertEqual(closing.cash_discrepancy, Decimal("-5.00"))
        self.assertEqual(closing.net_profit, Decimal("120.00"))


class ReportsApiTests(ReportsFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

    def login_as(self, role_name):
        role, _ = Role.objects.get_or_create(role_name=role_name)
        user = User.objects.create_user(username=f"{role_name}@example.test", password="secret")
        Employee.objects.create(user=user, role=role, first_name=role_name, last_name="User", email=user.username)
        self.client.force_authenticate(user)
        return role

    def grant(self, role, *codes):
        for code in codes:
            perm, _ = Permission.objects.get_or_create(permission_name=code)
            RolePermission.objects.get_or_create(role=role, perm=perm)

    def test_owner_and_admin_are_seeded_with_reports_access(self):
        for role_name in ("Owner", "Admin"):
            codes = set(
                RolePermission.objects.filter(role__role_name=role_name)
                .values_list("perm__permission_name", flat=True)
            )
            self.assertLessEqual({"reports.view", "reports.manage"}, codes)
        self.assertFalse(
            RolePermission.objects.filter(role__role_name="Cashier", perm__permission_name__startswith="reports.").exists()
        )

    def test_role_without_reports_permission_is_forbidden(self):
        role = self.login_as("Cashier")
        self.grant(role, "pos.view", "pos.manage")

        for path in ("summary/", "sales/", "discrepancies/", "export/", "expenses/", "closings/"):
            self.assertEqual(self.client.get(REPORTS_URL + path).status_code, 403, path)

    def test_view_only_role_cannot_close_day_or_log_expenses(self):
        self.grant(self.login_as("Auditor"), "reports.view")

        self.assertEqual(self.client.get(REPORTS_URL + "summary/").status_code, 200)
        self.assertEqual(
            self.client.post(REPORTS_URL + "closings/", {"business_date": DAY.isoformat()}).status_code, 403
        )
        self.assertEqual(
            self.client.post(
                REPORTS_URL + "expenses/", {"date": DAY.isoformat(), "description": "x", "amount": "1"}
            ).status_code,
            403,
        )

    def test_summary_returns_money_as_strings(self):
        self.grant(self.login_as("Owner"), "reports.view")
        self.make_sale()

        response = self.client.get(REPORTS_URL + "summary/", {"date": DAY.isoformat()})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["gross_sales"], "105.00")
        self.assertEqual(response.data["net_profit"], "60.00")
        self.assertEqual(response.data["payment_methods"][0]["payment_method"], "Cash")
        self.assertFalse(response.data["is_closed"])

    def test_invalid_query_params_are_rejected(self):
        self.grant(self.login_as("Owner"), "reports.view")

        self.assertEqual(self.client.get(REPORTS_URL + "summary/", {"date": "nope"}).status_code, 400)
        self.assertEqual(
            self.client.get(REPORTS_URL + "sales/", {"start": "2026-10-10", "end": "2026-10-01"}).status_code, 400
        )
        self.assertEqual(self.client.get(REPORTS_URL + "sales/", {"granularity": "hour"}).status_code, 400)
        self.assertEqual(
            self.client.get(REPORTS_URL + "sales/", {"start": "2020-01-01", "end": "2026-01-01"}).status_code, 400
        )

    def test_closing_a_day_locks_its_expenses(self):
        self.grant(self.login_as("Owner"), "reports.view", "reports.manage")
        expense = self.client.post(
            REPORTS_URL + "expenses/", {"date": DAY.isoformat(), "description": "Flour", "amount": "50.00"}
        )
        self.assertEqual(expense.status_code, 201)

        closed = self.client.post(REPORTS_URL + "closings/", {"business_date": DAY.isoformat(), "counted_cash": "0"})
        self.assertEqual(closed.status_code, 201)
        self.assertEqual(closed.data["total_expenses"], "50.00")
        self.assertEqual(closed.data["closed_by"], "Owner User")

        again = self.client.post(REPORTS_URL + "closings/", {"business_date": DAY.isoformat()})
        self.assertEqual(again.status_code, 400)
        self.assertEqual(
            self.client.post(
                REPORTS_URL + "expenses/", {"date": DAY.isoformat(), "description": "Late", "amount": "1"}
            ).status_code,
            400,
        )
        self.assertEqual(self.client.delete(f"{REPORTS_URL}expenses/{expense.data['id']}/").status_code, 400)
        self.assertEqual(
            self.client.patch(
                f"{REPORTS_URL}expenses/{expense.data['id']}/",
                {"date": (DAY + timedelta(days=1)).isoformat()},
            ).status_code,
            400,
        )

    def test_cannot_close_a_future_date(self):
        self.grant(self.login_as("Owner"), "reports.manage")
        tomorrow = timezone.localdate() + timedelta(days=1)

        response = self.client.post(REPORTS_URL + "closings/", {"business_date": tomorrow.isoformat()})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(DayClosing.objects.exists())

    def test_transaction_csv_export_neutralises_formulas(self):
        self.grant(self.login_as("Owner"), "reports.view")
        sale = self.make_sale(customer="=HYPERLINK(\"http://evil\")")
        PosRefund.objects.create(transaction=sale, amount=Decimal("10.00"), status=PosRefund.Status.COMPLETED)

        response = self.client.get(
            REPORTS_URL + "export/", {"start": DAY.isoformat(), "end": DAY.isoformat(), "kind": "transactions"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment;", response["Content-Disposition"])
        rows = list(csv.reader(StringIO(response.content.decode())))
        self.assertEqual(rows[0][0], "transaction_id")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][3], "'=HYPERLINK(\"http://evil\")")
        self.assertEqual(rows[1][9:], ["105.00", "10.00", "40.00"])

    def test_daily_csv_export_has_a_row_per_day(self):
        self.grant(self.login_as("Owner"), "reports.view")
        self.make_sale()

        response = self.client.get(
            REPORTS_URL + "export/",
            {"start": DAY.isoformat(), "end": (DAY + timedelta(days=2)).isoformat(), "kind": "daily"},
        )

        rows = list(csv.reader(StringIO(response.content.decode())))
        self.assertEqual([row[0] for row in rows[1:]], ["2026-10-20", "2026-10-21", "2026-10-22"])
        self.assertEqual(rows[1][2], "105.00")

    def test_discrepancies_value_shortages_and_include_cash_variance(self):
        self.grant(self.login_as("Owner"), "reports.view")
        for expected, actual in (("10", "7"), ("5", "6"), ("4", "4")):
            ClosingInventory.objects.create(
                menu_item=self.product,
                inventory_date=DAY,
                expected_quantity=Decimal(expected),
                actual_quantity=Decimal(actual),
                discrepancy_quantity=Decimal(actual) - Decimal(expected),
            )
        self.make_sale()
        close_day(DAY, counted_cash=Decimal("100.00"))

        response = self.client.get(REPORTS_URL + "discrepancies/", {"start": DAY.isoformat(), "end": DAY.isoformat()})

        self.assertEqual(response.status_code, 200)
        inventory = response.data["inventory"]
        self.assertEqual(inventory["count"], 2)
        self.assertEqual(inventory["shortage_value"], "-300.00")
        self.assertEqual(inventory["overage_value"], "100.00")
        self.assertEqual(response.data["cash"]["days"][0]["cash_discrepancy"], "-5.00")

    def test_pos_routes_are_mounted(self):
        self.grant(self.login_as("Cashier"), "pos.view")
        self.assertEqual(self.client.get("/api/v1/pos/products/").status_code, 200)
