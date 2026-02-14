"""
Tests for organization module access — resolver chain + serializer.
"""

from unittest.mock import Mock, patch

from django.test import TestCase

from organization.module_resolvers import (
    DefaultModuleResolver,
    LicenseModuleResolver,
    ModuleAccessChain,
    OrganizationModuleResolver,
)


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def make_organization(modules_enabled=None, license_obj=None):
    """Create a mock Organization."""
    org = Mock()
    org.modules_enabled = modules_enabled or []
    org.get_active_license.return_value = license_obj
    return org


def make_license(modules_allowed=None):
    """Create a mock License."""
    lic = Mock()
    lic.modules_allowed = modules_allowed or []
    lic.license_type = 'STANDARD'
    lic.max_users = 100
    lic.max_employees = 500
    lic.valid_from = '2025-01-01'
    lic.valid_until = None
    return lic


# ──────────────────────────────────────────────────────────────────
# Individual Resolver Tests
# ──────────────────────────────────────────────────────────────────

class LicenseModuleResolverTest(TestCase):
    """Tests for LicenseModuleResolver."""

    def setUp(self):
        self.resolver = LicenseModuleResolver()

    def test_allowed_module_returns_true(self):
        lic = make_license(modules_allowed=['payroll', 'leave', 'reports'])
        org = make_organization(license_obj=lic)
        self.assertIs(self.resolver.resolve(org, 'payroll'), True)

    def test_disallowed_module_returns_false(self):
        lic = make_license(modules_allowed=['payroll', 'leave'])
        org = make_organization(license_obj=lic)
        self.assertIs(self.resolver.resolve(org, 'reports'), False)

    def test_no_license_defers(self):
        org = make_organization(license_obj=None)
        self.assertIsNone(self.resolver.resolve(org, 'payroll'))

    def test_license_with_empty_modules_defers(self):
        lic = make_license(modules_allowed=[])
        org = make_organization(license_obj=lic)
        self.assertIsNone(self.resolver.resolve(org, 'payroll'))


class OrganizationModuleResolverTest(TestCase):
    """Tests for OrganizationModuleResolver."""

    def setUp(self):
        self.resolver = OrganizationModuleResolver()

    def test_enabled_module_returns_true(self):
        org = make_organization(modules_enabled=['payroll', 'reports'])
        self.assertIs(self.resolver.resolve(org, 'reports'), True)

    def test_disabled_module_returns_false(self):
        org = make_organization(modules_enabled=['payroll'])
        self.assertIs(self.resolver.resolve(org, 'reports'), False)

    def test_empty_modules_defers(self):
        org = make_organization(modules_enabled=[])
        self.assertIsNone(self.resolver.resolve(org, 'payroll'))


class DefaultModuleResolverTest(TestCase):
    """Tests for DefaultModuleResolver."""

    def test_always_returns_true(self):
        resolver = DefaultModuleResolver()
        org = make_organization()
        self.assertIs(resolver.resolve(org, 'anything'), True)


# ──────────────────────────────────────────────────────────────────
# Chain Tests
# ──────────────────────────────────────────────────────────────────

