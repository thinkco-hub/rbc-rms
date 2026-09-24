from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Employee, Role
from .permissions import AccountsPermission
from .serializers import EmployeeSerializer, LoginSerializer, MeSerializer, RoleSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = services.authenticate_employee(**serializer.validated_data)
        except services.LoginLockedOut as exc:
            return Response(
                {"detail": "Too many failed attempts.", "locked_until": exc.locked_until},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_401_UNAUTHORIZED)

        django_login(request, user)
        return Response(MeSerializer(user.employee).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, "employee", None)
        if not employee or not employee.is_active_employee:
            return Response({"detail": "No active employee profile."}, status=status.HTTP_403_FORBIDDEN)
        return Response(MeSerializer(employee).data)


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Role.objects.all().order_by("role_name")
    serializer_class = RoleSerializer
    permission_classes = [AccountsPermission]


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related("role", "user").order_by("first_name", "last_name")
    serializer_class = EmployeeSerializer
    permission_classes = [AccountsPermission]

    def perform_create(self, serializer):
        data = serializer.validated_data
        password = data.get("password")
        if not password:
            raise DrfValidationError({"password": "Password is required to create an account."})
        employee = services.create_employee(
            email=data["email"],
            password=password,
            first_name=data["first_name"],
            last_name=data["last_name"],
            role_id=data["role"].pk,
            phone=data.get("phone", ""),
        )
        serializer.instance = employee

    def perform_update(self, serializer):
        employee = services.update_employee(
            serializer.instance,
            first_name=serializer.validated_data.get("first_name"),
            last_name=serializer.validated_data.get("last_name"),
            phone=serializer.validated_data.get("phone"),
            role_id=serializer.validated_data.get("role").pk if serializer.validated_data.get("role") else None,
            password=serializer.validated_data.get("password") or None,
        )
        serializer.instance = employee

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        employee = self.get_object()
        services.set_employee_active(employee, active=False)
        return Response(EmployeeSerializer(employee).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        employee = self.get_object()
        services.set_employee_active(employee, active=True)
        return Response(EmployeeSerializer(employee).data)
