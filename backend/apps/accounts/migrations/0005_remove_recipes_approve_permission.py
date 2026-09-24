from django.db import migrations

CODE = "recipes.approve"


def remove(apps, schema_editor):
    apps.get_model("accounts", "Permission").objects.filter(permission_name=CODE).delete()


def restore(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")
    Role = apps.get_model("accounts", "Role")
    perm, _ = Permission.objects.get_or_create(permission_name=CODE)
    for role in Role.objects.filter(role_name__in=["Owner", "Admin"]):
        RolePermission.objects.get_or_create(role=role, perm=perm)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_seed_department_roles"),
    ]

    operations = [
        migrations.RunPython(remove, restore),
    ]
