"""
Views for training management.
"""

from datetime import date, timedelta
from django.db.models import Count, Q, Avg
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import TrainingProgram, TrainingSession, TrainingEnrollment
from .serializers import (
    TrainingProgramListSerializer, TrainingProgramDetailSerializer,
    TrainingProgramCreateSerializer,
    TrainingSessionListSerializer, TrainingSessionDetailSerializer,
    TrainingSessionCreateSerializer,
    TrainingEnrollmentListSerializer, TrainingEnrollmentDetailSerializer,
    TrainingEnrollmentCreateSerializer,
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
        })
