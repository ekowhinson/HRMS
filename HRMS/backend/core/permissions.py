"""
Custom permission classes for the HRMS application.
"""

from rest_framework.permissions import BasePermission


class IsSuperUser(BasePermission):
    """
    Allows access only to superusers (is_superuser=True).
    Stricter than IsAdminUser which only checks is_staff.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


def RoleRequired(role_codes):
    """
    Factory that returns a DRF permission class requiring specific role codes.
    Staff and superusers bypass the role check.
    """
    class _RolePermission(BasePermission):
        message = f'Requires one of these roles: {", ".join(role_codes)}'

        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if user.is_staff or user.is_superuser:
                return True
            return user.user_roles.filter(
                role__code__in=role_codes, is_active=True
            ).exists()

    _RolePermission.__name__ = f'RoleRequired_{"_".join(role_codes)}'
    return _RolePermission


PAYROLL_ADMIN_ROLES = ['PAYROLL_ADMIN', 'PAYROLL_MANAGER']
