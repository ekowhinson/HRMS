"""ViewSets for finance app."""

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Account, FiscalYear, FiscalPeriod, JournalEntry, JournalLine,
    Budget, BudgetCommitment, Vendor, VendorInvoice, Customer,
    CustomerInvoice, OrganizationBankAccount, Payment, BankStatement,
    BankStatementLine, ExchangeRate
)
from .serializers import (
    AccountSerializer, FiscalYearSerializer, FiscalPeriodSerializer,
    JournalEntrySerializer, JournalLineSerializer,
    BudgetSerializer, BudgetCommitmentSerializer,
    VendorSerializer, VendorInvoiceSerializer,
    CustomerSerializer, CustomerInvoiceSerializer,
    BankAccountSerializer, PaymentSerializer,
    BankStatementSerializer, BankStatementLineSerializer,
    ExchangeRateSerializer
)


class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['account_type', 'is_header', 'is_active', 'parent']
    search_fields = ['code', 'name']
    ordering = ['code']

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Return accounts as a tree structure."""
        root_accounts = self.get_queryset().filter(parent__isnull=True)
        serializer = self.get_serializer(root_accounts, many=True)
        return Response(serializer.data)


class FiscalYearViewSet(viewsets.ModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_closed']
    ordering = ['-start_date']


class FiscalPeriodViewSet(viewsets.ModelViewSet):
    queryset = FiscalPeriod.objects.select_related('fiscal_year').all()
    serializer_class = FiscalPeriodSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['fiscal_year', 'is_closed']


class JournalEntryViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'source', 'fiscal_period']
    search_fields = ['entry_number', 'description']
    ordering = ['-journal_date']

    def get_queryset(self):
        return JournalEntry.objects.select_related(
            'fiscal_period', 'posted_by'
        ).prefetch_related('lines__account')

    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        """Post a draft journal entry."""
        entry = self.get_object()
        if entry.status != JournalEntry.EntryStatus.DRAFT:
            return Response(
                {'error': 'Only draft entries can be posted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Validate debits = credits
        totals = entry.lines.aggregate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount')
        )
        if totals['total_debit'] != totals['total_credit']:
            return Response(
                {'error': 'Total debits must equal total credits'},
                status=status.HTTP_400_BAD_REQUEST
            )
        entry.status = JournalEntry.EntryStatus.POSTED
        entry.posted_by = request.user
        entry.posted_at = timezone.now()
        entry.total_debit = totals['total_debit'] or 0
        entry.total_credit = totals['total_credit'] or 0
        entry.save()
        return Response(self.get_serializer(entry).data)


class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.select_related('fiscal_year', 'account', 'cost_center', 'department').all()
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fiscal_year', 'account', 'cost_center', 'department', 'status']


class BudgetCommitmentViewSet(viewsets.ModelViewSet):
    queryset = BudgetCommitment.objects.select_related('budget').all()
    serializer_class = BudgetCommitmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['budget', 'status']


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name', 'tax_id', 'contact_name']


class VendorInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = VendorInvoiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['vendor', 'status']
    search_fields = ['invoice_number', 'vendor__name']
    ordering = ['-invoice_date']

    def get_queryset(self):
        return VendorInvoice.objects.select_related('vendor', 'journal_entry')


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name', 'contact_name']


class CustomerInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerInvoiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'status']
    search_fields = ['invoice_number', 'customer__name']
    ordering = ['-invoice_date']

    def get_queryset(self):
        return CustomerInvoice.objects.select_related('customer')


class BankAccountViewSet(viewsets.ModelViewSet):
    queryset = OrganizationBankAccount.objects.select_related('gl_account').all()
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'currency']
    search_fields = ['name', 'bank_name', 'account_number']


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['vendor', 'customer', 'payment_method', 'bank_account']
    search_fields = ['payment_number', 'reference']
    ordering = ['-payment_date']

    def get_queryset(self):
        return Payment.objects.select_related('vendor', 'customer', 'bank_account')


class BankStatementViewSet(viewsets.ModelViewSet):
    serializer_class = BankStatementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['bank_account']
    ordering = ['-statement_date']

    def get_queryset(self):
        return BankStatement.objects.select_related('bank_account')


class BankStatementLineViewSet(viewsets.ModelViewSet):
    serializer_class = BankStatementLineSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['statement', 'is_reconciled']

    def get_queryset(self):
        return BankStatementLine.objects.select_related('statement', 'matched_payment')


class ExchangeRateViewSet(viewsets.ModelViewSet):
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_currency', 'to_currency']
    ordering = ['-effective_date']
