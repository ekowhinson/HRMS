"""
Serializers for benefits app.
"""

from rest_framework import serializers

from .models import (
    LoanType, LoanAccount, LoanSchedule, LoanTransaction, LoanGuarantor,
    BenefitType, BenefitEnrollment, BenefitClaim,
    ExpenseType, ExpenseClaim, ExpenseClaimItem,
    FuneralGrantType, FuneralGrantClaim,
    MedicalLensBenefit, MedicalLensClaim,
    ProfessionalSubscriptionType, ProfessionalSubscription,
    BenefitEligibilityRecord
)


class LoanTypeSerializer(serializers.ModelSerializer):
    """Serializer for LoanType model."""

    class Meta:
        model = LoanType
        fields = '__all__'


class LoanScheduleSerializer(serializers.ModelSerializer):
    """Serializer for LoanSchedule model."""

    class Meta:
        model = LoanSchedule
        fields = '__all__'


class LoanTransactionSerializer(serializers.ModelSerializer):
    """Serializer for LoanTransaction model."""

    class Meta:
        model = LoanTransaction
        fields = '__all__'


class LoanGuarantorSerializer(serializers.ModelSerializer):
    """Serializer for LoanGuarantor model."""

    class Meta:
        model = LoanGuarantor
        fields = '__all__'


class LoanAccountSerializer(serializers.ModelSerializer):
    """Serializer for LoanAccount model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    loan_type_name = serializers.CharField(source='loan_type.name', read_only=True)

    class Meta:
        model = LoanAccount
        fields = '__all__'
        read_only_fields = [
            'loan_number', 'total_interest', 'total_amount', 'monthly_installment',
            'disbursed_amount', 'principal_paid', 'interest_paid', 'outstanding_balance'
        ]


class LoanAccountCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating loan accounts."""

    class Meta:
        model = LoanAccount
        fields = [
            'employee', 'loan_type', 'principal_amount', 'tenure_months', 'purpose'
        ]

    def create(self, validated_data):
        # If employee not provided, use the current user's employee
        if 'employee' not in validated_data:
            user = self.context['request'].user
            if hasattr(user, 'employee'):
                validated_data['employee'] = user.employee

        # Generate loan number
        import uuid
        validated_data['loan_number'] = f"LN-{uuid.uuid4().hex[:8].upper()}"

        # Get interest rate from loan type
        loan_type = validated_data['loan_type']
        validated_data['interest_rate'] = loan_type.interest_rate

        return super().create(validated_data)


class LoanAccountDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for LoanAccount with nested schedule and transactions."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    loan_type_name = serializers.CharField(source='loan_type.name', read_only=True)
    loan_type_details = LoanTypeSerializer(source='loan_type', read_only=True)
    schedule = LoanScheduleSerializer(many=True, read_only=True)
    transactions = LoanTransactionSerializer(many=True, read_only=True)
    guarantors = LoanGuarantorSerializer(many=True, read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = LoanAccount
        fields = [
            'id', 'loan_number', 'employee', 'employee_name', 'employee_number',
            'loan_type', 'loan_type_name', 'loan_type_details',
            'principal_amount', 'interest_rate', 'tenure_months', 'purpose',
            'total_interest', 'total_amount', 'monthly_installment',
            'disbursed_amount', 'principal_paid', 'interest_paid', 'outstanding_balance',
            'application_date', 'disbursement_date', 'first_deduction_date',
            'last_deduction_date', 'expected_completion_date', 'actual_completion_date',
            'status', 'approved_by', 'approved_by_name', 'approved_at',
            'rejection_reason', 'notes',
            'schedule', 'transactions', 'guarantors',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'loan_number', 'total_interest', 'total_amount', 'monthly_installment',
            'disbursed_amount', 'principal_paid', 'interest_paid', 'outstanding_balance'
        ]


class BenefitTypeSerializer(serializers.ModelSerializer):
    """Serializer for BenefitType model."""

    class Meta:
        model = BenefitType
        fields = '__all__'


class BenefitEnrollmentSerializer(serializers.ModelSerializer):
    """Serializer for BenefitEnrollment model."""
    benefit_type_name = serializers.CharField(source='benefit_type.name', read_only=True)

    class Meta:
        model = BenefitEnrollment
        fields = '__all__'


class BenefitClaimSerializer(serializers.ModelSerializer):
    """Serializer for BenefitClaim model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    benefit_type_name = serializers.CharField(source='benefit_type.name', read_only=True)

    class Meta:
        model = BenefitClaim
        fields = '__all__'
        read_only_fields = ['claim_number', 'status']


class ExpenseTypeSerializer(serializers.ModelSerializer):
    """Serializer for ExpenseType model."""

    class Meta:
        model = ExpenseType
        fields = '__all__'


class ExpenseClaimItemSerializer(serializers.ModelSerializer):
    """Serializer for ExpenseClaimItem model."""

    class Meta:
        model = ExpenseClaimItem
        fields = '__all__'


class ExpenseClaimSerializer(serializers.ModelSerializer):
    """Serializer for ExpenseClaim model."""
    items = ExpenseClaimItemSerializer(many=True, read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)

    class Meta:
        model = ExpenseClaim
        fields = '__all__'
        read_only_fields = ['claim_number', 'status', 'total_claimed', 'total_approved']


# ========================================
# NHIA Specific Benefits Serializers
# ========================================

class FuneralGrantTypeSerializer(serializers.ModelSerializer):
    """Serializer for FuneralGrantType model."""
    beneficiary_type_display = serializers.CharField(source='get_beneficiary_type_display', read_only=True)

    class Meta:
        model = FuneralGrantType
        fields = '__all__'


class FuneralGrantClaimSerializer(serializers.ModelSerializer):
    """Serializer for FuneralGrantClaim model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    grant_type_name = serializers.CharField(source='grant_type.get_beneficiary_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = FuneralGrantClaim
        fields = '__all__'
        read_only_fields = ['claim_number', 'status', 'reviewed_by', 'reviewed_at', 'paid_date']


class FuneralGrantClaimCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating funeral grant claims."""

    class Meta:
        model = FuneralGrantClaim
        fields = [
            'grant_type', 'deceased_name', 'relationship', 'date_of_death',
            'child_sequence', 'dependent', 'death_certificate_attached',
            'burial_permit_attached', 'other_documents', 'notes'
        ]

    def validate(self, attrs):
        grant_type = attrs.get('grant_type')
        user = self.context['request'].user

        if not hasattr(user, 'employee'):
            raise serializers.ValidationError("User does not have an employee record")

        employee = user.employee

        # Validate child sequence for child claims
        if grant_type.beneficiary_type == FuneralGrantType.BeneficiaryType.CHILD:
            child_sequence = attrs.get('child_sequence')
            if not child_sequence:
                raise serializers.ValidationError({
                    'child_sequence': 'Child sequence is required for child claims'
                })
            if child_sequence > grant_type.max_occurrences:
                raise serializers.ValidationError({
                    'child_sequence': f'Maximum {grant_type.max_occurrences} children can claim funeral grant'
                })

            # Check if this child sequence already claimed
            existing = FuneralGrantClaim.objects.filter(
                employee=employee,
                grant_type=grant_type,
                child_sequence=child_sequence,
                status__in=['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PAID']
            ).exists()
            if existing:
                raise serializers.ValidationError({
                    'child_sequence': f'Funeral grant already claimed for child #{child_sequence}'
                })

        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['employee'] = user.employee
        validated_data['grant_amount'] = validated_data['grant_type'].grant_amount
        return super().create(validated_data)


class MedicalLensBenefitSerializer(serializers.ModelSerializer):
    """Serializer for MedicalLensBenefit model."""

    class Meta:
        model = MedicalLensBenefit
        fields = '__all__'


class MedicalLensClaimSerializer(serializers.ModelSerializer):
    """Serializer for MedicalLensClaim model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, allow_null=True)
    is_eligible = serializers.SerializerMethodField()

    class Meta:
        model = MedicalLensClaim
        fields = '__all__'
        read_only_fields = [
            'claim_number', 'status', 'reviewed_by', 'reviewed_at',
            'last_claim_date', 'next_eligible_date', 'paid_date'
        ]

    def get_is_eligible(self, obj):
        is_eligible, _ = MedicalLensClaim.is_employee_eligible(obj.employee, obj.benefit)
        return is_eligible


class MedicalLensClaimCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating medical lens claims."""

    class Meta:
        model = MedicalLensClaim
        fields = [
            'benefit', 'expense_date', 'claimed_amount',
            'optical_provider', 'prescription_number', 'description', 'notes'
        ]

    def validate(self, attrs):
        benefit = attrs.get('benefit')
        user = self.context['request'].user

        if not hasattr(user, 'employee'):
            raise serializers.ValidationError("User does not have an employee record")

        employee = user.employee

        # Check eligibility
        is_eligible, next_date = MedicalLensClaim.is_employee_eligible(employee, benefit)
        if not is_eligible:
            raise serializers.ValidationError({
                'benefit': f'Not eligible until {next_date}. Medical lens benefit is once every {benefit.eligibility_period_months} months.'
            })

        # Check amount
        if attrs.get('claimed_amount', 0) > benefit.max_amount:
            raise serializers.ValidationError({
                'claimed_amount': f'Maximum allowed is GHS {benefit.max_amount}'
            })

        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        employee = user.employee
        benefit = validated_data['benefit']

        validated_data['employee'] = employee

        # Get last claim date
        last_claim = MedicalLensClaim.objects.filter(
            employee=employee,
            benefit=benefit,
            status__in=[MedicalLensClaim.Status.APPROVED, MedicalLensClaim.Status.PAID]
        ).order_by('-claim_date').first()

        if last_claim:
            validated_data['last_claim_date'] = last_claim.claim_date

        return super().create(validated_data)


class ProfessionalSubscriptionTypeSerializer(serializers.ModelSerializer):
    """Serializer for ProfessionalSubscriptionType model."""

    class Meta:
        model = ProfessionalSubscriptionType
        fields = '__all__'


class ProfessionalSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for ProfessionalSubscription model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    subscription_type_name = serializers.CharField(source='subscription_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = ProfessionalSubscription
        fields = '__all__'
        read_only_fields = ['claim_number', 'status', 'reviewed_by', 'reviewed_at', 'paid_date']


class ProfessionalSubscriptionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating professional subscription claims."""

    class Meta:
        model = ProfessionalSubscription
        fields = [
            'subscription_type', 'professional_body', 'membership_number',
            'subscription_period_start', 'subscription_period_end',
            'claimed_amount', 'receipt_attached', 'membership_proof_attached', 'notes'
        ]

    def validate(self, attrs):
        subscription_type = attrs.get('subscription_type')
        user = self.context['request'].user
        claim_year = attrs.get('subscription_period_start').year if attrs.get('subscription_period_start') else None

        if not hasattr(user, 'employee'):
            raise serializers.ValidationError("User does not have an employee record")

        employee = user.employee

        # Check for duplicate claim in same year
        existing = ProfessionalSubscription.objects.filter(
            employee=employee,
            subscription_type=subscription_type,
            claim_year=claim_year,
            status__in=['SUBMITTED', 'APPROVED', 'PAID']
        ).exists()
        if existing:
            raise serializers.ValidationError({
                'subscription_type': f'Already claimed for {subscription_type.name} in {claim_year}'
            })

        # Check amount
        if attrs.get('claimed_amount', 0) > subscription_type.max_annual_amount:
            raise serializers.ValidationError({
                'claimed_amount': f'Maximum allowed is GHS {subscription_type.max_annual_amount}'
            })

        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['employee'] = user.employee
        validated_data['claim_year'] = validated_data['subscription_period_start'].year
        return super().create(validated_data)


class BenefitEligibilityRecordSerializer(serializers.ModelSerializer):
    """Serializer for BenefitEligibilityRecord model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    category_display = serializers.CharField(source='get_benefit_category_display', read_only=True)

    class Meta:
        model = BenefitEligibilityRecord
        fields = '__all__'


# ========================================
# Third-Party Loan/Deduction Serializers
# ========================================

from .models import (
    ThirdPartyLender, ThirdPartyDeduction, ThirdPartyDeductionHistory,
    ThirdPartyRemittance, CreditUnionAccount, StudentLoanAccount, RentDeduction
)


class ThirdPartyLenderSerializer(serializers.ModelSerializer):
    """Serializer for ThirdPartyLender model."""
    lender_type_display = serializers.CharField(source='get_lender_type_display', read_only=True)
    active_deductions_count = serializers.SerializerMethodField()

    class Meta:
        model = ThirdPartyLender
        fields = '__all__'

    def get_active_deductions_count(self, obj):
        return obj.deductions.filter(status='ACTIVE').count()


class ThirdPartyLenderCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a third-party lender."""

    class Meta:
        model = ThirdPartyLender
        fields = [
            'code', 'name', 'lender_type', 'description',
            'contact_person', 'phone', 'email', 'address',
            'bank_name', 'bank_branch', 'account_number', 'account_name',
            'default_deduction_percentage', 'max_deduction_percentage',
            'remittance_frequency', 'deduction_pay_component'
        ]


class ThirdPartyDeductionSerializer(serializers.ModelSerializer):
    """Serializer for ThirdPartyDeduction model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    lender_name = serializers.CharField(source='lender.name', read_only=True)
    lender_type = serializers.CharField(source='lender.lender_type', read_only=True)
    deduction_type_display = serializers.CharField(source='get_deduction_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ThirdPartyDeduction
        fields = '__all__'
        read_only_fields = [
            'deduction_number', 'total_deductions', 'total_deducted_amount',
            'last_deduction_date', 'approved_by', 'approved_at'
        ]


class ThirdPartyDeductionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating third-party deduction enrollment."""

    class Meta:
        model = ThirdPartyDeduction
        fields = [
            'employee', 'lender', 'external_reference', 'deduction_type',
            'deduction_amount', 'deduction_percentage', 'salary_component',
            'principal_amount', 'interest_rate', 'total_loan_amount', 'outstanding_balance',
            'start_date', 'end_date', 'tenure_months', 'purpose', 'notes'
        ]

    def validate(self, attrs):
        deduction_type = attrs.get('deduction_type', ThirdPartyDeduction.DeductionType.FIXED_AMOUNT)
        lender = attrs.get('lender')
        employee = attrs.get('employee')

        # Validate amount/percentage based on type
        if deduction_type == ThirdPartyDeduction.DeductionType.FIXED_AMOUNT:
            if not attrs.get('deduction_amount'):
                raise serializers.ValidationError({
                    'deduction_amount': 'Fixed amount is required for this deduction type'
                })
        elif deduction_type == ThirdPartyDeduction.DeductionType.PERCENTAGE:
            if not attrs.get('deduction_percentage'):
                raise serializers.ValidationError({
                    'deduction_percentage': 'Percentage is required for this deduction type'
                })
            # Check max percentage
            if attrs['deduction_percentage'] > lender.max_deduction_percentage:
                raise serializers.ValidationError({
                    'deduction_percentage': f'Maximum allowed is {lender.max_deduction_percentage}%'
                })

        # Check for active duplicate
        existing = ThirdPartyDeduction.objects.filter(
            employee=employee,
            lender=lender,
            status__in=['ACTIVE', 'PENDING']
        ).exists()
        if existing:
            raise serializers.ValidationError({
                'lender': f'Employee already has an active deduction with {lender.name}'
            })

        return attrs


class ThirdPartyDeductionHistorySerializer(serializers.ModelSerializer):
    """Serializer for ThirdPartyDeductionHistory model."""
    deduction_number = serializers.CharField(source='deduction.deduction_number', read_only=True)
    employee_name = serializers.CharField(source='deduction.employee.full_name', read_only=True)
    lender_name = serializers.CharField(source='deduction.lender.name', read_only=True)
    payroll_period_name = serializers.CharField(source='payroll_period.name', read_only=True, allow_null=True)

    class Meta:
        model = ThirdPartyDeductionHistory
        fields = '__all__'


class ThirdPartyRemittanceSerializer(serializers.ModelSerializer):
    """Serializer for ThirdPartyRemittance model."""
    lender_name = serializers.CharField(source='lender.name', read_only=True)
    lender_code = serializers.CharField(source='lender.code', read_only=True)
    payroll_period_name = serializers.CharField(source='payroll_period.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.get_full_name', read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = ThirdPartyRemittance
        fields = '__all__'
        read_only_fields = ['remittance_number', 'total_employees', 'total_amount', 'breakdown']


class ThirdPartyRemittanceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating remittance."""

    class Meta:
        model = ThirdPartyRemittance
        fields = ['lender', 'payroll_period', 'remittance_date', 'notes']


class CreditUnionAccountSerializer(serializers.ModelSerializer):
    """Serializer for CreditUnionAccount model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    credit_union_name = serializers.CharField(source='credit_union.name', read_only=True)
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    active_loan_amount = serializers.DecimalField(
        source='active_loan_deduction.outstanding_balance',
        max_digits=12, decimal_places=2, read_only=True, allow_null=True
    )

    class Meta:
        model = CreditUnionAccount
        fields = '__all__'


class CreditUnionAccountCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating credit union account."""

    class Meta:
        model = CreditUnionAccount
        fields = [
            'employee', 'credit_union', 'member_number', 'account_type',
            'membership_date', 'savings_contribution'
        ]


class StudentLoanAccountSerializer(serializers.ModelSerializer):
    """Serializer for StudentLoanAccount model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    repayment_status_display = serializers.CharField(source='get_repayment_status_display', read_only=True)
    repayment_progress = serializers.SerializerMethodField()

    class Meta:
        model = StudentLoanAccount
        fields = '__all__'

    def get_repayment_progress(self, obj):
        if obj.total_with_interest > 0:
            return float((obj.total_repaid / obj.total_with_interest) * 100)
        return 0


class StudentLoanAccountCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating student loan account."""

    class Meta:
        model = StudentLoanAccount
        fields = [
            'employee', 'sltf_account_number', 'beneficiary_id',
            'institution_attended', 'program_studied', 'graduation_year',
            'original_loan_amount', 'total_with_interest', 'interest_rate',
            'monthly_deduction', 'outstanding_balance',
            'repayment_start_date', 'expected_completion_date', 'notes'
        ]


class RentDeductionSerializer(serializers.ModelSerializer):
    """Serializer for RentDeduction model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    housing_type_display = serializers.CharField(source='get_housing_type_display', read_only=True)

    class Meta:
        model = RentDeduction
        fields = '__all__'


class RentDeductionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating rent deduction."""

    class Meta:
        model = RentDeduction
        fields = [
            'employee', 'housing_type', 'property_address', 'property_number',
            'deduction_percentage', 'fixed_amount', 'occupancy_start_date',
            'occupancy_end_date', 'notes'
        ]
