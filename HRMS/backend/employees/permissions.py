"""
Employee ownership permissions for sub-resource views.
"""

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


class EmployeeOwnershipPermission(permissions.BasePermission):
    """Require authentication for employee sub-resource access."""

    def has_permission(self, request, view):
        return request.user.is_authenticated


class EmployeeOwnershipMixin:
    """
    Mixin for employee sub-resource views that use employee_id URL kwarg.
    Ensures users can only access their own employee data, their direct
    reports' data, or all data if they have HR/admin privileges.
    """
    permission_classes = [EmployeeOwnershipPermission]

    def check_permissions(self, request):
        super().check_permissions(request)
        employee_id = self.kwargs.get('employee_id')
        user = request.user

        # Staff/superuser always allowed
        if user.is_superuser or user.is_staff:
            return

        # HR roles always allowed
        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(
            user.user_roles.filter(is_active=True).values_list('role__code', flat=True)
        )
        if any(r in hr_roles for r in user_roles):
            return

        # Must have employee profile
        if not hasattr(user, 'employee') or user.employee is None:
            raise PermissionDenied('You do not have an employee profile.')

        # Owner check
        if str(user.employee.id) == str(employee_id):
            return

        # Supervisor check
        from employees.models import Employee
        try:
            target = Employee.objects.get(id=employee_id)
            if target.supervisor_id == user.employee.id:
                return
        except Employee.DoesNotExist:
            pass

        raise PermissionDenied('You do not have permission to access this employee\'s data.')
