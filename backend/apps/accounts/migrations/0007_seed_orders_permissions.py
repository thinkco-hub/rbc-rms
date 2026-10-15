from django.db import migrations


def seed(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")
    view_permission, _ = Permission.objects.get_or_create(permission_name="orders.view")
    manage_permission, _ = Permission.objects.get_or_create(permission_name="orders.manage")
    for role_name in ("Owner", "Admin", "Staff"):
        role = Role.objects.filter(role_name=role_name).first()
        if role:
            RolePermission.objects.get_or_create(role=role, perm=view_permission)
            RolePermission.objects.get_or_create(role=role, perm=manage_permission)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0006_seed_production_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
