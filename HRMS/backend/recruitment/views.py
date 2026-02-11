"""
Recruitment views for vacancy, applicant, interview, and scoring management.
"""

from rest_framework import viewsets, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Avg, Max, Min, Count

from rest_framework.permissions import AllowAny

from .models import (
    Vacancy, Applicant, Interview, InterviewPanel, InterviewFeedback,
    Reference, JobOffer,
    InterviewScoreTemplate, InterviewScoreCategory,
    InterviewScoringSheet, InterviewScoreItem, InterviewReport,
    VacancyURL, VacancyURLView, ApplicantPortalAccess, ApplicantStatusHistory,
    ApplicantDocument, ApplicantAttachment
)
from .services import ShortlistingService, auto_shortlist_applicant, apply_template_to_vacancy
from .serializers import (
    VacancySerializer, ApplicantSerializer,
    InterviewSerializer, InterviewPanelSerializer, InterviewFeedbackSerializer,
    ReferenceSerializer, JobOfferSerializer,
    InterviewScoreTemplateSerializer, InterviewScoreTemplateCreateSerializer,
    InterviewScoreCategorySerializer,
    InterviewScoringSheetSerializer, InterviewScoringSheetCreateSerializer,
    InterviewScoringSheetUpdateSerializer,
    InterviewScoreItemSerializer, InterviewReportSerializer,
    VacancyURLSerializer, VacancyURLCreateSerializer, VacancyURLListSerializer,
    ApplicantPortalAccessSerializer, ApplicantStatusHistorySerializer,
    ApplicantPortalSerializer, PublicVacancySerializer, PublicApplicationSerializer
)


class VacancyViewSet(viewsets.ModelViewSet):
    """ViewSet for Vacancy model."""
    queryset = Vacancy.objects.select_related('position', 'department', 'grade').annotate(
        applicant_count=Count('applicants')
    )
    serializer_class = VacancySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'posting_type', 'department']
    search_fields = ['job_title', 'vacancy_number']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        # Generate vacancy number
        import uuid
        vacancy_number = f"VAC-{uuid.uuid4().hex[:8].upper()}"
        serializer.save(vacancy_number=vacancy_number)

    @action(detail=False, methods=['get'])
    def published(self, request):
        """Get all published vacancies."""
        vacancies = self.get_queryset().filter(status=Vacancy.Status.PUBLISHED)
        serializer = self.get_serializer(vacancies, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a vacancy."""
        vacancy = self.get_object()
        vacancy.status = Vacancy.Status.PUBLISHED
        vacancy.publish_date = timezone.now().date()
        vacancy.save()
        return Response(VacancySerializer(vacancy).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a vacancy."""
        vacancy = self.get_object()
        vacancy.status = Vacancy.Status.CLOSED
        vacancy.save()
        return Response(VacancySerializer(vacancy).data)


class ApplicantViewSet(viewsets.ModelViewSet):
    """ViewSet for Applicant model."""
    queryset = Applicant.objects.select_related('vacancy').prefetch_related('documents')
    serializer_class = ApplicantSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'vacancy', 'source', 'is_internal']
    search_fields = ['first_name', 'last_name', 'email', 'applicant_number']
    ordering = ['-application_date']

    def perform_create(self, serializer):
        # Generate applicant number
        import uuid
        applicant_number = f"APP-{uuid.uuid4().hex[:8].upper()}"
        applicant = serializer.save(applicant_number=applicant_number)

        # Auto-shortlist if vacancy has criteria configured
        try:
            auto_shortlist_applicant(applicant)
        except Exception:
            pass  # Don't fail applicant creation if auto-shortlist errors

    @action(detail=True, methods=['post'])
    def shortlist(self, request, pk=None):
        """Shortlist an applicant."""
        applicant = self.get_object()
        applicant.status = Applicant.Status.SHORTLISTED
        applicant.save()
        return Response(ApplicantSerializer(applicant).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an applicant."""
        applicant = self.get_object()
        reason = request.data.get('reason', '')
        applicant.status = Applicant.Status.REJECTED
        applicant.rejection_reason = reason
        applicant.rejected_at = timezone.now()
        applicant.save()
        return Response(ApplicantSerializer(applicant).data)

    @action(detail=True, methods=['post'])
    def schedule_interview(self, request, pk=None):
        """Update applicant status to interview."""
        applicant = self.get_object()
        applicant.status = Applicant.Status.INTERVIEW
        applicant.save()
        return Response(ApplicantSerializer(applicant).data)


class InterviewViewSet(viewsets.ModelViewSet):
    """ViewSet for Interview model."""
    queryset = Interview.objects.select_related('applicant').prefetch_related(
        'panel_members', 'feedback', 'scoring_sheets'
    )
    serializer_class = InterviewSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'interview_type', 'result', 'applicant']
    ordering = ['scheduled_date', 'scheduled_time']

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark interview as completed."""
        interview = self.get_object()
        interview.status = Interview.Status.COMPLETED
        interview.save()
        return Response(InterviewSerializer(interview).data)

    @action(detail=True, methods=['post'])
    def set_result(self, request, pk=None):
        """Set interview result."""
        interview = self.get_object()
        result = request.data.get('result')
        if result not in [c[0] for c in Interview.Result.choices]:
            return Response(
                {'error': 'Invalid result'},
                status=status.HTTP_400_BAD_REQUEST
            )
        interview.result = result
        interview.status = Interview.Status.COMPLETED
        interview.save()
        return Response(InterviewSerializer(interview).data)

    @action(detail=True, methods=['get'])
    def scoring_summary(self, request, pk=None):
        """Get scoring summary for an interview."""
        interview = self.get_object()
        sheets = interview.scoring_sheets.filter(status='SUBMITTED')

        if not sheets.exists():
            return Response({
                'message': 'No submitted scoring sheets',
                'sheets_count': 0
            })

        summary = {
            'sheets_count': sheets.count(),
            'average_score': sheets.aggregate(avg=Avg('percentage_score'))['avg'],
            'highest_score': sheets.aggregate(max=Max('percentage_score'))['max'],
            'lowest_score': sheets.aggregate(min=Min('percentage_score'))['min'],
            'recommendations': {},
            'sheets': InterviewScoringSheetSerializer(sheets, many=True).data
        }

        # Count recommendations
        for sheet in sheets:
            if sheet.recommendation:
                summary['recommendations'][sheet.recommendation] = \
                    summary['recommendations'].get(sheet.recommendation, 0) + 1

        return Response(summary)


class InterviewPanelViewSet(viewsets.ModelViewSet):
    """ViewSet for InterviewPanel model."""
    queryset = InterviewPanel.objects.select_related('interview', 'interviewer')
    serializer_class = InterviewPanelSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['interview', 'role', 'confirmed']


class InterviewFeedbackViewSet(viewsets.ModelViewSet):
    """ViewSet for InterviewFeedback model."""
    queryset = InterviewFeedback.objects.select_related('interview', 'interviewer')
    serializer_class = InterviewFeedbackSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['interview', 'interviewer']


class ReferenceViewSet(viewsets.ModelViewSet):
    """ViewSet for Reference model."""
    queryset = Reference.objects.select_related('applicant')
    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['applicant', 'status']


class JobOfferViewSet(viewsets.ModelViewSet):
    """ViewSet for JobOffer model."""
    queryset = JobOffer.objects.select_related('applicant', 'position', 'department')
    serializer_class = JobOfferSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'applicant', 'vacancy']
    ordering = ['-offer_date']

    def perform_create(self, serializer):
        # Generate offer number
        import uuid
        offer_number = f"OFR-{uuid.uuid4().hex[:8].upper()}"
        serializer.save(offer_number=offer_number)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send offer to candidate."""
        offer = self.get_object()
        offer.status = JobOffer.Status.SENT
        offer.sent_at = timezone.now()
        offer.save()
        return Response(JobOfferSerializer(offer).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Mark offer as accepted."""
        offer = self.get_object()
        offer.status = JobOffer.Status.ACCEPTED
        offer.responded_at = timezone.now()
        offer.save()
        # Update applicant status
        offer.applicant.status = Applicant.Status.HIRED
        offer.applicant.save()
        return Response(JobOfferSerializer(offer).data)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Mark offer as declined."""
        offer = self.get_object()
        reason = request.data.get('reason', '')
        offer.status = JobOffer.Status.DECLINED
        offer.responded_at = timezone.now()
        offer.decline_reason = reason
        offer.save()
        return Response(JobOfferSerializer(offer).data)


# Interview Scoring ViewSets

class InterviewScoreTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for InterviewScoreTemplate model."""
    queryset = InterviewScoreTemplate.objects.prefetch_related('categories')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['template_type', 'is_active']
    ordering = ['template_type', 'name']

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewScoreTemplateCreateSerializer
        return InterviewScoreTemplateSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active templates."""
        templates = self.get_queryset().filter(is_active=True)
        serializer = InterviewScoreTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_category(self, request, pk=None):
        """Add a category to a template."""
        template = self.get_object()
        serializer = InterviewScoreCategorySerializer(data={
            **request.data,
            'template': template.id
        })
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InterviewScoreCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for InterviewScoreCategory model."""
    queryset = InterviewScoreCategory.objects.select_related('template')
    serializer_class = InterviewScoreCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['template', 'is_required']


