from django.db import models

class Role(models.Model):
    role_id = models.AutoField(primary_key=True)
    role_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

class Permission(models.Model):
    perm_id = models.AutoField(primary_key=True)
    permission_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    perm = models.ForeignKey(Permission, on_delete=models.CASCADE)
    description = models.TextField(blank=True)
    class Meta:
        unique_together = ("role", "perm")

class Employee(models.Model):
    emp_id = models.AutoField(primary_key=True)
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=20, default="active")