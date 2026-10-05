from django.db import migrations, models
import django.db.models.deletion


def create_unknown_opening_layers(apps, schema_editor):
    database = schema_editor.connection.alias
    MenuItem = apps.get_model("inventory", "MenuItem")
    FinishedGoodsCostLayer = apps.get_model("inventory", "FinishedGoodsCostLayer")

    for item in MenuItem.objects.using(database).filter(stock_quantity__gt=0).iterator():
        FinishedGoodsCostLayer.objects.using(database).create(
            menu_item_id=item.pk,
            quantity=item.stock_quantity,
            quantity_remaining=item.stock_quantity,
            unit_cost=None,
            source_type="opening_balance",
            source_reference="Created by inventory migration 0006",
        )


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_closinginventory_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="FinishedGoodsCostLayer",
            fields=[
                (
                    "finished_goods_cost_layer_id",
                    models.AutoField(primary_key=True, serialize=False),
                ),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("quantity_remaining", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "unit_cost",
                    models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
                ),
                (
                    "source_type",
                    models.CharField(
                        choices=[
                            ("opening_balance", "Opening balance"),
                            ("production", "Production"),
                            ("restock", "Restock"),
                            ("adjustment", "Adjustment"),
                        ],
                        max_length=24,
                    ),
                ),
                ("source_reference", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "menu_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="finished_goods_cost_layers",
                        to="inventory.menuitem",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "finished_goods_cost_layer_id"],
                "indexes": [
                    models.Index(
                        fields=["menu_item", "created_at", "finished_goods_cost_layer_id"],
                        name="fgcl_menu_created_fifo_idx",
                    ),
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(quantity__gt=0),
                        name="fgcl_quantity_positive",
                    ),
                    models.CheckConstraint(
                        condition=(
                            models.Q(quantity_remaining__gte=0)
                            & models.Q(quantity_remaining__lte=models.F("quantity"))
                        ),
                        name="fgcl_remaining_in_range",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(unit_cost__isnull=True)
                        | models.Q(unit_cost__gte=0),
                        name="fgcl_unit_cost_nonnegative_or_unknown",
                    ),
                ],
            },
        ),
        migrations.RunPython(create_unknown_opening_layers, migrations.RunPython.noop),
    ]