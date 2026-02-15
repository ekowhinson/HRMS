"""
Entity creator registry (Open/Closed Principle).

Adding a new import type only requires:
  1. Create a new creator/validator/matcher
  2. Call registry.register(entity_type, ...)
"""

from .interfaces import EntityCreator, EntityValidator, EntityMatcher


class EntityCreatorRegistry:
    """Central registry mapping entity types to their pipeline components."""

    def __init__(self):
        self._creators: dict[str, EntityCreator] = {}
        self._validators: dict[str, EntityValidator] = {}
        self._matchers: dict[str, EntityMatcher] = {}

    def register(
        self,
        entity_type: str,
        creator: EntityCreator,
        validator: EntityValidator | None = None,
        matcher: EntityMatcher | None = None,
    ):
        self._creators[entity_type] = creator
        if validator:
            self._validators[entity_type] = validator
        if matcher:
            self._matchers[entity_type] = matcher

    def get_creator(self, entity_type: str) -> EntityCreator:
        if entity_type not in self._creators:
            raise ValueError(f"No creator registered for entity type: {entity_type}")
        return self._creators[entity_type]

    def get_validator(self, entity_type: str) -> EntityValidator | None:
        return self._validators.get(entity_type)

    def get_matcher(self, entity_type: str) -> EntityMatcher | None:
        return self._matchers.get(entity_type)

    def get_target_schema(self, entity_type: str) -> dict:
        return self.get_creator(entity_type).get_target_schema()

    def supported_types(self) -> list[str]:
        return list(self._creators.keys())


# Module-level singleton
import_registry = EntityCreatorRegistry()