class ModuleAccessChainTest(TestCase):
    """Tests for the ModuleAccessChain orchestration."""

    def test_license_takes_priority_over_org(self):
        """License allows 'payroll' even though org doesn't list it."""
        lic = make_license(modules_allowed=['payroll'])
        org = make_organization(modules_enabled=['reports'], license_obj=lic)
        chain = ModuleAccessChain()
        self.assertTrue(chain.is_enabled(org, 'payroll'))

    def test_license_denies_even_if_org_allows(self):
        """License restricts to ['payroll'], so 'reports' is denied
        regardless of org.modules_enabled."""
        lic = make_license(modules_allowed=['payroll'])
        org = make_organization(modules_enabled=['reports'], license_obj=lic)
        chain = ModuleAccessChain()
        self.assertFalse(chain.is_enabled(org, 'reports'))

    def test_falls_through_to_org_when_no_license(self):
        org = make_organization(modules_enabled=['payroll', 'leave'])
        chain = ModuleAccessChain()
        self.assertTrue(chain.is_enabled(org, 'leave'))
        self.assertFalse(chain.is_enabled(org, 'reports'))

    def test_permits_all_when_no_restrictions(self):
        """No license, no modules_enabled → default allow-all."""
        org = make_organization()
        chain = ModuleAccessChain()
        self.assertTrue(chain.is_enabled(org, 'payroll'))
        self.assertTrue(chain.is_enabled(org, 'reports'))
        self.assertTrue(chain.is_enabled(org, 'anything'))

    def test_custom_resolver_chain(self):
        """Inject a custom resolver that denies everything."""
        class DenyAllResolver:
            def resolve(self, organization, module_name):
                return False

        chain = ModuleAccessChain(resolvers=[DenyAllResolver()])
        org = make_organization()
        self.assertFalse(chain.is_enabled(org, 'payroll'))

    def test_resolver_order_matters(self):
        """First definitive answer wins — put org before license."""
        lic = make_license(modules_allowed=['payroll', 'reports'])
        org = make_organization(modules_enabled=['payroll'], license_obj=lic)

        # Reversed order: org checked first
        chain = ModuleAccessChain(resolvers=[
            OrganizationModuleResolver(),
            LicenseModuleResolver(),
            DefaultModuleResolver(),
        ])
        # Org only has 'payroll', so 'reports' is denied even though license allows it
        self.assertFalse(chain.is_enabled(org, 'reports'))

    def test_empty_chain_falls_through(self):
        """Chain with no resolvers returns True (fallback)."""
        chain = ModuleAccessChain(resolvers=[])
        org = make_organization()
        self.assertTrue(chain.is_enabled(org, 'payroll'))


# ──────────────────────────────────────────────────────────────────
# Organization.is_module_enabled() Integration
# ──────────────────────────────────────────────────────────────────

class OrganizationIsModuleEnabledTest(TestCase):
    """Test that Organization.is_module_enabled delegates to the chain."""

    @patch('organization.module_resolvers.module_access_chain')
    def test_delegates_to_chain(self, mock_chain):
        mock_chain.is_enabled.return_value = True
        org = make_organization()

        # Call the real method on a mock — import and bind it
        from organization.models import Organization
        result = Organization.is_module_enabled(org, 'reports')

        mock_chain.is_enabled.assert_called_once_with(org, 'reports')
        self.assertTrue(result)

    @patch('organization.module_resolvers.module_access_chain')
    def test_delegates_denial(self, mock_chain):
        mock_chain.is_enabled.return_value = False
        org = make_organization()

        from organization.models import Organization
        result = Organization.is_module_enabled(org, 'reports')

        self.assertFalse(result)


# ──────────────────────────────────────────────────────────────────
# OrganizationBriefSerializer Tests
# ──────────────────────────────────────────────────────────────────

class OrganizationBriefSerializerTest(TestCase):
    """Test that the auth-response serializer includes module data."""

    def _serialize(self, org):
        from accounts.serializers import OrganizationBriefSerializer
        return OrganizationBriefSerializer(org).data

    @patch('accounts.serializers.Organization.objects', create=True)
    def test_includes_modules_enabled(self, _):
        org = Mock()
        org.pk = '00000000-0000-0000-0000-000000000001'
        org.id = org.pk
        org.name = 'Test Org'
        org.code = 'TEST'
        org.logo_data = None
        org.primary_color = '#1a365d'
        org.modules_enabled = ['payroll', 'reports', 'leave']
        org.get_active_license.return_value = None

        data = self._serialize(org)

        self.assertEqual(data['modules_enabled'], ['payroll', 'reports', 'leave'])
        self.assertIsNone(data['active_license'])

    @patch('accounts.serializers.Organization.objects', create=True)
    def test_includes_active_license(self, _):
        lic = make_license(modules_allowed=['payroll', 'finance'])
        lic.id = '00000000-0000-0000-0000-000000000002'

        org = Mock()
        org.pk = '00000000-0000-0000-0000-000000000001'
        org.id = org.pk
        org.name = 'Test Org'
        org.code = 'TEST'
        org.logo_data = None
        org.primary_color = '#1a365d'
        org.modules_enabled = []
        org.get_active_license.return_value = lic

        data = self._serialize(org)

        self.assertIsNotNone(data['active_license'])
        self.assertEqual(data['active_license']['modules_allowed'], ['payroll', 'finance'])
        self.assertEqual(data['active_license']['license_type'], 'STANDARD')
