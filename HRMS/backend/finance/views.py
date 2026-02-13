"""ViewSets for finance app."""

from datetime import date
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Account, FiscalYear, FiscalPeriod, JournalEntry, JournalLine,
    Budget, BudgetCommitment, Vendor, VendorInvoice, Customer,
    CustomerInvoice, OrganizationBankAccount, Payment, BankStatement,
    BankStatementLine, ExchangeRate, TaxType, CreditNote, DebitNote,
    RecurringJournal
)
from .serializers import (
    AccountSerializer, FiscalYearSerializer, FiscalPeriodSerializer,
    JournalEntryListSerializer, JournalEntryDetailSerializer, JournalLineSerializer,
    BudgetListSerializer, BudgetDetailSerializer, BudgetCommitmentSerializer,
    VendorSerializer, VendorInvoiceSerializer,
    CustomerSerializer, CustomerInvoiceSerializer,
    BankAccountSerializer, PaymentSerializer,
    BankStatementSerializer, BankStatementLineSerializer,
    ExchangeRateSerializer, TaxTypeSerializer, CreditNoteSerializer,
    DebitNoteSerializer, RecurringJournalSerializer
)
from .services import FinancialStatementService, post_journal_entry


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
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'source', 'fiscal_period']
    search_fields = ['entry_number', 'description']
    ordering = ['-journal_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return JournalEntryListSerializer
        return JournalEntryDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            return JournalEntry.objects.select_related('fiscal_period', 'posted_by')
        return JournalEntry.objects.select_related(
            'fiscal_period', 'posted_by'
        ).prefetch_related('lines__account')

    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        """Post a draft journal entry."""
        entry = self.get_object()
        try:
            post_journal_entry(entry, request.user)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(entry).data)


class BudgetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fiscal_year', 'account', 'cost_center', 'department', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return BudgetListSerializer
        return BudgetDetailSerializer

    def get_queryset(self):
        return Budget.objects.select_related('fiscal_year', 'account', 'cost_center', 'department').all()


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


# ---------------------------------------------------------------------------
# Financial Report API Views
# ---------------------------------------------------------------------------

class TrialBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_id = request.query_params.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period query parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            period = FiscalPeriod.objects.get(pk=period_id)
        except FiscalPeriod.DoesNotExist:
            return Response({'error': 'Fiscal period not found'}, status=status.HTTP_404_NOT_FOUND)
        data = FinancialStatementService.generate_trial_balance(period)
        return Response({'fiscal_period': str(period), 'data': data})


class IncomeStatementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_id = request.query_params.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period query parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            period = FiscalPeriod.objects.get(pk=period_id)
        except FiscalPeriod.DoesNotExist:
            return Response({'error': 'Fiscal period not found'}, status=status.HTTP_404_NOT_FOUND)
        data = FinancialStatementService.generate_income_statement(period)
        return Response({'fiscal_period': str(period), 'data': data})


class BalanceSheetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_id = request.query_params.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period query parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            period = FiscalPeriod.objects.get(pk=period_id)
        except FiscalPeriod.DoesNotExist:
            return Response({'error': 'Fiscal period not found'}, status=status.HTTP_404_NOT_FOUND)
        data = FinancialStatementService.generate_balance_sheet(period)
        return Response(data)


class CashFlowView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period_id = request.query_params.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period query parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            period = FiscalPeriod.objects.get(pk=period_id)
        except FiscalPeriod.DoesNotExist:
            return Response({'error': 'Fiscal period not found'}, status=status.HTTP_404_NOT_FOUND)
        data = FinancialStatementService.generate_cash_flow(period)
        return Response(data)


class APAgingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        as_of = request.query_params.get('as_of_date')
        as_of_date = date.fromisoformat(as_of) if as_of else None
        data = FinancialStatementService.generate_ap_aging(as_of_date)
        return Response(data)


class ARAgingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        as_of = request.query_params.get('as_of_date')
        as_of_date = date.fromisoformat(as_of) if as_of else None
        data = FinancialStatementService.generate_ar_aging(as_of_date)
        return Response(data)


class BudgetVsActualView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fy_id = request.query_params.get('fiscal_year')
        if not fy_id:
            return Response({'error': 'fiscal_year query parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        cc_id = request.query_params.get('cost_center')
        data = FinancialStatementService.generate_budget_vs_actual(fy_id, cc_id)
        return Response(data)


# ---------------------------------------------------------------------------
# Tax, Credit/Debit Note, Recurring Journal ViewSets
# ---------------------------------------------------------------------------

class TaxTypeViewSet(viewsets.ModelViewSet):
    queryset = TaxType.objects.select_related('account').all()
    serializer_class = TaxTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_compound']
    search_fields = ['code', 'name']


class CreditNoteViewSet(viewsets.ModelViewSet):
    serializer_class = CreditNoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor_invoice', 'customer_invoice']
    search_fields = ['credit_note_number', 'reason']
    ordering = ['-created_at']

    def get_queryset(self):
        return CreditNote.objects.select_related(
            'vendor_invoice', 'customer_invoice', 'journal_entry'
        )

    def perform_create(self, serializer):
        from .tasks import _generate_entry_number
        number = _generate_entry_number('CN')
        serializer.save(credit_note_number=number)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        note = self.get_object()
        if note.status != CreditNote.NoteStatus.DRAFT:
            return Response({'error': 'Only draft notes can be approved'}, status=status.HTTP_400_BAD_REQUEST)
        note.status = CreditNote.NoteStatus.APPROVED
        note.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(note).data)


class DebitNoteViewSet(viewsets.ModelViewSet):
    serializer_class = DebitNoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor_invoice', 'customer_invoice']
    search_fields = ['debit_note_number', 'reason']
    ordering = ['-created_at']

    def get_queryset(self):
        return DebitNote.objects.select_related(
            'vendor_invoice', 'customer_invoice', 'journal_entry'
        )

    def perform_create(self, serializer):
        from .tasks import _generate_entry_number
        number = _generate_entry_number('DN')
        serializer.save(debit_note_number=number)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        note = self.get_object()
        if note.status != DebitNote.NoteStatus.DRAFT:
            return Response({'error': 'Only draft notes can be approved'}, status=status.HTTP_400_BAD_REQUEST)
        note.status = DebitNote.NoteStatus.APPROVED
        note.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(note).data)


class RecurringJournalViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringJournalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active', 'frequency']
    ordering = ['next_run_date']

    def get_queryset(self):
        return RecurringJournal.objects.select_related('source_entry')

    @action(detail=True, methods=['post'])
    def generate_now(self, request, pk=None):
        """Manually trigger generation of this recurring journal."""
        from .tasks import generate_recurring_journals
        rj = self.get_object()
        result = generate_recurring_journals(recurring_id=str(rj.pk))
        return Response(result)


class YearEndCloseView(APIView):
    """Year-end close process."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        fiscal_year_id = request.data.get('fiscal_year_id')
        if not fiscal_year_id:
            return Response({'error': 'fiscal_year_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = FinancialStatementService.year_end_close(fiscal_year_id)
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
