"""
Benefits admin configuration.
"""

from django.contrib import admin
from .models import (
    LoanType, LoanAccount, LoanSchedule, LoanTransaction, LoanGuarantor,
    BenefitType, BenefitEnrollment, BenefitClaim,
    ExpenseType, ExpenseClaim, ExpenseClaimItem,
    FuneralGrantType, FuneralGrantClaim,
    MedicalLensBenefit, MedicalLensClaim,
    ProfessionalSubscriptionType, ProfessionalSubscription,
    BenefitEligibilityRecord,
    ThirdPartyLender, ThirdPartyDeduction, ThirdPartyDeductionHistory,
    ThirdPartyRemittance, CreditUnionAccount, StudentLoanAccount, RentDeduction
)


# ========================================
# Loan Administration
# ========================================

@admin.register(LoanType)
class LoanTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'max_amount', 'interest_rate', 'max_tenure_months', 'is_active']
    list_filter = ['is_active', 'interest_type']
    search_fields = ['code', 'name']


class LoanScheduleInline(admin.TabularInline):
    model = LoanSchedule
    extra = 0
    fields = ['installment_number', 'due_date', 'total_amount', 'is_paid']
    readonly_fields = ['principal_amount', 'interest_amount']


class LoanTransactionInline(admin.TabularInline):
    model = LoanTransaction
    extra = 0
    fields = ['transaction_type', 'transaction_date', 'total_amount', 'balance_after']


@admin.register(LoanAccount)
class LoanAccountAdmin(admin.ModelAdmin):
    list_display = ['loan_number', 'employee', 'loan_type', 'principal_amount', 'outstanding_balance', 'status']
    list_filter = ['status', 'loan_type']
    search_fields = ['loan_number', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-application_date']
    inlines = [LoanScheduleInline, LoanTransactionInline]


@admin.register(LoanGuarantor)
class LoanGuarantorAdmin(admin.ModelAdmin):
    list_display = ['loan_account', 'guarantor', 'guarantee_amount', 'is_accepted']
    list_filter = ['is_accepted']


# ========================================
# Benefits Administration
# ========================================

@admin.register(BenefitType)
class BenefitTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'is_active']
    list_filter = ['is_active', 'category']
    search_fields = ['code', 'name']


@admin.register(BenefitEnrollment)
class BenefitEnrollmentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'benefit_type', 'enrollment_date', 'employer_contribution', 'is_active']
    list_filter = ['benefit_type', 'is_active']
    search_fields = ['employee__employee_number', 'employee__first_name']


@admin.register(BenefitClaim)
class BenefitClaimAdmin(admin.ModelAdmin):
    list_display = ['claim_number', 'employee', 'benefit_type', 'claimed_amount', 'status']
    list_filter = ['status', 'benefit_type']
    search_fields = ['claim_number', 'employee__employee_number']


# ========================================
# Expense Administration
# ========================================

@admin.register(ExpenseType)
class ExpenseTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'max_amount', 'is_active']
    list_filter = ['is_active', 'requires_receipt']


class ExpenseClaimItemInline(admin.TabularInline):
    model = ExpenseClaimItem
    extra = 0


@admin.register(ExpenseClaim)
class ExpenseClaimAdmin(admin.ModelAdmin):
    list_display = ['claim_number', 'employee', 'claim_date', 'total_claimed', 'status']
    list_filter = ['status']
    search_fields = ['claim_number', 'employee__employee_number']
    ordering = ['-claim_date']
    inlines = [ExpenseClaimItemInline]


# ========================================
# Organization Benefits
# ========================================

@admin.register(FuneralGrantType)
class FuneralGrantTypeAdmin(admin.ModelAdmin):
    list_display = ['beneficiary_type', 'grant_amount', 'max_occurrences', 'is_active']
    list_filter = ['beneficiary_type', 'is_active']


@admin.register(FuneralGrantClaim)
class FuneralGrantClaimAdmin(admin.ModelAdmin):
    list_display = ['claim_number', 'employee', 'grant_type', 'grant_amount', 'status', 'claim_date']
    list_filter = ['status', 'grant_type']
    search_fields = ['claim_number', 'employee__employee_number', 'deceased_name']
    ordering = ['-claim_date']


