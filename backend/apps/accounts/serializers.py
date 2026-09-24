from rest_framework import serializers

from .models import Employee, Role


class RoleSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="role_id", read_only=True)

    class Meta:
        model = Role
        fields = ["id", "role_name", "description"]


class EmployeeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="emp_id", read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(source="role", queryset=Role.objects.all())
    role_name = serializers.CharField(source="role.role_name", read_only=True)
    is_active = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "status",
            "role_id",
            "role_name",
            "is_active",
            "password",
        ]
        read_only_fields = ["status"]

    def get_is_active(self, employee):
        return employee.is_active_employee

    def validate_password(self, value):
        if value:
            from django.contrib.auth.password_validation import validate_password

            validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class MeSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="emp_id")
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.CharField()
    role_name = serializers.CharField(source="role.role_name")
    is_superuser = serializers.SerializerMethodField()

    def get_is_superuser(self, employee):
        return employee.user.is_superuser
