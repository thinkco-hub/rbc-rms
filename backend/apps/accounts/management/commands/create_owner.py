import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Role
from apps.accounts.services import create_employee


class Command(BaseCommand):
    help = "Bootstraps the first Owner account (accounts CRUD is otherwise gated behind accounts.manage, which nobody holds yet)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--first-name", required=True)
        parser.add_argument("--last-name", required=True)

    def handle(self, *args, **options):
        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            raise CommandError("Passwords did not match.")
        try:
            validate_password(password)
        except Exception as exc:
            raise CommandError("\n".join(exc.messages))

        try:
            owner_role = Role.objects.get(role_name="Owner")
        except Role.DoesNotExist:
            raise CommandError("Owner role not found — run `manage.py migrate` first.")

        employee = create_employee(
            email=options["email"],
            password=password,
            first_name=options["first_name"],
            last_name=options["last_name"],
            role_id=owner_role.pk,
        )
        self.stdout.write(self.style.SUCCESS(f"Created Owner account for {employee.email}."))
