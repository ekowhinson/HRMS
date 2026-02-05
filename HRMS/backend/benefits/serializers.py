"""
Serializers for benefits app.
"""

from rest_framework import serializers

from .models import (
    LoanType, LoanAccount, LoanSchedule, LoanTransaction, LoanGuarantor,
    BenefitType, BenefitEnrollment, BenefitClaim,
    ExpenseType, ExpenseClaim, ExpenseClaimItem
)


class LoanTypeSerializer(serializers.ModelSerializer):
    """Serializer for LoanType model."""

    class Meta:
        model = LoanType
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
            'loan_type', 'principal_amount', 'tenure_months', 'purpose'
        ]

    def create(self, validated_data):
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
