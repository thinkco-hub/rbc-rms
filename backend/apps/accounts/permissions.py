from rest_framework.permissions import SAFE_METHODS, BasePermission

# Permission codes seeded by the 0003_seed_roles_and_permissions migration.
# "<module>.view" gates read access, "<module>.manage" gates writes.
ACCOUNTS_MANAGE = "accounts.manage"
INVENTORY_VIEW = "inventory.view"
INVENTORY_MANAGE = "inventory.manage"
RECIPES_VIEW = "recipes.view"
RECIPES_MANAGE = "recipes.manage"


def _employee_permission_codes(user):
    """Permission codes granted to `user`'s role, or None if they have no active employee record."""
    employee = getattr(user, "employee", None)
    if employee is None or not employee.is_active_employee:
        return None
    return set(
        employee.role.rolepermission_set.values_list("perm__permission_name", flat=True)
    )


class HasPermissionCode(BasePermission):
    """
    Server-side, per-module RBAC gate. A superuser (Django `is_superuser`,
    used only to bootstrap the first Owner account) always passes; everyone
    else must be an active Employee whose Role was granted the permission
    code required for the request.

    Subclass and set `view_permission` / `manage_permission` (or set them as
    attributes on the view/viewset to override per-view).
    """

    view_permission: str | None = None
    manage_permission: str | None = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True

        codes = _employee_permission_codes(request.user)
        if codes is None:
            return False

        required = getattr(view, "view_permission", self.view_permission) if request.method in SAFE_METHODS \
            else getattr(view, "manage_permission", self.manage_permission)
        if required is None:
            return False
        return required in codes


def require_permission(permission_code):
    """
    `permission_classes = [require_permission("recipes.approve")]` — gate a
    single action (or whole view) behind one permission code regardless of
    HTTP method. Returns a class, since DRF instantiates permission_classes
    entries itself.
    """
    return type(
        f"Require_{permission_code.replace('.', '_')}",
        (HasPermissionCode,),
        {"view_permission": permission_code, "manage_permission": permission_code},
    )


class InventoryPermission(HasPermissionCode):
    view_permission = INVENTORY_VIEW
    manage_permission = INVENTORY_MANAGE


class RecipesPermission(HasPermissionCode):
    view_permission = RECIPES_VIEW
    manage_permission = RECIPES_MANAGE


class AccountsPermission(HasPermissionCode):
    view_permission = ACCOUNTS_MANAGE
    manage_permission = ACCOUNTS_MANAGE
