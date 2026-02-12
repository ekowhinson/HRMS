"""Django admin for finance app."""

from django.contrib import admin
from .models import (
    Account, FiscalYear, FiscalPeriod, JournalEntry, JournalLine,
    Budget, Vendor, VendorInvoice, Customer, CustomerInvoice,
    OrganizationBankAccount, Payment, ExchangeRate
)


class JournalLineInline(admin.TabularInline):
    model = JournalLine
    extra = 2
    fields = ['account', 'description', 'debit_amount', 'credit_amount', 'cost_center']


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'account_type', 'is_header', 'is_active']
    list_filter = ['account_type', 'is_header', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['code']


@admin.register(FiscalYear)
class FiscalYearAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'is_closed']
    list_filter = ['is_closed']


@admin.register(FiscalPeriod)
class FiscalPeriodAdmin(admin.ModelAdmin):
    list_display = ['name', 'fiscal_year', 'period_number', 'start_date', 'end_date', 'is_closed']
    list_filter = ['fiscal_year', 'is_closed']


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ['entry_number', 'journal_date', 'description', 'status', 'total_debit', 'total_credit']
    list_filter = ['status', 'source']
    search_fields = ['entry_number', 'description']
    inlines = [JournalLineInline]


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['fiscal_year', 'account', 'cost_center', 'original_amount', 'revised_amount', 'status']
    list_filter = ['fiscal_year', 'status']


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'contact_email', 'payment_terms_days', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name']


@admin.register(VendorInvoice)
class VendorInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'vendor', 'invoice_date', 'total_amount', 'paid_amount', 'status']
    list_filter = ['status']
    search_fields = ['invoice_number', 'vendor__name']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'contact_email', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name']


@admin.register(CustomerInvoice)
class CustomerInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'customer', 'invoice_date', 'total_amount', 'paid_amount', 'status']
    list_filter = ['status']


@admin.register(OrganizationBankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ['name', 'bank_name', 'account_number', 'currency', 'current_balance', 'is_active']
    list_filter = ['is_active', 'currency']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['payment_number', 'payment_date', 'vendor', 'customer', 'amount', 'payment_method']
    list_filter = ['payment_method']
    search_fields = ['payment_number', 'reference']


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['from_currency', 'to_currency', 'rate', 'effective_date']
    list_filter = ['from_currency', 'to_currency']
