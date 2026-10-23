from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		("pos", "0002_pos_foundation"),
	]

	operations = [
		migrations.AddField(
			model_name="postransaction",
			name="delivery_date",
			field=models.DateField(blank=True, null=True),
		),
		migrations.AddField(
			model_name="postransaction",
			name="request_fingerprint",
			field=models.CharField(blank=True, default="", max_length=64),
		),
	]