from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		("pos", "0003_checkout_fields"),
	]

	operations = [
		migrations.AlterField(
			model_name="postransactionitem",
			name="unit_cogs",
			field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
		),
		migrations.AlterField(
			model_name="postransactionitem",
			name="total_cogs",
			field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
		),
	]