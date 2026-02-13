"""
Views for training management.
"""

from decimal import Decimal
from datetime import date, timedelta
from django.db.models import Count, Q, Avg, Sum, F, Value, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import (
    TrainingProgram, TrainingSession, TrainingEnrollment,
    PostTrainingReport, TrainingImpactAssessment,
    TrainingRequest,
)
from .serializers import (
    TrainingProgramListSerializer, TrainingProgramDetailSerializer,
    TrainingProgramCreateSerializer,
    TrainingSessionListSerializer, TrainingSessionDetailSerializer,
    TrainingSessionCreateSerializer,
    TrainingEnrollmentListSerializer, TrainingEnrollmentDetailSerializer,
    TrainingEnrollmentCreateSerializer, MyEnrollmentSerializer,
    PostTrainingReportSerializer, PostTrainingReportCreateSerializer,
    TrainingImpactAssessmentSerializer, TrainingImpactAssessmentCreateSerializer,
    TrainingRequestSerializer, TrainingRequestCreateSerializer,
)


class TrainingProgramViewSet(viewsets.ModelViewSet):
    """Training program management."""
    queryset = TrainingProgram.objects.all()
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code', 'description', 'provider']
    filterset_fields = ['category', 'training_type', 'is_mandatory', 'is_active']

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingProgramListSerializer
        if self.action == 'create':
            return TrainingProgramCreateSerializer
        return TrainingProgramDetailSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Program statistics."""
        programs = TrainingProgram.objects.all()
        by_category = list(
            programs.values('category').annotate(count=Count('id')).order_by('category')
        )
        total_sessions = TrainingSession.objects.count()
        total_enrolled = TrainingEnrollment.objects.count()
        return Response({
            'total_programs': programs.count(),
            'active_programs': programs.filter(is_active=True).count(),
            'mandatory_programs': programs.filter(is_mandatory=True).count(),
            'by_category': by_category,
            'total_sessions': total_sessions,
            'total_enrolled': total_enrolled,
        })

    @action(detail=True, methods=['get'])
    def sessions(self, request, pk=None):
        """List sessions for a program."""
        program = self.get_object()
        sessions = program.sessions.all()
        serializer = TrainingSessionListSerializer(sessions, many=True)
        return Response(serializer.data)


class TrainingSessionViewSet(viewsets.ModelViewSet):
    """Training session management."""
    queryset = TrainingSession.objects.select_related('program').all()
    permission_classes = [IsAuthenticated]
    search_fields = ['title', 'facilitator', 'venue', 'program__name']
    filterset_fields = ['program', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingSessionListSerializer
        if self.action == 'create':
            return TrainingSessionCreateSerializer
        return TrainingSessionDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Date range filtering
        start_after = self.request.query_params.get('start_after')
        start_before = self.request.query_params.get('start_before')
        if start_after:
            queryset = queryset.filter(start_date__gte=start_after)
        if start_before:
            queryset = queryset.filter(start_date__lte=start_before)
        return queryset

    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        """Enroll one or more employees in a session."""
        session = self.get_object()
        employee_ids = request.data.get('employee_ids', [])
        if not employee_ids:
            return Response(
                {'detail': 'employee_ids is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        skipped = []
        for emp_id in employee_ids:
            enrollment, was_created = TrainingEnrollment.objects.get_or_create(
                session=session,
                employee_id=emp_id,
                defaults={'status': TrainingEnrollment.EnrollmentStatus.ENROLLED}
            )
            if was_created:
                created.append(str(enrollment.employee_id))
            else:
                skipped.append(str(enrollment.employee_id))

        # Send notifications to newly enrolled employees
        if created:
            from core.tasks import send_notification_task
            from employees.models import Employee

            enrolled_employees = Employee.objects.filter(
                id__in=created
            ).select_related('user')

            for emp in enrolled_employees:
                if emp.user_id:
                    send_notification_task.delay(
                        str(emp.user_id),
                        'INFO',
                        {
                            'title': f'Training Enrollment: {session.title}',
                            'message': f'You have been enrolled in training session "{session.title}", scheduled from {session.start_date.strftime("%d %b %Y")} to {session.end_date.strftime("%d %b %Y")}.',
                            'link': '/training/sessions',
                            'extra_data': {
                                'session_id': str(session.id),
                                'program_id': str(session.program_id),
                            },
                        }
                    )

        return Response({
            'enrolled': len(created),
            'skipped': len(skipped),
            'created_ids': created,
            'skipped_ids': skipped,
        })

    @action(detail=True, methods=['post'])
    def mark_attendance(self, request, pk=None):
        """Bulk update enrollment statuses for attendance."""
        session = self.get_object()
        updates = request.data.get('updates', [])
        # updates: [{"enrollment_id": "...", "status": "ATTENDED"}, ...]
        updated_count = 0
        for item in updates:
            enrollment_id = item.get('enrollment_id')
            new_status = item.get('status')
            if enrollment_id and new_status:
                updated = session.enrollments.filter(id=enrollment_id).update(
                    status=new_status,
                    attendance_date=date.today() if new_status == 'ATTENDED' else None,
                )
                updated_count += updated

        return Response({'updated': updated_count})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark session as completed and update enrollment statuses."""
        session = self.get_object()
        session.status = TrainingSession.SessionStatus.COMPLETED
        session.save()

        # Mark all ATTENDED enrollments as COMPLETED
        session.enrollments.filter(
            status=TrainingEnrollment.EnrollmentStatus.ATTENDED
        ).update(status=TrainingEnrollment.EnrollmentStatus.COMPLETED)

        # Mark remaining ENROLLED as NO_SHOW
        session.enrollments.filter(
            status=TrainingEnrollment.EnrollmentStatus.ENROLLED
        ).update(status=TrainingEnrollment.EnrollmentStatus.NO_SHOW)

        serializer = TrainingSessionDetailSerializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel session and update all enrollments."""
        session = self.get_object()
        session.status = TrainingSession.SessionStatus.CANCELLED
        session.save()

        session.enrollments.exclude(
            status=TrainingEnrollment.EnrollmentStatus.CANCELLED
        ).update(status=TrainingEnrollment.EnrollmentStatus.CANCELLED)

        serializer = TrainingSessionDetailSerializer(session)
        return Response(serializer.data)


class TrainingEnrollmentViewSet(viewsets.ModelViewSet):
    """Training enrollment management."""
    queryset = TrainingEnrollment.objects.select_related(
        'session', 'session__program', 'employee', 'employee__department'
    ).all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['session', 'employee', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingEnrollmentListSerializer
        if self.action == 'create':
            return TrainingEnrollmentCreateSerializer
        return TrainingEnrollmentDetailSerializer

    @action(detail=True, methods=['post'])
    def evaluate(self, request, pk=None):
        """Set score and feedback for an enrollment."""
        enrollment = self.get_object()
        score = request.data.get('score')
        feedback = request.data.get('feedback', '')

        if score is not None:
            enrollment.score = score
        if feedback:
            enrollment.feedback = feedback
        enrollment.save()

        serializer = TrainingEnrollmentDetailSerializer(enrollment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def issue_certificate(self, request, pk=None):
        """Mark certificate as issued."""
        enrollment = self.get_object()
        enrollment.certificate_issued = True
        enrollment.certificate_date = date.today()
        enrollment.save()

        serializer = TrainingEnrollmentDetailSerializer(enrollment)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_enrollments(self, request):
        """Get training enrollments for the current user."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'No employee profile found'},
                status=status.HTTP_404_NOT_FOUND
            )
        enrollments = self.get_queryset().filter(
            employee=employee
        ).order_by('-session__start_date')

        # Optional status filter
        enrollment_status = request.query_params.get('status')
        if enrollment_status:
            enrollments = enrollments.filter(status=enrollment_status)

        serializer = MyEnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)


