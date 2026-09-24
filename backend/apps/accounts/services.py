from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError

from .models import Employee, Role

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60
CACHE_KEY_PREFIX = "login_attempts:"


class LoginLockedOut(Exception):
    def __init__(self, locked_until):
        self.locked_until = locked_until
        super().__init__("Too many failed attempts.")


def _cache_key(username):
    return f"{CACHE_KEY_PREFIX}{username.strip().lower()}"


def get_locked_until(username):
    """Epoch-ms the given username is locked out until, or None. Authoritative server-side state."""
    record = cache.get(_cache_key(username)) or {}
    locked_until = record.get("locked_until")
    return locked_until if locked_until else None


def _record_failed_attempt(username):
    key = _cache_key(username)
    record = cache.get(key) or {"attempts": 0, "locked_until": None}
    record["attempts"] += 1
    if record["attempts"] >= MAX_ATTEMPTS:
        import time

        record["locked_until"] = int((time.time() + LOCKOUT_SECONDS) * 1000)
    cache.set(key, record, timeout=LOCKOUT_SECONDS + 5)


def _clear_attempts(username):
    cache.delete(_cache_key(username))


def authenticate_employee(username, password):
    """
    Verifies credentials against Django's hashed password store and the
    Employee's active status, enforcing a server-side lockout after
    repeated failures. Returns the authenticated User, or raises
    LoginLockedOut / ValidationError.
    """
    locked_until = get_locked_until(username)
    if locked_until:
        raise LoginLockedOut(locked_until)

    user = authenticate(username=username, password=password)
    employee = getattr(user, "employee", None) if user else None
    if not user or not employee or not employee.is_active_employee:
        _record_failed_attempt(username)
        locked_until = get_locked_until(username)
        if locked_until:
            raise LoginLockedOut(locked_until)
        raise ValidationError("Invalid username or password.")

    _clear_attempts(username)
    return user


def create_employee(*, email, password, first_name, last_name, role_id, phone=""):
    if User.objects.filter(username=email).exists():
        raise ValidationError("An account with this email already exists.")
    role = Role.objects.get(pk=role_id)
    user = User.objects.create_user(username=email, email=email, password=password)
    try:
        return Employee.objects.create(
            user=user,
            role=role,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
        )
    except Exception:
        user.delete()
        raise


def update_employee(employee, *, first_name=None, last_name=None, phone=None, role_id=None, password=None):
    if first_name is not None:
        employee.first_name = first_name
    if last_name is not None:
        employee.last_name = last_name
    if phone is not None:
        employee.phone = phone
    if role_id is not None:
        employee.role = Role.objects.get(pk=role_id)
    employee.save()
    if password:
        employee.user.set_password(password)
        employee.user.save(update_fields=["password"])
    return employee


def set_employee_active(employee, active):
    employee.status = Employee.STATUS_ACTIVE if active else Employee.STATUS_DEACTIVATED
    employee.save(update_fields=["status"])
    # Deactivating also revokes the underlying login, not just the profile flag.
    employee.user.is_active = active
    employee.user.save(update_fields=["is_active"])
    return employee
