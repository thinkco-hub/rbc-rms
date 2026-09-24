from django.db import migrations

ROLES = ["Owner", "Admin", "Staff"]

PERMISSIONS = [
    "accounts.manage",
    "inventory.view",
    "inventory.manage",
    "recipes.view",
    "recipes.manage",
    "recipes.approve",
]

# Staff get read access plus the day-to-day inventory writes (restocking,
# closing counts); approving prices and managing accounts/recipes BOMs stay
# with Owner/Admin. Owner and Admin are equivalent for now (FR-3.10.1 groups
# them together) — split further here if their privileges ever diverge.
ROLE_PERMISSIONS = {
    "Owner": PERMISSIONS,
    "Admin": PERMISSIONS,
    "Staff": ["inventory.view", "inventory.manage", "recipes.view"],
}


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    roles = {name: Role.objects.get_or_create(role_name=name)[0] for name in ROLES}
    perms = {name: Permission.objects.get_or_create(permission_name=name)[0] for name in PERMISSIONS}

    for role_name, perm_names in ROLE_PERMISSIONS.items():
        for perm_name in perm_names:
            RolePermission.objects.get_or_create(role=roles[role_name], perm=perms[perm_name])


def unseed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    Role.objects.filter(role_name__in=ROLES).delete()
    Permission.objects.filter(permission_name__in=PERMISSIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_employee_user_status_choices"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
