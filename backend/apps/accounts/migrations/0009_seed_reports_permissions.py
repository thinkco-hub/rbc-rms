from django.db import migrations


# Sales figures and profit are owner-level information (FR-3.8.5): only
# Owner and Admin can see reports, log expenses or close a day.
PERMISSIONS = ["reports.view", "reports.manage"]
ROLE_PERMISSIONS = {
    "Owner": PERMISSIONS,
    "Admin": PERMISSIONS,
}


def seed(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")
    database = schema_editor.connection.alias

    permissions = {
        name: Permission.objects.using(database).get_or_create(permission_name=name)[0]
        for name in PERMISSIONS
    }
    for role_name, permission_names in ROLE_PERMISSIONS.items():
        role = Role.objects.using(database).filter(role_name=role_name).first()
        if role is None:
            continue
        for permission_name in permission_names:
            RolePermission.objects.using(database).get_or_create(
                role_id=role.pk,
                perm_id=permissions[permission_name].pk,
            )


def unseed(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    database = schema_editor.connection.alias
    Permission.objects.using(database).filter(permission_name__in=PERMISSIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_merge_20261023_0240"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
