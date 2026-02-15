"""
AI-powered column mapping using the LLM provider.

Sends source columns + sample data + target schema to the LLM
and parses the JSON mapping response.
"""

import json
import logging
import re
from difflib import SequenceMatcher

from ..providers import get_llm_provider
from .interfaces import LLMColumnMapper

logger = logging.getLogger(__name__)

COLUMN_MAPPING_SYSTEM_PROMPT = """You are a data-mapping assistant. You ONLY output valid JSON — no explanations, no markdown fences, no extra text.

Your task: map source CSV/Excel column names to target field names.

Rules:
1. Return a JSON object where each key is a SOURCE column name and the value is the matching TARGET field name (or null if no match).
2. Every source column MUST appear as a key.
3. Values must be exact target field names from the schema provided, or null.
4. Do NOT invent target field names.
5. Use the sample data rows to help resolve ambiguous mappings.
"""

ENTITY_DETECT_SYSTEM_PROMPT = """You are a data-classification assistant. You ONLY output valid JSON — no explanations, no markdown fences, no extra text.

Given CSV/Excel column names and sample rows, determine what entity type the data represents.

Respond with:
{"entity_type": "<one of: EMPLOYEE_TRANSACTION, EMPLOYEE, BANK_ACCOUNT, PAY_COMPONENT, BANK>", "confidence": <0.0-1.0>}

Hints:
- EMPLOYEE_TRANSACTION: columns like employee_number + component/pay_component + amount/override + effective_from
- EMPLOYEE: columns like employee_number + first_name + last_name + department + date_of_joining
- BANK_ACCOUNT: columns like employee_number + bank + account_number + account_name
- PAY_COMPONENT: columns like code + name + component_type + calculation_type
- BANK: columns like code + name + swift_code + sort_code
"""


class OllamaColumnMapper(LLMColumnMapper):
    """Uses the configured LLM provider to map columns via structured JSON."""

    def __init__(self, llm_provider=None):
        self.llm = llm_provider or get_llm_provider()

    def map_columns(self, source_columns, sample_data, target_schema, entity_type):
        schema_desc = "\n".join(
            f"  - {field}: {desc}" for field, desc in target_schema.items()
        )
        sample_text = ""
        for i, row in enumerate(sample_data[:3]):
            sample_text += f"\nRow {i + 1}: {json.dumps(row, default=str)}"

        user_message = (
            f"Entity type: {entity_type}\n\n"
            f"SOURCE columns:\n{json.dumps(source_columns)}\n\n"
            f"TARGET schema:\n{schema_desc}\n\n"
            f"Sample data:{sample_text}\n\n"
            f"Return the JSON mapping."
        )

        try:
            raw = self.llm.chat_json(COLUMN_MAPPING_SYSTEM_PROMPT, user_message)
            mapping = self._parse_json(raw)
            if mapping and isinstance(mapping, dict):
                return self._validate_mapping(mapping, source_columns, target_schema)
        except Exception as e:
            logger.warning(f"LLM column mapping failed, falling back to fuzzy: {e}")

        return self._fuzzy_fallback(source_columns, target_schema)

    def detect_entity_type(self, source_columns, sample_data):
        sample_text = ""
        for i, row in enumerate(sample_data[:3]):
            sample_text += f"\nRow {i + 1}: {json.dumps(row, default=str)}"

        user_message = (
            f"Columns: {json.dumps(source_columns)}\n\n"
            f"Sample data:{sample_text}\n\n"
            f"What entity type is this?"
        )

        try:
            raw = self.llm.chat_json(ENTITY_DETECT_SYSTEM_PROMPT, user_message)
            result = self._parse_json(raw)
            if result and isinstance(result, dict):
                return result.get('entity_type', 'EMPLOYEE_TRANSACTION')
        except Exception as e:
            logger.warning(f"LLM entity detection failed: {e}")

        return 'EMPLOYEE_TRANSACTION'

    # ── helpers ──────────────────────────────────────────────────────

    def _parse_json(self, raw: str) -> dict | None:
        """Extract JSON from LLM response, stripping markdown fences if present."""
        raw = raw.strip()
        # Remove markdown code fences
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw)
        if match:
            raw = match.group(1)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to find first { ... } block
            match = re.search(r'\{[\s\S]*\}', raw)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return None

    def _validate_mapping(self, mapping, source_columns, target_schema):
        """Ensure mapping values are valid target fields."""
        valid_targets = set(target_schema.keys())
        result = {}
        for src_col in source_columns:
            target = mapping.get(src_col)
            if target and target in valid_targets:
                result[src_col] = target
            else:
                result[src_col] = None
        return result

    def _fuzzy_fallback(self, source_columns, target_schema):
        """Fallback: match columns by string similarity."""
        target_fields = list(target_schema.keys())
        mapping = {}
        used = set()

        for src in source_columns:
            best_score = 0
            best_target = None
            src_norm = src.lower().replace(' ', '_').replace('-', '_')

            for tgt in target_fields:
                if tgt in used:
                    continue
                score = SequenceMatcher(None, src_norm, tgt.lower()).ratio()
                if score > best_score:
                    best_score = score
                    best_target = tgt

            if best_score >= 0.6 and best_target:
                mapping[src] = best_target
                used.add(best_target)
            else:
                mapping[src] = None

        return mapping
