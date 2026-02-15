"""
Backward-compatible re-exports.

The canonical implementations now live in providers.py.
"""

from .providers import (  # noqa: F401
    OllamaProvider as OllamaService,
    SYSTEM_PROMPT,
    PAYROLL_AUDIT_SYSTEM_PROMPT,
    get_llm_provider,
)
