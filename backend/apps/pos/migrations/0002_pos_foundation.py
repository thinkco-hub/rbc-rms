import django.db.models.deletion
from django.db import migrations, models


def backfill_legacy_snapshots(apps, schema_editor):
    database = schema_editor.connection.alias
    PosTransaction = apps.get_model("pos", "PosTransaction")
    PosTransactionItem = apps.get_model("pos", "PosTransactionItem")

    PosTransaction.objects.using(database).update(
        payment_status="unknown",
        amount_paid=None,
    )
    for line in PosTransactionItem.objects.using(database).select_related("menu_item").iterator():
        PosTransactionItem.objects.using(database).filter(pk=line.pk).update(
            item_name=line.menu_item.name,
            unit=line.menu_item.unit or "",
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_seed_pos_permissions"),
        ("inventory", "0006_finished_goods_cost_layer"),
        ("pos", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="postransaction",
            name="amount_paid",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="customer_contact",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="customer_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="idempotency_key",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="payment_reference",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="tax_amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="tax_rate",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="transaction_timestamp",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="void_reason",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="voided_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="pos_voids",
                to="accounts.employee",
            ),
        ),
        migrations.AddField(
            model_name="postransaction",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("unknown", "Unknown"),
                    ("unpaid", "Unpaid"),
                    ("partially_paid", "Partially paid"),
                    ("paid", "Paid"),
                    ("partially_refunded", "Partially refunded"),
                    ("refunded", "Refunded"),
                ],
                default="unpaid",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="postransactionitem",
            name="item_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="postransactionitem",
            name="unit",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name="postransaction",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("Cash", "Cash"),
                    ("GCash", "GCash"),
                    ("Bank Transfer", "Bank Transfer"),
                    ("Card", "Card"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="postransaction",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("completed", "Completed"),
                    ("voided", "Voided"),
                    ("partially_refunded", "Partially refunded"),
                    ("refunded", "Refunded"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_legacy_snapshots, migrations.RunPython.noop),
        migrations.CreateModel(
            name="PosRefund",
            fields=[
                ("refund_id", models.AutoField(primary_key=True, serialize=False)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "payment_method",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("Cash", "Cash"),
                            ("GCash", "GCash"),
                            ("Bank Transfer", "Bank Transfer"),
                            ("Card", "Card"),
                        ],
                        max_length=20,
                    ),
                ),
                ("payment_reference", models.CharField(blank=True, max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("reason", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pos_refunds",
                        to="accounts.employee",
                    ),
                ),
                (
                    "transaction",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="refunds",
                        to="pos.postransaction",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PosRefundItem",
            fields=[
                ("refund_item_id", models.AutoField(primary_key=True, serialize=False)),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "refund",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="pos.posrefund",
                    ),
                ),
                (
                    "transaction_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="pos.postransactionitem",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="posrefund",
            constraint=models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="pos_refund_amount_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="posrefunditem",
            constraint=models.UniqueConstraint(
                fields=("refund", "transaction_item"),
                name="pos_refund_item_unique_line",
            ),
        ),
        migrations.AddConstraint(
            model_name="posrefunditem",
            constraint=models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="pos_refund_item_quantity_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="posrefunditem",
            constraint=models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name="pos_refund_item_amount_nonnegative",
            ),
        ),
    ]