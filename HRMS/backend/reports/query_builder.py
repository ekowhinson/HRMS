"""Core query engine for the ad-hoc report builder."""

import logging
from django.apps import apps
from django.db.models import Count, Sum, Avg, Min, Max, Q
from django.db.models.fields.related import ForeignKey, ManyToManyField

logger = logging.getLogger('hrms')


class ReportQueryBuilder:
    """Build and execute Django ORM queries from report definitions."""

    ALLOWED_MODELS = {
        'employees.employee', 'employees.employeebankaccount',
        'payroll.payrollrun', 'payroll.payrollitem', 'payroll.employeesalary',
        'leave.leaverequest', 'leave.leavebalance',
        'benefits.loanaccount', 'benefits.custombenefitclaim',
        'finance.journalentry', 'finance.journalline', 'finance.account',
        'finance.vendor', 'finance.vendorinvoice', 'finance.customer',
        'finance.customerinvoice', 'finance.budget', 'finance.payment',
        'procurement.purchaserequisition', 'procurement.purchaseorder',
        'procurement.goodsreceiptnote', 'procurement.contract',
        'inventory.item', 'inventory.stockentry', 'inventory.stockledger',
        'inventory.asset', 'inventory.assetdepreciation',
        'projects.project', 'projects.timesheet',
        'performance.appraisal',
        'recruitment.vacancy', 'recruitment.applicant',
        'discipline.disciplinarycase',
    }

    ALLOWED_OPERATORS = {
        '=': 'exact',
        '!=': '__exclude__',  # special handling
        '>': 'gt',
        '<': 'lt',
        '>=': 'gte',
        '<=': 'lte',
        'IN': 'in',
        'LIKE': 'icontains',
        'BETWEEN': 'range',
        'IS_NULL': '__isnull_true__',
        'IS_NOT_NULL': '__isnull_false__',
        'STARTS_WITH': 'istartswith',
        'ENDS_WITH': 'iendswith',
    }

    ALLOWED_AGGREGATIONS = {
        'COUNT': Count,
        'SUM': Sum,
        'AVG': Avg,
        'MIN': Min,
        'MAX': Max,
    }

    def __init__(self, report_definition, user=None):
        self.definition = report_definition
        self.user = user
        self.model = self._resolve_model(report_definition.data_source)

    def _resolve_model(self, data_source):
        """Validate data source against whitelist and return model class."""
        if data_source.lower() not in self.ALLOWED_MODELS:
            raise ValueError(f"Data source '{data_source}' is not allowed")
        app_label, model_name = data_source.split('.')
        return apps.get_model(app_label, model_name)

    def _apply_filters(self, qs, filters):
        """Build Q objects from filter list."""
        for f in filters:
            field = f.get('field', '')
            operator = f.get('operator', '=')
            value = f.get('value')

            if operator not in self.ALLOWED_OPERATORS:
                continue

            lookup = self.ALLOWED_OPERATORS[operator]

            if lookup == '__exclude__':
                qs = qs.exclude(**{f'{field}__exact': value})
            elif lookup == '__isnull_true__':
                qs = qs.filter(**{f'{field}__isnull': True})
            elif lookup == '__isnull_false__':
                qs = qs.filter(**{f'{field}__isnull': False})
            else:
                qs = qs.filter(**{f'{field}__{lookup}': value})

        return qs

    def _apply_grouping(self, qs, group_by, aggregations):
        """Apply GROUP BY with aggregations."""
        if not group_by:
            return qs

        qs = qs.values(*group_by)

        for agg in aggregations:
            field = agg.get('field')
            func_name = agg.get('function', 'COUNT')
            label = agg.get('label', f'{func_name.lower()}_{field}')

            agg_func = self.ALLOWED_AGGREGATIONS.get(func_name)
            if agg_func and field:
                qs = qs.annotate(**{label: agg_func(field)})

        return qs

    def _apply_ordering(self, qs, ordering):
        """Apply ORDER BY."""
        if ordering:
            qs = qs.order_by(*ordering)
        return qs

    def build_queryset(self):
        """Compose the full query."""
        qs = self.model.objects.all()

        # Apply filters
        filters = self.definition.filters
        if filters:
            qs = self._apply_filters(qs, filters)

        # Apply grouping and aggregations
        group_by = self.definition.group_by
        aggregations = self.definition.aggregations
        if group_by:
            qs = self._apply_grouping(qs, group_by, aggregations)
        else:
            # Select specific columns
            columns = self.definition.columns
            if columns:
                fields = [c.get('field') for c in columns if c.get('field')]
                if fields:
                    qs = qs.values(*fields)

        # Apply ordering
        ordering = self.definition.ordering
        if ordering:
            qs = self._apply_ordering(qs, ordering)

        return qs

    def execute(self, page=1, page_size=50):
        """Run the query with pagination."""
        import time
        start = time.monotonic()

        qs = self.build_queryset()
        total = qs.count()

        offset = (page - 1) * page_size
        data = list(qs[offset:offset + page_size])

        execution_time_ms = round((time.monotonic() - start) * 1000)

        return {
            'data': data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'execution_time_ms': execution_time_ms,
        }
