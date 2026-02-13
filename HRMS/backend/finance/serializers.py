"""Serializers for finance app."""

from rest_framework import serializers
from .models import (
    Account, FiscalYear, FiscalPeriod, JournalEntry, JournalLine,
    Budget, BudgetCommitment, Vendor, VendorInvoice, Customer,
    CustomerInvoice, OrganizationBankAccount, Payment, BankStatement,
    BankStatementLine, ExchangeRate, TaxType, TaxLine, CreditNote,
    DebitNote, RecurringJournal
)


class AccountSerializer(serializers.ModelSerializer):
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_children_count(self, obj):
        return obj.children.filter(is_deleted=False).count()


class FiscalYearSerializer(serializers.ModelSerializer):
    periods_count = serializers.SerializerMethodField()

    class Meta:
        model = FiscalYear
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_periods_count(self, obj):
        return obj.periods.count()


class FiscalPeriodSerializer(serializers.ModelSerializer):
    fiscal_year_name = serializers.CharField(source='fiscal_year.name', read_only=True)

    class Meta:
        model = FiscalPeriod
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = JournalLine
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class JournalEntryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for journal entry list views."""
    period_name = serializers.CharField(source='fiscal_period.name', read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            'id', 'entry_number', 'journal_date', 'description',
            'status', 'source', 'source_reference',
            'total_debit', 'total_credit',
            'fiscal_period', 'period_name',
            'posted_by', 'posted_at',
            'created_at', 'updated_at',
        ]


class JournalEntryDetailSerializer(serializers.ModelSerializer):
    """Full serializer for journal entry detail with nested lines."""
    lines = JournalLineSerializer(many=True, read_only=True)
    period_name = serializers.CharField(source='fiscal_period.name', read_only=True)

    class Meta:
        model = JournalEntry
        fields = '__all__'
        read_only_fields = ['id', 'entry_number', 'total_debit', 'total_credit',
                           'posted_by', 'posted_at', 'created_at', 'updated_at']


# Keep BudgetSerializer alias for backward compatibility in other modules
class JournalEntrySerializer(JournalEntryDetailSerializer):
    """Alias — prefer JournalEntryDetailSerializer for new code."""
    pass


class BudgetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for budget list views."""
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = Budget
        fields = [
            'id', 'fiscal_year', 'account', 'account_code', 'account_name',
            'department', 'cost_center', 'original_amount', 'current_amount',
            'status', 'created_at', 'updated_at',
        ]


class BudgetDetailSerializer(serializers.ModelSerializer):
    """Full serializer for budget detail with computed amounts."""
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    committed_amount = serializers.SerializerMethodField()
    available_amount = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_committed_amount(self, obj):
        return sum(c.amount for c in obj.commitments.filter(status='COMMITTED'))

    def get_available_amount(self, obj):
        committed = self.get_committed_amount(obj)
        return obj.current_amount - committed


class BudgetSerializer(BudgetDetailSerializer):
    """Alias — prefer BudgetDetailSerializer for new code."""
    pass


class BudgetCommitmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetCommitment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class VendorInvoiceSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    balance_due = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = VendorInvoice
        fields = '__all__'
        read_only_fields = ['id', 'paid_amount', 'created_at', 'updated_at']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class CustomerInvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    balance_due = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = CustomerInvoice
        fields = '__all__'
        read_only_fields = ['id', 'paid_amount', 'created_at', 'updated_at']


class BankAccountSerializer(serializers.ModelSerializer):
    gl_account_code = serializers.CharField(source='gl_account.code', read_only=True)

    class Meta:
        model = OrganizationBankAccount
        fields = '__all__'
        read_only_fields = ['id', 'current_balance', 'created_at', 'updated_at']


class PaymentSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['id', 'payment_number', 'journal_entry', 'created_at', 'updated_at']


class BankStatementSerializer(serializers.ModelSerializer):
    lines_count = serializers.SerializerMethodField()
    reconciled_count = serializers.SerializerMethodField()

    class Meta:
        model = BankStatement
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_lines_count(self, obj):
        return obj.lines.count()

    def get_reconciled_count(self, obj):
        return obj.lines.filter(is_reconciled=True).count()


class BankStatementLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatementLine
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class TaxTypeSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = TaxType
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class TaxLineSerializer(serializers.ModelSerializer):
    tax_type_code = serializers.CharField(source='tax_type.code', read_only=True)
    tax_type_name = serializers.CharField(source='tax_type.name', read_only=True)

    class Meta:
        model = TaxLine
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreditNoteSerializer(serializers.ModelSerializer):
    vendor_invoice_number = serializers.CharField(
        source='vendor_invoice.invoice_number', read_only=True, default=None
    )
    customer_invoice_number = serializers.CharField(
        source='customer_invoice.invoice_number', read_only=True, default=None
    )

    class Meta:
        model = CreditNote
        fields = '__all__'
        read_only_fields = ['id', 'credit_note_number', 'journal_entry', 'created_at', 'updated_at']


class DebitNoteSerializer(serializers.ModelSerializer):
    vendor_invoice_number = serializers.CharField(
        source='vendor_invoice.invoice_number', read_only=True, default=None
    )
    customer_invoice_number = serializers.CharField(
        source='customer_invoice.invoice_number', read_only=True, default=None
    )

    class Meta:
        model = DebitNote
        fields = '__all__'
        read_only_fields = ['id', 'debit_note_number', 'journal_entry', 'created_at', 'updated_at']


class RecurringJournalSerializer(serializers.ModelSerializer):
    source_entry_number = serializers.CharField(
        source='source_entry.entry_number', read_only=True
    )

    class Meta:
        model = RecurringJournal
        fields = '__all__'
        read_only_fields = ['id', 'last_generated', 'created_at', 'updated_at']
