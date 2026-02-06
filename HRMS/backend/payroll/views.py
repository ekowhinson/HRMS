"""
Payroll management views.
"""

from decimal import Decimal
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from django.http import HttpResponse
from .models import (
    PayComponent, SalaryStructure, PayrollPeriod, PayrollRun,
    PayrollItem, EmployeeSalary, AdHocPayment,
    TaxBracket, TaxRelief, SSNITRate, BankFile, Payslip, EmployeeTransaction,
    OvertimeBonusTaxConfig, Bank, BankBranch, StaffCategory,
    SalaryBand, SalaryLevel, SalaryNotch, PayrollCalendar, PayrollSettings
)
from .serializers import (
    PayComponentSerializer, SalaryStructureSerializer,
    PayrollPeriodSerializer, PayrollRunSerializer, PayrollItemSerializer,
    EmployeeSalarySerializer, AdHocPaymentSerializer,
    TaxBracketSerializer, TaxReliefSerializer, SSNITRateSerializer,
    PayComponentListSerializer, PayComponentDetailSerializer,
    EmployeeTransactionSerializer, EmployeeTransactionCreateSerializer,
    FormulaValidationSerializer, TransactionApprovalSerializer,
    TransactionRejectSerializer, BulkTransactionCreateSerializer,
    OvertimeBonusTaxConfigSerializer, BankSerializer, BankBranchSerializer,
    StaffCategorySerializer, SalaryBandSerializer, SalaryLevelSerializer,
    SalaryNotchSerializer, PayrollCalendarSerializer,
    PayrollSettingsSerializer, SetActivePeriodSerializer
)
from .services import PayrollService


