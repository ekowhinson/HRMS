"""
Tests for the assistant app — import pipeline.

Organised into:
  1. Unit tests for base helpers (to_decimal, to_date, to_bool, to_str)
  2. Unit tests for ValidationResult / MatchResult dataclasses
  3. Unit tests for EntityCreatorRegistry
  4. Unit tests for OllamaColumnMapper (fuzzy fallback + JSON parsing)
  5. Unit tests for ImportPreviewGenerator (mocked ORM + pandas)
  6. Unit tests for ImportExecutor (mocked ORM + creators)
  7. Unit tests for entity validators (PayComponent, Bank)
  8. Integration-style model tests (ImportSession lifecycle)
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import Mock, MagicMock, patch, PropertyMock

from django.test import TestCase

from assistant.import_pipeline.interfaces import ValidationResult, MatchResult
from assistant.import_pipeline.registry import EntityCreatorRegistry
from assistant.import_pipeline.creators.base import to_decimal, to_date, to_bool, to_str


# ═══════════════════════════════════════════════════════════════════════════
# 1. Base helper tests
# ═══════════════════════════════════════════════════════════════════════════

class ToDecimalTest(TestCase):
    def test_valid_int(self):
        self.assertEqual(to_decimal(100), Decimal('100'))

    def test_valid_float_string(self):
        self.assertEqual(to_decimal('123.45'), Decimal('123.45'))

    def test_none_returns_default(self):
        self.assertIsNone(to_decimal(None))

    def test_empty_string_returns_default(self):
        self.assertIsNone(to_decimal(''))

    def test_custom_default(self):
        self.assertEqual(to_decimal('bad', default=Decimal('0')), Decimal('0'))

    def test_garbage_returns_default(self):
        self.assertIsNone(to_decimal('not-a-number'))


class ToDateTest(TestCase):
    def test_iso_format(self):
        self.assertEqual(to_date('2025-01-15'), date(2025, 1, 15))

    def test_dd_mm_yyyy_slash(self):
        self.assertEqual(to_date('15/01/2025'), date(2025, 1, 15))

    def test_mm_dd_yyyy_slash(self):
        self.assertEqual(to_date('01/15/2025'), date(2025, 1, 15))

    def test_date_passthrough(self):
        d = date(2025, 6, 1)
        self.assertIs(to_date(d), d)

    def test_datetime_to_date(self):
        dt = datetime(2025, 6, 1, 12, 30)
        self.assertEqual(to_date(dt), date(2025, 6, 1))

    def test_none_returns_default(self):
        self.assertIsNone(to_date(None))

    def test_bad_string_returns_default(self):
        self.assertIsNone(to_date('not-a-date'))


class ToBoolTest(TestCase):
    def test_true_values(self):
        for val in ('true', 'True', '1', 'yes', 'y', 'Y'):
            self.assertTrue(to_bool(val), f'{val!r} should be True')

    def test_false_values(self):
        for val in ('false', '0', 'no', 'n', 'random'):
            self.assertFalse(to_bool(val), f'{val!r} should be False')

    def test_bool_passthrough(self):
        self.assertTrue(to_bool(True))
        self.assertFalse(to_bool(False))

    def test_none_returns_default(self):
        self.assertFalse(to_bool(None))
        self.assertTrue(to_bool(None, default=True))


class ToStrTest(TestCase):
    def test_normal_string(self):
        self.assertEqual(to_str('  hello  '), 'hello')

    def test_number_to_string(self):
        self.assertEqual(to_str(42), '42')

    def test_none_returns_default(self):
        self.assertEqual(to_str(None), '')
        self.assertEqual(to_str(None, default='N/A'), 'N/A')


# ═══════════════════════════════════════════════════════════════════════════
# 2. Dataclass tests
# ═══════════════════════════════════════════════════════════════════════════

class ValidationResultTest(TestCase):
    def test_valid_when_no_errors(self):
        vr = ValidationResult()
        self.assertTrue(vr.is_valid)

    def test_invalid_when_errors(self):
        vr = ValidationResult(errors=['missing field'])
        self.assertFalse(vr.is_valid)

    def test_valid_with_warnings_only(self):
        vr = ValidationResult(warnings=['check value'])
        self.assertTrue(vr.is_valid)


class MatchResultTest(TestCase):
    def test_default_is_empty(self):
        mr = MatchResult()
        self.assertIsNone(mr.existing_record)
        self.assertIsNone(mr.changes)

    def test_with_record(self):
        record = Mock(pk=uuid.uuid4())
        mr = MatchResult(existing_record=record, changes={'name': {'old': 'A', 'new': 'B'}})
        self.assertIsNotNone(mr.existing_record)
        self.assertIn('name', mr.changes)


# ═══════════════════════════════════════════════════════════════════════════
# 3. Registry tests
# ═══════════════════════════════════════════════════════════════════════════

class EntityCreatorRegistryTest(TestCase):
    def setUp(self):
        self.registry = EntityCreatorRegistry()
        self.mock_creator = Mock()
        self.mock_validator = Mock()
        self.mock_matcher = Mock()

    def test_register_and_get_creator(self):
        self.registry.register('TEST', self.mock_creator)
        self.assertIs(self.registry.get_creator('TEST'), self.mock_creator)

    def test_get_creator_unknown_raises(self):
        with self.assertRaises(ValueError):
            self.registry.get_creator('UNKNOWN')

    def test_validator_optional(self):
        self.registry.register('TEST', self.mock_creator)
        self.assertIsNone(self.registry.get_validator('TEST'))

    def test_matcher_optional(self):
        self.registry.register('TEST', self.mock_creator)
        self.assertIsNone(self.registry.get_matcher('TEST'))

    def test_register_with_all_components(self):
        self.registry.register(
            'TEST', self.mock_creator,
            validator=self.mock_validator,
            matcher=self.mock_matcher,
        )
        self.assertIs(self.registry.get_validator('TEST'), self.mock_validator)
        self.assertIs(self.registry.get_matcher('TEST'), self.mock_matcher)

    def test_supported_types(self):
        self.registry.register('AAA', Mock())
        self.registry.register('BBB', Mock())
        types = self.registry.supported_types()
        self.assertIn('AAA', types)
        self.assertIn('BBB', types)
        self.assertEqual(len(types), 2)

    def test_get_target_schema_delegates(self):
        self.mock_creator.get_target_schema.return_value = {'code': 'desc'}
        self.registry.register('TEST', self.mock_creator)
        schema = self.registry.get_target_schema('TEST')
        self.assertEqual(schema, {'code': 'desc'})


# ═══════════════════════════════════════════════════════════════════════════
# 4. Column mapper tests (fuzzy fallback + JSON parsing)
# ═══════════════════════════════════════════════════════════════════════════

class OllamaColumnMapperTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.column_mapper import OllamaColumnMapper
        self.mock_llm = Mock()
        self.mapper = OllamaColumnMapper(llm_provider=self.mock_llm)

    def test_parse_json_clean(self):
        raw = '{"col_a": "field_a", "col_b": null}'
        result = self.mapper._parse_json(raw)
        self.assertEqual(result, {'col_a': 'field_a', 'col_b': None})

    def test_parse_json_with_fences(self):
        raw = '```json\n{"col_a": "field_a"}\n```'
        result = self.mapper._parse_json(raw)
        self.assertEqual(result, {'col_a': 'field_a'})

    def test_parse_json_with_leading_text(self):
        raw = 'Here is the mapping:\n{"col_a": "field_a"}'
        result = self.mapper._parse_json(raw)
        self.assertEqual(result, {'col_a': 'field_a'})

    def test_parse_json_garbage_returns_none(self):
        result = self.mapper._parse_json('not json at all')
        self.assertIsNone(result)

    def test_validate_mapping_strips_invalid_targets(self):
        mapping = {'A': 'code', 'B': 'INVALID', 'C': 'name'}
        source_cols = ['A', 'B', 'C']
        schema = {'code': 'desc', 'name': 'desc'}

        result = self.mapper._validate_mapping(mapping, source_cols, schema)
        self.assertEqual(result['A'], 'code')
        self.assertIsNone(result['B'])
        self.assertEqual(result['C'], 'name')

    def test_validate_mapping_includes_missing_source_cols(self):
        mapping = {'A': 'code'}
        source_cols = ['A', 'B']
        schema = {'code': 'desc'}

        result = self.mapper._validate_mapping(mapping, source_cols, schema)
        self.assertEqual(result['A'], 'code')
        self.assertIsNone(result['B'])

    def test_fuzzy_fallback_matches_similar_names(self):
        source_cols = ['employee_number', 'component_code', 'random_col']
        schema = {
            'employee_number': 'Employee ID',
            'component_code': 'Pay component code',
            'effective_from': 'Start date',
        }
        result = self.mapper._fuzzy_fallback(source_cols, schema)
        self.assertEqual(result['employee_number'], 'employee_number')
        self.assertEqual(result['component_code'], 'component_code')
        self.assertIsNone(result['random_col'])

    def test_fuzzy_fallback_normalizes_spaces_and_hyphens(self):
        source_cols = ['Employee Number']
        schema = {'employee_number': 'EmpID'}
        result = self.mapper._fuzzy_fallback(source_cols, schema)
        self.assertEqual(result['Employee Number'], 'employee_number')

    def test_map_columns_uses_llm_on_success(self):
        self.mock_llm.chat_json.return_value = '{"Col A": "code", "Col B": "name"}'
        result = self.mapper.map_columns(
            source_columns=['Col A', 'Col B'],
            sample_data=[{'Col A': 'X', 'Col B': 'Y'}],
            target_schema={'code': 'desc', 'name': 'desc'},
            entity_type='PAY_COMPONENT',
        )
        self.assertEqual(result['Col A'], 'code')
        self.assertEqual(result['Col B'], 'name')
        self.mock_llm.chat_json.assert_called_once()

    def test_map_columns_falls_back_on_llm_error(self):
        self.mock_llm.chat_json.side_effect = Exception('LLM down')
        result = self.mapper.map_columns(
            source_columns=['code', 'name'],
            sample_data=[{'code': 'X', 'name': 'Y'}],
            target_schema={'code': 'desc', 'name': 'desc'},
            entity_type='PAY_COMPONENT',
        )
        # Fuzzy fallback should still produce a mapping
        self.assertEqual(result['code'], 'code')
        self.assertEqual(result['name'], 'name')

    def test_detect_entity_type_uses_llm(self):
        self.mock_llm.chat_json.return_value = '{"entity_type": "BANK", "confidence": 0.9}'
        result = self.mapper.detect_entity_type(
            source_columns=['code', 'name', 'swift_code'],
            sample_data=[{'code': 'GCB', 'name': 'GCB Bank', 'swift_code': 'GCBLGHAC'}],
        )
        self.assertEqual(result, 'BANK')

    def test_detect_entity_type_defaults_on_error(self):
        self.mock_llm.chat_json.side_effect = Exception('fail')
        result = self.mapper.detect_entity_type(
            source_columns=['x'], sample_data=[{'x': 1}],
        )
        self.assertEqual(result, 'EMPLOYEE_TRANSACTION')


# ═══════════════════════════════════════════════════════════════════════════
# 5. Entity validator tests
# ═══════════════════════════════════════════════════════════════════════════

class PayComponentValidatorTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.creators.pay_component import PayComponentValidator
        self.validator = PayComponentValidator()

    def test_valid_row(self):
        result = self.validator.validate_row({'code': 'BASIC', 'name': 'Basic Salary'}, 1)
        self.assertTrue(result.is_valid)

    def test_missing_code(self):
        result = self.validator.validate_row({'name': 'Basic'}, 1)
        self.assertFalse(result.is_valid)
        self.assertTrue(any('code' in e for e in result.errors))

    def test_missing_name(self):
        result = self.validator.validate_row({'code': 'BASIC'}, 1)
        self.assertFalse(result.is_valid)
        self.assertTrue(any('name' in e for e in result.errors))

    def test_missing_both(self):
        result = self.validator.validate_row({}, 1)
        self.assertFalse(result.is_valid)
        self.assertEqual(len(result.errors), 2)


class BankValidatorTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.creators.bank import BankValidator
        self.validator = BankValidator()

    def test_valid_row(self):
        result = self.validator.validate_row({'code': 'GCB', 'name': 'GCB Bank'}, 1)
        self.assertTrue(result.is_valid)

    def test_missing_code(self):
        result = self.validator.validate_row({'name': 'GCB Bank'}, 1)
        self.assertFalse(result.is_valid)

    def test_missing_name(self):
        result = self.validator.validate_row({'code': 'GCB'}, 1)
        self.assertFalse(result.is_valid)


# ═══════════════════════════════════════════════════════════════════════════
# 6. Preview generator tests (fully mocked)
# ═══════════════════════════════════════════════════════════════════════════

class ImportPreviewGeneratorTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.preview_generator import ImportPreviewGenerator
        self.generator = ImportPreviewGenerator()

    def _make_session(self, column_mapping, confirmed_mapping=None, import_params=None):
        session = Mock()
        session.column_mapping = column_mapping
        session.confirmed_mapping = confirmed_mapping
        session.import_params = import_params
        session.entity_type = 'PAY_COMPONENT'
        session.preview_rows.all.return_value.delete.return_value = None
        session.attachment = Mock()
        session.attachment.file_name = 'test.csv'
        session.attachment.file_data = b'code,name\nBASIC,Basic Salary\nHOUSING,Housing'
        return session

    def _make_registry(self, validator_result=None, match_result=None):
        registry = Mock()
        creator = Mock()
        creator.get_target_schema.return_value = {'code': 'desc', 'name': 'desc'}
        registry.get_creator.return_value = creator

        validator = Mock()
        if validator_result is None:
            validator_result = ValidationResult()
        validator.validate_row.return_value = validator_result
        registry.get_validator.return_value = validator

        matcher = Mock()
        if match_result is None:
            match_result = MatchResult()
        matcher.find_existing.return_value = match_result
        registry.get_matcher.return_value = matcher

        return registry

    @patch('assistant.import_pipeline.preview_generator.ImportPreviewRow')
    def test_generate_all_creates(self, mock_preview_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_preview_cls.objects = Mock()

        session = self._make_session({'code': 'code', 'name': 'name'})
        registry = self._make_registry()  # No match → all CREATE

        summary = self.generator.generate(session, registry)

        self.assertEqual(summary['total'], 2)
        self.assertEqual(summary['to_create'], 2)
        self.assertEqual(summary['to_update'], 0)
        self.assertEqual(summary['errors'], 0)
        session.save.assert_called()

    @patch('assistant.import_pipeline.preview_generator.ImportPreviewRow')
    def test_generate_with_validation_errors(self, mock_preview_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_preview_cls.objects = Mock()

        session = self._make_session({'code': 'code', 'name': 'name'})
        bad_validation = ValidationResult(errors=['code is required'])
        registry = self._make_registry(validator_result=bad_validation)

        summary = self.generator.generate(session, registry)

        self.assertEqual(summary['total'], 2)
        self.assertEqual(summary['errors'], 2)
        self.assertEqual(summary['to_create'], 0)

    @patch('assistant.import_pipeline.preview_generator.ImportPreviewRow')
    def test_generate_uses_confirmed_mapping(self, mock_preview_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_preview_cls.objects = Mock()

        # Original mapping maps code→code, name→name
        # Confirmed mapping swaps to code→name, name→code
        session = self._make_session(
            column_mapping={'code': 'code', 'name': 'name'},
            confirmed_mapping={'code': 'name', 'name': 'code'},
        )
        registry = self._make_registry()

        summary = self.generator.generate(session, registry)

        # confirmed_mapping takes priority
        self.assertEqual(summary['total'], 2)

    @patch('assistant.import_pipeline.preview_generator.ImportPreviewRow')
    def test_generate_with_upserts(self, mock_preview_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_preview_cls.objects = Mock()

        existing = Mock(pk=uuid.uuid4())
        match = MatchResult(existing_record=existing, changes={'name': {'old': 'Old', 'new': 'New'}})

        session = self._make_session({'code': 'code', 'name': 'name'})
        registry = self._make_registry(match_result=match)

        summary = self.generator.generate(session, registry)

        self.assertEqual(summary['to_update'], 2)
        self.assertEqual(summary['to_create'], 0)

    def test_generate_no_attachment_raises(self):
        session = Mock()
        session.attachment = None
        registry = Mock()

        with self.assertRaises(ValueError):
            self.generator.generate(session, registry)

    def test_generate_no_mapping_raises(self):
        session = Mock()
        session.attachment = Mock()
        session.attachment.file_name = 'test.csv'
        session.attachment.file_data = b'a,b\n1,2'
        session.column_mapping = None
        session.confirmed_mapping = None
        session.preview_rows.all.return_value.delete.return_value = None
        registry = Mock()

        with self.assertRaises(ValueError):
            self.generator.generate(session, registry)


# ═══════════════════════════════════════════════════════════════════════════
# 7. Import executor tests (fully mocked)
# ═══════════════════════════════════════════════════════════════════════════

class ImportExecutorTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.import_executor import ImportExecutor
        self.executor = ImportExecutor()

    def _make_preview_row(self, action='CREATE', row_number=1, parsed_data=None):
        row = Mock()
        row.action = action
        row.row_number = row_number
        row.parsed_data = parsed_data or {'code': 'TST', 'name': 'Test'}
        row.existing_record_id = None
        return row

    def _make_session(self, rows, rollback_on_error=False):
        session = Mock()
        session.entity_type = 'PAY_COMPONENT'
        session.import_params = {'rollback_on_error': rollback_on_error}
        session.user = Mock()

        # Mock the queryset chain
        qs = MagicMock()
        qs.exclude.return_value = qs
        qs.order_by.return_value = qs
        qs.count.return_value = len(rows)
        qs.iterator.return_value = iter(rows)
        session.preview_rows = qs

        return session

    def _make_registry(self, create_record=None, create_error=None):
        registry = Mock()
        creator = Mock()
        if create_error:
            creator.create.side_effect = create_error
        else:
            record = create_record or Mock(pk=uuid.uuid4())
            creator.create.return_value = record
            creator.update.return_value = record
        registry.get_creator.return_value = creator
        return registry

    @patch('assistant.import_pipeline.import_executor.ImportResult')
    @patch('assistant.import_pipeline.import_executor.ImportPreviewRow')
    @patch('assistant.import_pipeline.import_executor.ImportSession')
    def test_execute_creates_successfully(self, mock_session_cls, mock_preview_cls, mock_result_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_session_cls.Status = type('Status', (), {
            'EXECUTING': 'EXECUTING', 'COMPLETED': 'COMPLETED', 'FAILED': 'FAILED',
        })

        rows = [self._make_preview_row(action='CREATE', row_number=i) for i in range(1, 4)]
        session = self._make_session(rows)
        registry = self._make_registry()

        self.executor.execute(session, registry)

        # Session should be marked COMPLETED
        self.assertEqual(session.status, 'COMPLETED')
        self.assertEqual(session.rows_created, 3)
        self.assertEqual(session.rows_errored, 0)
        session.save.assert_called()

    @patch('assistant.import_pipeline.import_executor.ImportResult')
    @patch('assistant.import_pipeline.import_executor.ImportPreviewRow')
    @patch('assistant.import_pipeline.import_executor.ImportSession')
    def test_execute_handles_per_row_errors(self, mock_session_cls, mock_preview_cls, mock_result_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_session_cls.Status = type('Status', (), {
            'EXECUTING': 'EXECUTING', 'COMPLETED': 'COMPLETED', 'FAILED': 'FAILED',
        })

        rows = [self._make_preview_row(action='CREATE', row_number=1)]
        session = self._make_session(rows, rollback_on_error=False)
        registry = self._make_registry(create_error=ValueError('DB constraint'))

        self.executor.execute(session, registry)

        # Session still COMPLETED (per-row mode), but with errors
        self.assertEqual(session.status, 'COMPLETED')
        self.assertEqual(session.rows_errored, 1)
        self.assertEqual(session.rows_created, 0)

    @patch('assistant.import_pipeline.import_executor.ImportResult')
    @patch('assistant.import_pipeline.import_executor.ImportPreviewRow')
    @patch('assistant.import_pipeline.import_executor.ImportSession')
    def test_execute_progress_callback(self, mock_session_cls, mock_preview_cls, mock_result_cls):
        mock_preview_cls.Action = type('Action', (), {
            'CREATE': 'CREATE', 'UPDATE': 'UPDATE', 'SKIP': 'SKIP', 'ERROR': 'ERROR',
        })
        mock_session_cls.Status = type('Status', (), {
            'EXECUTING': 'EXECUTING', 'COMPLETED': 'COMPLETED', 'FAILED': 'FAILED',
        })

        rows = [self._make_preview_row(action='CREATE', row_number=i) for i in range(1, 4)]
        session = self._make_session(rows)
        registry = self._make_registry()
        callback = Mock()

        self.executor.execute(session, registry, progress_callback=callback)

        self.assertEqual(callback.call_count, 3)
        callback.assert_any_call(1, 3)
        callback.assert_any_call(2, 3)
        callback.assert_any_call(3, 3)


# ═══════════════════════════════════════════════════════════════════════════
# 8. Singleton registry integration test
# ═══════════════════════════════════════════════════════════════════════════

class RegistrySingletonTest(TestCase):
    """Verify the module-level registry has all 5 entity types registered."""

    def test_all_entity_types_registered(self):
        from assistant.import_pipeline.registry import import_registry
        from assistant.import_pipeline import creators  # noqa: F401 — triggers registration

        types = import_registry.supported_types()
        expected = {'EMPLOYEE_TRANSACTION', 'EMPLOYEE', 'BANK_ACCOUNT', 'PAY_COMPONENT', 'BANK'}
        self.assertEqual(set(types), expected)

    def test_each_creator_has_schema(self):
        from assistant.import_pipeline.registry import import_registry
        from assistant.import_pipeline import creators  # noqa: F401

        for entity_type in import_registry.supported_types():
            schema = import_registry.get_target_schema(entity_type)
            self.assertIsInstance(schema, dict)
            self.assertTrue(len(schema) > 0, f"{entity_type} schema is empty")

    def test_each_type_has_validator(self):
        from assistant.import_pipeline.registry import import_registry
        from assistant.import_pipeline import creators  # noqa: F401

        for entity_type in import_registry.supported_types():
            validator = import_registry.get_validator(entity_type)
            self.assertIsNotNone(validator, f"{entity_type} has no validator")


# ═══════════════════════════════════════════════════════════════════════════
# 9. Employee transaction validator test
# ═══════════════════════════════════════════════════════════════════════════

class EmployeeTransactionValidatorTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.creators.employee_transaction import (
            EmployeeTransactionValidator,
        )
        self.validator = EmployeeTransactionValidator()

    def test_valid_row_with_code(self):
        result = self.validator.validate_row({
            'employee_number': 'EMP001',
            'component_code': 'BASIC',
        }, 1)
        self.assertTrue(result.is_valid)

    def test_valid_row_with_name(self):
        result = self.validator.validate_row({
            'employee_number': 'EMP001',
            'component_name': 'Basic Salary',
        }, 1)
        self.assertTrue(result.is_valid)

    def test_missing_employee_number(self):
        result = self.validator.validate_row({
            'component_code': 'BASIC',
        }, 1)
        self.assertFalse(result.is_valid)

    def test_missing_component_identifier(self):
        result = self.validator.validate_row({
            'employee_number': 'EMP001',
        }, 1)
        self.assertFalse(result.is_valid)


# ═══════════════════════════════════════════════════════════════════════════
# 10. Employee validator test
# ═══════════════════════════════════════════════════════════════════════════

class EmployeeValidatorTest(TestCase):
    def setUp(self):
        from assistant.import_pipeline.creators.employee import EmployeeValidator
        self.validator = EmployeeValidator()

    def test_valid_row(self):
        result = self.validator.validate_row({
            'employee_number': 'EMP001',
            'first_name': 'John',
            'last_name': 'Doe',
            'department_name': 'IT',
            'position_name': 'Developer',
        }, 1)
        self.assertTrue(result.is_valid)

    def test_missing_employee_number(self):
        result = self.validator.validate_row({
            'first_name': 'John',
            'last_name': 'Doe',
        }, 1)
        self.assertFalse(result.is_valid)

    def test_missing_first_name(self):
        result = self.validator.validate_row({
            'employee_number': 'EMP001',
            'last_name': 'Doe',
        }, 1)
        self.assertFalse(result.is_valid)
