"""
Views for Discipline & Grievance module.
"""

from datetime import date

from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import HttpResponse
from django.utils import timezone

from .models import (
    MisconductCategory, DisciplinaryCase, DisciplinaryAction,
    DisciplinaryHearing, HearingCommitteeMember, DisciplinaryEvidence,
    DisciplinaryAppeal, GrievanceCategory, Grievance, GrievanceNote,
    GrievanceAttachment,
)
from .serializers import (
    MisconductCategorySerializer, DisciplinaryCaseListSerializer,
    DisciplinaryCaseDetailSerializer, DisciplinaryCaseCreateSerializer,
    DisciplinaryActionSerializer, DisciplinaryHearingSerializer,
    HearingCommitteeMemberSerializer, DisciplinaryEvidenceSerializer,
    DisciplinaryAppealSerializer, GrievanceCategorySerializer,
    GrievanceListSerializer, GrievanceDetailSerializer,
    GrievanceCreateSerializer, GrievanceNoteSerializer,
    GrievanceAttachmentSerializer,
)


# ── Category ViewSets ──────────────────────────────────────────


class MisconductCategoryViewSet(viewsets.ModelViewSet):
    queryset = MisconductCategory.objects.all()
    serializer_class = MisconductCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'code']


class GrievanceCategoryViewSet(viewsets.ModelViewSet):
    queryset = GrievanceCategory.objects.all()
    serializer_class = GrievanceCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'code']


# ── Disciplinary Case ──────────────────────────────────────────


class DisciplinaryCaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'misconduct_category', 'employee', 'misconduct_category__severity']
    search_fields = ['case_number', 'employee__first_name', 'employee__last_name']
    ordering_fields = ['reported_date', 'incident_date', 'status']
    ordering = ['-reported_date']

    def get_queryset(self):
        return (
            DisciplinaryCase.objects
            .select_related('employee', 'misconduct_category', 'reported_by',
                            'assigned_investigator', 'hr_representative', 'decision_by')
            .prefetch_related('actions', 'hearings', 'hearings__committee_members', 'evidence', 'appeals')
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return DisciplinaryCaseListSerializer
        if self.action == 'retrieve':
            return DisciplinaryCaseDetailSerializer
        if self.action == 'create':
            return DisciplinaryCaseCreateSerializer
        return DisciplinaryCaseDetailSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        open_statuses = [
            DisciplinaryCase.Status.REPORTED,
            DisciplinaryCase.Status.UNDER_INVESTIGATION,
            DisciplinaryCase.Status.SHOW_CAUSE_ISSUED,
            DisciplinaryCase.Status.SHOW_CAUSE_RECEIVED,
            DisciplinaryCase.Status.HEARING_SCHEDULED,
            DisciplinaryCase.Status.HEARING_COMPLETED,
            DisciplinaryCase.Status.PENDING_DECISION,
            DisciplinaryCase.Status.DECISION_ISSUED,
            DisciplinaryCase.Status.APPEAL_FILED,
        ]
        total = qs.count()
        open_cases = qs.filter(status__in=open_statuses).count()
        by_severity = {}
        for sev in MisconductCategory.Severity.values:
            by_severity[sev] = qs.filter(misconduct_category__severity=sev).count()
        return Response({
            'total': total,
            'open': open_cases,
            'by_severity': by_severity,
        })

    # ── Status transition actions ──

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        case = self.get_object()
        if case.status != DisciplinaryCase.Status.DRAFT:
            return Response({'detail': 'Case can only be submitted from Draft status.'},
                            status=status.HTTP_400_BAD_REQUEST)
        case.status = DisciplinaryCase.Status.REPORTED
        case.save(update_fields=['status', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def investigate(self, request, pk=None):
        case = self.get_object()
        if case.status != DisciplinaryCase.Status.REPORTED:
            return Response({'detail': 'Case must be in Reported status.'},
                            status=status.HTTP_400_BAD_REQUEST)
        investigator_id = request.data.get('assigned_investigator')
        if investigator_id:
            case.assigned_investigator_id = investigator_id
        case.investigation_start_date = date.today()
        case.status = DisciplinaryCase.Status.UNDER_INVESTIGATION
        case.save(update_fields=['status', 'assigned_investigator', 'investigation_start_date', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def issue_show_cause(self, request, pk=None):
        case = self.get_object()
        if case.status != DisciplinaryCase.Status.UNDER_INVESTIGATION:
            return Response({'detail': 'Case must be Under Investigation.'},
                            status=status.HTTP_400_BAD_REQUEST)
        case.show_cause_issued_date = date.today()
        case.status = DisciplinaryCase.Status.SHOW_CAUSE_ISSUED
        case.save(update_fields=['status', 'show_cause_issued_date', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def receive_show_cause(self, request, pk=None):
        case = self.get_object()
        if case.status != DisciplinaryCase.Status.SHOW_CAUSE_ISSUED:
            return Response({'detail': 'Show cause must be issued first.'},
                            status=status.HTTP_400_BAD_REQUEST)
        case.show_cause_response = request.data.get('show_cause_response', '')
        case.show_cause_response_date = date.today()
        case.status = DisciplinaryCase.Status.SHOW_CAUSE_RECEIVED
        case.save(update_fields=['status', 'show_cause_response', 'show_cause_response_date', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def schedule_hearing(self, request, pk=None):
        case = self.get_object()
        case.status = DisciplinaryCase.Status.HEARING_SCHEDULED
        case.save(update_fields=['status', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def complete_hearing(self, request, pk=None):
        case = self.get_object()
        if case.status != DisciplinaryCase.Status.HEARING_SCHEDULED:
            return Response({'detail': 'Hearing must be scheduled first.'},
                            status=status.HTTP_400_BAD_REQUEST)
        case.status = DisciplinaryCase.Status.HEARING_COMPLETED
        case.save(update_fields=['status', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def issue_decision(self, request, pk=None):
        case = self.get_object()
        case.final_decision = request.data.get('final_decision', '')
        case.decision_date = date.today()
        case.decision_by = request.user
        case.status = DisciplinaryCase.Status.DECISION_ISSUED
        case.save(update_fields=[
            'status', 'final_decision', 'decision_date', 'decision_by', 'updated_at',
        ])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        case = self.get_object()
        case.closure_date = date.today()
        case.closure_notes = request.data.get('closure_notes', '')
        case.status = DisciplinaryCase.Status.CLOSED
        case.save(update_fields=['status', 'closure_date', 'closure_notes', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        case = self.get_object()
        case.status = DisciplinaryCase.Status.WITHDRAWN
        case.closure_date = date.today()
        case.closure_notes = request.data.get('closure_notes', 'Withdrawn')
        case.save(update_fields=['status', 'closure_date', 'closure_notes', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)


# ── Supporting ViewSets ────────────────────────────────────────


class DisciplinaryActionViewSet(viewsets.ModelViewSet):
    serializer_class = DisciplinaryActionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['case']

    def get_queryset(self):
        return DisciplinaryAction.objects.select_related('issued_by')


class DisciplinaryHearingViewSet(viewsets.ModelViewSet):
    serializer_class = DisciplinaryHearingSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['case', 'status']
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        return DisciplinaryHearing.objects.prefetch_related('committee_members__employee')


class HearingCommitteeMemberViewSet(viewsets.ModelViewSet):
    serializer_class = HearingCommitteeMemberSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['hearing']

    def get_queryset(self):
        return HearingCommitteeMember.objects.select_related('employee')


class DisciplinaryEvidenceViewSet(viewsets.ModelViewSet):
    serializer_class = DisciplinaryEvidenceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['case']

    def get_queryset(self):
        return DisciplinaryEvidence.objects.select_related('submitted_by')

    @action(detail=True, methods=['post'])
    def upload(self, request, pk=None):
        evidence = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        evidence.set_file(file)
        evidence.save()
        return Response(DisciplinaryEvidenceSerializer(evidence).data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        evidence = self.get_object()
        if not evidence.has_file:
            return Response({'detail': 'No file attached.'}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(evidence.file_data, content_type=evidence.mime_type)
        response['Content-Disposition'] = f'attachment; filename="{evidence.file_name}"'
        return response


class DisciplinaryAppealViewSet(viewsets.ModelViewSet):
    serializer_class = DisciplinaryAppealSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['case', 'status']

    def get_queryset(self):
        return DisciplinaryAppeal.objects.select_related('reviewed_by')

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        appeal = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        appeal.set_document(file)
        appeal.save()
        return Response(DisciplinaryAppealSerializer(appeal).data)

    @action(detail=True, methods=['get'])
    def download_document(self, request, pk=None):
        appeal = self.get_object()
        if not appeal.has_document:
            return Response({'detail': 'No document attached.'}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(appeal.document_data, content_type=appeal.document_mime)
        response['Content-Disposition'] = f'attachment; filename="{appeal.document_name}"'
        return response


# ── Grievance ──────────────────────────────────────────────────


class GrievanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'category', 'priority', 'employee']
    search_fields = ['grievance_number', 'subject', 'employee__first_name', 'employee__last_name']
    ordering_fields = ['submitted_date', 'priority', 'status']
    ordering = ['-submitted_date']

    def get_queryset(self):
        return (
            Grievance.objects
            .select_related(
                'employee', 'category', 'assigned_to',
                'against_employee', 'against_department',
                'against_manager', 'escalated_to', 'hr_representative',
            )
            .prefetch_related('notes', 'attachments')
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return GrievanceListSerializer
        if self.action == 'retrieve':
            return GrievanceDetailSerializer
        if self.action == 'create':
            return GrievanceCreateSerializer
        return GrievanceDetailSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        open_statuses = [
            Grievance.Status.SUBMITTED,
            Grievance.Status.ACKNOWLEDGED,
            Grievance.Status.UNDER_INVESTIGATION,
            Grievance.Status.MEDIATION,
            Grievance.Status.PENDING_RESOLUTION,
            Grievance.Status.ESCALATED,
        ]
        total = qs.count()
        open_count = qs.filter(status__in=open_statuses).count()
        by_priority = {}
        for p in Grievance.Priority.values:
            by_priority[p] = qs.filter(priority=p).count()
        return Response({
            'total': total,
            'open': open_count,
            'by_priority': by_priority,
        })

    # ── Status transition actions ──

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        grievance = self.get_object()
        if grievance.status != Grievance.Status.DRAFT:
            return Response({'detail': 'Grievance can only be submitted from Draft.'}, status=status.HTTP_400_BAD_REQUEST)
        grievance.status = Grievance.Status.SUBMITTED
        grievance.submitted_date = date.today()
        grievance.save(update_fields=['status', 'submitted_date', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        grievance = self.get_object()
        if grievance.status != Grievance.Status.SUBMITTED:
            return Response({'detail': 'Grievance must be Submitted.'}, status=status.HTTP_400_BAD_REQUEST)
        grievance.status = Grievance.Status.ACKNOWLEDGED
        grievance.acknowledged_date = date.today()
        grievance.save(update_fields=['status', 'acknowledged_date', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def investigate(self, request, pk=None):
        grievance = self.get_object()
        assigned_to = request.data.get('assigned_to')
        if assigned_to:
            grievance.assigned_to_id = assigned_to
        grievance.status = Grievance.Status.UNDER_INVESTIGATION
        grievance.save(update_fields=['status', 'assigned_to', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        grievance = self.get_object()
        grievance.escalation_level += 1
        escalated_to = request.data.get('escalated_to')
        if escalated_to:
            grievance.escalated_to_id = escalated_to
        grievance.escalation_reason = request.data.get('escalation_reason', '')
        grievance.escalated_date = date.today()
        grievance.status = Grievance.Status.ESCALATED
        grievance.save(update_fields=[
            'status', 'escalation_level', 'escalated_to',
            'escalation_reason', 'escalated_date', 'updated_at',
        ])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        grievance = self.get_object()
        grievance.resolution = request.data.get('resolution', '')
        grievance.resolution_date = date.today()
        grievance.status = Grievance.Status.RESOLVED
        grievance.save(update_fields=['status', 'resolution', 'resolution_date', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def close_grievance(self, request, pk=None):
        grievance = self.get_object()
        grievance.status = Grievance.Status.CLOSED
        grievance.save(update_fields=['status', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        grievance = self.get_object()
        serializer = GrievanceNoteSerializer(data={
            'grievance': grievance.id,
            'note': request.data.get('note', ''),
            'is_internal': request.data.get('is_internal', False),
        }, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def accept_resolution(self, request, pk=None):
        grievance = self.get_object()
        if grievance.status != Grievance.Status.RESOLVED:
            return Response({'detail': 'Grievance must be Resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        grievance.resolution_accepted = True
        grievance.resolution_feedback = request.data.get('feedback', '')
        grievance.status = Grievance.Status.CLOSED
        grievance.save(update_fields=['resolution_accepted', 'resolution_feedback', 'status', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)

    @action(detail=True, methods=['post'])
    def reject_resolution(self, request, pk=None):
        grievance = self.get_object()
        if grievance.status != Grievance.Status.RESOLVED:
            return Response({'detail': 'Grievance must be Resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        grievance.resolution_accepted = False
        grievance.resolution_feedback = request.data.get('feedback', '')
        grievance.status = Grievance.Status.SUBMITTED  # Re-open
        grievance.save(update_fields=['resolution_accepted', 'resolution_feedback', 'status', 'updated_at'])
        return Response(GrievanceDetailSerializer(grievance).data)


class GrievanceNoteViewSet(viewsets.ModelViewSet):
    serializer_class = GrievanceNoteSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['grievance']

    def get_queryset(self):
        return GrievanceNote.objects.select_related('added_by')


class GrievanceAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = GrievanceAttachmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['grievance']

    def get_queryset(self):
        return GrievanceAttachment.objects.select_related('uploaded_by')

    @action(detail=True, methods=['post'])
    def upload(self, request, pk=None):
        attachment = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        attachment.set_file(file)
        attachment.save()
        return Response(GrievanceAttachmentSerializer(attachment).data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        attachment = self.get_object()
        if not attachment.has_file:
            return Response({'detail': 'No file attached.'}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(attachment.file_data, content_type=attachment.mime_type)
        response['Content-Disposition'] = f'attachment; filename="{attachment.file_name}"'
        return response


# ── Self-Service Views ─────────────────────────────────────────


class MyDisciplinaryCasesView(generics.ListAPIView):
    serializer_class = DisciplinaryCaseDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            return (
                DisciplinaryCase.objects
                .filter(employee=user.employee)
                .select_related('employee', 'misconduct_category', 'reported_by',
                                'assigned_investigator', 'hr_representative', 'decision_by')
                .prefetch_related('actions', 'hearings', 'evidence', 'appeals')
            )
        return DisciplinaryCase.objects.none()


class RespondToShowCauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            employee = request.user.employee
            case = DisciplinaryCase.objects.get(pk=pk, employee=employee)
        except (AttributeError, DisciplinaryCase.DoesNotExist):
            return Response({'detail': 'Case not found.'}, status=status.HTTP_404_NOT_FOUND)

        if case.status != DisciplinaryCase.Status.SHOW_CAUSE_ISSUED:
            return Response({'detail': 'Show cause has not been issued for this case.'},
                            status=status.HTTP_400_BAD_REQUEST)

        response_text = request.data.get('show_cause_response', '')
        if not response_text:
            return Response({'detail': 'Response text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        case.show_cause_response = response_text
        case.show_cause_response_date = date.today()
        case.status = DisciplinaryCase.Status.SHOW_CAUSE_RECEIVED
        case.save(update_fields=['show_cause_response', 'show_cause_response_date', 'status', 'updated_at'])
        return Response(DisciplinaryCaseDetailSerializer(case).data)


class AcknowledgeActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            employee = request.user.employee
        except AttributeError:
            return Response({'detail': 'No employee profile.'}, status=status.HTTP_404_NOT_FOUND)

        action_id = request.data.get('action_id')
        if not action_id:
            return Response({'detail': 'action_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            da = DisciplinaryAction.objects.get(pk=action_id, case__employee=employee, case__pk=pk)
        except DisciplinaryAction.DoesNotExist:
            return Response({'detail': 'Action not found.'}, status=status.HTTP_404_NOT_FOUND)

        da.acknowledged_by_employee = True
        da.acknowledged_date = timezone.now()
        da.save(update_fields=['acknowledged_by_employee', 'acknowledged_date', 'updated_at'])
        return Response(DisciplinaryActionSerializer(da).data)


class FileAppealView(generics.CreateAPIView):
    serializer_class = DisciplinaryAppealSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, pk, *args, **kwargs):
        try:
            employee = request.user.employee
            case = DisciplinaryCase.objects.get(pk=pk, employee=employee)
        except (AttributeError, DisciplinaryCase.DoesNotExist):
            return Response({'detail': 'Case not found.'}, status=status.HTTP_404_NOT_FOUND)

        existing_count = case.appeals.count()
        appeal = DisciplinaryAppeal(
            case=case,
            appeal_number=existing_count + 1,
            filed_date=date.today(),
            grounds_for_appeal=request.data.get('grounds_for_appeal', ''),
        )

        file = request.FILES.get('document')
        if file:
            appeal.set_document(file)

        appeal.save()

        # Update case status
        case.status = DisciplinaryCase.Status.APPEAL_FILED
        case.save(update_fields=['status', 'updated_at'])

        return Response(DisciplinaryAppealSerializer(appeal).data, status=status.HTTP_201_CREATED)


class MyGrievancesView(generics.ListAPIView):
    serializer_class = GrievanceDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'employee') and user.employee:
            return (
                Grievance.objects
                .filter(employee=user.employee)
                .select_related(
                    'employee', 'category', 'assigned_to',
                    'against_employee', 'against_department',
                    'against_manager', 'escalated_to', 'hr_representative',
                )
                .prefetch_related('notes', 'attachments')
            )
        return Grievance.objects.none()


class FileGrievanceView(generics.CreateAPIView):
    serializer_class = GrievanceCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx
