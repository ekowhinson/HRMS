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
