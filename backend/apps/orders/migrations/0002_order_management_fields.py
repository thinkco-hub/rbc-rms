import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("orders", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="client",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="client",
            name="standing_order",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="order",
            name="amount_paid",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="order",
            name="created_at",
            field=models.DateField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delivered_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="order",
            name="customer_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("Cash", "Cash"),
                    ("GCash", "GCash"),
                    ("Bank Transfer", "Bank Transfer"),
                    ("Card", "Card"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="unit_price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AlterField(
            model_name="order",
            name="created_at",
            field=models.DateField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name="orderitem",
            name="unit_price",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("in_production", "In Production"),
                    ("ready", "Ready"),
                    ("delivered", "Delivered"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="client",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to="orders.client",
            ),
        ),
        migrations.AlterField(
            model_name="orderitem",
            name="order",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="items",
                to="orders.order",
            ),
        ),
        migrations.AlterField(
            model_name="delivery",
            name="order",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="delivery",
                to="orders.order",
            ),
        ),
    ]
