"""
AI-powered payroll data import pipeline.

Architecture:
  - interfaces.py: ABCs (LLMColumnMapper, EntityCreator, EntityValidator, EntityMatcher)
  - registry.py:   EntityCreatorRegistry — maps entity types to implementations
  - column_mapper.py:     OllamaColumnMapper — AI-powered column mapping
  - preview_generator.py: ImportPreviewGenerator — dry-run preview
  - import_executor.py:   ImportExecutor — confirmed import execution
  - creators/:            Concrete entity creators
"""
