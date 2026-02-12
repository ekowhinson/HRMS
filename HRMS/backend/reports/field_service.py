"""Field enumeration service for the report builder."""

from django.apps import apps
from django.db import models


class FieldEnumerationService:
    """Enumerate available fields for report builder data sources."""

    MAX_DEPTH = 3

    FIELD_TYPE_MAP = {
        models.CharField: 'string',
        models.TextField: 'string',
        models.SlugField: 'string',
        models.EmailField: 'string',
        models.URLField: 'string',
        models.IntegerField: 'integer',
        models.SmallIntegerField: 'integer',
        models.BigIntegerField: 'integer',
        models.PositiveIntegerField: 'integer',
        models.PositiveSmallIntegerField: 'integer',
        models.FloatField: 'float',
        models.DecimalField: 'decimal',
        models.BooleanField: 'boolean',
        models.DateField: 'date',
        models.DateTimeField: 'datetime',
        models.TimeField: 'time',
        models.UUIDField: 'uuid',
        models.JSONField: 'json',
    }

    DATA_SOURCE_META = {
        'employees.employee': {'label': 'Employees', 'description': 'Employee master data', 'icon': 'users'},
        'payroll.payrollrun': {'label': 'Payroll Runs', 'description': 'Payroll processing runs', 'icon': 'dollar-sign'},
        'payroll.payrollitem': {'label': 'Payroll Items', 'description': 'Individual payroll line items', 'icon': 'dollar-sign'},
        'payroll.employeesalary': {'label': 'Employee Salaries', 'description': 'Employee salary records', 'icon': 'dollar-sign'},
        'leave.leaverequest': {'label': 'Leave Requests', 'description': 'Employee leave applications', 'icon': 'calendar'},
        'leave.leavebalance': {'label': 'Leave Balances', 'description': 'Leave balance records', 'icon': 'calendar'},
        'benefits.loanaccount': {'label': 'Loan Accounts', 'description': 'Employee loan records', 'icon': 'credit-card'},
        'benefits.custombenefitclaim': {'label': 'Benefit Claims', 'description': 'Custom benefit claims', 'icon': 'gift'},
        'finance.journalentry': {'label': 'Journal Entries', 'description': 'GL journal entries', 'icon': 'book'},
        'finance.journalline': {'label': 'Journal Lines', 'description': 'Journal entry line items', 'icon': 'book'},
        'finance.account': {'label': 'Chart of Accounts', 'description': 'GL accounts', 'icon': 'list'},
        'finance.vendor': {'label': 'Vendors', 'description': 'Vendor master data', 'icon': 'truck'},
        'finance.vendorinvoice': {'label': 'Vendor Invoices', 'description': 'AP invoices', 'icon': 'file-text'},
        'finance.customer': {'label': 'Customers', 'description': 'Customer master data', 'icon': 'briefcase'},
        'finance.customerinvoice': {'label': 'Customer Invoices', 'description': 'AR invoices', 'icon': 'file-text'},
        'finance.budget': {'label': 'Budgets', 'description': 'Budget records', 'icon': 'pie-chart'},
        'finance.payment': {'label': 'Payments', 'description': 'Payment records', 'icon': 'credit-card'},
        'procurement.purchaserequisition': {'label': 'Purchase Requisitions', 'description': 'Purchase requests', 'icon': 'shopping-cart'},
        'procurement.purchaseorder': {'label': 'Purchase Orders', 'description': 'Purchase orders', 'icon': 'shopping-cart'},
        'procurement.goodsreceiptnote': {'label': 'Goods Receipts', 'description': 'Goods receipt notes', 'icon': 'package'},
        'procurement.contract': {'label': 'Contracts', 'description': 'Vendor contracts', 'icon': 'file'},
        'inventory.item': {'label': 'Items', 'description': 'Item master', 'icon': 'box'},
        'inventory.stockentry': {'label': 'Stock Entries', 'description': 'Stock movements', 'icon': 'archive'},
        'inventory.stockledger': {'label': 'Stock Ledger', 'description': 'Stock balances', 'icon': 'archive'},
        'inventory.asset': {'label': 'Assets', 'description': 'Fixed assets', 'icon': 'monitor'},
        'inventory.assetdepreciation': {'label': 'Asset Depreciation', 'description': 'Depreciation records', 'icon': 'trending-down'},
        'projects.project': {'label': 'Projects', 'description': 'Project records', 'icon': 'folder'},
        'projects.timesheet': {'label': 'Timesheets', 'description': 'Time entries', 'icon': 'clock'},
        'performance.appraisal': {'label': 'Appraisals', 'description': 'Performance appraisals', 'icon': 'star'},
        'recruitment.vacancy': {'label': 'Vacancies', 'description': 'Job vacancies', 'icon': 'briefcase'},
        'recruitment.applicant': {'label': 'Applicants', 'description': 'Job applicants', 'icon': 'user-plus'},
        'discipline.disciplinarycase': {'label': 'Disciplinary Cases', 'description': 'Discipline records', 'icon': 'alert-triangle'},
    }

    @classmethod
    def get_all_data_sources(cls):
        """Return list of available data sources."""
        from .query_builder import ReportQueryBuilder
        sources = []
        for key in ReportQueryBuilder.ALLOWED_MODELS:
            meta = cls.DATA_SOURCE_META.get(key, {})
            sources.append({
                'key': key,
                'label': meta.get('label', key),
                'description': meta.get('description', ''),
                'icon': meta.get('icon', 'database'),
            })
        return sorted(sources, key=lambda x: x['label'])

    @classmethod
    def get_fields_for_model(cls, data_source, depth=0):
        """Return enumerated fields for a model."""
        from .query_builder import ReportQueryBuilder
        if data_source.lower() not in ReportQueryBuilder.ALLOWED_MODELS:
            raise ValueError(f"Data source '{data_source}' is not allowed")

        app_label, model_name = data_source.split('.')
        model = apps.get_model(app_label, model_name)

        return cls._enumerate_fields(model, prefix='', depth=depth)

    @classmethod
    def _enumerate_fields(cls, model, prefix='', depth=0):
        """Recursively enumerate model fields."""
        fields = []
        skip_fields = {'id', 'tenant', 'tenant_id', 'is_deleted', 'created_by', 'updated_by'}

        for field in model._meta.get_fields():
            if field.name in skip_fields:
                continue

            path = f"{prefix}{field.name}" if prefix else field.name

            if isinstance(field, (models.ForeignKey, models.OneToOneField)):
                fields.append({
                    'path': f"{path}_id" if not prefix else f"{path}_id",
                    'type': 'uuid',
                    'label': cls._make_label(path) + ' ID',
                    'choices': None,
                    'is_relation': True,
                    'related_model': f"{field.related_model._meta.app_label}.{field.related_model._meta.model_name}",
                })
                # Recurse into related model
                if depth < cls.MAX_DEPTH:
                    related_fields = cls._enumerate_fields(
                        field.related_model,
                        prefix=f"{path}__",
                        depth=depth + 1,
                    )
                    fields.extend(related_fields)
            elif isinstance(field, models.ManyToManyField):
                continue  # Skip M2M in report builder
            elif hasattr(field, 'get_internal_type'):
                field_type = cls._get_field_type(field)
                choices = None
                if hasattr(field, 'choices') and field.choices:
                    choices = [{'value': c[0], 'label': c[1]} for c in field.choices]
                fields.append({
                    'path': path,
                    'type': field_type,
                    'label': cls._make_label(path),
                    'choices': choices,
                    'is_relation': False,
                    'related_model': None,
                })

        return fields

    @classmethod
    def _get_field_type(cls, field):
        """Map Django field to report builder field type."""
        for field_class, type_name in cls.FIELD_TYPE_MAP.items():
            if isinstance(field, field_class):
                return type_name
        return 'string'

    @classmethod
    def _make_label(cls, path):
        """Convert field path to human-readable label."""
        parts = path.replace('__', ' > ').replace('_', ' ').title()
        return parts

    @classmethod
    def get_operators_for_type(cls, field_type):
        """Return applicable operators for a field type."""
        common = ['=', '!=', 'IS_NULL', 'IS_NOT_NULL']
        numeric = ['>', '<', '>=', '<=', 'IN', 'BETWEEN']
        string = ['LIKE', 'STARTS_WITH', 'ENDS_WITH', 'IN']
        date = ['>', '<', '>=', '<=', 'BETWEEN']

        type_operators = {
            'string': common + string,
            'integer': common + numeric,
            'decimal': common + numeric,
            'float': common + numeric,
            'date': common + date,
            'datetime': common + date,
            'boolean': ['=', '!='],
            'uuid': ['=', '!=', 'IN', 'IS_NULL', 'IS_NOT_NULL'],
        }
        return type_operators.get(field_type, common)
