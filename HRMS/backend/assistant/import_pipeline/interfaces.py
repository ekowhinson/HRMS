"""
Abstract interfaces for the import pipeline.

Follows Interface Segregation: validators and matchers are separate from creators.
Simpler entities (e.g. Bank) can skip matcher.
"""

import abc
from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self):
        return len(self.errors) == 0


@dataclass
class MatchResult:
    existing_record: object | None = None
    changes: dict | None = None  # {field: {old: ..., new: ...}}


class LLMColumnMapper(abc.ABC):
    """Map source file columns to target entity schema using AI."""

    @abc.abstractmethod
    def map_columns(
        self,
        source_columns: list[str],
        sample_data: list[dict],
        target_schema: dict,
        entity_type: str,
    ) -> dict[str, str | None]:
        """Return {source_column: target_field_or_None}."""

    @abc.abstractmethod
    def detect_entity_type(
        self,
        source_columns: list[str],
        sample_data: list[dict],
    ) -> str:
        """Auto-detect the entity type from column names and sample data."""


class EntityValidator(abc.ABC):
    """Validate a single parsed row before creation."""

    @abc.abstractmethod
    def validate_row(self, parsed_row: dict, row_number: int) -> ValidationResult:
        ...


class EntityMatcher(abc.ABC):
    """Find an existing record for upsert detection."""

    @abc.abstractmethod
    def find_existing(self, parsed_row: dict) -> MatchResult:
        ...


class EntityCreator(abc.ABC):
    """Create or update a single entity from a parsed row."""

    @abc.abstractmethod
    def get_entity_type(self) -> str:
        """Return the ImportSession.EntityType value this creator handles."""

    @abc.abstractmethod
    def get_target_schema(self) -> dict:
        """Return {field_name: description} for the AI column mapper."""

    @abc.abstractmethod
    def create(self, row: dict, user) -> object:
        """Create and return the new record."""

    @abc.abstractmethod
    def update(self, existing, row: dict, user) -> object:
        """Update the existing record and return it."""
