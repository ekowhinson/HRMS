"""
Serializers for payroll app.
"""

from decimal import Decimal
from rest_framework import serializers

from datetime import timedelta

from .models import (
    PayComponent, SalaryStructure, SalaryStructureComponent,
    EmployeeSalary, EmployeeSalaryComponent,
    PayrollPeriod, PayrollRun, PayrollItem, PayrollItemDetail,
    AdHocPayment, TaxBracket, TaxRelief, SSNITRate, EmployeeTransaction,
    OvertimeBonusTaxConfig, Bank, BankBranch, StaffCategory,
    SalaryBand, SalaryLevel, SalaryNotch, PayrollCalendar, PayrollSettings,
    BackpayRequest, BackpayDetail, SalaryUpgradeRequest,
    SalaryIncrementHistory, SalaryIncrementDetail,
    RemovalReasonCategory, PayrollValidation, EmployeePayrollFlag,
)


class PayComponentSerializer(serializers.ModelSerializer):
    """Serializer for PayComponent model."""

    class Meta:
        model = PayComponent
        fields = '__all__'


class PayComponentListSerializer(serializers.ModelSerializer):
    """Light serializer for PayComponent listing with transaction count."""
    transaction_count = serializers.SerializerMethodField()
    component_type_display = serializers.CharField(source='get_component_type_display', read_only=True)
    calculation_type_display = serializers.CharField(source='get_calculation_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = PayComponent
        fields = [
            'id', 'code', 'name', 'short_name', 'description',
            'component_type', 'component_type_display',
            'calculation_type', 'calculation_type_display',
            'category', 'category_display',
            'default_amount', 'percentage_value', 'formula',
            'is_taxable', 'reduces_taxable', 'is_overtime', 'is_bonus',
            'affects_ssnit', 'is_statutory', 'is_recurring',
            'requires_approval', 'approval_threshold',
            'is_active', 'display_order', 'show_on_payslip',
            'transaction_count', 'created_at', 'updated_at'
        ]

    def get_transaction_count(self, obj):
        # Use annotation if available (set in PayComponentViewSet.get_queryset)
        if hasattr(obj, 'active_transaction_count'):
            return obj.active_transaction_count
        return obj.employee_transactions.filter(
            status__in=['PENDING', 'APPROVED', 'ACTIVE']
        ).count()


class PayComponentDetailSerializer(serializers.ModelSerializer):
    """Full serializer for PayComponent create/edit."""
    component_type_display = serializers.CharField(source='get_component_type_display', read_only=True)
    calculation_type_display = serializers.CharField(source='get_calculation_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = PayComponent
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):
        """Validate calculation type has required fields."""
        calc_type = data.get('calculation_type', self.instance.calculation_type if self.instance else None)

        if calc_type == PayComponent.CalculationType.FIXED:
            if not data.get('default_amount') and not (self.instance and self.instance.default_amount):
                raise serializers.ValidationError({
                    'default_amount': 'Fixed amount is required for FIXED calculation type.'
                })

        elif calc_type in [PayComponent.CalculationType.PERCENTAGE_BASIC, PayComponent.CalculationType.PERCENTAGE_GROSS]:
            if not data.get('percentage_value') and not (self.instance and self.instance.percentage_value):
                raise serializers.ValidationError({
                    'percentage_value': 'Percentage value is required for percentage calculation types.'
                })

        elif calc_type == PayComponent.CalculationType.FORMULA:
            if not data.get('formula') and not (self.instance and self.instance.formula):
                raise serializers.ValidationError({
                    'formula': 'Formula is required for FORMULA calculation type.'
                })

        return data


class SalaryStructureComponentSerializer(serializers.ModelSerializer):
    """Serializer for SalaryStructureComponent model."""
    component_name = serializers.CharField(source='pay_component.name', read_only=True)

    class Meta:
        model = SalaryStructureComponent
        fields = '__all__'


class SalaryStructureSerializer(serializers.ModelSerializer):
    """Serializer for SalaryStructure model."""
    components = SalaryStructureComponentSerializer(many=True, read_only=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True)

    class Meta:
        model = SalaryStructure
        fields = '__all__'


class EmployeeSalaryComponentSerializer(serializers.ModelSerializer):
    """Serializer for EmployeeSalaryComponent model."""
    component_name = serializers.CharField(source='pay_component.name', read_only=True)

    class Meta:
        model = EmployeeSalaryComponent
        fields = '__all__'


class EmployeeSalarySerializer(serializers.ModelSerializer):
    """Serializer for EmployeeSalary model."""
    components = EmployeeSalaryComponentSerializer(many=True, read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)

    class Meta:
        model = EmployeeSalary
        fields = '__all__'


class PayrollCalendarSerializer(serializers.ModelSerializer):
    """Serializer for PayrollCalendar model."""
    month_name = serializers.ReadOnlyField()

    class Meta:
        model = PayrollCalendar
        fields = [
            'id', 'year', 'month', 'name', 'month_name',
            'start_date', 'end_date', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PayrollSettingsSerializer(serializers.ModelSerializer):
    """Serializer for PayrollSettings (global payroll configuration)."""
    active_calendar_name = serializers.CharField(source='active_calendar.name', read_only=True)
    active_calendar_year = serializers.IntegerField(source='active_calendar.year', read_only=True)
    active_calendar_month = serializers.IntegerField(source='active_calendar.month', read_only=True)
    active_period_name = serializers.CharField(source='active_period.name', read_only=True)
    active_period_status = serializers.CharField(source='active_period.status', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.get_full_name', read_only=True)

    class Meta:
        model = PayrollSettings
        fields = [
            'id',
            'active_calendar', 'active_calendar_name', 'active_calendar_year', 'active_calendar_month',
            'active_period', 'active_period_name', 'active_period_status',
            'auto_advance_period', 'default_transaction_status',
            'updated_at', 'updated_by', 'updated_by_name'
        ]
        read_only_fields = ['updated_at', 'updated_by', 'updated_by_name']


class SetActivePeriodSerializer(serializers.Serializer):
    """Serializer for setting active period."""
    calendar_id = serializers.UUIDField(required=False, help_text='Calendar ID to set as active')
    period_id = serializers.UUIDField(required=False, help_text='Period ID to set as active')
    year = serializers.IntegerField(required=False, help_text='Year (used with month)')
    month = serializers.IntegerField(required=False, min_value=1, max_value=12, help_text='Month (1-12)')

    def validate(self, data):
        if not any([data.get('calendar_id'), data.get('period_id'), (data.get('year') and data.get('month'))]):
            raise serializers.ValidationError(
                'Provide either calendar_id, period_id, or year+month combination'
            )
        return data


class PayrollPeriodSerializer(serializers.ModelSerializer):
    """Serializer for PayrollPeriod model."""
    calendar_name = serializers.CharField(source='calendar.name', read_only=True)

    class Meta:
        model = PayrollPeriod
        fields = '__all__'


class PayrollItemDetailSerializer(serializers.ModelSerializer):
    """Serializer for PayrollItemDetail model."""
    component_name = serializers.CharField(source='pay_component.name', read_only=True)
    component_type = serializers.CharField(source='pay_component.component_type', read_only=True)

    class Meta:
        model = PayrollItemDetail
        fields = '__all__'


class PayrollItemSerializer(serializers.ModelSerializer):
    """Serializer for PayrollItem model."""
    details = PayrollItemDetailSerializer(many=True, read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    period_name = serializers.CharField(source='payroll_run.payroll_period.name', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, default='')
    position_name = serializers.CharField(source='employee.position.title', read_only=True, default='')
    grade_name = serializers.CharField(source='employee.grade.name', read_only=True, default='')

    class Meta:
        model = PayrollItem
        fields = '__all__'


class MyPayslipSerializer(serializers.ModelSerializer):
    """Serializer for employee self-service payslip view."""
    period_name = serializers.CharField(source='payroll_run.payroll_period.name', read_only=True)
    payment_date = serializers.SerializerMethodField()
    gross_pay = serializers.DecimalField(source='gross_earnings', max_digits=12, decimal_places=2, read_only=True)
    net_pay = serializers.DecimalField(source='net_salary', max_digits=12, decimal_places=2, read_only=True)
    paye_tax = serializers.DecimalField(source='paye', max_digits=12, decimal_places=2, read_only=True)
    allowances = serializers.SerializerMethodField()
    other_deductions = serializers.SerializerMethodField()
    payslip_id = serializers.SerializerMethodField()
    has_payslip = serializers.SerializerMethodField()

    class Meta:
        model = PayrollItem
        fields = [
            'id', 'payslip_id', 'has_payslip', 'period_name', 'payment_date',
            'basic_salary', 'gross_pay', 'net_pay', 'paye_tax',
            'total_deductions', 'ssnit_employee', 'ssnit_employer',
            'allowances', 'other_deductions',
        ]

    def get_payment_date(self, obj):
        return obj.payment_date or obj.payroll_run.payroll_period.end_date

    def get_allowances(self, obj):
        return [
            {'name': d.pay_component.name, 'amount': float(d.amount)}
            for d in obj.details.filter(pay_component__component_type='EARNING')
            if d.pay_component.name.upper() != 'BASIC SALARY'
        ]

    def get_other_deductions(self, obj):
        return [
            {'name': d.pay_component.name, 'amount': float(d.amount)}
            for d in obj.details.filter(pay_component__component_type='DEDUCTION')
        ]

    def get_payslip_id(self, obj):
        payslip = getattr(obj, 'payslip', None)
        return str(payslip.id) if payslip else None

    def get_has_payslip(self, obj):
        return hasattr(obj, 'payslip') and obj.payslip is not None


class PayrollRunSerializer(serializers.ModelSerializer):
    """Serializer for PayrollRun model."""
    period_name = serializers.CharField(source='payroll_period.name', read_only=True)
    period_status = serializers.CharField(source='payroll_period.status', read_only=True)
    error_count = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = '__all__'
        read_only_fields = [
            'run_number', 'total_employees', 'total_gross', 'total_deductions',
            'total_net', 'total_employer_cost', 'total_paye',
            'total_ssnit_employee', 'total_ssnit_employer', 'total_tier2_employer'
        ]

    def get_error_count(self, obj):
        return obj.items.filter(status='ERROR').count()


class AdHocPaymentSerializer(serializers.ModelSerializer):
    """Serializer for AdHocPayment model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    component_name = serializers.CharField(source='pay_component.name', read_only=True)

    class Meta:
        model = AdHocPayment
        fields = '__all__'
        read_only_fields = ['status', 'processed_at']


class TaxBracketSerializer(serializers.ModelSerializer):
    """Serializer for TaxBracket model."""

    class Meta:
        model = TaxBracket
        fields = '__all__'


class TaxReliefSerializer(serializers.ModelSerializer):
    """Serializer for TaxRelief model."""

    class Meta:
        model = TaxRelief
        fields = '__all__'


class SSNITRateSerializer(serializers.ModelSerializer):
    """Serializer for SSNITRate model."""

    class Meta:
        model = SSNITRate
        fields = '__all__'


class EmployeeTransactionSerializer(serializers.ModelSerializer):
    """Serializer for EmployeeTransaction with calculated amount preview."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True, allow_null=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, allow_null=True)
    component_code = serializers.CharField(source='pay_component.code', read_only=True)
    component_name = serializers.CharField(source='pay_component.name', read_only=True)
    component_type = serializers.CharField(source='pay_component.component_type', read_only=True)
    override_type_display = serializers.CharField(source='get_override_type_display', read_only=True)
    target_type_display = serializers.CharField(source='get_target_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    payroll_period_name = serializers.CharField(source='payroll_period.name', read_only=True)
    calendar_name = serializers.CharField(source='calendar.name', read_only=True)
    calendar_year = serializers.IntegerField(source='calendar.year', read_only=True)
    calendar_month = serializers.IntegerField(source='calendar.month', read_only=True)
    # Grade/Band fields
    job_grade_name = serializers.CharField(source='job_grade.name', read_only=True, allow_null=True)
    job_grade_code = serializers.CharField(source='job_grade.code', read_only=True, allow_null=True)
    salary_band_name = serializers.CharField(source='salary_band.name', read_only=True, allow_null=True)
    salary_band_code = serializers.CharField(source='salary_band.code', read_only=True, allow_null=True)
    applicable_employee_count = serializers.SerializerMethodField()
    calculated_amount = serializers.SerializerMethodField()
    supporting_document = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeTransaction
        fields = [
            'id', 'reference_number',
            'target_type', 'target_type_display',
            'employee', 'employee_name', 'employee_number', 'department_name',
            'job_grade', 'job_grade_name', 'job_grade_code',
            'salary_band', 'salary_band_name', 'salary_band_code',
            'applicable_employee_count',
            'pay_component', 'component_code', 'component_name', 'component_type',
            'override_type', 'override_type_display',
            'override_amount', 'override_percentage', 'override_formula', 'quantity',
            'is_recurring', 'effective_from', 'effective_to',
            'calendar', 'calendar_name', 'calendar_year', 'calendar_month',
            'payroll_period', 'payroll_period_name',
            'status', 'status_display',
            'approved_by', 'approved_by_name', 'approved_at', 'approval_notes',
            'description', 'supporting_document', 'document_name',
            'calculated_amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'reference_number', 'approved_by', 'approved_at', 'created_at', 'updated_at',
            'document_name'
        ]

    def get_applicable_employee_count(self, obj):
        """Get count of employees this transaction applies to."""
        try:
            return obj.get_applicable_employees().count()
        except Exception:
            return 0

    def get_calculated_amount(self, obj):
        """Calculate the amount based on employee's current salary."""
        try:
            if obj.employee:
                current_salary = obj.employee.salaries.filter(is_current=True).first()
                if current_salary:
                    basic = current_salary.basic_salary or Decimal('0')
                    gross = current_salary.gross_salary or basic
                    return str(obj.calculate_amount(basic, gross))
        except Exception:
            pass
        return None

    def get_supporting_document(self, obj):
        """Return supporting document as data URI."""
        if obj.has_document:
            return obj.get_document_data_uri()
        return None


class EmployeeTransactionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating transactions, supports bulk via employee_ids or grade/band targeting."""
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        help_text="List of employee IDs for bulk creation (only for INDIVIDUAL target type)"
    )
    supporting_document = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = EmployeeTransaction
        fields = [
            'target_type', 'employee', 'employee_ids', 'job_grade', 'salary_band',
            'pay_component',
            'override_type', 'override_amount', 'override_percentage', 'override_formula', 'quantity',
            'is_recurring', 'effective_from', 'effective_to',
            'payroll_period', 'description', 'supporting_document'
        ]

    def validate(self, data):
        """Validate override type has required fields and target fields."""
        override_type = data.get('override_type', EmployeeTransaction.OverrideType.NONE)
        target_type = data.get('target_type', EmployeeTransaction.TargetType.INDIVIDUAL)

        # Validate override type fields
        if override_type == EmployeeTransaction.OverrideType.FIXED:
            if not data.get('override_amount'):
                raise serializers.ValidationError({
                    'override_amount': 'Override amount is required when override type is FIXED.'
                })

        elif override_type == EmployeeTransaction.OverrideType.PERCENTAGE:
            if not data.get('override_percentage'):
                raise serializers.ValidationError({
                    'override_percentage': 'Override percentage is required when override type is PCT.'
                })

        elif override_type == EmployeeTransaction.OverrideType.FORMULA:
            if not data.get('override_formula'):
                raise serializers.ValidationError({
                    'override_formula': 'Override formula is required when override type is FORMULA.'
                })

        # Validate dates
        effective_from = data.get('effective_from')
        effective_to = data.get('effective_to')
        if effective_from and effective_to and effective_to < effective_from:
            raise serializers.ValidationError({
                'effective_to': 'Effective to date must be after effective from date.'
            })

        # Validate target type requirements
        if target_type == EmployeeTransaction.TargetType.INDIVIDUAL:
            if not data.get('employee') and not data.get('employee_ids'):
                raise serializers.ValidationError({
                    'employee': 'Employee or employee_ids is required for individual transactions.'
                })
        elif target_type == EmployeeTransaction.TargetType.GRADE:
            if not data.get('job_grade'):
                raise serializers.ValidationError({
                    'job_grade': 'Job grade is required for grade-based transactions.'
                })
            # Clear employee fields for grade transactions
            data['employee'] = None
            data.pop('employee_ids', None)
        elif target_type == EmployeeTransaction.TargetType.BAND:
            if not data.get('salary_band'):
                raise serializers.ValidationError({
                    'salary_band': 'Salary band is required for band-based transactions.'
                })
            # Clear employee fields for band transactions
            data['employee'] = None
            data.pop('employee_ids', None)

        return data

    def create(self, validated_data):
        """Create single or multiple transactions."""
        employee_ids = validated_data.pop('employee_ids', None)
        supporting_document = validated_data.pop('supporting_document', None)

        # Auto-set payroll_period based on effective_from date
        if not validated_data.get('payroll_period'):
            effective_from = validated_data.get('effective_from')
            if effective_from:
                period = PayrollPeriod.objects.filter(
                    year=effective_from.year,
                    month=effective_from.month,
                    is_supplementary=False,
                ).first()
                if period:
                    validated_data['payroll_period'] = period

        if employee_ids:
            # Bulk creation
            from employees.models import Employee
            transactions = []
            for emp_id in employee_ids:
                try:
                    employee = Employee.objects.get(pk=emp_id)
                    txn_data = {**validated_data, 'employee': employee}
                    txn = EmployeeTransaction(**txn_data)
                    txn.reference_number = EmployeeTransaction.generate_reference_number()
                    if supporting_document:
                        txn.set_document(supporting_document)
                    transactions.append(txn)
                except Employee.DoesNotExist:
                    continue

            created = EmployeeTransaction.objects.bulk_create(transactions, batch_size=1000)
            # Return first one for single object response
            return created[0] if created else None

        # Single creation
        instance = super().create(validated_data)
        if supporting_document:
            instance.set_document(supporting_document)
            instance.save()
        return instance

    def update(self, instance, validated_data):
        """
        Version-on-update: when effective_from or value fields change,
        close out the old record and create a new versioned record.
        """
        validated_data.pop('employee_ids', None)
        supporting_document = validated_data.pop('supporting_document', None)

        new_effective_from = validated_data.get('effective_from')
        value_fields_changed = any(
            k in validated_data for k in [
                'override_type', 'override_amount', 'override_percentage',
                'override_formula', 'pay_component'
            ]
        )

        # Version-on-update if effective_from changed or value fields changed
        if new_effective_from and (new_effective_from != instance.effective_from or value_fields_changed):
            # Close out old record
            instance.effective_to = new_effective_from - timedelta(days=1)
            instance.is_current_version = False
            instance.save(update_fields=['effective_to', 'is_current_version', 'updated_at'])

            # Build new record data from existing instance
            writable_fields = [
                'target_type', 'employee', 'job_grade', 'salary_band',
                'pay_component', 'override_type', 'override_amount',
                'override_percentage', 'override_formula', 'quantity',
                'is_recurring', 'effective_from', 'effective_to',
                'calendar', 'payroll_period', 'status', 'description',
            ]
            new_data = {}
            for field in writable_fields:
                val = getattr(instance, field + '_id', None) if field in [
                    'employee', 'job_grade', 'salary_band', 'pay_component',
                    'calendar', 'payroll_period'
                ] else getattr(instance, field, None)
                if field in ['employee', 'job_grade', 'salary_band', 'pay_component',
                             'calendar', 'payroll_period']:
                    new_data[field + '_id'] = val
                else:
                    new_data[field] = val

            # Apply the validated updates
            for key, val in validated_data.items():
                if key in ['employee', 'job_grade', 'salary_band', 'pay_component',
                           'calendar', 'payroll_period']:
                    new_data[key + '_id'] = val.id if hasattr(val, 'id') else val
                else:
                    new_data[key] = val

            new_data['parent_transaction'] = instance
            new_data['version'] = instance.version + 1
            new_data['is_current_version'] = True
            new_data['effective_to'] = None
            new_data['reference_number'] = EmployeeTransaction.generate_reference_number()

            new_txn = EmployeeTransaction.objects.create(**new_data)

            if supporting_document:
                new_txn.set_document(supporting_document)
                new_txn.save()

            return new_txn

        # Simple in-place update (e.g., description change)
        instance = super().update(instance, validated_data)
        if supporting_document:
            instance.set_document(supporting_document)
            instance.save()
        return instance


class FormulaValidationSerializer(serializers.Serializer):
    """Serializer for testing formula evaluation."""
    formula = serializers.CharField()
    test_basic = serializers.DecimalField(max_digits=12, decimal_places=2, default=5000)
    test_gross = serializers.DecimalField(max_digits=12, decimal_places=2, default=7000)

    def validate_formula(self, value):
        """Validate formula syntax."""
        import re
        # Allow safe characters including comparison operators for conditional expressions
        # Supports: digits, spaces, math operators, parentheses, commas, letters, underscores,
        # and comparison operators (<, >, =, !) for Python conditional expressions like PAYE
        if not re.match(r'^[\d\s\+\-\*\/\.\(\)\,a-zA-Z_<>=!]+$', value):
            raise serializers.ValidationError('Formula contains invalid characters.')
        return value


class TransactionApprovalSerializer(serializers.Serializer):
    """Serializer for transaction approval actions."""
    notes = serializers.CharField(required=False, allow_blank=True)


class TransactionRejectSerializer(serializers.Serializer):
    """Serializer for transaction rejection."""
    reason = serializers.CharField(required=True)


class BulkTransactionCreateSerializer(serializers.Serializer):
    """Serializer for bulk transaction creation."""
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1
    )
    pay_component = serializers.PrimaryKeyRelatedField(queryset=PayComponent.objects.all())
    override_type = serializers.ChoiceField(
        choices=EmployeeTransaction.OverrideType.choices,
        default=EmployeeTransaction.OverrideType.NONE
    )
    override_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    override_percentage = serializers.DecimalField(
        max_digits=6, decimal_places=4, required=False, allow_null=True
    )
    override_formula = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.DecimalField(max_digits=8, decimal_places=2, default=Decimal('1'))
    is_recurring = serializers.BooleanField(default=True)
    effective_from = serializers.DateField()
    effective_to = serializers.DateField(required=False, allow_null=True)
    payroll_period = serializers.PrimaryKeyRelatedField(
        queryset=PayrollPeriod.objects.all(), required=False, allow_null=True
    )
    description = serializers.CharField(required=False, allow_blank=True)


class OvertimeBonusTaxConfigSerializer(serializers.ModelSerializer):
    """Serializer for OvertimeBonusTaxConfig model."""

    class Meta:
        model = OvertimeBonusTaxConfig
        fields = [
            'id', 'name', 'description',
            # Overtime configuration
            'overtime_annual_salary_threshold',
            'overtime_basic_percentage_threshold',
            'overtime_rate_below_threshold',
            'overtime_rate_above_threshold',
            # Bonus configuration
            'bonus_annual_basic_percentage_threshold',
            'bonus_flat_rate',
            'bonus_excess_to_paye',
            # Non-resident rates
            'non_resident_overtime_rate',
            'non_resident_bonus_rate',
            # Validity
            'effective_from', 'effective_to', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):
        """Validate the configuration."""
        # Ensure rates are between 0 and 100
        rate_fields = [
            'overtime_basic_percentage_threshold',
            'overtime_rate_below_threshold',
            'overtime_rate_above_threshold',
            'bonus_annual_basic_percentage_threshold',
            'bonus_flat_rate',
            'non_resident_overtime_rate',
            'non_resident_bonus_rate',
        ]
        for field in rate_fields:
            value = data.get(field)
            if value is not None:
                if value < 0 or value > 100:
                    raise serializers.ValidationError({
                        field: f'{field} must be between 0 and 100'
                    })

        # Ensure threshold is positive
        threshold = data.get('overtime_annual_salary_threshold')
        if threshold is not None and threshold < 0:
            raise serializers.ValidationError({
                'overtime_annual_salary_threshold': 'Salary threshold must be positive'
            })

        return data


class BankSerializer(serializers.ModelSerializer):
    """Serializer for Bank model."""
    branch_count = serializers.SerializerMethodField()

    class Meta:
        model = Bank
        fields = [
            'id', 'code', 'name', 'short_name', 'swift_code', 'sort_code',
            'is_active', 'branch_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_branch_count(self, obj):
        if hasattr(obj, 'branch_count_annotated'):
            return obj.branch_count_annotated
        return obj.branches.count() if hasattr(obj, 'branches') else 0


class BankBranchSerializer(serializers.ModelSerializer):
    """Serializer for BankBranch model."""
    bank_name = serializers.CharField(source='bank.name', read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = BankBranch
        fields = [
            'id', 'bank', 'bank_name', 'code', 'name', 'sort_code',
            'city', 'region', 'region_name', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class StaffCategorySerializer(serializers.ModelSerializer):
    """Serializer for StaffCategory model."""
    employee_count = serializers.SerializerMethodField()
    salary_band_name = serializers.CharField(source='salary_band.name', read_only=True, allow_null=True)
    salary_band_code = serializers.CharField(source='salary_band.code', read_only=True, allow_null=True)

    class Meta:
        model = StaffCategory
        fields = [
            'id', 'code', 'name', 'description', 'payroll_group',
            'salary_band', 'salary_band_name', 'salary_band_code',
            'sort_order', 'is_active', 'employee_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_employee_count(self, obj):
        if hasattr(obj, 'employee_count_annotated'):
            return obj.employee_count_annotated
        return obj.employees.count() if hasattr(obj, 'employees') else 0


class SalaryBandSerializer(serializers.ModelSerializer):
    """Serializer for SalaryBand model."""
    level_count = serializers.SerializerMethodField()

    class Meta:
        model = SalaryBand
        fields = [
            'id', 'code', 'name', 'description', 'min_salary', 'max_salary',
            'sort_order', 'is_active', 'level_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_level_count(self, obj):
        if hasattr(obj, 'level_count_annotated'):
            return obj.level_count_annotated
        return obj.levels.count() if hasattr(obj, 'levels') else 0


class SalaryLevelSerializer(serializers.ModelSerializer):
    """Serializer for SalaryLevel model."""
    band_name = serializers.CharField(source='band.name', read_only=True)
    band_code = serializers.CharField(source='band.code', read_only=True)
    notch_count = serializers.SerializerMethodField()

    class Meta:
        model = SalaryLevel
        fields = [
            'id', 'band', 'band_name', 'band_code', 'code', 'name',
            'description', 'min_salary', 'max_salary', 'sort_order',
            'is_active', 'notch_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_notch_count(self, obj):
        if hasattr(obj, 'notch_count_annotated'):
            return obj.notch_count_annotated
        return obj.notches.count() if hasattr(obj, 'notches') else 0


class SalaryNotchSerializer(serializers.ModelSerializer):
    """Serializer for SalaryNotch model."""
    level_name = serializers.CharField(source='level.name', read_only=True)
    level_code = serializers.CharField(source='level.code', read_only=True)
    band_id = serializers.UUIDField(source='level.band.id', read_only=True)
    band_code = serializers.CharField(source='level.band.code', read_only=True)
    band_name = serializers.CharField(source='level.band.name', read_only=True)
    full_code = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = SalaryNotch
        fields = [
            'id', 'level', 'level_name', 'level_code', 'band_id', 'band_code', 'band_name',
            'code', 'name', 'full_code', 'amount', 'description',
            'sort_order', 'is_active', 'employee_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_full_code(self, obj):
        return f"{obj.level.band.code}/{obj.level.code}/{obj.code}" if obj.level else obj.code

    def get_employee_count(self, obj):
        return obj.employees.count() if hasattr(obj, 'employees') else 0


# ============================================
# Backpay Serializers
# ============================================

class BackpayDetailSerializer(serializers.ModelSerializer):
    """Serializer for per-period, per-component backpay detail."""
    period_name = serializers.CharField(source='payroll_period.name', read_only=True)
    component_code = serializers.CharField(source='pay_component.code', read_only=True)
    component_name = serializers.CharField(source='pay_component.name', read_only=True)
    component_type = serializers.CharField(source='pay_component.component_type', read_only=True)

    class Meta:
        model = BackpayDetail
        fields = [
            'id', 'payroll_period', 'period_name',
            'original_payroll_item', 'applicable_salary',
            'pay_component', 'component_code', 'component_name', 'component_type',
            'old_amount', 'new_amount', 'difference',
            'created_at',
        ]
        read_only_fields = ['created_at']


class BackpayRequestSerializer(serializers.ModelSerializer):
    """Full read serializer for BackpayRequest with nested details."""
    details = BackpayDetailSerializer(many=True, read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    applied_to_run_number = serializers.CharField(
        source='applied_to_run.run_number', read_only=True, allow_null=True
    )
    payroll_period_name = serializers.SerializerMethodField()
    reference_period_name = serializers.SerializerMethodField()

    class Meta:
        model = BackpayRequest
        fields = [
            'id', 'reference_number',
            'employee', 'employee_name', 'employee_number',
            'new_salary', 'old_salary',
            'reason', 'reason_display', 'description',
            'effective_from', 'effective_to',
            'total_arrears_earnings', 'total_arrears_deductions', 'net_arrears',
            'periods_covered',
            'status', 'status_display',
            'applied_to_run', 'applied_to_run_number',
            'payroll_period', 'payroll_period_name',
            'reference_period', 'reference_period_name',
            'approved_by', 'approved_by_name', 'approved_at', 'applied_at',
            'details',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'reference_number', 'total_arrears_earnings', 'total_arrears_deductions',
            'net_arrears', 'periods_covered', 'status',
            'applied_to_run', 'approved_by', 'approved_at', 'applied_at',
            'payroll_period',
            'created_at', 'updated_at',
        ]

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            user = obj.approved_by
            name = f"{user.first_name} {user.last_name}".strip()
            return name or user.email
        return None

    def get_payroll_period_name(self, obj):
        if obj.payroll_period:
            return obj.payroll_period.name
        return None

    def get_reference_period_name(self, obj):
        if obj.reference_period:
            return obj.reference_period.name
        return None


class BackpayRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating backpay requests."""

    class Meta:
        model = BackpayRequest
        fields = [
            'employee', 'new_salary', 'old_salary',
            'reason', 'description',
            'effective_from', 'effective_to',
            'reference_period',
        ]
        extra_kwargs = {
            'reference_period': {'required': False, 'allow_null': True},
        }

    def validate(self, data):
        effective_from = data.get('effective_from')
        effective_to = data.get('effective_to')

        if effective_from and effective_to:
            if effective_to < effective_from:
                raise serializers.ValidationError({
                    'effective_to': 'Effective to date must be after effective from date.'
                })

        # Validate that there are PAID/CLOSED periods in the range
        periods = PayrollPeriod.objects.filter(
            status__in=['PAID', 'CLOSED'],
            start_date__lte=effective_to,
            end_date__gte=effective_from,
            is_supplementary=False
        )
        if not periods.exists():
            raise serializers.ValidationError(
                'No paid/closed payroll periods found in the specified date range.'
            )

        return data


class BackpayPreviewSerializer(serializers.Serializer):
    """Input serializer for preview endpoint."""
    employee = serializers.UUIDField()
    effective_from = serializers.DateField()
    effective_to = serializers.DateField()
    reason = serializers.ChoiceField(choices=BackpayRequest.Reason.choices)
    new_salary = serializers.UUIDField(required=False, allow_null=True)
    old_salary = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, data):
        if data['effective_to'] < data['effective_from']:
            raise serializers.ValidationError({
                'effective_to': 'Effective to date must be after effective from date.'
            })
        return data


class BackpayBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk-creating backpay requests across multiple employees."""
    all_active = serializers.BooleanField(default=False)
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True,
    )
    # Filter fields (all optional)
    division = serializers.UUIDField(required=False, allow_null=True)
    directorate = serializers.UUIDField(required=False, allow_null=True)
    department = serializers.UUIDField(required=False, allow_null=True)
    grade = serializers.UUIDField(required=False, allow_null=True)
    region = serializers.UUIDField(required=False, allow_null=True)
    district = serializers.UUIDField(required=False, allow_null=True)
    work_location = serializers.UUIDField(required=False, allow_null=True)
    staff_category = serializers.UUIDField(required=False, allow_null=True)
    # Backpay fields
    reason = serializers.ChoiceField(choices=BackpayRequest.Reason.choices)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    effective_from = serializers.DateField()
    effective_to = serializers.DateField()

    FILTER_FIELDS = [
        'division', 'directorate', 'department', 'grade',
        'region', 'district', 'work_location', 'staff_category',
    ]

    def validate(self, data):
        if data['effective_to'] < data['effective_from']:
            raise serializers.ValidationError({
                'effective_to': 'Effective to date must be after effective from date.'
            })

        has_employees = bool(data.get('employee_ids'))
        has_all = data.get('all_active', False)
        has_filter = any(data.get(f) for f in self.FILTER_FIELDS)

        if not has_employees and not has_all and not has_filter:
            raise serializers.ValidationError(
                'Provide all_active, employee_ids, or at least one filter field.'
            )
        return data


# ============================================
# Salary Upgrade Serializers
# ============================================

SALARY_UPGRADE_REASONS = [
    ('PROMOTION', 'Promotion'),
    ('GRADE_UPGRADE', 'Grade Upgrade'),
    ('NOTCH_INCREMENT', 'Notch Increment'),
    ('SALARY_REVISION', 'Salary Revision'),
    ('OTHER', 'Other'),
]


INCREMENT_TYPE_CHOICES = [
    ('PERCENTAGE', 'Percentage'),
    ('AMOUNT', 'Fixed Amount'),
]


class SalaryUpgradeCreateSerializer(serializers.Serializer):
    """Serializer for creating an individual salary upgrade."""
    employee = serializers.UUIDField()
    new_notch = serializers.UUIDField(required=False, allow_null=True)
    new_grade = serializers.UUIDField(required=False, allow_null=True)
    new_position = serializers.UUIDField(required=False, allow_null=True)
    reason = serializers.ChoiceField(choices=SALARY_UPGRADE_REASONS)
    effective_from = serializers.DateField()
    description = serializers.CharField(required=False, allow_blank=True, default='')
    increment_type = serializers.ChoiceField(choices=INCREMENT_TYPE_CHOICES, required=False, allow_null=True)
    increment_value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    def validate_employee(self, value):
        from employees.models import Employee
        try:
            emp = Employee.objects.get(pk=value, is_deleted=False)
            if emp.status != 'ACTIVE':
                raise serializers.ValidationError('Employee is not active.')
        except Employee.DoesNotExist:
            raise serializers.ValidationError('Employee not found.')
        return value

    def validate_new_notch(self, value):
        if value is None:
            return value
        try:
            SalaryNotch.objects.get(pk=value)
        except SalaryNotch.DoesNotExist:
            raise serializers.ValidationError('Salary notch not found.')
        return value

    def validate(self, data):
        has_notch = bool(data.get('new_notch'))
        has_increment = bool(data.get('increment_type') and data.get('increment_value'))

        if not has_notch and not has_increment:
            raise serializers.ValidationError(
                'Provide either new_notch or both increment_type and increment_value.'
            )

        if has_increment:
            if data['increment_value'] <= 0:
                raise serializers.ValidationError({'increment_value': 'Must be greater than zero.'})

        if data.get('new_grade'):
            from organization.models import JobGrade
            try:
                JobGrade.objects.get(pk=data['new_grade'])
            except JobGrade.DoesNotExist:
                raise serializers.ValidationError({'new_grade': 'Job grade not found.'})

        if data.get('new_position'):
            from organization.models import JobPosition
            try:
                JobPosition.objects.get(pk=data['new_position'])
            except JobPosition.DoesNotExist:
                raise serializers.ValidationError({'new_position': 'Job position not found.'})

        return data


class SalaryUpgradeBulkSerializer(serializers.Serializer):
    """Serializer for bulk salary upgrades."""
    all_active = serializers.BooleanField(default=False)
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True,
    )
    # Filter fields
    division = serializers.UUIDField(required=False, allow_null=True)
    directorate = serializers.UUIDField(required=False, allow_null=True)
    department = serializers.UUIDField(required=False, allow_null=True)
    grade = serializers.UUIDField(required=False, allow_null=True)
    region = serializers.UUIDField(required=False, allow_null=True)
    district = serializers.UUIDField(required=False, allow_null=True)
    work_location = serializers.UUIDField(required=False, allow_null=True)
    staff_category = serializers.UUIDField(required=False, allow_null=True)
    # Upgrade fields
    new_notch = serializers.UUIDField(required=False, allow_null=True)
    new_grade = serializers.UUIDField(required=False, allow_null=True)
    new_position = serializers.UUIDField(required=False, allow_null=True)
    reason = serializers.ChoiceField(choices=SALARY_UPGRADE_REASONS)
    effective_from = serializers.DateField()
    description = serializers.CharField(required=False, allow_blank=True, default='')
    increment_type = serializers.ChoiceField(choices=INCREMENT_TYPE_CHOICES, required=False, allow_null=True)
    increment_value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    FILTER_FIELDS = [
        'division', 'directorate', 'department', 'grade',
        'region', 'district', 'work_location', 'staff_category',
    ]

    def validate(self, data):
        has_employees = bool(data.get('employee_ids'))
        has_all = data.get('all_active', False)
        has_filter = any(data.get(f) for f in self.FILTER_FIELDS)

        if not has_employees and not has_all and not has_filter:
            raise serializers.ValidationError(
                'Provide all_active, employee_ids, or at least one filter field.'
            )

        has_notch = bool(data.get('new_notch'))
        has_increment = bool(data.get('increment_type') and data.get('increment_value'))

        if not has_notch and not has_increment:
            raise serializers.ValidationError(
                'Provide either new_notch or both increment_type and increment_value.'
            )

        if has_increment and data['increment_value'] <= 0:
            raise serializers.ValidationError({'increment_value': 'Must be greater than zero.'})

        return data


class SalaryUpgradePreviewSerializer(serializers.Serializer):
    """Input serializer for preview endpoint."""
    employee = serializers.UUIDField()
    new_notch = serializers.UUIDField(required=False, allow_null=True)
    new_grade = serializers.UUIDField(required=False, allow_null=True)
    new_position = serializers.UUIDField(required=False, allow_null=True)
    increment_type = serializers.ChoiceField(choices=INCREMENT_TYPE_CHOICES, required=False, allow_null=True)
    increment_value = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)

    def validate(self, data):
        has_notch = bool(data.get('new_notch'))
        has_increment = bool(data.get('increment_type') and data.get('increment_value'))
        if not has_notch and not has_increment:
            raise serializers.ValidationError(
                'Provide either new_notch or both increment_type and increment_value.'
            )
        return data


class SalaryUpgradeRequestSerializer(serializers.ModelSerializer):
    """Full read serializer for SalaryUpgradeRequest."""
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    new_notch_display = serializers.SerializerMethodField()
    new_notch_amount = serializers.DecimalField(
        source='new_notch.amount', max_digits=12, decimal_places=2, read_only=True,
    )
    current_notch_display = serializers.SerializerMethodField()
    current_salary = serializers.SerializerMethodField()
    salary_diff = serializers.SerializerMethodField()
    new_grade_name = serializers.CharField(source='new_grade.name', read_only=True, allow_null=True)
    new_position_title = serializers.CharField(source='new_position.title', read_only=True, allow_null=True)
    current_grade_name = serializers.SerializerMethodField()
    current_position_title = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    processing_period_name = serializers.CharField(
        source='processing_period.name', read_only=True, allow_null=True,
    )

    class Meta:
        model = SalaryUpgradeRequest
        fields = [
            'id', 'reference_number',
            'employee', 'employee_number', 'employee_name',
            'new_notch', 'new_notch_display', 'new_notch_amount',
            'current_notch_display', 'current_salary', 'salary_diff',
            'new_grade', 'new_grade_name',
            'new_position', 'new_position_title',
            'current_grade_name', 'current_position_title',
            'reason', 'reason_display',
            'effective_from', 'description',
            'status', 'status_display',
            'is_bulk', 'bulk_reference',
            'approved_by', 'approved_by_name', 'approved_at',
            'rejection_reason',
            'increment_type', 'increment_value',
            'processing_period', 'processing_period_name',
            'created_at', 'updated_at',
        ]

    def get_new_notch_display(self, obj):
        n = obj.new_notch
        if n and n.level:
            return f"{n.level.band.code}/{n.level.code}/{n.code}"
        return n.code if n else None

    def get_current_notch_display(self, obj):
        n = obj.employee.salary_notch if obj.employee else None
        if n and n.level:
            return f"{n.level.band.code}/{n.level.code}/{n.code}"
        return n.code if n else None

    def get_current_salary(self, obj):
        n = obj.employee.salary_notch if obj.employee else None
        return float(n.amount) if n else 0

    def get_salary_diff(self, obj):
        current = obj.employee.salary_notch.amount if obj.employee and obj.employee.salary_notch else 0
        return float(obj.new_notch.amount - current) if obj.new_notch else 0

    def get_current_grade_name(self, obj):
        return obj.employee.grade.name if obj.employee and obj.employee.grade else None

    def get_current_position_title(self, obj):
        return obj.employee.position.title if obj.employee and obj.employee.position else None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            name = f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
            return name or obj.approved_by.email
        return None


class SalaryUpgradeRejectSerializer(serializers.Serializer):
    """Input serializer for rejecting a salary upgrade request."""
    rejection_reason = serializers.CharField(required=True, min_length=1)


# ============================================
# Global Salary Increment Serializers
# ============================================

class SalaryIncrementPreviewSerializer(serializers.Serializer):
    """Input serializer for previewing a global salary increment."""
    increment_type = serializers.ChoiceField(choices=['PERCENTAGE', 'AMOUNT'])
    value = serializers.DecimalField(max_digits=12, decimal_places=2)
    effective_date = serializers.DateField()
    band_id = serializers.UUIDField(required=False, allow_null=True)
    level_id = serializers.UUIDField(required=False, allow_null=True)


class SalaryIncrementApplySerializer(SalaryIncrementPreviewSerializer):
    """Input serializer for applying a global salary increment."""
    description = serializers.CharField(required=False, default='', allow_blank=True)


class SalaryIncrementDetailSerializer(serializers.ModelSerializer):
    """Output serializer for per-notch increment detail."""
    notch_code = serializers.CharField(source='notch.full_code', read_only=True)
    notch_name = serializers.CharField(source='notch.name', read_only=True)

    class Meta:
        model = SalaryIncrementDetail
        fields = [
            'id', 'notch', 'notch_code', 'notch_name',
            'old_amount', 'new_amount', 'difference',
        ]


class SalaryIncrementHistorySerializer(serializers.ModelSerializer):
    """Output serializer for salary increment history records."""
    details = SalaryIncrementDetailSerializer(many=True, read_only=True)
    applied_by_name = serializers.SerializerMethodField()
    band_name = serializers.CharField(source='band.name', read_only=True, default=None)
    level_name = serializers.CharField(source='level.name', read_only=True, default=None)

    class Meta:
        model = SalaryIncrementHistory
        fields = [
            'id', 'reference_number', 'increment_type', 'value',
            'effective_date', 'band', 'band_name', 'level', 'level_name',
            'status', 'notches_affected', 'employees_affected',
            'total_old_amount', 'total_new_amount',
            'applied_by', 'applied_by_name', 'applied_at',
            'description', 'details',
        ]

    def get_applied_by_name(self, obj):
        if obj.applied_by:
            name = f"{obj.applied_by.first_name} {obj.applied_by.last_name}".strip()
            return name or obj.applied_by.email
        return None


# ============================================
# Payroll Validation Serializers
# ============================================

class RemovalReasonCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RemovalReasonCategory
        fields = ['id', 'code', 'name', 'description', 'is_active', 'sort_order', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class EmployeePayrollFlagSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    removal_reason_name = serializers.CharField(source='removal_reason.name', read_only=True)
    removal_reason_code = serializers.CharField(source='removal_reason.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    flagged_by_name = serializers.SerializerMethodField()
    reinstated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayrollFlag
        fields = [
            'id', 'validation', 'employee', 'employee_name', 'employee_number',
            'removal_reason', 'removal_reason_name', 'removal_reason_code',
            'reason_detail', 'flagged_by', 'flagged_by_name', 'flagged_at',
            'status', 'status_display',
            'reinstated_by', 'reinstated_by_name', 'reinstated_at',
        ]
        read_only_fields = ['flagged_by', 'flagged_at', 'reinstated_by', 'reinstated_at']

    def get_flagged_by_name(self, obj):
        if obj.flagged_by:
            name = f"{obj.flagged_by.first_name} {obj.flagged_by.last_name}".strip()
            return name or obj.flagged_by.email
        return None

    def get_reinstated_by_name(self, obj):
        if obj.reinstated_by:
            name = f"{obj.reinstated_by.first_name} {obj.reinstated_by.last_name}".strip()
            return name or obj.reinstated_by.email
        return None


class EmployeePayrollFlagCreateSerializer(serializers.Serializer):
    employee = serializers.UUIDField()
    removal_reason = serializers.UUIDField()
    reason_detail = serializers.CharField(required=False, allow_blank=True, default='')


class PayrollValidationListSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source='district.name', read_only=True)
    district_code = serializers.CharField(source='district.code', read_only=True)
    period_name = serializers.CharField(source='payroll_period.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    validated_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PayrollValidation
        fields = [
            'id', 'payroll_period', 'period_name',
            'district', 'district_name', 'district_code',
            'status', 'status_display',
            'total_employees', 'validated_employees', 'flagged_employees',
            'deadline', 'validated_by', 'validated_by_name', 'validated_at',
            'approved_by_name', 'approved_at',
            'created_at',
        ]

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            name = f"{obj.validated_by.first_name} {obj.validated_by.last_name}".strip()
            return name or obj.validated_by.email
        return None

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() if obj.approved_by else None


class PayrollValidationDetailSerializer(PayrollValidationListSerializer):
    flags = EmployeePayrollFlagSerializer(many=True, read_only=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    class Meta(PayrollValidationListSerializer.Meta):
        fields = PayrollValidationListSerializer.Meta.fields + [
            'flags', 'notes',
            'approval_notes', 'rejected_by', 'rejected_at', 'rejection_reason',
        ]


class ValidationDashboardSerializer(serializers.Serializer):
    period_id = serializers.UUIDField()
    period_name = serializers.CharField()
    total_districts = serializers.IntegerField()
    validated_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    in_progress_count = serializers.IntegerField()
    submitted_count = serializers.IntegerField(default=0)
    overdue_count = serializers.IntegerField()
    total_flagged = serializers.IntegerField()
    total_employees = serializers.IntegerField()
    completion_percentage = serializers.FloatField()
