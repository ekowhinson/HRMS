from abc import ABC, abstractmethod


class ModuleAccessResolver(ABC):
    """Abstract resolver for module access decisions."""

    @abstractmethod
    def resolve(self, organization, module_name):
        """
        Return True if module is allowed, False if denied,
        or None to defer to the next resolver in the chain.
        """


class LicenseModuleResolver(ModuleAccessResolver):
    """Check the active license's allowed modules list."""

    def resolve(self, organization, module_name):
        license_obj = organization.get_active_license()
        if license_obj and license_obj.modules_allowed:
            return module_name in license_obj.modules_allowed
        return None


class OrganizationModuleResolver(ModuleAccessResolver):
    """Check the organization-level modules_enabled list."""

    def resolve(self, organization, module_name):
        if organization.modules_enabled:
            return module_name in organization.modules_enabled
        return None


class DefaultModuleResolver(ModuleAccessResolver):
    """Permit access when no other resolver has an opinion."""

    def resolve(self, organization, module_name):
        return True


class ModuleAccessChain:
    """
    Chain-of-responsibility for module access.
    Resolvers are tried in order — first definitive answer (True/False) wins.
    """

    DEFAULT_RESOLVERS = [
        LicenseModuleResolver(),
        OrganizationModuleResolver(),
        DefaultModuleResolver(),
    ]

    def __init__(self, resolvers=None):
        self.resolvers = resolvers if resolvers is not None else self.DEFAULT_RESOLVERS

    def is_enabled(self, organization, module_name):
        for resolver in self.resolvers:
            result = resolver.resolve(organization, module_name)
            if result is not None:
                return result
        return True


# Module-level instance used by Organization.is_module_enabled()
module_access_chain = ModuleAccessChain()
