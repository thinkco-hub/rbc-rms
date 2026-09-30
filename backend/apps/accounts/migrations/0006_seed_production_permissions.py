from django.db import migrations

CODES = ["production.view", "production.manage"]

# Kitchen runs production; Owner/Admin oversee everything. Other departments
# get nothing yet, consistent with how 0004 left them until their modules exist.
ROLE_PERMISSIONS = {
    "Owner": CODES,
    "Admin": CODES,
    "Staff": ["production.view"],
    "Head of Kitchen": CODES,
}


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    perms = {name: Permission.objects.get_or_create(permission_name=name)[0] for name in CODES}

    for role_name, perm_names in ROLE_PERMISSIONS.items():
        role = Role.objects.filter(role_name=role_name).first()
        if role is None:
            continue
        for perm_name in perm_names:
            RolePermission.objects.get_or_create(role=role, perm=perms[perm_name])


def unseed(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Permission.objects.filter(permission_name__in=CODES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_remove_recipes_approve_permission"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