class InterviewScoringSheetViewSet(viewsets.ModelViewSet):
    """ViewSet for InterviewScoringSheet model."""
    queryset = InterviewScoringSheet.objects.select_related(
        'interview', 'template', 'interviewer'
    ).prefetch_related('scores')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['interview', 'template', 'interviewer', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return InterviewScoringSheetCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return InterviewScoringSheetUpdateSerializer
        return InterviewScoringSheetSerializer

    @action(detail=False, methods=['get'])
    def my_sheets(self, request):
        """Get current user's scoring sheets."""
        if hasattr(request.user, 'employee'):
            sheets = self.get_queryset().filter(interviewer=request.user.employee)
            serializer = InterviewScoringSheetSerializer(sheets, many=True)
            return Response(serializer.data)
        return Response([])

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a scoring sheet."""
        sheet = self.get_object()
        if sheet.status != InterviewScoringSheet.Status.DRAFT:
            return Response(
                {'error': 'Only draft sheets can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate all required categories have scores
        required_categories = sheet.template.categories.filter(is_required=True)
        scored_categories = sheet.scores.exclude(score__isnull=True).values_list(
            'category_id', flat=True
        )

        missing = required_categories.exclude(id__in=scored_categories)
        if missing.exists():
            return Response(
                {'error': f'Missing scores for required categories: {", ".join(c.name for c in missing)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sheet.status = InterviewScoringSheet.Status.SUBMITTED
        sheet.submitted_at = timezone.now()
        sheet.calculate_scores()
        sheet.save()

        return Response(InterviewScoringSheetSerializer(sheet).data)

    @action(detail=True, methods=['post'])
    def update_scores(self, request, pk=None):
        """Update scores on a sheet."""
        sheet = self.get_object()
        scores_data = request.data.get('scores', [])

        for score_data in scores_data:
            InterviewScoreItem.objects.update_or_create(
                scoring_sheet=sheet,
                category_id=score_data['category_id'],
                defaults={
                    'score': score_data.get('score'),
                    'comments': score_data.get('comments', '')
                }
            )

        sheet.calculate_scores()
        sheet.save()

        return Response(InterviewScoringSheetSerializer(sheet).data)


class InterviewReportViewSet(viewsets.ModelViewSet):
    """ViewSet for InterviewReport model."""
    queryset = InterviewReport.objects.select_related('interview', 'decided_by')
    serializer_class = InterviewReportSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['final_decision', 'interview']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        """Generate report from scoring sheets."""
        report = self.get_object()
        report.generate_from_scoring_sheets()
        report.save()
        return Response(InterviewReportSerializer(report).data)

    @action(detail=True, methods=['post'])
    def decide(self, request, pk=None):
        """Record final decision."""
        report = self.get_object()
        decision = request.data.get('decision')
        rationale = request.data.get('rationale', '')

        if decision not in [c[0] for c in InterviewReport.FinalDecision.choices]:
            return Response(
                {'error': 'Invalid decision'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.final_decision = decision
        report.decision_rationale = rationale
        report.decided_by = request.user
        report.decided_at = timezone.now()
        report.save()

        # Update interview result based on decision
        if decision == InterviewReport.FinalDecision.HIRE:
            report.interview.result = Interview.Result.PASSED
        elif decision == InterviewReport.FinalDecision.REJECT:
            report.interview.result = Interview.Result.FAILED
        elif decision == InterviewReport.FinalDecision.HOLD:
            report.interview.result = Interview.Result.ON_HOLD
        report.interview.save()

        return Response(InterviewReportSerializer(report).data)

    @action(detail=False, methods=['post'])
    def create_for_interview(self, request):
        """Create a report for an interview."""
        interview_id = request.data.get('interview_id')

        try:
            interview = Interview.objects.get(id=interview_id)
        except Interview.DoesNotExist:
            return Response(
                {'error': 'Interview not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if report already exists
        if hasattr(interview, 'report'):
            return Response(
                {'error': 'Report already exists for this interview'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report = InterviewReport.objects.create(interview=interview)
        report.generate_from_scoring_sheets()
        report.save()

        return Response(InterviewReportSerializer(report).data, status=status.HTTP_201_CREATED)


class RecruitmentSummaryView(APIView):
    """Get recruitment summary statistics."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vacancies = Vacancy.objects.all()
        applicants = Applicant.objects.all()
        interviews = Interview.objects.all()

        summary = {
            'vacancies': {
                'total': vacancies.count(),
                'published': vacancies.filter(status=Vacancy.Status.PUBLISHED).count(),
                'closed': vacancies.filter(status=Vacancy.Status.CLOSED).count(),
            },
            'applicants': {
                'total': applicants.count(),
                'new': applicants.filter(status=Applicant.Status.NEW).count(),
                'shortlisted': applicants.filter(status=Applicant.Status.SHORTLISTED).count(),
                'interviewing': applicants.filter(status=Applicant.Status.INTERVIEW).count(),
                'hired': applicants.filter(status=Applicant.Status.HIRED).count(),
                'rejected': applicants.filter(status=Applicant.Status.REJECTED).count(),
            },
            'interviews': {
                'total': interviews.count(),
                'scheduled': interviews.filter(status=Interview.Status.SCHEDULED).count(),
                'completed': interviews.filter(status=Interview.Status.COMPLETED).count(),
                'passed': interviews.filter(result=Interview.Result.PASSED).count(),
            },
            'by_vacancy': list(vacancies.filter(
                status=Vacancy.Status.PUBLISHED
            ).annotate(
                applicant_count=Count('applicants')
            ).values('id', 'job_title', 'applicant_count')[:10])
        }

        return Response(summary)


# ========================================
# Vacancy URL System
# ========================================

class VacancyURLViewSet(viewsets.ModelViewSet):
    """ViewSet for managing vacancy URLs."""
    queryset = VacancyURL.objects.select_related('vacancy')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['vacancy', 'url_type', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return VacancyURLCreateSerializer
        if self.action == 'list':
            return VacancyURLListSerializer
        return VacancyURLSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            VacancyURLSerializer(instance).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def by_vacancy(self, request):
        """Get all URLs for a specific vacancy."""
        vacancy_id = request.query_params.get('vacancy_id')
        if not vacancy_id:
            return Response({'error': 'vacancy_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        urls = self.get_queryset().filter(vacancy_id=vacancy_id)
        serializer = VacancyURLSerializer(urls, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a vacancy URL."""
        url = self.get_object()
        url.is_active = False
        url.save()
        return Response(VacancyURLSerializer(url).data)

    @action(detail=True, methods=['post'])
    def regenerate_token(self, request, pk=None):
        """Regenerate access token for a vacancy URL."""
        import secrets

        url = self.get_object()
        if url.url_type == VacancyURL.URLType.PUBLIC:
            return Response(
                {'error': 'Public URLs do not have tokens'},
                status=status.HTTP_400_BAD_REQUEST
            )

        url.access_token = secrets.token_urlsafe(32)
        url.save()

        return Response(VacancyURLSerializer(url).data)

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get analytics for a vacancy URL."""
        url = self.get_object()

        views = url.views.all()
        recent_views = views[:100]

        # Device breakdown
        devices = views.values('device_type').annotate(count=Count('id'))

        # Daily views (last 30 days)
        from django.db.models.functions import TruncDate
        daily_views = views.annotate(
            date=TruncDate('viewed_at')
        ).values('date').annotate(count=Count('id')).order_by('-date')[:30]

        return Response({
            'url': VacancyURLSerializer(url).data,
            'view_count': url.view_count,
            'application_count': url.application_count,
            'conversion_rate': (url.application_count / url.view_count * 100) if url.view_count > 0 else 0,
            'devices': list(devices),
            'daily_views': list(daily_views),
        })


# ========================================
# Public Vacancy/Application Views (No Auth)
# ========================================

class PublicVacancyListView(generics.ListAPIView):
    """Public listing of open vacancies."""
    serializer_class = PublicVacancySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Vacancy.objects.filter(
            status=Vacancy.Status.PUBLISHED,
            posting_type__in=[Vacancy.PostingType.EXTERNAL, Vacancy.PostingType.BOTH]
        ).select_related('position', 'department', 'work_location')


class PublicVacancyDetailView(APIView):
    """Get vacancy details via URL slug."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        # Find vacancy URL by slug
        try:
            vacancy_url = VacancyURL.objects.select_related('vacancy').get(url_slug=slug)
        except VacancyURL.DoesNotExist:
            return Response({'error': 'Vacancy not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if expired
        if vacancy_url.is_expired:
            return Response({'error': 'This link has expired'}, status=status.HTTP_410_GONE)

        # Verify token if required
        if vacancy_url.url_type in [VacancyURL.URLType.TOKEN, VacancyURL.URLType.GROUP]:
            token = request.query_params.get('token')
            if not vacancy_url.verify_token(token):
                return Response({'error': 'Invalid or missing access token'}, status=status.HTTP_403_FORBIDDEN)

        # Record view
        vacancy_url.record_view()

        # Track view details
        VacancyURLView.objects.create(
            vacancy_url=vacancy_url,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            referrer=request.META.get('HTTP_REFERER', '')[:500] or None,
        )

        return Response({
            'vacancy': PublicVacancySerializer(vacancy_url.vacancy).data,
            'url_type': vacancy_url.url_type,
            'closing_date': vacancy_url.vacancy.closing_date,
        })


class PublicApplicationSubmitView(APIView):
    """Submit a job application via public URL."""
    permission_classes = [AllowAny]

    def get_throttles(self):
        from core.throttling import ApplicationSubmitRateThrottle
        return [ApplicationSubmitRateThrottle()]

    def post(self, request, slug):
        # Find vacancy URL by slug
        try:
            vacancy_url = VacancyURL.objects.select_related('vacancy').get(url_slug=slug)
        except VacancyURL.DoesNotExist:
            return Response({'error': 'Vacancy not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if expired
        if vacancy_url.is_expired:
            return Response({'error': 'This link has expired'}, status=status.HTTP_410_GONE)

        # Verify token if required
        if vacancy_url.url_type in [VacancyURL.URLType.TOKEN, VacancyURL.URLType.GROUP]:
            token = request.query_params.get('token') or request.data.get('token')
            if not vacancy_url.verify_token(token):
                return Response({'error': 'Invalid or missing access token'}, status=status.HTTP_403_FORBIDDEN)

        # For GROUP type, verify email
        if vacancy_url.url_type == VacancyURL.URLType.GROUP:
            email = request.data.get('email', '')
            if not vacancy_url.verify_email(email):
                return Response(
                    {'error': 'Your email is not authorized to apply via this link'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Check vacancy is still open
        vacancy = vacancy_url.vacancy
        if vacancy.status != Vacancy.Status.PUBLISHED:
            return Response({'error': 'This vacancy is no longer accepting applications'}, status=status.HTTP_400_BAD_REQUEST)

        if vacancy.closing_date and timezone.now().date() > vacancy.closing_date:
            return Response({'error': 'Application deadline has passed'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for duplicate application
        email = request.data.get('email', '')
        existing = Applicant.objects.filter(vacancy=vacancy, email=email).exists()
        if existing:
            return Response(
                {'error': 'An application with this email already exists for this vacancy'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create application
        serializer = PublicApplicationSerializer(
            data=request.data,
            context={'vacancy': vacancy, 'request': request}
        )

        if serializer.is_valid():
            applicant = serializer.save()
            _save_applicant_attachments(applicant, request)
            vacancy_url.record_use()

            # Auto-shortlist if vacancy has criteria configured
            try:
                auto_shortlist_applicant(applicant)
            except Exception:
                pass  # Don't fail submission if auto-shortlist errors

            # Get portal access
            portal_access = ApplicantPortalAccess.objects.get(applicant=applicant)

            # Send confirmation email asynchronously
            from .tasks import send_application_confirmation_email
            try:
                send_application_confirmation_email.delay(
                    str(applicant.id), portal_access.access_token
                )
            except Exception:
                pass  # Don't fail submission if email queuing errors

            return Response({
                'message': 'Application submitted successfully',
                'applicant_number': applicant.applicant_number,
                'portal_token': portal_access.access_token,
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ========================================
# Applicant Portal Views
# ========================================

class ApplicantPortalLoginView(APIView):
    """Login to applicant portal with email and token."""
    permission_classes = [AllowAny]

    def get_throttles(self):
        from core.throttling import PortalLoginRateThrottle
        return [PortalLoginRateThrottle()]

    def post(self, request):
        email = request.data.get('email')
        token = request.data.get('token')

        if not email or not token:
            return Response(
                {'error': 'Email and token are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            access = ApplicantPortalAccess.objects.select_related('applicant').get(
                email=email,
                access_token=token
            )
        except ApplicantPortalAccess.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if not access.is_valid():
            return Response({'error': 'Access token has expired'}, status=status.HTTP_401_UNAUTHORIZED)

        access.record_login()

        return Response({
            'applicant': ApplicantPortalSerializer(access.applicant).data,
            'token_expires_at': access.token_expires_at,
        })


class ApplicantPortalStatusView(APIView):
    """Get applicant's application status via portal token."""
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            access = ApplicantPortalAccess.objects.select_related(
                'applicant', 'applicant__vacancy'
            ).get(access_token=token)
        except ApplicantPortalAccess.DoesNotExist:
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

        if not access.is_valid():
            return Response({'error': 'Token has expired'}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'applicant': ApplicantPortalSerializer(access.applicant).data,
        })


class PortalTokenMixin:
    """Reusable mixin for validating portal access tokens."""

    def validate_portal_token(self, request):
        """Validate X-Portal-Token header or ?token= query param.
        Returns (applicant, None) on success or (None, error_response) on failure.
        """
        token = request.META.get('HTTP_X_PORTAL_TOKEN') or request.query_params.get('token')
        if not token:
            return None, Response(
                {'error': 'Portal access token is required'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            access = ApplicantPortalAccess.objects.select_related(
                'applicant', 'applicant__vacancy',
                'applicant__vacancy__department', 'applicant__vacancy__position',
                'applicant__vacancy__work_location'
            ).get(access_token=token)
        except ApplicantPortalAccess.DoesNotExist:
            return None, Response(
                {'error': 'Invalid access token'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not access.is_valid():
            return None, Response(
                {'error': 'Access token has expired'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        return access.applicant, None


class ApplicantPortalDashboardView(PortalTokenMixin, APIView):
    """Full applicant portal dashboard."""
    permission_classes = [AllowAny]

    def get(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        # Applicant info
        applicant_data = ApplicantPortalSerializer(applicant).data

        # Offer summary
        offer_data = None
        offer = applicant.offers.first()
        if offer:
            offer_data = {
                'id': str(offer.id),
                'offer_number': offer.offer_number,
                'status': offer.status,
                'status_display': offer.get_status_display(),
                'position': offer.position.name if offer.position else '',
                'department': offer.department.name if offer.department else '',
                'basic_salary': str(offer.basic_salary),
                'total_compensation': str(offer.total_compensation),
                'proposed_start_date': str(offer.proposed_start_date),
                'response_deadline': str(offer.response_deadline),
                'has_offer_letter': offer.has_offer_letter,
            }

        # Documents checklist
        documents = applicant.documents.all()
        documents_data = [
            {
                'id': str(doc.id),
                'document_type': doc.document_type,
                'document_type_display': doc.get_document_type_display(),
                'status': doc.status,
                'status_display': doc.get_status_display(),
                'file_name': doc.file_name,
                'file_size': doc.file_size,
                'rejection_reason': doc.rejection_reason,
                'updated_at': doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in documents
        ]

        # Interviews
        interviews = applicant.interviews.filter(
            status__in=['SCHEDULED', 'CONFIRMED']
        ).order_by('scheduled_date', 'scheduled_time')
        interviews_data = [
            {
                'id': str(iv.id),
                'interview_type': iv.interview_type,
                'interview_type_display': iv.get_interview_type_display(),
                'scheduled_date': str(iv.scheduled_date),
                'scheduled_time': str(iv.scheduled_time),
                'duration_minutes': iv.duration_minutes,
                'location': iv.location,
                'meeting_link': iv.meeting_link,
                'status': iv.status,
                'status_display': iv.get_status_display(),
            }
            for iv in interviews
        ]

        # Status timeline
        timeline = applicant.status_history.filter(
            is_visible_to_applicant=True
        ).order_by('-changed_at')[:20]
        timeline_data = ApplicantStatusHistorySerializer(timeline, many=True).data

        return Response({
            'applicant': applicant_data,
            'offer': offer_data,
            'documents': documents_data,
            'interviews': interviews_data,
            'timeline': timeline_data,
        })


class ApplicantPortalOfferView(PortalTokenMixin, APIView):
    """View offer details and download offer letter."""
    permission_classes = [AllowAny]

    def get(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        offer = applicant.offers.select_related('position', 'department', 'grade').first()
        if not offer:
            return Response({'error': 'No offer found'}, status=status.HTTP_404_NOT_FOUND)

        data = {
            'id': str(offer.id),
            'offer_number': offer.offer_number,
            'status': offer.status,
            'status_display': offer.get_status_display(),
            'position': offer.position.name if offer.position else '',
            'department': offer.department.name if offer.department else '',
            'grade': offer.grade.name if offer.grade else '',
            'basic_salary': str(offer.basic_salary),
            'allowances': str(offer.allowances),
            'total_compensation': str(offer.total_compensation),
            'compensation_notes': offer.compensation_notes,
            'offer_date': str(offer.offer_date),
            'response_deadline': str(offer.response_deadline),
            'proposed_start_date': str(offer.proposed_start_date),
            'has_offer_letter': offer.has_offer_letter,
            'offer_letter_base64': offer.get_offer_letter_base64(),
            'offer_letter_name': offer.offer_letter_name,
            'offer_letter_mime': offer.offer_letter_mime,
        }

        return Response(data)


class ApplicantPortalOfferAcceptView(PortalTokenMixin, APIView):
    """Accept offer and upload acceptance letter."""
    permission_classes = [AllowAny]

    def post(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        offer = applicant.offers.first()
        if not offer:
            return Response({'error': 'No offer found'}, status=status.HTTP_404_NOT_FOUND)

        if offer.status not in [JobOffer.Status.SENT, JobOffer.Status.APPROVED]:
            return Response(
                {'error': 'This offer cannot be accepted in its current state'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Accept the offer
        offer.status = JobOffer.Status.ACCEPTED
        offer.responded_at = timezone.now()
        offer.save()

        # Update applicant status
        old_status = applicant.status
        applicant.status = Applicant.Status.HIRED
        applicant.save()

        # Create status history
        ApplicantStatusHistory.objects.create(
            applicant=applicant,
            old_status=old_status,
            new_status=Applicant.Status.HIRED,
            is_visible_to_applicant=True,
            public_message='Congratulations! You have accepted the offer.'
        )

        # Handle acceptance letter upload
        acceptance_file = request.FILES.get('acceptance_letter')
        if acceptance_file:
            doc, _ = ApplicantDocument.objects.get_or_create(
                applicant=applicant,
                document_type=ApplicantDocument.DocumentType.ACCEPTANCE_LETTER,
            )
            doc.set_file(acceptance_file)
            doc.save()

        # Auto-create pending document records for all required onboarding types
        required_types = [
            ApplicantDocument.DocumentType.PERSONAL_HISTORY,
            ApplicantDocument.DocumentType.POLICE_REPORT,
            ApplicantDocument.DocumentType.MEDICAL_REPORT,
            ApplicantDocument.DocumentType.BANK_DETAILS,
            ApplicantDocument.DocumentType.PROVIDENT_FUND,
            ApplicantDocument.DocumentType.TIER_2_FORM,
        ]
        for doc_type in required_types:
            ApplicantDocument.objects.get_or_create(
                applicant=applicant,
                document_type=doc_type,
                defaults={'status': ApplicantDocument.Status.PENDING}
            )

        return Response({
            'message': 'Offer accepted successfully',
            'status': 'HIRED',
        })


class ApplicantPortalOfferDeclineView(PortalTokenMixin, APIView):
    """Decline an offer with reason."""
    permission_classes = [AllowAny]

    def post(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        offer = applicant.offers.first()
        if not offer:
            return Response({'error': 'No offer found'}, status=status.HTTP_404_NOT_FOUND)

        if offer.status not in [JobOffer.Status.SENT, JobOffer.Status.APPROVED]:
            return Response(
                {'error': 'This offer cannot be declined in its current state'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        offer.status = JobOffer.Status.DECLINED
        offer.responded_at = timezone.now()
        offer.decline_reason = reason
        offer.save()

        # Create status history
        ApplicantStatusHistory.objects.create(
            applicant=applicant,
            old_status=applicant.status,
            new_status=applicant.status,
            is_visible_to_applicant=True,
            public_message='You have declined the offer.'
        )

        return Response({
            'message': 'Offer declined',
            'status': offer.status,
        })


class ApplicantPortalDocumentsView(PortalTokenMixin, APIView):
    """List onboarding documents with status."""
    permission_classes = [AllowAny]

    def get(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        documents = applicant.documents.all().order_by('document_type')
        data = [
            {
                'id': str(doc.id),
                'document_type': doc.document_type,
                'document_type_display': doc.get_document_type_display(),
                'status': doc.status,
                'status_display': doc.get_status_display(),
                'file_name': doc.file_name,
                'file_size': doc.file_size,
                'rejection_reason': doc.rejection_reason,
                'notes': doc.notes,
                'updated_at': doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in documents
        ]

        return Response(data)


class ApplicantPortalDocumentUploadView(PortalTokenMixin, APIView):
    """Upload a specific onboarding document."""
    permission_classes = [AllowAny]

    def post(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        document_type = request.data.get('document_type')
        if not document_type:
            return Response(
                {'error': 'document_type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate document type
        valid_types = [c[0] for c in ApplicantDocument.DocumentType.choices]
        if document_type not in valid_types:
            return Response(
                {'error': f'Invalid document type. Must be one of: {", ".join(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024
        if file_obj.size > max_size:
            return Response(
                {'error': 'File size exceeds maximum of 10MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        doc, _ = ApplicantDocument.objects.get_or_create(
            applicant=applicant,
            document_type=document_type,
        )

        # Allow re-upload if rejected or pending
        if doc.status == ApplicantDocument.Status.VERIFIED:
            return Response(
                {'error': 'This document has already been verified and cannot be replaced'},
                status=status.HTTP_400_BAD_REQUEST
            )

        doc.set_file(file_obj)
        doc.rejection_reason = ''  # Clear any previous rejection
        doc.save()

        return Response({
            'message': 'Document uploaded successfully',
            'document_type': doc.document_type,
            'document_type_display': doc.get_document_type_display(),
            'status': doc.status,
            'file_name': doc.file_name,
            'file_size': doc.file_size,
        })


class ApplicantPortalInterviewsView(PortalTokenMixin, APIView):
    """View scheduled interviews (applicant-safe fields only)."""
    permission_classes = [AllowAny]

    def get(self, request):
        applicant, error = self.validate_portal_token(request)
        if error:
            return error

        interviews = applicant.interviews.order_by('scheduled_date', 'scheduled_time')
        data = [
            {
                'id': str(iv.id),
                'interview_type': iv.interview_type,
                'interview_type_display': iv.get_interview_type_display(),
                'round_number': iv.round_number,
                'scheduled_date': str(iv.scheduled_date),
                'scheduled_time': str(iv.scheduled_time),
                'duration_minutes': iv.duration_minutes,
                'location': iv.location,
                'meeting_link': iv.meeting_link,
                'status': iv.status,
                'status_display': iv.get_status_display(),
            }
            for iv in interviews
        ]

        return Response(data)


class ApplicantStatusHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing applicant status history."""
    queryset = ApplicantStatusHistory.objects.select_related('applicant', 'changed_by')
    serializer_class = ApplicantStatusHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['applicant']

    @action(detail=False, methods=['post'])
    def add_status(self, request):
        """Add a status change (used when updating applicant status)."""
        applicant_id = request.data.get('applicant_id')
        new_status = request.data.get('new_status')
        notes = request.data.get('notes', '')
        public_message = request.data.get('public_message', '')
        is_visible = request.data.get('is_visible_to_applicant', True)

        try:
            applicant = Applicant.objects.get(id=applicant_id)
        except Applicant.DoesNotExist:
            return Response({'error': 'Applicant not found'}, status=status.HTTP_404_NOT_FOUND)

        old_status = applicant.status
        applicant.status = new_status
        applicant.save()

        history = ApplicantStatusHistory.objects.create(
            applicant=applicant,
            old_status=old_status,
            new_status=new_status,
            changed_by=request.user,
            notes=notes,
            public_message=public_message,
            is_visible_to_applicant=is_visible
        )

        return Response(ApplicantStatusHistorySerializer(history).data, status=status.HTTP_201_CREATED)


# ========================================
# System-Based Shortlisting
# ========================================

from .models import (
    ShortlistCriteria, ShortlistTemplate, ShortlistTemplateCriteria,
    ShortlistRun, ShortlistResult
)
from .serializers import (
    ShortlistCriteriaSerializer, ShortlistCriteriaCreateSerializer,
    ShortlistTemplateSerializer, ShortlistTemplateCreateSerializer,
    ShortlistTemplateCriteriaSerializer,
    ShortlistRunSerializer, ShortlistRunCreateSerializer, ShortlistRunListSerializer,
    ShortlistResultSerializer, ShortlistResultOverrideSerializer,
    ApplyTemplateSerializer
)


# ========================================
# Internal Job Board Views (Authenticated Employees)
# ========================================


def _save_applicant_attachments(applicant, request):
    """Save file attachments (resume, cover letter file, certificates) for an applicant."""
    import logging
    from core.validators import validate_uploaded_file
    from django.core.exceptions import ValidationError

    logger = logging.getLogger(__name__)

    def _is_valid_file(file_obj):
        try:
            validate_uploaded_file(file_obj)
            return True
        except ValidationError as e:
            logger.warning('File validation failed for %s: %s', file_obj.name, e.message)
            return False

    # Resume
    resume = request.FILES.get('resume')
    if resume and _is_valid_file(resume):
        attachment = ApplicantAttachment(
            applicant=applicant,
            attachment_type=ApplicantAttachment.AttachmentType.RESUME,
            label='Resume',
        )
        attachment.set_file(resume)
        attachment.save()
        # Backward compatibility: also store on Applicant model
        resume.seek(0)
        applicant.set_resume(resume)
        applicant.save()

    # Cover letter file
    cover_letter_file = request.FILES.get('cover_letter_file')
    if cover_letter_file and _is_valid_file(cover_letter_file):
        attachment = ApplicantAttachment(
            applicant=applicant,
            attachment_type=ApplicantAttachment.AttachmentType.COVER_LETTER,
            label='Cover Letter',
        )
        attachment.set_file(cover_letter_file)
        attachment.save()

    # Certificates (multiple)
    certificates = request.FILES.getlist('certificates')
    for cert_file in certificates:
        if _is_valid_file(cert_file):
            attachment = ApplicantAttachment(
                applicant=applicant,
                attachment_type=ApplicantAttachment.AttachmentType.CERTIFICATE,
                label=cert_file.name,
            )
            attachment.set_file(cert_file)
            attachment.save()


class InternalVacancyListView(generics.ListAPIView):
    """List vacancies available to internal employees."""
    serializer_class = PublicVacancySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Vacancy.objects.filter(
            status=Vacancy.Status.PUBLISHED,
            posting_type__in=[Vacancy.PostingType.INTERNAL, Vacancy.PostingType.BOTH]
        ).select_related('position', 'department', 'work_location')


class InternalApplicationSubmitView(APIView):
    """Apply for an internal vacancy as an authenticated employee."""
    permission_classes = [IsAuthenticated]

    def get(self, request, vacancy_id):
        """Return vacancy details + pre-filled employee data."""
        try:
            vacancy = Vacancy.objects.select_related(
                'position', 'department', 'work_location'
            ).get(
                id=vacancy_id,
                status=Vacancy.Status.PUBLISHED,
                posting_type__in=[Vacancy.PostingType.INTERNAL, Vacancy.PostingType.BOTH]
            )
        except Vacancy.DoesNotExist:
            return Response({'error': 'Vacancy not found or not available for internal applications'},
                            status=status.HTTP_404_NOT_FOUND)

        employee = getattr(request.user, 'employee', None)
        employee_data = {}
        if employee:
            employee_data = {
                'first_name': employee.first_name,
                'middle_name': employee.middle_name or '',
                'last_name': employee.last_name,
                'email': employee.work_email or employee.personal_email or '',
                'phone': employee.mobile_phone or '',
                'date_of_birth': str(employee.date_of_birth) if employee.date_of_birth else '',
                'gender': employee.gender or '',
                'nationality': employee.nationality or '',
                'address': employee.residential_address or '',
                'current_position': str(employee.position) if employee.position else '',
                'department': str(employee.department) if employee.department else '',
                'employee_number': employee.employee_number,
            }

        return Response({
            'vacancy': PublicVacancySerializer(vacancy).data,
            'employee': employee_data,
        })

    def post(self, request, vacancy_id):
        """Submit an internal application."""
        try:
            vacancy = Vacancy.objects.get(
                id=vacancy_id,
                status=Vacancy.Status.PUBLISHED,
                posting_type__in=[Vacancy.PostingType.INTERNAL, Vacancy.PostingType.BOTH]
            )
        except Vacancy.DoesNotExist:
            return Response({'error': 'Vacancy not found or not available for internal applications'},
                            status=status.HTTP_404_NOT_FOUND)

        # Check closing date
        if vacancy.closing_date and timezone.now().date() > vacancy.closing_date:
            return Response({'error': 'Application deadline has passed'},
                            status=status.HTTP_400_BAD_REQUEST)

        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'error': 'No employee profile linked to your account'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Duplicate check
        if Applicant.objects.filter(vacancy=vacancy, employee=employee).exists():
            return Response({'error': 'You have already applied for this vacancy'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Create applicant from employee data
        import uuid
        applicant = Applicant.objects.create(
            applicant_number=f"APP-{uuid.uuid4().hex[:8].upper()}",
            vacancy=vacancy,
            first_name=employee.first_name,
            middle_name=employee.middle_name or '',
            last_name=employee.last_name,
            email=employee.work_email or employee.personal_email or '',
            phone=employee.mobile_phone or '',
            date_of_birth=employee.date_of_birth,
            gender=employee.gender or '',
            nationality=employee.nationality or 'Ghanaian',
            address=employee.residential_address or '',
            current_position=str(employee.position) if employee.position else '',
            cover_letter=request.data.get('cover_letter', ''),
            is_internal=True,
            employee=employee,
            source=Applicant.Source.INTERNAL,
        )

        _save_applicant_attachments(applicant, request)

        # Create status history
        ApplicantStatusHistory.objects.create(
            applicant=applicant,
            old_status='',
            new_status=Applicant.Status.NEW,
            is_visible_to_applicant=True,
            public_message='Your internal application has been received.'
        )

        # Auto-shortlist if criteria configured
        try:
            auto_shortlist_applicant(applicant)
        except Exception:
            pass

        # Send confirmation email asynchronously
        from .tasks import send_application_confirmation_email
        try:
            send_application_confirmation_email.delay(str(applicant.id))
        except Exception:
            pass  # Don't fail submission if email queuing errors

        return Response({
            'message': 'Internal application submitted successfully',
            'applicant_number': applicant.applicant_number,
        }, status=status.HTTP_201_CREATED)


class MyInternalApplicationsView(APIView):
    """List the authenticated employee's internal applications."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response([])

        applicants = Applicant.objects.filter(
            employee=employee, is_internal=True
        ).select_related('vacancy', 'vacancy__department', 'vacancy__position').order_by('-application_date')

        data = []
        for app in applicants:
            timeline = app.status_history.filter(
                is_visible_to_applicant=True
            ).order_by('-changed_at')[:10]

            data.append({
                'id': str(app.id),
                'applicant_number': app.applicant_number,
                'vacancy_id': str(app.vacancy.id),
                'vacancy_title': app.vacancy.job_title,
                'department': app.vacancy.department.name if app.vacancy.department else '',
                'status': app.status,
                'status_display': app.get_status_display(),
                'application_date': app.application_date.isoformat(),
                'cover_letter': app.cover_letter,
                'timeline': ApplicantStatusHistorySerializer(timeline, many=True).data,
            })

        return Response(data)


class ShortlistCriteriaViewSet(viewsets.ModelViewSet):
    """ViewSet for managing shortlist criteria."""
    queryset = ShortlistCriteria.objects.select_related('vacancy')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['vacancy', 'criteria_type', 'is_mandatory']

    def get_serializer_class(self):
        if self.action == 'create':
            return ShortlistCriteriaCreateSerializer
        return ShortlistCriteriaSerializer

    @action(detail=False, methods=['get'])
    def by_vacancy(self, request):
        """Get criteria for a specific vacancy."""
        vacancy_id = request.query_params.get('vacancy_id')
        if not vacancy_id:
            return Response({'error': 'vacancy_id required'}, status=status.HTTP_400_BAD_REQUEST)

        criteria = self.get_queryset().filter(vacancy_id=vacancy_id).order_by('sort_order')
        serializer = ShortlistCriteriaSerializer(criteria, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple criteria at once."""
        criteria_data = request.data.get('criteria', [])
        vacancy_id = request.data.get('vacancy_id')

        if not vacancy_id or not criteria_data:
            return Response(
                {'error': 'vacancy_id and criteria array required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        for idx, crit_data in enumerate(criteria_data):
            crit_data['vacancy'] = vacancy_id
            crit_data['sort_order'] = idx
            serializer = ShortlistCriteriaCreateSerializer(data=crit_data)
            if serializer.is_valid():
                obj = serializer.save()
                created.append(ShortlistCriteriaSerializer(obj).data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response({'created': created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['delete'])
    def clear_vacancy(self, request):
        """Delete all criteria for a vacancy."""
        vacancy_id = request.query_params.get('vacancy_id')
        if not vacancy_id:
            return Response({'error': 'vacancy_id required'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = ShortlistCriteria.objects.filter(vacancy_id=vacancy_id).delete()
        return Response({'deleted': deleted_count})


class ShortlistTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing shortlist templates."""
    queryset = ShortlistTemplate.objects.prefetch_related('criteria')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['job_family', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return ShortlistTemplateCreateSerializer
        return ShortlistTemplateSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active templates."""
        templates = self.get_queryset().filter(is_active=True)
        serializer = ShortlistTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_criteria(self, request, pk=None):
        """Add criteria to a template."""
        template = self.get_object()
        serializer = ShortlistTemplateCriteriaSerializer(data={
            **request.data,
            'template': template.id
        })
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def apply_to_vacancy(self, request, pk=None):
        """Apply template criteria to a vacancy."""
        template = self.get_object()
        vacancy_id = request.data.get('vacancy_id')
        clear_existing = request.data.get('clear_existing', False)

        if not vacancy_id:
            return Response({'error': 'vacancy_id required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            vacancy = Vacancy.objects.get(id=vacancy_id)
        except Vacancy.DoesNotExist:
            return Response({'error': 'Vacancy not found'}, status=status.HTTP_404_NOT_FOUND)

        count = apply_template_to_vacancy(vacancy, template, clear_existing)
        return Response({
            'message': f'{count} criteria applied to vacancy',
            'vacancy_id': vacancy_id,
            'template_id': template.id
        })


class ShortlistRunViewSet(viewsets.ModelViewSet):
    """ViewSet for managing shortlist runs."""
    queryset = ShortlistRun.objects.select_related('vacancy', 'run_by').prefetch_related('results')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['vacancy', 'status']
    ordering = ['-run_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return ShortlistRunCreateSerializer
        if self.action == 'list':
            return ShortlistRunListSerializer
        return ShortlistRunSerializer

    def perform_create(self, serializer):
        serializer.save(run_by=self.request.user)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute the shortlisting process."""
        run = self.get_object()

        if run.status != ShortlistRun.Status.PENDING:
            return Response(
                {'error': 'Can only execute pending runs'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = ShortlistingService(run)
        try:
            service.execute()
            return Response(ShortlistRunSerializer(run).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """Get results for a shortlist run."""
        run = self.get_object()
        results = run.results.select_related('applicant').order_by('rank', '-final_score')

        # Filter by outcome
        outcome = request.query_params.get('outcome')
        if outcome:
            results = results.filter(outcome=outcome)

        serializer = ShortlistResultSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def qualified(self, request, pk=None):
        """Get only qualified applicants."""
        run = self.get_object()
        results = run.results.filter(
            outcome=ShortlistResult.Outcome.QUALIFIED
        ).select_related('applicant').order_by('rank')

        serializer = ShortlistResultSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def apply_results(self, request, pk=None):
        """Apply shortlist results to applicants (update their status)."""
        run = self.get_object()

        if run.status != ShortlistRun.Status.COMPLETED:
            return Response(
                {'error': 'Can only apply results from completed runs'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_count = 0
        qualified_results = run.results.filter(
            outcome=ShortlistResult.Outcome.QUALIFIED
        ).select_related('applicant')

        for result in qualified_results:
            applicant = result.applicant
            if applicant.status == Applicant.Status.SCREENING:
                old_status = applicant.status
                applicant.status = Applicant.Status.SHORTLISTED
                applicant.screening_score = int(result.percentage_score)
                applicant.save()

                # Create status history
                ApplicantStatusHistory.objects.create(
                    applicant=applicant,
                    old_status=old_status,
                    new_status=Applicant.Status.SHORTLISTED,
                    changed_by=request.user,
                    notes=f'Auto-shortlisted via run {run.run_number} (Score: {result.percentage_score:.1f}%)',
                    is_visible_to_applicant=True,
                    public_message='Congratulations! You have been shortlisted for further consideration.'
                )
                updated_count += 1

        return Response({
            'message': f'{updated_count} applicants shortlisted',
            'run_number': run.run_number
        })


class ShortlistResultViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing shortlist results."""
    queryset = ShortlistResult.objects.select_related(
        'shortlist_run', 'applicant', 'overridden_by'
    )
    serializer_class = ShortlistResultSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['shortlist_run', 'outcome', 'is_overridden']

    @action(detail=True, methods=['post'])
    def override(self, request, pk=None):
        """Override a shortlist result."""
        result = self.get_object()

        serializer = ShortlistResultOverrideSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result.is_overridden = True
        result.override_outcome = serializer.validated_data['override_outcome']
        result.override_reason = serializer.validated_data['override_reason']
        result.overridden_by = request.user
        result.overridden_at = timezone.now()
        result.save()

        return Response(ShortlistResultSerializer(result).data)

    @action(detail=True, methods=['post'])
    def clear_override(self, request, pk=None):
        """Remove override from a result."""
        result = self.get_object()

        result.is_overridden = False
        result.override_outcome = ''
        result.override_reason = ''
        result.overridden_by = None
        result.overridden_at = None
        result.save()

        return Response(ShortlistResultSerializer(result).data)

    @action(detail=True, methods=['get'])
    def breakdown(self, request, pk=None):
        """Get detailed score breakdown for a result."""
        result = self.get_object()

        return Response({
            'applicant': {
                'id': result.applicant.id,
                'name': result.applicant.full_name,
                'number': result.applicant.applicant_number,
            },
            'scores': {
                'criteria_score': result.criteria_score,
                'screening_score': result.screening_score_used,
                'final_score': result.final_score,
                'percentage': result.percentage_score,
            },
            'breakdown': result.score_breakdown,
            'failed_mandatory': result.failed_mandatory,
            'outcome': result.outcome,
            'effective_outcome': result.effective_outcome,
            'rank': result.rank,
        })