class TrainingDashboardView(APIView):
    """Training dashboard statistics."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        thirty_days = today + timedelta(days=30)

        # Overall stats
        total_programs = TrainingProgram.objects.filter(is_active=True).count()
        active_sessions = TrainingSession.objects.filter(
            status__in=['SCHEDULED', 'IN_PROGRESS']
        ).count()
        total_enrolled = TrainingEnrollment.objects.exclude(
            status=TrainingEnrollment.EnrollmentStatus.CANCELLED
        ).count()
        total_completed = TrainingEnrollment.objects.filter(
            status=TrainingEnrollment.EnrollmentStatus.COMPLETED
        ).count()
        completion_rate = (
            round((total_completed / total_enrolled) * 100, 1) if total_enrolled > 0 else 0
        )

        # Upcoming sessions (next 30 days)
        upcoming_sessions = TrainingSession.objects.select_related('program').filter(
            start_date__gte=today,
            start_date__lte=thirty_days,
            status=TrainingSession.SessionStatus.SCHEDULED,
        ).order_by('start_date')[:10]
        upcoming_data = TrainingSessionListSerializer(upcoming_sessions, many=True).data

        # Recent completions
        recent_completions = TrainingSession.objects.select_related('program').filter(
            status=TrainingSession.SessionStatus.COMPLETED,
        ).order_by('-end_date')[:10]
        recent_data = TrainingSessionListSerializer(recent_completions, many=True).data

        # Programs by category
        by_category = list(
            TrainingProgram.objects.filter(is_active=True)
            .values('category')
            .annotate(count=Count('id'))
            .order_by('category')
        )

        # Top training areas (programs with most enrollments)
        top_programs = list(
            TrainingProgram.objects.filter(is_active=True)
            .annotate(total_enrolled=Count('sessions__enrollments'))
            .order_by('-total_enrolled')
            .values('id', 'name', 'code', 'category', 'total_enrolled')[:5]
        )

        # ── Advanced Analytics ──────────────────────────────────────

        # 1. Completion rate by department
        dept_enrollment_stats = (
            TrainingEnrollment.objects
            .exclude(status=TrainingEnrollment.EnrollmentStatus.CANCELLED)
            .values(department_name=F('employee__department__name'))
            .annotate(
                total_enrollments=Count('id'),
                completed_enrollments=Count(
                    'id', filter=Q(status=TrainingEnrollment.EnrollmentStatus.COMPLETED)
                ),
            )
            .order_by('department_name')
        )
        completion_rate_by_department = []
        for row in dept_enrollment_stats:
            dept_name = row['department_name'] or 'Unassigned'
            dept_total = row['total_enrollments']
            dept_completed = row['completed_enrollments']
            completion_rate_by_department.append({
                'department': dept_name,
                'total_enrollments': dept_total,
                'completed_enrollments': dept_completed,
                'completion_rate': (
                    round((dept_completed / dept_total) * 100, 1) if dept_total > 0 else 0
                ),
            })

        # 2. Staff trained by department
        from employees.models import Employee
        from organization.models import Department

        all_departments = Department.objects.all()
        trained_by_dept_qs = (
            TrainingEnrollment.objects
            .filter(status=TrainingEnrollment.EnrollmentStatus.COMPLETED)
            .values(department_name=F('employee__department__name'))
            .annotate(trained_count=Count('employee', distinct=True))
        )
        trained_map = {
            row['department_name']: row['trained_count']
            for row in trained_by_dept_qs
        }

        staff_trained_by_department = []
        for dept in all_departments.order_by('name'):
            total_staff = Employee.objects.filter(department=dept).count()
            trained_count = trained_map.get(dept.name, 0)
            staff_trained_by_department.append({
                'department': dept.name,
                'total_staff': total_staff,
                'trained_count': trained_count,
                'percentage': (
                    round((trained_count / total_staff) * 100, 1)
                    if total_staff > 0 else 0
                ),
            })

        # 3. Cost analysis
        # Total estimated cost: sum of cost_per_person across all active programs
        total_estimated_cost = (
            TrainingProgram.objects.filter(is_active=True)
            .aggregate(
                total=Coalesce(Sum('cost_per_person'), Decimal('0.00'), output_field=DecimalField())
            )['total']
        )

        # Total actual cost: sum(cost_per_person * number of completed enrollments) per program
        actual_cost_qs = (
            TrainingProgram.objects.filter(
                sessions__enrollments__status=TrainingEnrollment.EnrollmentStatus.COMPLETED
            )
            .annotate(
                completed_count=Count(
                    'sessions__enrollments',
                    filter=Q(sessions__enrollments__status=TrainingEnrollment.EnrollmentStatus.COMPLETED),
                )
            )
            .annotate(
                program_cost=F('cost_per_person') * F('completed_count')
            )
            .aggregate(
                total=Coalesce(Sum('program_cost'), Decimal('0.00'), output_field=DecimalField())
            )
        )
        total_actual_cost = actual_cost_qs['total']

        avg_cost_per_employee = (
            round(total_actual_cost / total_completed, 2)
            if total_completed > 0 else Decimal('0.00')
        )

        cost_analysis = {
            'total_estimated_cost': str(total_estimated_cost),
            'total_actual_cost': str(total_actual_cost),
            'avg_cost_per_employee': str(avg_cost_per_employee),
        }

        # 4. Training type distribution
        training_type_distribution = list(
            TrainingEnrollment.objects
            .exclude(status=TrainingEnrollment.EnrollmentStatus.CANCELLED)
            .values(training_type=F('session__program__training_type'))
            .annotate(count=Count('id'))
            .order_by('training_type')
        )

        return Response({
            'total_programs': total_programs,
            'active_sessions': active_sessions,
            'total_enrolled': total_enrolled,
            'total_completed': total_completed,
            'completion_rate': completion_rate,
            'upcoming_sessions': upcoming_data,
            'recent_completions': recent_data,
            'by_category': by_category,
            'top_programs': top_programs,
            # Advanced analytics
            'completion_rate_by_department': completion_rate_by_department,
            'staff_trained_by_department': staff_trained_by_department,
            'cost_analysis': cost_analysis,
            'training_type_distribution': training_type_distribution,
        })


class PostTrainingReportViewSet(viewsets.ModelViewSet):
    """Post-training report management."""
    queryset = PostTrainingReport.objects.select_related(
        'enrollment', 'enrollment__employee', 'enrollment__session',
        'enrollment__session__program'
    )
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'enrollment']

    def get_serializer_class(self):
        if self.action == 'create':
            return PostTrainingReportCreateSerializer
        return PostTrainingReportSerializer

    @action(detail=False, methods=['get'])
    def my_reports(self, request):
        """Get reports for the current user's enrollments."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'No employee profile found'},
                status=status.HTTP_404_NOT_FOUND
            )
        reports = self.get_queryset().filter(enrollment__employee=employee)
        serializer = PostTrainingReportSerializer(reports, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a post-training report."""
        report = self.get_object()
        report.status = PostTrainingReport.Status.SUBMITTED
        report.submitted_at = timezone.now()
        report.save()
        serializer = PostTrainingReportSerializer(report)
        return Response(serializer.data)


class TrainingImpactAssessmentViewSet(viewsets.ModelViewSet):
    """Training impact assessment management."""
    queryset = TrainingImpactAssessment.objects.select_related(
        'enrollment', 'enrollment__employee', 'enrollment__session',
        'enrollment__session__program', 'assessor'
    )
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'enrollment', 'assessor']

    def get_serializer_class(self):
        if self.action == 'create':
            return TrainingImpactAssessmentCreateSerializer
        return TrainingImpactAssessmentSerializer

    def perform_create(self, serializer):
        """Auto-set assessor from request user."""
        employee = getattr(self.request.user, 'employee', None)
        if not employee:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('User must have an employee profile')
        serializer.save(assessor=employee)

    @action(detail=False, methods=['get'])
    def my_assessments(self, request):
        """Get assessments made by the current user."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'No employee profile found'},
                status=status.HTTP_404_NOT_FOUND
            )
        assessments = self.get_queryset().filter(assessor=employee)
        serializer = TrainingImpactAssessmentSerializer(assessments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit an impact assessment."""
        assessment = self.get_object()
        assessment.status = TrainingImpactAssessment.Status.SUBMITTED
        assessment.submitted_at = timezone.now()
        assessment.save()
        serializer = TrainingImpactAssessmentSerializer(assessment)
        return Response(serializer.data)


class TrainingRequestViewSet(viewsets.ModelViewSet):
    """Self-service training request management."""
    queryset = TrainingRequest.objects.select_related(
        'employee', 'employee__department', 'training_program', 'reviewed_by'
    )
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'employee', 'training_type']
    search_fields = ['title', 'description', 'employee__first_name', 'employee__last_name']

    def get_serializer_class(self):
        if self.action == 'create':
            return TrainingRequestCreateSerializer
        return TrainingRequestSerializer

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        if not employee:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('User must have an employee profile')
        serializer.save(employee=employee, created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's training requests."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'No employee profile found'},
                status=status.HTTP_404_NOT_FOUND
            )
        requests = self.get_queryset().filter(employee=employee)
        serializer = TrainingRequestSerializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft request."""
        obj = self.get_object()
        if obj.status != TrainingRequest.Status.DRAFT:
            return Response(
                {'detail': 'Only draft requests can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = TrainingRequest.Status.SUBMITTED
        obj.save()
        return Response(TrainingRequestSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted request."""
        obj = self.get_object()
        if obj.status != TrainingRequest.Status.SUBMITTED:
            return Response(
                {'detail': 'Only submitted requests can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = TrainingRequest.Status.APPROVED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.review_notes = request.data.get('notes', '')
        obj.save()

        # Auto-create a TrainingNeed in the performance module
        try:
            from performance.models import TrainingNeed
            TrainingNeed.objects.create(
                employee=obj.employee,
                title=obj.title,
                description=obj.justification or obj.description,
                training_type=obj.training_type if obj.training_type in dict(TrainingNeed.Type.choices) else 'TRAINING',
                priority='MEDIUM',
                status='IDENTIFIED',
                estimated_cost=obj.estimated_cost,
                target_date=obj.preferred_date,
                created_by=request.user,
            )
        except Exception:
            pass  # Don't fail approval if training need creation fails

        return Response(TrainingRequestSerializer(obj).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted request."""
        obj = self.get_object()
        if obj.status != TrainingRequest.Status.SUBMITTED:
            return Response(
                {'detail': 'Only submitted requests can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        obj.status = TrainingRequest.Status.REJECTED
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        obj.review_notes = request.data.get('notes', '')
        obj.save()
        return Response(TrainingRequestSerializer(obj).data)
