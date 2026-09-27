from django.db import migrations

# Roles from the system access matrix. Sales, Cashier and Chams Branch
# Reporter own modules (orders, POS, ledger) that have no permission codes
# yet, so they start with none — grant them here once those modules exist.
ROLE_PERMISSIONS = {
    "Head of Kitchen": ["inventory.view", "inventory.manage", "recipes.view"],
    "Sales": [],
    "R&D": ["recipes.view", "recipes.manage", "inventory.view"],
    "Cashier": [],
    "Chams Branch Reporter": [],
}


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    for role_name, perm_names in ROLE_PERMISSIONS.items():
        role, _ = Role.objects.get_or_create(role_name=role_name)
        for perm_name in perm_names:
            perm = Permission.objects.get(permission_name=perm_name)
            RolePermission.objects.get_or_create(role=role, perm=perm)


def unseed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(role_name__in=ROLE_PERMISSIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_seed_roles_and_permissions"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
