"""
Benefits and Loans views.
"""

from rest_framework import viewsets, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import (
    LoanType, LoanAccount, LoanSchedule, LoanTransaction,
    BenefitType, BenefitEnrollment, BenefitClaim,
    ExpenseType, ExpenseClaim
)
from .serializers import (
    LoanTypeSerializer, LoanAccountSerializer, LoanAccountCreateSerializer,
    LoanScheduleSerializer, LoanTransactionSerializer,
    BenefitTypeSerializer, BenefitEnrollmentSerializer, BenefitClaimSerializer,
    ExpenseTypeSerializer, ExpenseClaimSerializer
)


class LoanTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Loan Types."""
    queryset = LoanType.objects.filter(is_active=True)
    serializer_class = LoanTypeSerializer
    filterset_fields = ['is_active']
    ordering = ['name']


class LoanAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for Loan Accounts."""
    queryset = LoanAccount.objects.select_related('employee', 'loan_type')
    filterset_fields = ['status', 'loan_type', 'employee']
    search_fields = ['loan_number', 'employee__employee_number']
    ordering = ['-application_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return LoanAccountCreateSerializer
        return LoanAccountSerializer


class LoanScheduleView(generics.ListAPIView):
    """Get loan repayment schedule."""
    serializer_class = LoanScheduleSerializer

    def get_queryset(self):
        return LoanSchedule.objects.filter(loan_account_id=self.kwargs['pk'])


class LoanTransactionListView(generics.ListAPIView):
    """List loan transactions."""
    serializer_class = LoanTransactionSerializer

    def get_queryset(self):
        return LoanTransaction.objects.filter(loan_account_id=self.kwargs['pk'])


class ApproveLoanView(APIView):
    """Approve a loan."""

    def post(self, request, pk):
        # TODO: Implement loan approval
        return Response({'message': 'Loan approval endpoint'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class DisburseLoanView(APIView):
    """Disburse a loan."""

    def post(self, request, pk):
        # TODO: Implement loan disbursement
        return Response({'message': 'Loan disbursement endpoint'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class LoanStatementView(APIView):
    """Get loan statement."""

    def get(self, request, pk):
        # TODO: Implement loan statement
        return Response({'message': 'Loan statement endpoint'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class BenefitTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Benefit Types."""
    queryset = BenefitType.objects.filter(is_active=True)
    serializer_class = BenefitTypeSerializer
    filterset_fields = ['category', 'is_active']
    ordering = ['category', 'name']


class BenefitEnrollmentListView(generics.ListCreateAPIView):
    """List and create benefit enrollments."""
    queryset = BenefitEnrollment.objects.select_related('employee', 'benefit_type')
    serializer_class = BenefitEnrollmentSerializer


class BenefitEnrollmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete benefit enrollment."""
    queryset = BenefitEnrollment.objects.all()
    serializer_class = BenefitEnrollmentSerializer


class BenefitClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for Benefit Claims."""
    queryset = BenefitClaim.objects.select_related('employee', 'benefit_type')
    serializer_class = BenefitClaimSerializer
    filterset_fields = ['status', 'benefit_type', 'employee']
    search_fields = ['claim_number']
    ordering = ['-claim_date']


class ExpenseTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Expense Types."""
    queryset = ExpenseType.objects.filter(is_active=True)
    serializer_class = ExpenseTypeSerializer
    filterset_fields = ['category', 'is_active']
    ordering = ['category', 'name']


class ExpenseClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for Expense Claims."""
    queryset = ExpenseClaim.objects.select_related('employee')
    serializer_class = ExpenseClaimSerializer
    filterset_fields = ['status', 'employee']
    search_fields = ['claim_number']
    ordering = ['-claim_date']


class EmployeeLoanSummaryView(APIView):
    """Get employee loan summary."""

    def get(self, request, employee_id):
        loans = LoanAccount.objects.filter(employee_id=employee_id)
        active_loans = loans.filter(status__in=['ACTIVE', 'DISBURSED'])

        return Response({
            'total_loans': loans.count(),
            'active_loans': active_loans.count(),
            'total_outstanding': sum(l.outstanding_balance for l in active_loans),
            'loans': LoanAccountSerializer(active_loans, many=True).data
        })


class EmployeeBenefitSummaryView(APIView):
    """Get employee benefit summary."""

    def get(self, request, employee_id):
        enrollments = BenefitEnrollment.objects.filter(
            employee_id=employee_id, is_active=True
        )
        claims = BenefitClaim.objects.filter(employee_id=employee_id)

        return Response({
            'active_enrollments': enrollments.count(),
            'total_claims': claims.count(),
            'enrollments': BenefitEnrollmentSerializer(enrollments, many=True).data
        })
