"""
Multi-provider authentication backends for HRMS.

Supports:
- Local (email/password)
- LDAP/LDAPS (Active Directory)
- Azure AD (OAuth2/OIDC)
"""

from .local import LocalAuthBackend
from .ldap import LDAPAuthBackend
from .azure_ad import AzureADBackend

__all__ = [
    'LocalAuthBackend',
    'LDAPAuthBackend',
    'AzureADBackend',
]
