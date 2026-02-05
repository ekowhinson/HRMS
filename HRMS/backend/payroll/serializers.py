"""
Serializers for payroll app.
"""

from decimal import Decimal
from rest_framework import serializers

from .models import (
    PayComponent, SalaryStructure, SalaryStructureComponent,
    EmployeeSalary, EmployeeSalaryComponent,
    PayrollPeriod, PayrollRun, PayrollItem, PayrollItemDetail,
    AdHocPayment, TaxBracket, TaxRelief, SSNITRate, EmployeeTransaction,
    OvertimeBonusTaxConfig, Bank, BankBranch, StaffCategory,
    SalaryBand, SalaryLevel, SalaryNotch, PayrollCalendar, PayrollSettings
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

    class Meta:
        model = PayrollItem
        fields = '__all__'


class PayrollRunSerializer(serializers.ModelSerializer):
    """Serializer for PayrollRun model."""
    period_name = serializers.CharField(source='payroll_period.name', read_only=True)

    class Meta:
        model = PayrollRun
        fields = '__all__'
        read_only_fields = [
            'run_number', 'total_employees', 'total_gross', 'total_deductions',
            'total_net', 'total_employer_cost', 'total_paye',
            'total_ssnit_employee', 'total_ssnit_employer', 'total_tier2_employer'
        ]


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
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    component_code = serializers.CharField(source='pay_component.code', read_only=True)
    component_name = serializers.CharField(source='pay_component.name', read_only=True)
    component_type = serializers.CharField(source='pay_component.component_type', read_only=True)
    override_type_display = serializers.CharField(source='get_override_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    payroll_period_name = serializers.CharField(source='payroll_period.name', read_only=True)
    calendar_name = serializers.CharField(source='calendar.name', read_only=True)
    calendar_year = serializers.IntegerField(source='calendar.year', read_only=True)
    calendar_month = serializers.IntegerField(source='calendar.month', read_only=True)
    calculated_amount = serializers.SerializerMethodField()
    supporting_document = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeTransaction
        fields = [
            'id', 'reference_number',
            'employee', 'employee_name', 'employee_number', 'department_name',
            'pay_component', 'component_code', 'component_name', 'component_type',
            'override_type', 'override_type_display',
            'override_amount', 'override_percentage', 'override_formula',
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

    def get_calculated_amount(self, obj):
        """Calculate the amount based on employee's current salary."""
        try:
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
    """Serializer for creating transactions, supports bulk via employee_ids."""
    employee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        help_text="List of employee IDs for bulk creation"
    )
    supporting_document = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = EmployeeTransaction
        fields = [
            'employee', 'employee_ids', 'pay_component',
            'override_type', 'override_amount', 'override_percentage', 'override_formula',
            'is_recurring', 'effective_from', 'effective_to',
            'payroll_period', 'description', 'supporting_document'
        ]

    def validate(self, data):
        """Validate override type has required fields."""
        override_type = data.get('override_type', EmployeeTransaction.OverrideType.NONE)

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

        # Must have either employee or employee_ids
        if not data.get('employee') and not data.get('employee_ids'):
            raise serializers.ValidationError({
                'employee': 'Either employee or employee_ids is required.'
            })

        return data

    def create(self, validated_data):
        """Create single or multiple transactions."""
        employee_ids = validated_data.pop('employee_ids', None)
        supporting_document = validated_data.pop('supporting_document', None)

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

            created = EmployeeTransaction.objects.bulk_create(transactions)
            # Return first one for single object response
            return created[0] if created else None

        # Single creation
        instance = super().create(validated_data)
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

    class Meta:
        model = StaffCategory
        fields = [
            'id', 'code', 'name', 'description', 'payroll_group',
            'sort_order', 'is_active', 'employee_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_employee_count(self, obj):
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
        return obj.notches.count() if hasattr(obj, 'notches') else 0


class SalaryNotchSerializer(serializers.ModelSerializer):
    """Serializer for SalaryNotch model."""
    level_name = serializers.CharField(source='level.name', read_only=True)
    level_code = serializers.CharField(source='level.code', read_only=True)
    band_code = serializers.CharField(source='level.band.code', read_only=True)
    full_code = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = SalaryNotch
        fields = [
            'id', 'level', 'level_name', 'level_code', 'band_code',
            'code', 'name', 'full_code', 'amount', 'description',
            'sort_order', 'is_active', 'employee_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_full_code(self, obj):
        return f"{obj.level.band.code}/{obj.level.code}/{obj.code}" if obj.level else obj.code

    def get_employee_count(self, obj):
        return obj.employees.count() if hasattr(obj, 'employees') else 0