class PayComponentViewSet(viewsets.ModelViewSet):
    """ViewSet for Pay Components with formula validation and usage stats."""
    queryset = PayComponent.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['component_type', 'calculation_type', 'category', 'is_active', 'is_statutory', 'is_recurring']
    search_fields = ['code', 'name', 'short_name', 'description']
    ordering_fields = ['code', 'name', 'component_type', 'category', 'display_order', 'created_at']
    ordering = ['component_type', 'display_order', 'name']

    def get_serializer_class(self):
        if self.action == 'list':
            return PayComponentListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return PayComponentDetailSerializer
        elif self.action == 'validate_formula':
            return FormulaValidationSerializer
        return PayComponentDetailSerializer

    @action(detail=False, methods=['post'])
    def validate_formula(self, request):
        """Test formula evaluation with sample values."""
        serializer = FormulaValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        formula = serializer.validated_data['formula']
        test_basic = serializer.validated_data.get('test_basic', Decimal('5000'))
        test_gross = serializer.validated_data.get('test_gross', Decimal('7000'))

        # Create a temporary transaction to use the evaluation method
        temp_txn = EmployeeTransaction()
        try:
            result = temp_txn._evaluate_formula(formula, test_basic, test_gross)
            return Response({
                'valid': True,
                'formula': formula,
                'test_basic': str(test_basic),
                'test_gross': str(test_gross),
                'result': str(result)
            })
        except Exception as e:
            return Response({
                'valid': False,
                'formula': formula,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def usage_stats(self, request, pk=None):
        """Get active transaction count for this component."""
        component = self.get_object()
        active_count = component.employee_transactions.filter(
            status__in=['PENDING', 'APPROVED', 'ACTIVE']
        ).count()
        total_count = component.employee_transactions.count()

        return Response({
            'component_id': component.id,
            'component_code': component.code,
            'active_transactions': active_count,
            'total_transactions': total_count
        })


class SalaryStructureViewSet(viewsets.ModelViewSet):
    """ViewSet for Salary Structures."""
    queryset = SalaryStructure.objects.select_related('grade')
    serializer_class = SalaryStructureSerializer
    filterset_fields = ['is_active', 'grade']
    ordering = ['grade__level', 'name']


class PayrollCalendarViewSet(viewsets.ModelViewSet):
    """ViewSet for Payroll Calendar with year creation."""
    queryset = PayrollCalendar.objects.all()
    serializer_class = PayrollCalendarSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['year', 'month', 'is_active']
    search_fields = ['name']
    ordering = ['-year', '-month']

    @action(detail=False, methods=['post'])
    def create_year(self, request):
        """
        Create all 12 calendar months for a specified year.
        POST /payroll/calendar/create_year/
        Body: {"year": 2025}
        """
        year = request.data.get('year')
        if not year:
            return Response({
                'error': 'year is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
        except (ValueError, TypeError):
            return Response({
                'error': 'year must be a valid integer'
            }, status=status.HTTP_400_BAD_REQUEST)

        if year < 1900 or year > 2100:
            return Response({
                'error': 'year must be between 1900 and 2100'
            }, status=status.HTTP_400_BAD_REQUEST)

        created = PayrollCalendar.create_year_calendar(year, request.user)

        return Response({
            'year': year,
            'created_count': len(created),
            'message': f'Created {len(created)} calendar months for {year}' if created else f'Calendar for {year} already exists',
            'calendar': PayrollCalendarSerializer(
                PayrollCalendar.objects.filter(year=year).order_by('month'),
                many=True
            ).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def years(self, request):
        """Get list of years with calendar entries."""
        years = PayrollCalendar.objects.values_list('year', flat=True).distinct().order_by('-year')
        return Response({'years': list(years)})


class PayrollSettingsView(APIView):
    """
    API view for global payroll settings.

    GET  /payroll/settings/ - Get current settings including active period
    PUT  /payroll/settings/ - Update settings
    POST /payroll/settings/set-active-period/ - Set active period by calendar/period/year+month
    POST /payroll/settings/advance-period/ - Advance to next period
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current payroll settings."""
        settings_obj = PayrollSettings.get_settings()
        serializer = PayrollSettingsSerializer(settings_obj)

        # Add available calendars and periods for selection
        calendars = PayrollCalendar.objects.filter(is_active=True).order_by('-year', '-month')
        periods = PayrollPeriod.objects.filter(is_supplementary=False).order_by('-year', '-month')

        return Response({
            'settings': serializer.data,
            'available_calendars': PayrollCalendarSerializer(calendars[:24], many=True).data,
            'available_periods': PayrollPeriodSerializer(periods[:24], many=True).data,
        })

    def put(self, request):
        """Update payroll settings."""
        settings_obj = PayrollSettings.get_settings()
        serializer = PayrollSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Update with user tracking
        settings_obj.updated_by = request.user
        serializer.save()

        return Response({
            'message': 'Settings updated successfully',
            'settings': PayrollSettingsSerializer(settings_obj).data
        })


class SetActivePeriodView(APIView):
    """Set the active payroll period."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Set active period by calendar_id, period_id, or year+month.

        POST /payroll/settings/set-active-period/
        Body options:
        - {"calendar_id": "uuid"} - Set by calendar ID
        - {"period_id": "uuid"} - Set by period ID
        - {"year": 2025, "month": 3} - Set by year and month
        """
        serializer = SetActivePeriodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        calendar_id = serializer.validated_data.get('calendar_id')
        period_id = serializer.validated_data.get('period_id')
        year = serializer.validated_data.get('year')
        month = serializer.validated_data.get('month')

        try:
            if period_id:
                period = PayrollPeriod.objects.get(pk=period_id)
                settings_obj = PayrollSettings.set_active_period(period, request.user)
            elif calendar_id:
                calendar = PayrollCalendar.objects.get(pk=calendar_id)
                settings_obj = PayrollSettings.set_active_calendar(calendar, request.user)
            elif year and month:
                # Get or create calendar for year/month
                calendar, created = PayrollCalendar.get_or_create_month(year, month, request.user)
                settings_obj = PayrollSettings.set_active_calendar(calendar, request.user)

                # Also ensure period exists
                period = PayrollPeriod.objects.filter(year=year, month=month, is_supplementary=False).first()
                if not period:
                    PayrollPeriod.create_year_periods(year, request.user)
                    period = PayrollPeriod.objects.filter(year=year, month=month, is_supplementary=False).first()
                if period:
                    settings_obj.active_period = period
                    settings_obj.save()

            return Response({
                'message': 'Active period updated successfully',
                'settings': PayrollSettingsSerializer(settings_obj).data
            })

        except PayrollCalendar.DoesNotExist:
            return Response({'error': 'Calendar not found'}, status=status.HTTP_404_NOT_FOUND)
        except PayrollPeriod.DoesNotExist:
            return Response({'error': 'Period not found'}, status=status.HTTP_404_NOT_FOUND)


class AdvancePeriodView(APIView):
    """Advance to the next payroll period."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Advance to the next payroll period.

        POST /payroll/settings/advance-period/
        """
        settings_obj = PayrollSettings.get_settings()

        if not settings_obj.active_calendar:
            return Response({
                'error': 'No active calendar set. Please set an active period first.'
            }, status=status.HTTP_400_BAD_REQUEST)

        current_name = settings_obj.active_calendar.name

        # Advance to next period
        settings_obj = PayrollSettings.advance_to_next_period(request.user)

        return Response({
            'message': f'Advanced from {current_name} to {settings_obj.active_calendar.name}',
            'settings': PayrollSettingsSerializer(settings_obj).data
        })


class PayrollPeriodViewSet(viewsets.ModelViewSet):
    """ViewSet for Payroll Periods with reopen functionality."""
    queryset = PayrollPeriod.objects.select_related('calendar').all()
    serializer_class = PayrollPeriodSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['year', 'month', 'status', 'calendar']
    search_fields = ['name']
    ordering = ['-year', '-month']

    @action(detail=False, methods=['post'])
    def create_year(self, request):
        """
        Create all 12 payroll periods for a specified year.
        POST /payroll/periods/create_year/
        Body: {"year": 2025}
        """
        year = request.data.get('year')
        if not year:
            return Response({
                'error': 'year is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
        except (ValueError, TypeError):
            return Response({
                'error': 'year must be a valid integer'
            }, status=status.HTTP_400_BAD_REQUEST)

        if year < 1900 or year > 2100:
            return Response({
                'error': 'year must be between 1900 and 2100'
            }, status=status.HTTP_400_BAD_REQUEST)

        created = PayrollPeriod.create_year_periods(year, request.user)

        return Response({
            'year': year,
            'created_count': len(created),
            'message': f'Created {len(created)} payroll periods for {year}' if created else f'Periods for {year} already exist',
            'periods': PayrollPeriodSerializer(
                PayrollPeriod.objects.filter(year=year, is_supplementary=False).order_by('month'),
                many=True
            ).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def years(self, request):
        """Get list of years with payroll periods."""
        years = PayrollPeriod.objects.values_list('year', flat=True).distinct().order_by('-year')
        return Response({'years': list(years)})

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """
        Reopen a payroll period to allow reprocessing.
        Only COMPUTED or APPROVED periods can be reopened (not PAID or CLOSED).
        """
        period = self.get_object()

        # Cannot reopen PAID or CLOSED periods without special confirmation
        if period.status == 'PAID':
            force = request.data.get('force', False)
            if not force:
                return Response({
                    'error': 'This period has been marked as PAID. '
                             'Reopening may cause discrepancies. '
                             'Set "force": true to confirm.',
                    'requires_confirmation': True
                }, status=status.HTTP_400_BAD_REQUEST)

        if period.status == 'CLOSED':
            return Response({
                'error': 'Cannot reopen a CLOSED period. '
                         'Please contact system administrator.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if period.status == 'OPEN':
            return Response({
                'message': 'Period is already open.',
                'data': PayrollPeriodSerializer(period).data
            })

        # Reopen the period
        period.status = PayrollPeriod.Status.OPEN
        period.save(update_fields=['status', 'updated_at'])

        return Response({
            'message': f'Period {period.name} reopened successfully.',
            'data': PayrollPeriodSerializer(period).data
        })


class PayrollRunViewSet(viewsets.ModelViewSet):
    """ViewSet for Payroll Runs with recompute and status management."""
    queryset = PayrollRun.objects.select_related('payroll_period')
    serializer_class = PayrollRunSerializer
    filterset_fields = ['status', 'payroll_period']
    search_fields = ['run_number']
    ordering = ['-run_date']

    @action(detail=True, methods=['post'])
    def recompute(self, request, pk=None):
        """
        Recompute payroll for an existing run.
        Allows recomputation for DRAFT, COMPUTED, or REJECTED statuses.
        """
        payroll_run = self.get_object()

        try:
            service = PayrollService(payroll_run)
            result = service.compute_payroll(request.user)
            return Response({
                'message': 'Payroll recomputed successfully',
                'data': result
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': f'Failed to recompute payroll: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def reset_to_draft(self, request, pk=None):
        """
        Reset a payroll run back to DRAFT status for reprocessing.
        Only allowed for COMPUTED or REJECTED statuses.
        """
        payroll_run = self.get_object()

        allowed_statuses = ['COMPUTED', 'REJECTED']
        if payroll_run.status not in allowed_statuses:
            return Response({
                'error': f'Cannot reset payroll in status: {payroll_run.status}. '
                         f'Only {", ".join(allowed_statuses)} can be reset.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if period is still open
        if payroll_run.payroll_period.status in ['PAID', 'CLOSED']:
            return Response({
                'error': 'Cannot reset payroll for a closed or paid period.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Clear existing items and reset status
        PayrollItem.objects.filter(payroll_run=payroll_run).delete()
        payroll_run.status = PayrollRun.Status.DRAFT
        payroll_run.total_employees = 0
        payroll_run.total_gross = Decimal('0')
        payroll_run.total_deductions = Decimal('0')
        payroll_run.total_net = Decimal('0')
        payroll_run.total_employer_cost = Decimal('0')
        payroll_run.total_paye = Decimal('0')
        payroll_run.total_ssnit_employee = Decimal('0')
        payroll_run.total_ssnit_employer = Decimal('0')
        payroll_run.total_tier2_employer = Decimal('0')
        payroll_run.computed_by = None
        payroll_run.computed_at = None
        payroll_run.save()

        return Response({
            'message': 'Payroll run reset to draft successfully',
            'data': PayrollRunSerializer(payroll_run).data
        })


class AdHocPaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for Ad Hoc Payments."""
    queryset = AdHocPayment.objects.select_related('employee', 'pay_component')
    serializer_class = AdHocPaymentSerializer
    filterset_fields = ['status', 'payment_type', 'employee']
    ordering = ['-created_at']


class EmployeeTransactionViewSet(viewsets.ModelViewSet):
    """ViewSet for Employee Transactions with approval workflow."""
    queryset = EmployeeTransaction.objects.select_related(
        'employee', 'employee__department', 'pay_component',
        'approved_by', 'payroll_period'
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_recurring', 'pay_component', 'pay_component__component_type', 'employee']
    search_fields = ['reference_number', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering_fields = ['reference_number', 'effective_from', 'effective_to', 'status', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action in ['create']:
            return EmployeeTransactionCreateSerializer
        elif self.action == 'bulk_create':
            return BulkTransactionCreateSerializer
        elif self.action in ['approve', 'reactivate']:
            return TransactionApprovalSerializer
        elif self.action == 'reject':
            return TransactionRejectSerializer
        return EmployeeTransactionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by department
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(employee__department_id=department)

        # Filter by date range
        effective_from = self.request.query_params.get('effective_from')
        effective_to = self.request.query_params.get('effective_to')
        if effective_from:
            queryset = queryset.filter(effective_from__gte=effective_from)
        if effective_to:
            queryset = queryset.filter(
                Q(effective_to__isnull=True) | Q(effective_to__lte=effective_to)
            )

        return queryset

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a pending transaction."""
        transaction = self.get_object()

        if transaction.status != EmployeeTransaction.Status.PENDING:
            return Response(
                {'error': 'Only pending transactions can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TransactionApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction.status = EmployeeTransaction.Status.ACTIVE
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.approval_notes = serializer.validated_data.get('notes', '')
        transaction.save()

        return Response(EmployeeTransactionSerializer(transaction).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a pending transaction."""
        transaction = self.get_object()

        if transaction.status != EmployeeTransaction.Status.PENDING:
            return Response(
                {'error': 'Only pending transactions can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TransactionRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction.status = EmployeeTransaction.Status.CANCELLED
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.approval_notes = serializer.validated_data['reason']
        transaction.save()

        return Response(EmployeeTransactionSerializer(transaction).data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend an active transaction."""
        transaction = self.get_object()

        if transaction.status != EmployeeTransaction.Status.ACTIVE:
            return Response(
                {'error': 'Only active transactions can be suspended.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        transaction.status = EmployeeTransaction.Status.SUSPENDED
        transaction.save()

        return Response(EmployeeTransactionSerializer(transaction).data)

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate a suspended transaction."""
        transaction = self.get_object()

        if transaction.status != EmployeeTransaction.Status.SUSPENDED:
            return Response(
                {'error': 'Only suspended transactions can be reactivated.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TransactionApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction.status = EmployeeTransaction.Status.ACTIVE
        transaction.approval_notes = serializer.validated_data.get('notes', '')
        transaction.save()

        return Response(EmployeeTransactionSerializer(transaction).data)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create transactions for multiple employees."""
        serializer = BulkTransactionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        employee_ids = data.pop('employee_ids')
        pay_component = data.pop('pay_component')

        from employees.models import Employee
        transactions = []

        for emp_id in employee_ids:
            try:
                employee = Employee.objects.get(pk=emp_id)
                txn = EmployeeTransaction(
                    employee=employee,
                    pay_component=pay_component,
                    **data
                )
                txn.reference_number = EmployeeTransaction.generate_reference_number()
                transactions.append(txn)
            except Employee.DoesNotExist:
                continue

        created = EmployeeTransaction.objects.bulk_create(transactions)

        return Response({
            'message': f'Created {len(created)} transactions.',
            'count': len(created),
            'transactions': EmployeeTransactionSerializer(created, many=True).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """List pending transactions that need approval."""
        queryset = self.get_queryset().filter(status=EmployeeTransaction.Status.PENDING)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = EmployeeTransactionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = EmployeeTransactionSerializer(queryset, many=True)
        return Response(serializer.data)


class EmployeeSalaryView(APIView):
    """Get employee's current salary."""

    def get(self, request, employee_id):
        try:
            salary = EmployeeSalary.objects.get(employee_id=employee_id, is_current=True)
            return Response(EmployeeSalarySerializer(salary).data)
        except EmployeeSalary.DoesNotExist:
            return Response({'error': 'No current salary found'}, status=status.HTTP_404_NOT_FOUND)


class EmployeeSalaryHistoryView(generics.ListAPIView):
    """Get employee's salary history."""
    serializer_class = EmployeeSalarySerializer

    def get_queryset(self):
        return EmployeeSalary.objects.filter(employee_id=self.kwargs['employee_id'])


class EmployeePayslipsView(generics.ListAPIView):
    """Get employee's payslips."""
    serializer_class = PayrollItemSerializer

    def get_queryset(self):
        return PayrollItem.objects.filter(
            employee_id=self.kwargs['employee_id'],
            status=PayrollItem.Status.PAID
        ).select_related('payroll_run', 'payroll_run__payroll_period')


class ComputePayrollView(APIView):
    """Compute payroll for a run."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            payroll_run = PayrollRun.objects.get(pk=pk)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            service = PayrollService(payroll_run)
            result = service.compute_payroll(request.user)
            return Response({
                'message': 'Payroll computed successfully',
                'data': result
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': f'Failed to compute payroll: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ApprovePayrollView(APIView):
    """Approve payroll run."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            payroll_run = PayrollRun.objects.get(pk=pk)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        action = request.data.get('action', 'approve').lower()
        comments = request.data.get('comments', '')

        try:
            service = PayrollService(payroll_run)

            if action == 'reject':
                if not comments:
                    return Response(
                        {'error': 'Comments are required when rejecting'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                result = service.reject_payroll(request.user, comments)
            else:
                result = service.approve_payroll(request.user, comments)

            return Response({
                'message': f'Payroll {action}d successfully',
                'data': result
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': f'Failed to {action} payroll: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProcessPaymentView(APIView):
    """Process payroll payment."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            payroll_run = PayrollRun.objects.get(pk=pk)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        payment_reference = request.data.get('payment_reference')

        try:
            service = PayrollService(payroll_run)
            result = service.process_payment(request.user, payment_reference)
            return Response({
                'message': 'Payment processed successfully',
                'data': result
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': f'Failed to process payment: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateBankFileView(APIView):
    """Generate bank payment file."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            payroll_run = PayrollRun.objects.get(pk=pk)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        file_format = request.data.get('format', 'CSV').upper()

        try:
            service = PayrollService(payroll_run)
            bank_files = service.generate_bank_file(request.user, file_format)
            return Response({
                'message': f'Generated {len(bank_files)} bank file(s)',
                'data': {
                    'files': [
                        {
                            'id': str(bf.id),
                            'bank_name': bf.bank_name,
                            'file_name': bf.file_name,
                            'total_amount': str(bf.total_amount),
                            'transaction_count': bf.transaction_count,
                        }
                        for bf in bank_files
                    ]
                }
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': f'Failed to generate bank file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GeneratePayslipsView(APIView):
    """Generate payslips for a run."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            payroll_run = PayrollRun.objects.get(pk=pk)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            service = PayrollService(payroll_run)
            payslips = service.generate_payslips(request.user)
            return Response({
                'message': f'Generated {len(payslips)} payslip(s)',
                'data': {
                    'payslips_count': len(payslips),
                    'payslips': [
                        {
                            'id': str(ps.id),
                            'payslip_number': ps.payslip_number,
                            'employee_number': ps.payroll_item.employee.employee_number,
                            'employee_name': ps.payroll_item.employee.full_name,
                        }
                        for ps in payslips[:50]
                    ]
                }
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'error': f'Failed to generate payslips: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PayrollItemListView(generics.ListAPIView):
    """List payroll items for a run."""
    serializer_class = PayrollItemSerializer

    def get_queryset(self):
        return PayrollItem.objects.filter(payroll_run_id=self.kwargs['run_id'])


class PayrollItemDetailView(generics.RetrieveAPIView):
    """Get payroll item details."""
    queryset = PayrollItem.objects.all()
    serializer_class = PayrollItemSerializer


class TaxBracketListView(generics.ListAPIView):
    """List tax brackets."""
    queryset = TaxBracket.objects.filter(is_active=True)
    serializer_class = TaxBracketSerializer


class TaxBracketViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing PAYE Tax Brackets.

    Provides full CRUD operations for tax bracket configuration.
    """
    queryset = TaxBracket.objects.all()
    serializer_class = TaxBracketSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active']
    ordering_fields = ['order', 'min_amount', 'effective_from']
    ordering = ['order', 'min_amount']

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get currently active tax brackets."""
        brackets = TaxBracket.objects.filter(is_active=True).order_by('order', 'min_amount')
        serializer = self.get_serializer(brackets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk update/replace all tax brackets.

        Expects a list of bracket objects. Deactivates existing brackets
        and creates new ones.
        """
        brackets_data = request.data.get('brackets', [])
        if not brackets_data:
            return Response(
                {'error': 'No brackets provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Deactivate all current brackets
        TaxBracket.objects.filter(is_active=True).update(is_active=False)

        # Create new brackets
        created_brackets = []
        for i, bracket_data in enumerate(brackets_data):
            bracket = TaxBracket.objects.create(
                name=bracket_data.get('name', f'Bracket {i + 1}'),
                min_amount=bracket_data.get('min_amount', 0),
                max_amount=bracket_data.get('max_amount'),
                rate=bracket_data.get('rate', 0),
                cumulative_tax=bracket_data.get('cumulative_tax', 0),
                effective_from=bracket_data.get('effective_from'),
                effective_to=bracket_data.get('effective_to'),
                is_active=True,
                order=i
            )
            created_brackets.append(bracket)

        serializer = self.get_serializer(created_brackets, many=True)
        return Response({
            'message': f'Created {len(created_brackets)} tax brackets',
            'brackets': serializer.data
        })

    @action(detail=False, methods=['post'])
    def calculate_cumulative(self, request):
        """
        Recalculate cumulative tax for all active brackets.

        This updates the cumulative_tax field for each bracket
        based on the progressive tax calculation.
        """
        brackets = TaxBracket.objects.filter(is_active=True).order_by('order', 'min_amount')

        cumulative = Decimal('0')
        updated_brackets = []

        for bracket in brackets:
            bracket.cumulative_tax = cumulative
            bracket.save(update_fields=['cumulative_tax'])
            updated_brackets.append(bracket)

            # Calculate tax for this bracket's range
            if bracket.max_amount:
                bracket_range = bracket.max_amount - bracket.min_amount
                bracket_tax = bracket_range * (bracket.rate / Decimal('100'))
                cumulative += bracket_tax

        serializer = self.get_serializer(updated_brackets, many=True)
        return Response({
            'message': 'Cumulative tax recalculated',
            'brackets': serializer.data
        })


class SSNITRateListView(generics.ListAPIView):
    """List SSNIT rates."""
    queryset = SSNITRate.objects.filter(is_active=True)
    serializer_class = SSNITRateSerializer


class TaxReliefListView(generics.ListAPIView):
    """List tax reliefs."""
    queryset = TaxRelief.objects.filter(is_active=True)
    serializer_class = TaxReliefSerializer


class PayrollSummaryReportView(APIView):
    """Get payroll summary report."""

    def get(self, request):
        # TODO: Implement payroll summary
        return Response({'message': 'Payroll summary report endpoint'})


class PAYEReportView(APIView):
    """Get PAYE report."""

    def get(self, request):
        # TODO: Implement PAYE report
        return Response({'message': 'PAYE report endpoint'})


class SSNITReportView(APIView):
    """Get SSNIT report."""

    def get(self, request):
        # TODO: Implement SSNIT report
        return Response({'message': 'SSNIT report endpoint'})


class BankAdviceReportView(APIView):
    """Get bank advice report."""

    def get(self, request):
        # TODO: Implement bank advice report
        return Response({'message': 'Bank advice report endpoint'})


class OvertimeBonusTaxConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Overtime and Bonus Tax Configuration.

    Allows admin to configure:
    - Overtime tax: salary threshold, basic % threshold, tax rates
    - Bonus tax: annual basic % threshold, flat rate, excess handling
    - Non-resident rates for both overtime and bonus
    """
    queryset = OvertimeBonusTaxConfig.objects.all()
    serializer_class = OvertimeBonusTaxConfigSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active']
    ordering_fields = ['effective_from', 'created_at']
    ordering = ['-effective_from']

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the currently active configuration."""
        config = OvertimeBonusTaxConfig.get_active_config()
        if config:
            serializer = self.get_serializer(config)
            return Response(serializer.data)
        return Response(
            {'message': 'No active configuration found'},
            status=status.HTTP_404_NOT_FOUND
        )

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a specific configuration and deactivate others."""
        config = self.get_object()

        # Deactivate all other configurations
        OvertimeBonusTaxConfig.objects.exclude(pk=pk).update(is_active=False)

        # Activate this configuration
        config.is_active = True
        config.save(update_fields=['is_active', 'updated_at'])

        serializer = self.get_serializer(config)
        return Response({
            'message': 'Configuration activated successfully',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def calculate_preview(self, request):
        """
        Preview overtime and bonus tax calculations for given amounts.

        Query params:
        - basic_salary: Monthly basic salary
        - annual_salary: Annual salary (for overtime eligibility check)
        - overtime_amount: Overtime earnings
        - bonus_amount: Bonus amount
        - is_resident: Whether employee is resident (default: true)
        """
        from decimal import Decimal, InvalidOperation

        try:
            basic_salary = Decimal(request.query_params.get('basic_salary', '0'))
            annual_salary = Decimal(request.query_params.get('annual_salary', '0'))
            overtime_amount = Decimal(request.query_params.get('overtime_amount', '0'))
            bonus_amount = Decimal(request.query_params.get('bonus_amount', '0'))
            is_resident = request.query_params.get('is_resident', 'true').lower() == 'true'
        except (InvalidOperation, ValueError):
            return Response(
                {'error': 'Invalid numeric values provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        config = OvertimeBonusTaxConfig.get_active_config()
        if not config:
            return Response(
                {'error': 'No active tax configuration found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Calculate using the config
        annual_basic = basic_salary * Decimal('12')

        # Overtime eligibility check
        overtime_qualifies = annual_salary <= config.overtime_annual_salary_threshold

        # Overtime tax
        overtime_tax = Decimal('0')
        overtime_to_paye = Decimal('0')

        if overtime_amount > 0:
            if not is_resident:
                overtime_tax = overtime_amount * (config.non_resident_overtime_rate / Decimal('100'))
            elif overtime_qualifies:
                threshold = basic_salary * (config.overtime_basic_percentage_threshold / Decimal('100'))
                if overtime_amount <= threshold:
                    overtime_tax = overtime_amount * (config.overtime_rate_below_threshold / Decimal('100'))
                else:
                    overtime_tax = (
                        threshold * (config.overtime_rate_below_threshold / Decimal('100')) +
                        (overtime_amount - threshold) * (config.overtime_rate_above_threshold / Decimal('100'))
                    )
            else:
                overtime_to_paye = overtime_amount

        # Bonus tax
        bonus_tax = Decimal('0')
        bonus_excess = Decimal('0')

        if bonus_amount > 0:
            if not is_resident:
                bonus_tax = bonus_amount * (config.non_resident_bonus_rate / Decimal('100'))
            else:
                threshold = annual_basic * (config.bonus_annual_basic_percentage_threshold / Decimal('100'))
                if bonus_amount <= threshold:
                    bonus_tax = bonus_amount * (config.bonus_flat_rate / Decimal('100'))
                else:
                    bonus_tax = threshold * (config.bonus_flat_rate / Decimal('100'))
                    if config.bonus_excess_to_paye:
                        bonus_excess = bonus_amount - threshold

        return Response({
            'config': OvertimeBonusTaxConfigSerializer(config).data,
            'inputs': {
                'basic_salary': str(basic_salary),
                'annual_salary': str(annual_salary),
                'annual_basic': str(annual_basic),
                'overtime_amount': str(overtime_amount),
                'bonus_amount': str(bonus_amount),
                'is_resident': is_resident,
            },
            'overtime': {
                'qualifies_for_preferential_rate': overtime_qualifies,
                'salary_threshold': str(config.overtime_annual_salary_threshold),
                'basic_percentage_threshold': str(config.overtime_basic_percentage_threshold),
                'overtime_tax': str(overtime_tax.quantize(Decimal('0.01'))),
                'overtime_to_paye': str(overtime_to_paye),
                'explanation': (
                    f'Employee {"qualifies" if overtime_qualifies else "does NOT qualify"} for preferential overtime rates '
                    f'(annual salary {"<=" if overtime_qualifies else ">"} GHS {config.overtime_annual_salary_threshold})'
                ),
            },
            'bonus': {
                'threshold_amount': str((annual_basic * config.bonus_annual_basic_percentage_threshold / Decimal('100')).quantize(Decimal('0.01'))),
                'bonus_tax': str(bonus_tax.quantize(Decimal('0.01'))),
                'bonus_excess_to_paye': str(bonus_excess),
            },
        })


class BankViewSet(viewsets.ModelViewSet):
    """ViewSet for Banks."""
    queryset = Bank.objects.all()
    serializer_class = BankSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name', 'swift_code']
    ordering_fields = ['code', 'name', 'created_at']
    ordering = ['name']


class BankBranchViewSet(viewsets.ModelViewSet):
    """ViewSet for Bank Branches."""
    queryset = BankBranch.objects.select_related('bank', 'region')
    serializer_class = BankBranchSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['bank', 'is_active', 'region']
    search_fields = ['code', 'name', 'city', 'bank__name']
    ordering_fields = ['code', 'name', 'bank__name', 'created_at']
    ordering = ['bank__name', 'name']


class StaffCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Staff Categories."""
    queryset = StaffCategory.objects.all()
    serializer_class = StaffCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'payroll_group']
    search_fields = ['code', 'name', 'payroll_group']
    ordering_fields = ['sort_order', 'code', 'name', 'created_at']
    ordering = ['sort_order', 'name']


class SalaryBandViewSet(viewsets.ModelViewSet):
    """ViewSet for Salary Bands."""
    queryset = SalaryBand.objects.all()
    serializer_class = SalaryBandSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']
    ordering_fields = ['sort_order', 'code', 'name', 'created_at']
    ordering = ['sort_order', 'code']


class SalaryLevelViewSet(viewsets.ModelViewSet):
    """ViewSet for Salary Levels."""
    queryset = SalaryLevel.objects.select_related('band')
    serializer_class = SalaryLevelSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['band', 'is_active']
    search_fields = ['code', 'name', 'band__code', 'band__name']
    ordering_fields = ['sort_order', 'code', 'name', 'band__sort_order', 'created_at']
    ordering = ['band__sort_order', 'sort_order', 'code']


class SalaryNotchViewSet(viewsets.ModelViewSet):
    """ViewSet for Salary Notches."""
    queryset = SalaryNotch.objects.select_related('level', 'level__band')
    serializer_class = SalaryNotchSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['level', 'level__band', 'is_active']
    search_fields = ['code', 'name', 'level__code', 'level__band__code']
    ordering_fields = ['sort_order', 'code', 'name', 'amount', 'created_at']
    ordering = ['level__band__sort_order', 'level__sort_order', 'sort_order', 'code']


# ============================================
# Payslip and Bank File Download Views
# ============================================

class PayslipDownloadView(APIView):
    """Download a single payslip by ID."""

    def get(self, request, pk):
        try:
            payslip = Payslip.objects.select_related(
                'payroll_item__employee',
                'payroll_item__payroll_run'
            ).get(pk=pk)
        except Payslip.DoesNotExist:
            return Response(
                {'error': 'Payslip not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not payslip.file_data:
            return Response(
                {'error': 'Payslip file not generated yet'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update downloaded_at timestamp
        payslip.downloaded_at = timezone.now()
        payslip.save(update_fields=['downloaded_at'])

        response = HttpResponse(
            payslip.file_data,
            content_type=payslip.mime_type or 'application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{payslip.file_name or payslip.payslip_number + ".pdf"}"'
        response['Content-Length'] = payslip.file_size or len(payslip.file_data)
        return response


class PayrollRunPayslipsListView(APIView):
    """List all payslips for a payroll run."""

    def get(self, request, run_id):
        try:
            payroll_run = PayrollRun.objects.get(pk=run_id)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        payslips = Payslip.objects.filter(
            payroll_item__payroll_run=payroll_run
        ).select_related(
            'payroll_item__employee'
        ).values(
            'id',
            'payslip_number',
            'file_name',
            'file_size',
            'generated_at',
            'downloaded_at',
            'payroll_item__employee__employee_number',
            'payroll_item__employee__first_name',
            'payroll_item__employee__last_name',
        )

        return Response({
            'payroll_run': {
                'id': str(payroll_run.id),
                'run_number': payroll_run.run_number,
                'period_name': payroll_run.payroll_period.name if payroll_run.payroll_period else None,
            },
            'total_count': payslips.count(),
            'payslips': list(payslips)
        })


class PayrollRunPayslipsDownloadView(APIView):
    """Download payslips for a payroll run in various formats (PDF, Excel, CSV) with optional filters."""

    def get(self, request, run_id):
        import zipfile
        import io
        from .generators import PayslipGenerator

        try:
            payroll_run = PayrollRun.objects.get(pk=run_id)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get file_format parameter (default: pdf)
        # Note: Using 'file_format' instead of 'format' to avoid conflict with DRF's format suffix
        file_format = request.query_params.get('file_format', 'pdf').lower()
        if file_format not in ['pdf', 'excel', 'csv', 'text']:
            return Response(
                {'error': 'Invalid file_format. Use: pdf, excel, csv, or text'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get payroll items with filters
        items = PayrollItem.objects.filter(
            payroll_run=payroll_run
        ).exclude(
            status=PayrollItem.Status.ERROR
        ).select_related(
            'employee', 'employee__department', 'employee__position',
            'employee__division', 'employee__directorate', 'employee__grade',
            'employee__salary_notch', 'employee__salary_notch__level',
            'employee__salary_notch__level__band', 'employee__work_location'
        ).prefetch_related('details', 'details__pay_component')

        # Apply employee filters
        if request.query_params.get('employee_code'):
            items = items.filter(employee__employee_number__icontains=request.query_params['employee_code'])
        if request.query_params.get('division'):
            items = items.filter(employee__division_id=request.query_params['division'])
        if request.query_params.get('directorate'):
            items = items.filter(employee__directorate_id=request.query_params['directorate'])
        if request.query_params.get('department'):
            items = items.filter(employee__department_id=request.query_params['department'])
        if request.query_params.get('position'):
            items = items.filter(employee__position_id=request.query_params['position'])
        if request.query_params.get('grade'):
            items = items.filter(employee__grade_id=request.query_params['grade'])
        if request.query_params.get('salary_band'):
            items = items.filter(employee__salary_notch__level__band_id=request.query_params['salary_band'])
        if request.query_params.get('salary_level'):
            items = items.filter(employee__salary_notch__level_id=request.query_params['salary_level'])
        if request.query_params.get('staff_category'):
            items = items.filter(employee__staff_category_id=request.query_params['staff_category'])

        if not items.exists():
            return Response(
                {'error': 'No payroll items found matching the filters'},
                status=status.HTTP_404_NOT_FOUND
            )

        period = payroll_run.payroll_period

        # Generate payslips in requested format
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for item in items:
                generator = PayslipGenerator(item, period)
                emp = item.employee

                if file_format == 'pdf':
                    content = generator.generate_pdf()
                    ext = 'pdf'
                    mime = 'application/pdf'
                elif file_format == 'excel':
                    content = generator.generate_excel()
                    ext = 'xlsx'
                    mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                else:  # csv/text
                    content = generator.generate_text()
                    ext = 'txt'
                    mime = 'text/plain'

                filename = f"{emp.employee_number}_{payroll_run.run_number}.{ext}"
                zf.writestr(filename, content)

        buffer.seek(0)

        zip_filename = f"payslips_{payroll_run.run_number}_{file_format}.zip"
        response = HttpResponse(buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{zip_filename}"'
        return response


class BankFileDownloadView(APIView):
    """Download a single bank file by ID."""

    def get(self, request, pk):
        try:
            bank_file = BankFile.objects.select_related('payroll_run').get(pk=pk)
        except BankFile.DoesNotExist:
            return Response(
                {'error': 'Bank file not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not bank_file.file_data:
            return Response(
                {'error': 'Bank file data not available'},
                status=status.HTTP_404_NOT_FOUND
            )

        response = HttpResponse(
            bank_file.file_data,
            content_type=bank_file.mime_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{bank_file.file_name}"'
        response['Content-Length'] = bank_file.file_size or len(bank_file.file_data)
        return response


class PayrollRunBankFilesListView(APIView):
    """List all bank files for a payroll run."""

    def get(self, request, run_id):
        try:
            payroll_run = PayrollRun.objects.get(pk=run_id)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        bank_files = BankFile.objects.filter(
            payroll_run=payroll_run
        ).values(
            'id',
            'bank_name',
            'file_name',
            'file_format',
            'file_size',
            'total_amount',
            'transaction_count',
            'generated_at',
            'is_submitted',
            'submitted_at',
        )

        return Response({
            'payroll_run': {
                'id': str(payroll_run.id),
                'run_number': payroll_run.run_number,
                'period_name': payroll_run.payroll_period.name if payroll_run.payroll_period else None,
            },
            'total_count': bank_files.count(),
            'bank_files': list(bank_files)
        })


class PayrollRunBankFileDownloadView(APIView):
    """Download bank payment file for a payroll run in various formats (PDF, Excel, CSV) with optional filters."""

    def get(self, request, run_id):
        from .generators import BankFileGenerator

        try:
            payroll_run = PayrollRun.objects.get(pk=run_id)
        except PayrollRun.DoesNotExist:
            return Response(
                {'error': 'Payroll run not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get file_format parameter (default: csv)
        # Note: Using 'file_format' instead of 'format' to avoid conflict with DRF's format suffix
        file_format = request.query_params.get('file_format', 'csv').lower()
        if file_format not in ['pdf', 'excel', 'csv', 'text']:
            return Response(
                {'error': 'Invalid file_format. Use: pdf, excel, csv, or text'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get payroll items with bank details
        items = PayrollItem.objects.filter(
            payroll_run=payroll_run,
            bank_account_number__isnull=False
        ).select_related('employee')

        # Apply employee filters
        if request.query_params.get('employee_code'):
            items = items.filter(employee__employee_number__icontains=request.query_params['employee_code'])
        if request.query_params.get('division'):
            items = items.filter(employee__division_id=request.query_params['division'])
        if request.query_params.get('directorate'):
            items = items.filter(employee__directorate_id=request.query_params['directorate'])
        if request.query_params.get('department'):
            items = items.filter(employee__department_id=request.query_params['department'])
        if request.query_params.get('position'):
            items = items.filter(employee__position_id=request.query_params['position'])
        if request.query_params.get('grade'):
            items = items.filter(employee__grade_id=request.query_params['grade'])
        if request.query_params.get('salary_band'):
            items = items.filter(employee__salary_notch__level__band_id=request.query_params['salary_band'])
        if request.query_params.get('salary_level'):
            items = items.filter(employee__salary_notch__level_id=request.query_params['salary_level'])
        if request.query_params.get('staff_category'):
            items = items.filter(employee__staff_category_id=request.query_params['staff_category'])
        if request.query_params.get('bank'):
            items = items.filter(bank_name__icontains=request.query_params['bank'])

        items = items.order_by('bank_name', 'employee__employee_number')

        if not items.exists():
            return Response(
                {'error': 'No payment records found matching the filters'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Generate file in requested format
        generator = BankFileGenerator(payroll_run, list(items))
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')

        if file_format == 'pdf':
            content = generator.generate_pdf()
            filename = f"bank_advice_{payroll_run.run_number}_{timestamp}.pdf"
            content_type = 'application/pdf'
        elif file_format == 'excel':
            content = generator.generate_excel()
            filename = f"bank_advice_{payroll_run.run_number}_{timestamp}.xlsx"
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:  # csv/text
            content = generator.generate_csv()
            filename = f"bank_payment_{payroll_run.run_number}_{timestamp}.csv"
            content_type = 'text/csv'

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
