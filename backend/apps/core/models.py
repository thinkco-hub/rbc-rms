from django.db import models

class Expense(models.Model):
    expense_id = models.AutoField(primary_key=True)
    emp = models.ForeignKey("accounts.Employee", on_delete=models.SET_NULL, null=True)
    expense_date = models.DateField()
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)