@admin.register(MedicalLensBenefit)
class MedicalLensBenefitAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'max_amount', 'eligibility_period_months', 'is_active']
    list_filter = ['is_active']


@admin.register(MedicalLensClaim)
class MedicalLensClaimAdmin(admin.ModelAdmin):
    list_display = ['claim_number', 'employee', 'claimed_amount', 'approved_amount', 'status', 'claim_date']
    list_filter = ['status']
    search_fields = ['claim_number', 'employee__employee_number']
    ordering = ['-claim_date']


@admin.register(ProfessionalSubscriptionType)
class ProfessionalSubscriptionTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'max_annual_amount', 'is_active']
    list_filter = ['is_active']


@admin.register(ProfessionalSubscription)
class ProfessionalSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['claim_number', 'employee', 'subscription_type', 'professional_body', 'claimed_amount', 'status']
    list_filter = ['status', 'subscription_type', 'claim_year']
    search_fields = ['claim_number', 'employee__employee_number', 'professional_body']
    ordering = ['-claim_year', '-created_at']


@admin.register(BenefitEligibilityRecord)
class BenefitEligibilityRecordAdmin(admin.ModelAdmin):
    list_display = ['employee', 'benefit_category', 'benefit_code', 'is_eligible', 'next_eligible_date']
    list_filter = ['benefit_category', 'is_eligible']
    search_fields = ['employee__employee_number', 'benefit_code']


# ========================================
# Third-Party Loans/Deductions
# ========================================

@admin.register(ThirdPartyLender)
class ThirdPartyLenderAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'lender_type', 'is_active', 'default_deduction_percentage']
    list_filter = ['lender_type', 'is_active']
    search_fields = ['code', 'name']


class ThirdPartyDeductionHistoryInline(admin.TabularInline):
    model = ThirdPartyDeductionHistory
    extra = 0
    fields = ['deduction_date', 'amount', 'balance_after', 'payroll_period']
    readonly_fields = ['deduction_date', 'amount', 'balance_after']


@admin.register(ThirdPartyDeduction)
class ThirdPartyDeductionAdmin(admin.ModelAdmin):
    list_display = [
        'deduction_number', 'employee', 'lender', 'deduction_type',
        'deduction_amount', 'outstanding_balance', 'status'
    ]
    list_filter = ['status', 'lender', 'deduction_type']
    search_fields = ['deduction_number', 'employee__employee_number', 'external_reference']
    ordering = ['-start_date']
    inlines = [ThirdPartyDeductionHistoryInline]


@admin.register(ThirdPartyRemittance)
class ThirdPartyRemittanceAdmin(admin.ModelAdmin):
    list_display = ['remittance_number', 'lender', 'payroll_period', 'total_employees', 'total_amount', 'status']
    list_filter = ['status', 'lender']
    search_fields = ['remittance_number']
    ordering = ['-remittance_date']


@admin.register(CreditUnionAccount)
class CreditUnionAccountAdmin(admin.ModelAdmin):
    list_display = ['member_number', 'employee', 'credit_union', 'account_type', 'savings_contribution', 'is_active']
    list_filter = ['credit_union', 'account_type', 'is_active']
    search_fields = ['member_number', 'employee__employee_number']


@admin.register(StudentLoanAccount)
class StudentLoanAccountAdmin(admin.ModelAdmin):
    list_display = [
        'sltf_account_number', 'employee', 'institution_attended',
        'original_loan_amount', 'outstanding_balance', 'repayment_status'
    ]
    list_filter = ['repayment_status']
    search_fields = ['sltf_account_number', 'employee__employee_number', 'institution_attended']


@admin.register(RentDeduction)
class RentDeductionAdmin(admin.ModelAdmin):
    list_display = ['employee', 'housing_type', 'property_number', 'deduction_percentage', 'is_active']
    list_filter = ['housing_type', 'is_active']
    search_fields = ['employee__employee_number', 'property_number']
