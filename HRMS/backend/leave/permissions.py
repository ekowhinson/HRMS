"""
Permission classes for leave module.
"""

from rest_framework import permissions


class IsHROrReadOnly(permissions.BasePermission):
    """
    Allow HR users full access to leave types/policies.
    Other users get read-only access.
    """

    def has_permission(self, request, view):
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions only for HR staff
        user = request.user
        if not user.is_authenticated:
            return False

        # Check if user is superuser or staff
        if user.is_superuser or user.is_staff:
            return True

        # Check for HR role
        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        return any(role in hr_roles for role in user_roles)


class IsOwnerOrManager(permissions.BasePermission):
    """
    Allow access to own leave requests or supervisor's team requests.
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Superusers and staff have full access
        if user.is_superuser or user.is_staff:
            return True

        # Check if user has an employee profile
        if not hasattr(user, 'employee'):
            return False

        employee = user.employee

        # Owner can access their own requests
        if obj.employee == employee:
            return True

        # Supervisors can access their direct reports' requests
        if obj.employee.supervisor == employee:
            return True

        # HR can access all requests
        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return True

        return False


class CanApproveLeave(permissions.BasePermission):
    """
    Only supervisors and HR can approve/reject leave requests.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user.is_authenticated:
            return False

        # Superusers and staff can approve
        if user.is_superuser or user.is_staff:
            return True

        # Must have employee profile
        if not hasattr(user, 'employee'):
            return False

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Superusers and staff have full access
        if user.is_superuser or user.is_staff:
            return True

        employee = user.employee

        # Supervisors can approve their direct reports' requests
        if obj.employee.supervisor == employee:
            return True

        # HR can approve all requests
        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return True

        return False


class IsEmployee(permissions.BasePermission):
    """
    Check if the user has an associated employee record.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False

        # Staff and superusers always have access
        if user.is_superuser or user.is_staff:
            return True

        # Must have employee profile
        return hasattr(user, 'employee') and user.employee is not None
