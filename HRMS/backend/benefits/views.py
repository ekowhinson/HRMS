"""
Benefits and Loans views.
"""

from decimal import Decimal
from rest_framework import viewsets, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import (
    LoanType, LoanAccount, LoanSchedule, LoanTransaction, LoanGuarantor,
    BenefitType, BenefitEnrollment, BenefitClaim,
    ExpenseType, ExpenseClaim,
    FuneralGrantType, FuneralGrantClaim,
    MedicalLensBenefit, MedicalLensClaim,
    ProfessionalSubscriptionType, ProfessionalSubscription,
    BenefitEligibilityRecord
)
from .serializers import (
    LoanTypeSerializer, LoanAccountSerializer, LoanAccountCreateSerializer,
    LoanAccountDetailSerializer, LoanScheduleSerializer, LoanTransactionSerializer,
    BenefitTypeSerializer, BenefitEnrollmentSerializer, BenefitClaimSerializer,
    ExpenseTypeSerializer, ExpenseClaimSerializer,
    FuneralGrantTypeSerializer, FuneralGrantClaimSerializer, FuneralGrantClaimCreateSerializer,
    MedicalLensBenefitSerializer, MedicalLensClaimSerializer, MedicalLensClaimCreateSerializer,
    ProfessionalSubscriptionTypeSerializer, ProfessionalSubscriptionSerializer,
    ProfessionalSubscriptionCreateSerializer, BenefitEligibilityRecordSerializer
)
from .services import LoanEligibilityService, LoanApprovalService


class LoanTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Loan Types."""
    queryset = LoanType.objects.all()
    serializer_class = LoanTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active', 'salary_component']
    ordering = ['name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            queryset = queryset.filter(is_active=True)
        return queryset


class LoanAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for Loan Accounts."""
    queryset = LoanAccount.objects.select_related(
        'employee', 'loan_type', 'approved_by'
    ).prefetch_related('schedule', 'transactions')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'loan_type', 'employee']
    search_fields = ['loan_number', 'employee__employee_number', 'employee__first_name']
    ordering = ['-application_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return LoanAccountCreateSerializer
        elif self.action == 'retrieve':
            return LoanAccountDetailSerializer
        return LoanAccountSerializer

    @action(detail=False, methods=['get'])
    def my_loans(self, request):
        """Get current user's loans."""
        if hasattr(request.user, 'employee'):
            queryset = self.get_queryset().filter(employee=request.user.employee)
            serializer = LoanAccountSerializer(queryset, many=True)
            return Response(serializer.data)
        return Response([])

    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get loans pending approval."""
        queryset = self.get_queryset().filter(
            status__in=[LoanAccount.Status.PENDING, LoanAccount.Status.DRAFT]
        )
        serializer = LoanAccountSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active loans."""
        queryset = self.get_queryset().filter(
            status__in=[LoanAccount.Status.ACTIVE, LoanAccount.Status.DISBURSED]
        )
        serializer = LoanAccountSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit loan for approval."""
        loan = self.get_object()

        if loan.status != LoanAccount.Status.DRAFT:
            return Response(
                {'error': 'Only draft loans can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        loan.status = LoanAccount.Status.PENDING
        loan.save()

        return Response(LoanAccountDetailSerializer(loan).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a loan."""
        loan = self.get_object()

        try:
            service = LoanApprovalService(loan, request.user)
            loan = service.approve()
            return Response(LoanAccountDetailSerializer(loan).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a loan."""
        loan = self.get_object()
        reason = request.data.get('reason', '')

        if not reason:
            return Response(
                {'error': 'Rejection reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = LoanApprovalService(loan, request.user)
            loan = service.reject(reason)
            return Response(LoanAccountDetailSerializer(loan).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        """Disburse a loan."""
        loan = self.get_object()

        try:
            service = LoanApprovalService(loan, request.user)
            loan = service.disburse()
            return Response(LoanAccountDetailSerializer(loan).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        """Get loan repayment schedule."""
        loan = self.get_object()
        schedule = LoanSchedule.objects.filter(loan_account=loan)
        serializer = LoanScheduleSerializer(schedule, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        """Get loan transactions."""
        loan = self.get_object()
        transactions = LoanTransaction.objects.filter(loan_account=loan)
        serializer = LoanTransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Get loan statement."""
        loan = self.get_object()

        statement = {
            'loan_number': loan.loan_number,
            'employee_name': loan.employee.full_name,
            'employee_number': loan.employee.employee_number,
            'loan_type': loan.loan_type.name,
            'principal_amount': loan.principal_amount,
            'interest_rate': loan.interest_rate,
            'tenure_months': loan.tenure_months,
            'total_amount': loan.total_amount,
            'monthly_installment': loan.monthly_installment,
            'disbursement_date': loan.disbursement_date,
            'first_deduction_date': loan.first_deduction_date,
            'expected_completion_date': loan.expected_completion_date,
            'principal_paid': loan.principal_paid,
            'interest_paid': loan.interest_paid,
            'outstanding_balance': loan.outstanding_balance,
            'status': loan.status,
            'transactions': LoanTransactionSerializer(
                loan.transactions.all(), many=True
            ).data,
            'schedule': LoanScheduleSerializer(
                loan.schedule.all(), many=True
            ).data,
        }

        return Response(statement)


class CheckLoanEligibilityView(APIView):
    """Check employee eligibility for a loan type."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from employees.models import Employee

        employee_id = request.query_params.get('employee_id')
        loan_type_id = request.query_params.get('loan_type_id')

        if not employee_id or not loan_type_id:
            return Response(
                {'error': 'employee_id and loan_type_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee = Employee.objects.get(id=employee_id)
            loan_type = LoanType.objects.get(id=loan_type_id)
        except (Employee.DoesNotExist, LoanType.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)

        service = LoanEligibilityService(employee, loan_type)
        is_eligible, details = service.check_eligibility()

        return Response(details)


class LoanScheduleView(generics.ListAPIView):
    """Get loan repayment schedule."""
    serializer_class = LoanScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return LoanSchedule.objects.filter(loan_account_id=self.kwargs['pk'])


class LoanTransactionListView(generics.ListAPIView):
    """List loan transactions."""
    serializer_class = LoanTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return LoanTransaction.objects.filter(loan_account_id=self.kwargs['pk'])


class LoanSummaryView(APIView):
    """Get summary of all loans."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Count

        loans = LoanAccount.objects.all()

        summary = {
            'total_loans': loans.count(),
            'pending_approval': loans.filter(
                status__in=[LoanAccount.Status.PENDING, LoanAccount.Status.DRAFT]
            ).count(),
            'active_loans': loans.filter(
                status__in=[LoanAccount.Status.ACTIVE, LoanAccount.Status.DISBURSED]
            ).count(),
            'completed_loans': loans.filter(status=LoanAccount.Status.COMPLETED).count(),
            'total_disbursed': loans.filter(
                status__in=[LoanAccount.Status.ACTIVE, LoanAccount.Status.DISBURSED, LoanAccount.Status.COMPLETED]
            ).aggregate(total=Sum('disbursed_amount'))['total'] or 0,
            'total_outstanding': loans.filter(
                status__in=[LoanAccount.Status.ACTIVE, LoanAccount.Status.DISBURSED]
            ).aggregate(total=Sum('outstanding_balance'))['total'] or 0,
            'by_type': list(loans.values('loan_type__name').annotate(
                count=Count('id'),
                total=Sum('principal_amount')
            )),
        }

        return Response(summary)


class BenefitTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Benefit Types."""
    queryset = BenefitType.objects.all()
    serializer_class = BenefitTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'is_active']
    ordering = ['category', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            queryset = queryset.filter(is_active=True)
        return queryset


class BenefitEnrollmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Benefit Enrollments."""
    queryset = BenefitEnrollment.objects.select_related('employee', 'benefit_type')
    serializer_class = BenefitEnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'benefit_type', 'is_active']


class BenefitClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for Benefit Claims."""
    queryset = BenefitClaim.objects.select_related('employee', 'benefit_type')
    serializer_class = BenefitClaimSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'benefit_type', 'employee']
    search_fields = ['claim_number']
    ordering = ['-claim_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a benefit claim."""
        claim = self.get_object()

        if claim.status not in [BenefitClaim.Status.DRAFT, BenefitClaim.Status.SUBMITTED]:
            return Response(
                {'error': 'Claim cannot be approved from current status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        approved_amount = request.data.get('approved_amount', claim.claimed_amount)

        claim.status = BenefitClaim.Status.APPROVED
        claim.approved_amount = approved_amount
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        return Response(BenefitClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a benefit claim."""
        claim = self.get_object()
        reason = request.data.get('reason', '')

        claim.status = BenefitClaim.Status.REJECTED
        claim.rejection_reason = reason
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        return Response(BenefitClaimSerializer(claim).data)


class ExpenseTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Expense Types."""
    queryset = ExpenseType.objects.all()
    serializer_class = ExpenseTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'is_active']
    ordering = ['category', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            queryset = queryset.filter(is_active=True)
        return queryset


class ExpenseClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for Expense Claims."""
    queryset = ExpenseClaim.objects.select_related('employee')
    serializer_class = ExpenseClaimSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'employee']
    search_fields = ['claim_number']
    ordering = ['-claim_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an expense claim."""
        claim = self.get_object()

        if claim.status not in [ExpenseClaim.Status.DRAFT, ExpenseClaim.Status.SUBMITTED]:
            return Response(
                {'error': 'Claim cannot be approved from current status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        approved_amount = request.data.get('approved_amount', claim.total_claimed)

        claim.status = ExpenseClaim.Status.APPROVED
        claim.total_approved = approved_amount
        claim.approved_by = request.user
        claim.approved_at = timezone.now()
        claim.save()

        return Response(ExpenseClaimSerializer(claim).data)


class EmployeeLoanSummaryView(APIView):
    """Get employee loan summary."""
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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


# ========================================
# NHIA Specific Benefits Views
# ========================================

class FuneralGrantTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Funeral Grant Types configuration."""
    queryset = FuneralGrantType.objects.all()
    serializer_class = FuneralGrantTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['beneficiary_type', 'is_active']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list' and not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class FuneralGrantClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for Funeral Grant Claims."""
    queryset = FuneralGrantClaim.objects.select_related(
        'employee', 'employee__department', 'grant_type', 'reviewed_by', 'dependent'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'grant_type', 'employee']

    def get_serializer_class(self):
        if self.action == 'create':
            return FuneralGrantClaimCreateSerializer
        return FuneralGrantClaimSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_claims(self, request):
        """Get current user's funeral grant claims."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(employee=request.user.employee)
        serializer = FuneralGrantClaimSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def eligibility(self, request):
        """Check funeral grant eligibility for current user."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        employee = request.user.employee
        grant_types = FuneralGrantType.objects.filter(is_active=True)

        eligibility = []
        for gt in grant_types:
            # Count existing approved claims for this type
            existing_claims = FuneralGrantClaim.objects.filter(
                employee=employee,
                grant_type=gt,
                status__in=['APPROVED', 'PAID']
            ).count()

            remaining = gt.max_occurrences - existing_claims
            is_eligible = remaining > 0

            eligibility.append({
                'beneficiary_type': gt.beneficiary_type,
                'beneficiary_type_display': gt.get_beneficiary_type_display(),
                'grant_amount': float(gt.grant_amount),
                'max_occurrences': gt.max_occurrences,
                'claims_made': existing_claims,
                'remaining': remaining,
                'is_eligible': is_eligible,
            })

        return Response(eligibility)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft claim."""
        claim = self.get_object()

        if claim.status != FuneralGrantClaim.Status.DRAFT:
            return Response(
                {'error': 'Only draft claims can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        claim.status = FuneralGrantClaim.Status.SUBMITTED
        claim.save()

        return Response(FuneralGrantClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a funeral grant claim."""
        claim = self.get_object()

        if claim.status not in [FuneralGrantClaim.Status.SUBMITTED, FuneralGrantClaim.Status.UNDER_REVIEW]:
            return Response(
                {'error': 'Only submitted claims can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        approved_amount = request.data.get('approved_amount', claim.grant_amount)

        claim.status = FuneralGrantClaim.Status.APPROVED
        claim.approved_amount = approved_amount
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        return Response(FuneralGrantClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a funeral grant claim."""
        claim = self.get_object()

        reason = request.data.get('reason', '')
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        claim.status = FuneralGrantClaim.Status.REJECTED
        claim.rejection_reason = reason
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        return Response(FuneralGrantClaimSerializer(claim).data)


class MedicalLensBenefitViewSet(viewsets.ModelViewSet):
    """ViewSet for Medical Lens Benefit configuration."""
    queryset = MedicalLensBenefit.objects.all()
    serializer_class = MedicalLensBenefitSerializer
    permission_classes = [IsAuthenticated]


class MedicalLensClaimViewSet(viewsets.ModelViewSet):
    """ViewSet for Medical Lens Claims."""
    queryset = MedicalLensClaim.objects.select_related(
        'employee', 'employee__department', 'benefit', 'reviewed_by'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'employee']

    def get_serializer_class(self):
        if self.action == 'create':
            return MedicalLensClaimCreateSerializer
        return MedicalLensClaimSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_claims(self, request):
        """Get current user's medical lens claims."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(employee=request.user.employee)
        serializer = MedicalLensClaimSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def eligibility(self, request):
        """Check medical lens eligibility for current user."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        employee = request.user.employee
        benefit = MedicalLensBenefit.objects.filter(is_active=True).first()

        if not benefit:
            return Response({
                'is_eligible': False,
                'message': 'No medical lens benefit configured'
            })

        is_eligible, next_date = MedicalLensClaim.is_employee_eligible(employee, benefit)

        # Get last claim
        last_claim = MedicalLensClaim.objects.filter(
            employee=employee,
            benefit=benefit,
            status__in=[MedicalLensClaim.Status.APPROVED, MedicalLensClaim.Status.PAID]
        ).order_by('-claim_date').first()

        return Response({
            'is_eligible': is_eligible,
            'next_eligible_date': next_date,
            'max_amount': float(benefit.max_amount),
            'eligibility_period_months': benefit.eligibility_period_months,
            'last_claim_date': last_claim.claim_date if last_claim else None,
            'last_claim_amount': float(last_claim.approved_amount or last_claim.claimed_amount) if last_claim else None,
        })

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft claim."""
        claim = self.get_object()

        if claim.status != MedicalLensClaim.Status.DRAFT:
            return Response(
                {'error': 'Only draft claims can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        claim.status = MedicalLensClaim.Status.SUBMITTED
        claim.save()

        return Response(MedicalLensClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a medical lens claim."""
        claim = self.get_object()

        if claim.status not in [MedicalLensClaim.Status.SUBMITTED, MedicalLensClaim.Status.UNDER_REVIEW]:
            return Response(
                {'error': 'Only submitted claims can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        approved_amount = request.data.get('approved_amount', claim.claimed_amount)

        claim.status = MedicalLensClaim.Status.APPROVED
        claim.approved_amount = min(approved_amount, claim.benefit.max_amount)
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()  # This will calculate next_eligible_date in save()

        return Response(MedicalLensClaimSerializer(claim).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a medical lens claim."""
        claim = self.get_object()

        reason = request.data.get('reason', '')
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        claim.status = MedicalLensClaim.Status.REJECTED
        claim.rejection_reason = reason
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        return Response(MedicalLensClaimSerializer(claim).data)


class ProfessionalSubscriptionTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Professional Subscription Types configuration."""
    queryset = ProfessionalSubscriptionType.objects.all()
    serializer_class = ProfessionalSubscriptionTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active']


class ProfessionalSubscriptionViewSet(viewsets.ModelViewSet):
    """ViewSet for Professional Subscriptions."""
    queryset = ProfessionalSubscription.objects.select_related(
        'employee', 'employee__department', 'subscription_type', 'reviewed_by'
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'subscription_type', 'employee', 'claim_year']

    def get_serializer_class(self):
        if self.action == 'create':
            return ProfessionalSubscriptionCreateSerializer
        return ProfessionalSubscriptionSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_subscriptions(self, request):
        """Get current user's professional subscriptions."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        year = request.query_params.get('year', timezone.now().year)
        queryset = self.get_queryset().filter(
            employee=request.user.employee,
            claim_year=year
        )
        serializer = ProfessionalSubscriptionSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def eligibility(self, request):
        """Check professional subscription eligibility for current user."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        employee = request.user.employee
        current_year = timezone.now().year
        subscription_types = ProfessionalSubscriptionType.objects.filter(is_active=True)

        eligibility = []
        for st in subscription_types:
            # Check if already claimed this year
            existing = ProfessionalSubscription.objects.filter(
                employee=employee,
                subscription_type=st,
                claim_year=current_year,
                status__in=['SUBMITTED', 'APPROVED', 'PAID']
            ).first()

            eligibility.append({
                'subscription_type_id': str(st.id),
                'subscription_type': st.name,
                'max_annual_amount': float(st.max_annual_amount),
                'is_eligible': existing is None,
                'claimed_this_year': existing is not None,
                'claim_status': existing.status if existing else None,
                'claimed_amount': float(existing.claimed_amount) if existing else None,
            })

        return Response(eligibility)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft subscription claim."""
        subscription = self.get_object()

        if subscription.status != ProfessionalSubscription.Status.DRAFT:
            return Response(
                {'error': 'Only draft claims can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        subscription.status = ProfessionalSubscription.Status.SUBMITTED
        subscription.save()

        return Response(ProfessionalSubscriptionSerializer(subscription).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a professional subscription claim."""
        subscription = self.get_object()

        if subscription.status != ProfessionalSubscription.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted claims can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        approved_amount = request.data.get('approved_amount', subscription.claimed_amount)

        subscription.status = ProfessionalSubscription.Status.APPROVED
        subscription.approved_amount = min(approved_amount, subscription.subscription_type.max_annual_amount)
        subscription.reviewed_by = request.user
        subscription.reviewed_at = timezone.now()
        subscription.save()

        return Response(ProfessionalSubscriptionSerializer(subscription).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a professional subscription claim."""
        subscription = self.get_object()

        reason = request.data.get('reason', '')
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        subscription.status = ProfessionalSubscription.Status.REJECTED
        subscription.rejection_reason = reason
        subscription.reviewed_by = request.user
        subscription.reviewed_at = timezone.now()
        subscription.save()

        return Response(ProfessionalSubscriptionSerializer(subscription).data)


class BenefitEligibilityRecordViewSet(viewsets.ModelViewSet):
    """ViewSet for Benefit Eligibility Records."""
    queryset = BenefitEligibilityRecord.objects.select_related('employee')
    serializer_class = BenefitEligibilityRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'benefit_category', 'is_eligible']

    @action(detail=False, methods=['get'])
    def my_eligibility(self, request):
        """Get current user's benefit eligibility records."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(employee=request.user.employee)
        serializer = BenefitEligibilityRecordSerializer(queryset, many=True)
        return Response(serializer.data)


# ========================================
# Third-Party Loan/Deduction Views
# ========================================

from .models import (
    ThirdPartyLender, ThirdPartyDeduction, ThirdPartyDeductionHistory,
    ThirdPartyRemittance, CreditUnionAccount, StudentLoanAccount, RentDeduction
)
from .serializers import (
    ThirdPartyLenderSerializer, ThirdPartyLenderCreateSerializer,
    ThirdPartyDeductionSerializer, ThirdPartyDeductionCreateSerializer,
    ThirdPartyDeductionHistorySerializer,
    ThirdPartyRemittanceSerializer, ThirdPartyRemittanceCreateSerializer,
    CreditUnionAccountSerializer, CreditUnionAccountCreateSerializer,
    StudentLoanAccountSerializer, StudentLoanAccountCreateSerializer,
    RentDeductionSerializer, RentDeductionCreateSerializer
)


class ThirdPartyLenderViewSet(viewsets.ModelViewSet):
    """ViewSet for managing third-party lenders."""
    queryset = ThirdPartyLender.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lender_type', 'is_active']
    search_fields = ['code', 'name']

    def get_serializer_class(self):
        if self.action == 'create':
            return ThirdPartyLenderCreateSerializer
        return ThirdPartyLenderSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active lenders."""
        lenders = self.get_queryset().filter(is_active=True)
        serializer = ThirdPartyLenderSerializer(lenders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get lenders by type."""
        lender_type = request.query_params.get('type')
        if not lender_type:
            return Response({'error': 'type parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        lenders = self.get_queryset().filter(lender_type=lender_type, is_active=True)
        serializer = ThirdPartyLenderSerializer(lenders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get lender summary with totals."""
        lender = self.get_object()
        active_deductions = lender.deductions.filter(status='ACTIVE')

        return Response({
            'lender': ThirdPartyLenderSerializer(lender).data,
            'active_employees': active_deductions.count(),
            'total_monthly_deduction': sum(d.deduction_amount or 0 for d in active_deductions),
            'total_outstanding': sum(d.outstanding_balance or 0 for d in active_deductions),
        })


class ThirdPartyDeductionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing third-party deductions."""
    queryset = ThirdPartyDeduction.objects.select_related('employee', 'lender', 'approved_by')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'lender', 'status', 'deduction_type']

    def get_serializer_class(self):
        if self.action == 'create':
            return ThirdPartyDeductionCreateSerializer
        return ThirdPartyDeductionSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active deductions."""
        deductions = self.get_queryset().filter(status='ACTIVE')
        serializer = ThirdPartyDeductionSerializer(deductions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_employee(self, request):
        """Get deductions for a specific employee."""
        employee_id = request.query_params.get('employee_id')
        if not employee_id:
            return Response({'error': 'employee_id required'}, status=status.HTTP_400_BAD_REQUEST)

        deductions = self.get_queryset().filter(employee_id=employee_id)
        serializer = ThirdPartyDeductionSerializer(deductions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_deductions(self, request):
        """Get current user's third-party deductions."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        deductions = self.get_queryset().filter(employee=request.user.employee)
        serializer = ThirdPartyDeductionSerializer(deductions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a pending deduction."""
        deduction = self.get_object()

        if deduction.status not in ['DRAFT', 'PENDING']:
            return Response(
                {'error': 'Only draft/pending deductions can be activated'},
                status=status.HTTP_400_BAD_REQUEST
            )

        deduction.status = ThirdPartyDeduction.Status.ACTIVE
        deduction.approved_by = request.user
        deduction.approved_at = timezone.now()
        deduction.save()

        return Response(ThirdPartyDeductionSerializer(deduction).data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend an active deduction."""
        deduction = self.get_object()

        if deduction.status != ThirdPartyDeduction.Status.ACTIVE:
            return Response(
                {'error': 'Only active deductions can be suspended'},
                status=status.HTTP_400_BAD_REQUEST
            )

        deduction.status = ThirdPartyDeduction.Status.SUSPENDED
        deduction.save()

        return Response(ThirdPartyDeductionSerializer(deduction).data)

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """Resume a suspended deduction."""
        deduction = self.get_object()

        if deduction.status != ThirdPartyDeduction.Status.SUSPENDED:
            return Response(
                {'error': 'Only suspended deductions can be resumed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        deduction.status = ThirdPartyDeduction.Status.ACTIVE
        deduction.save()

        return Response(ThirdPartyDeductionSerializer(deduction).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark deduction as completed."""
        deduction = self.get_object()

        deduction.status = ThirdPartyDeduction.Status.COMPLETED
        deduction.end_date = timezone.now().date()
        deduction.save()

        return Response(ThirdPartyDeductionSerializer(deduction).data)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a deduction payment (from payroll)."""
        deduction = self.get_object()
        amount = request.data.get('amount')
        payroll_period_id = request.data.get('payroll_period_id')
        reference = request.data.get('reference', '')

        if not amount:
            return Response({'error': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)

        from payroll.models import PayrollPeriod
        payroll_period = None
        if payroll_period_id:
            try:
                payroll_period = PayrollPeriod.objects.get(id=payroll_period_id)
            except PayrollPeriod.DoesNotExist:
                pass

        # Create history record
        balance_after = (deduction.outstanding_balance or 0) - Decimal(str(amount))
        history = ThirdPartyDeductionHistory.objects.create(
            deduction=deduction,
            payroll_period=payroll_period,
            deduction_date=timezone.now().date(),
            amount=amount,
            balance_after=max(0, balance_after),
            reference=reference
        )

        # Update deduction totals
        deduction.record_deduction(Decimal(str(amount)), payroll_period)

        return Response({
            'deduction': ThirdPartyDeductionSerializer(deduction).data,
            'history': ThirdPartyDeductionHistorySerializer(history).data
        })

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get deduction history."""
        deduction = self.get_object()
        history = deduction.history.all().order_by('-deduction_date')
        serializer = ThirdPartyDeductionHistorySerializer(history, many=True)
        return Response(serializer.data)


class ThirdPartyDeductionHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing deduction history."""
    queryset = ThirdPartyDeductionHistory.objects.select_related(
        'deduction', 'deduction__employee', 'deduction__lender', 'payroll_period'
    )
    serializer_class = ThirdPartyDeductionHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['deduction', 'payroll_period']


class ThirdPartyRemittanceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing third-party remittances."""
    queryset = ThirdPartyRemittance.objects.select_related('lender', 'payroll_period', 'prepared_by', 'approved_by')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lender', 'payroll_period', 'status']

    def get_serializer_class(self):
        if self.action == 'create':
            return ThirdPartyRemittanceCreateSerializer
        return ThirdPartyRemittanceSerializer

    def perform_create(self, serializer):
        serializer.save(prepared_by=self.request.user)

    @action(detail=True, methods=['post'])
    def generate_breakdown(self, request, pk=None):
        """Generate remittance breakdown from payroll deductions."""
        remittance = self.get_object()

        if not remittance.payroll_period:
            return Response(
                {'error': 'Payroll period is required to generate breakdown'},
                status=status.HTTP_400_BAD_REQUEST
            )

        count = remittance.generate_breakdown(remittance.payroll_period)

        return Response({
            'message': f'Generated breakdown for {count} employees',
            'remittance': ThirdPartyRemittanceSerializer(remittance).data
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a remittance."""
        remittance = self.get_object()

        if remittance.status not in ['DRAFT', 'PENDING']:
            return Response(
                {'error': 'Only draft/pending remittances can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remittance.status = ThirdPartyRemittance.Status.APPROVED
        remittance.approved_by = request.user
        remittance.approved_at = timezone.now()
        remittance.save()

        return Response(ThirdPartyRemittanceSerializer(remittance).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark remittance as paid."""
        remittance = self.get_object()

        if remittance.status != ThirdPartyRemittance.Status.APPROVED:
            return Response(
                {'error': 'Only approved remittances can be marked as paid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_reference = request.data.get('payment_reference', '')
        payment_method = request.data.get('payment_method', '')
        bank_reference = request.data.get('bank_reference', '')

        remittance.status = ThirdPartyRemittance.Status.PAID
        remittance.payment_date = timezone.now().date()
        remittance.payment_reference = payment_reference
        remittance.payment_method = payment_method
        remittance.bank_reference = bank_reference
        remittance.save()

        return Response(ThirdPartyRemittanceSerializer(remittance).data)

    @action(detail=False, methods=['get'])
    def by_lender(self, request):
        """Get remittances for a specific lender."""
        lender_id = request.query_params.get('lender_id')
        if not lender_id:
            return Response({'error': 'lender_id required'}, status=status.HTTP_400_BAD_REQUEST)

        remittances = self.get_queryset().filter(lender_id=lender_id)
        serializer = ThirdPartyRemittanceSerializer(remittances, many=True)
        return Response(serializer.data)


class CreditUnionAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Credit Union accounts."""
    queryset = CreditUnionAccount.objects.select_related('employee', 'credit_union', 'active_loan_deduction')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'credit_union', 'account_type', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return CreditUnionAccountCreateSerializer
        return CreditUnionAccountSerializer

    @action(detail=False, methods=['get'])
    def my_account(self, request):
        """Get current user's credit union account."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        accounts = self.get_queryset().filter(employee=request.user.employee)
        serializer = CreditUnionAccountSerializer(accounts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_savings(self, request, pk=None):
        """Update savings contribution amount."""
        account = self.get_object()
        new_amount = request.data.get('savings_contribution')

        if new_amount is None:
            return Response({'error': 'savings_contribution required'}, status=status.HTTP_400_BAD_REQUEST)

        account.savings_contribution = new_amount
        account.save()

        return Response(CreditUnionAccountSerializer(account).data)


class StudentLoanAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Student Loan accounts."""
    queryset = StudentLoanAccount.objects.select_related('employee', 'active_deduction')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'repayment_status']

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentLoanAccountCreateSerializer
        return StudentLoanAccountSerializer

    @action(detail=False, methods=['get'])
    def my_account(self, request):
        """Get current user's student loan account."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        accounts = self.get_queryset().filter(employee=request.user.employee)
        serializer = StudentLoanAccountSerializer(accounts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_balance(self, request, pk=None):
        """Update outstanding balance (from SLTF statement)."""
        account = self.get_object()
        new_balance = request.data.get('outstanding_balance')
        total_repaid = request.data.get('total_repaid')

        if new_balance is not None:
            account.outstanding_balance = new_balance
        if total_repaid is not None:
            account.total_repaid = total_repaid

        # Check if completed
        if account.outstanding_balance <= 0:
            account.repayment_status = StudentLoanAccount.RepaymentStatus.COMPLETED
            account.actual_completion_date = timezone.now().date()

        account.save()

        return Response(StudentLoanAccountSerializer(account).data)


class RentDeductionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Rent deductions."""
    queryset = RentDeduction.objects.select_related('employee', 'active_deduction')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['employee', 'housing_type', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return RentDeductionCreateSerializer
        return RentDeductionSerializer

    @action(detail=False, methods=['get'])
    def my_rent(self, request):
        """Get current user's rent deduction."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        rents = self.get_queryset().filter(employee=request.user.employee)
        serializer = RentDeductionSerializer(rents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def end_occupancy(self, request, pk=None):
        """End rent deduction (employee vacating property)."""
        rent = self.get_object()

        rent.occupancy_end_date = request.data.get('end_date', timezone.now().date())
        rent.is_active = False
        rent.save()

        # Also complete the linked deduction if exists
        if rent.active_deduction:
            rent.active_deduction.status = ThirdPartyDeduction.Status.COMPLETED
            rent.active_deduction.end_date = rent.occupancy_end_date
            rent.active_deduction.save()

        return Response(RentDeductionSerializer(rent).data)

    @action(detail=False, methods=['get'])
    def active_by_property(self, request):
        """Get active rent deductions grouped by property type."""
        rents = self.get_queryset().filter(is_active=True)

        by_type = {}
        for rent in rents:
            housing_type = rent.housing_type
            if housing_type not in by_type:
                by_type[housing_type] = {
                    'count': 0,
                    'total_deduction': Decimal('0'),
                }
            by_type[housing_type]['count'] += 1

            if rent.fixed_amount:
                by_type[housing_type]['total_deduction'] += rent.fixed_amount

        return Response(by_type)
