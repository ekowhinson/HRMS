"""
Serializers for Discipline & Grievance module.
"""

import uuid
from datetime import date

from rest_framework import serializers
from django.utils import timezone

from .models import (
    MisconductCategory, DisciplinaryCase, DisciplinaryAction,
    DisciplinaryHearing, HearingCommitteeMember, DisciplinaryEvidence,
    DisciplinaryAppeal, GrievanceCategory, Grievance, GrievanceNote,
    GrievanceAttachment,
)


class MisconductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MisconductCategory
        fields = [
            'id', 'code', 'name', 'description', 'severity',
            'recommended_action', 'is_active',
        ]


class GrievanceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GrievanceCategory
        fields = ['id', 'code', 'name', 'description', 'is_active']


# ── Disciplinary Case ──────────────────────────────────────────


class DisciplinaryCaseListSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    category_name = serializers.CharField(source='misconduct_category.name', read_only=True)
    severity = serializers.CharField(source='misconduct_category.severity', read_only=True)
    source_grievance_number = serializers.SerializerMethodField()

    class Meta:
        model = DisciplinaryCase
        fields = [
            'id', 'case_number', 'employee', 'employee_name', 'employee_number',
            'misconduct_category', 'category_name', 'severity',
            'status', 'reported_date', 'incident_date',
            'source_grievance_number',
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_source_grievance_number(self, obj):
        return obj.source_grievance.grievance_number if obj.source_grievance else None


class DisciplinaryActionSerializer(serializers.ModelSerializer):
    issued_by_name = serializers.CharField(
        source='issued_by.get_full_name', read_only=True, default=''
    )
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)

    class Meta:
        model = DisciplinaryAction
        fields = [
            'id', 'case', 'action_type', 'action_type_display', 'action_date',
            'effective_date', 'end_date', 'description', 'conditions',
            'suspension_days', 'reduction_percentage', 'reduction_duration_months',
            'issued_by', 'issued_by_name',
            'acknowledged_by_employee', 'acknowledged_date',
        ]
        read_only_fields = ['issued_by']

    def create(self, validated_data):
        validated_data['issued_by'] = self.context['request'].user
        return super().create(validated_data)


class HearingCommitteeMemberSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = HearingCommitteeMember
        fields = [
            'id', 'hearing', 'employee', 'employee_name', 'role',
            'role_display', 'attended',
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''


class DisciplinaryHearingSerializer(serializers.ModelSerializer):
    committee_members = HearingCommitteeMemberSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DisciplinaryHearing
        fields = [
            'id', 'case', 'hearing_number', 'scheduled_date', 'scheduled_time',
            'location', 'status', 'status_display',
            'employee_present', 'employee_representation',
            'minutes', 'findings', 'recommendations',
            'actual_start_time', 'actual_end_time',
            'next_hearing_date', 'adjournment_reason',
            'committee_members',
        ]


class DisciplinaryEvidenceSerializer(serializers.ModelSerializer):
    evidence_type_display = serializers.CharField(source='get_evidence_type_display', read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    has_file = serializers.BooleanField(read_only=True)

    class Meta:
        model = DisciplinaryEvidence
        fields = [
            'id', 'case', 'evidence_type', 'evidence_type_display',
            'title', 'description',
            'file_name', 'file_size', 'mime_type', 'has_file',
            'submitted_by', 'submitted_by_name', 'submitted_date',
        ]
        read_only_fields = ['file_name', 'file_size', 'mime_type', 'submitted_by', 'submitted_date']

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''


class DisciplinaryAppealSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.get_full_name', read_only=True, default=''
    )
    has_document = serializers.BooleanField(read_only=True)

    class Meta:
        model = DisciplinaryAppeal
        fields = [
            'id', 'case', 'appeal_number', 'filed_date',
            'grounds_for_appeal',
            'document_name', 'document_size', 'document_mime', 'has_document',
            'status', 'status_display',
            'reviewed_by', 'reviewed_by_name',
            'decision', 'decision_date', 'decision_rationale',
        ]
        read_only_fields = ['document_name', 'document_size', 'document_mime', 'reviewed_by']


class DisciplinaryCaseDetailSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    category_name = serializers.CharField(source='misconduct_category.name', read_only=True)
    severity = serializers.CharField(source='misconduct_category.severity', read_only=True)
    category_data = MisconductCategorySerializer(source='misconduct_category', read_only=True)
    reported_by_name = serializers.SerializerMethodField()
    investigator_name = serializers.SerializerMethodField()
    hr_representative_name = serializers.CharField(
        source='hr_representative.get_full_name', read_only=True, default=''
    )
    decision_by_name = serializers.CharField(
        source='decision_by.get_full_name', read_only=True, default=''
    )
    actions = DisciplinaryActionSerializer(many=True, read_only=True)
    hearings = DisciplinaryHearingSerializer(many=True, read_only=True)
    evidence = DisciplinaryEvidenceSerializer(many=True, read_only=True)
    appeals = DisciplinaryAppealSerializer(many=True, read_only=True)
    source_grievance_number = serializers.SerializerMethodField()

    class Meta:
        model = DisciplinaryCase
        fields = [
            'id', 'case_number', 'employee', 'employee_name', 'employee_number',
            'misconduct_category', 'category_name', 'severity', 'category_data',
            'incident_date', 'incident_location', 'incident_description',
            'reported_date', 'reported_by', 'reported_by_name',
            'status',
            'assigned_investigator', 'investigator_name',
            'hr_representative', 'hr_representative_name',
            'investigation_start_date', 'investigation_end_date',
            'investigation_findings', 'is_substantiated',
            'show_cause_issued_date', 'show_cause_response_date', 'show_cause_response',
            'final_decision', 'decision_date', 'decision_by', 'decision_by_name',
            'closure_date', 'closure_notes',
            'actions', 'hearings', 'evidence', 'appeals',
            'source_grievance', 'source_grievance_number',
            'created_at', 'updated_at',
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_reported_by_name(self, obj):
        return obj.reported_by.full_name if obj.reported_by else ''

    def get_investigator_name(self, obj):
        return obj.assigned_investigator.full_name if obj.assigned_investigator else ''

    def get_source_grievance_number(self, obj):
        return obj.source_grievance.grievance_number if obj.source_grievance else None


class DisciplinaryCaseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisciplinaryCase
        fields = [
            'employee', 'misconduct_category',
            'incident_date', 'incident_location', 'incident_description',
            'reported_date',
        ]

    def create(self, validated_data):
        # Auto-generate case number
        today = date.today()
        prefix = f"DC-{today.strftime('%Y%m')}"
        last = (
            DisciplinaryCase.objects
            .filter(case_number__startswith=prefix)
            .order_by('-case_number')
            .first()
        )
        if last:
            seq = int(last.case_number.split('-')[-1]) + 1
        else:
            seq = 1
        validated_data['case_number'] = f"{prefix}-{seq:04d}"

        # Set reported_by from request user's employee profile
        request = self.context.get('request')
        if request and hasattr(request.user, 'employee'):
            validated_data['reported_by'] = request.user.employee

        if 'reported_date' not in validated_data or not validated_data['reported_date']:
            validated_data['reported_date'] = today

        return super().create(validated_data)


# ── Grievance ──────────────────────────────────────────────────


class GrievanceNoteSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(
        source='added_by.get_full_name', read_only=True, default=''
    )

    class Meta:
        model = GrievanceNote
        fields = [
            'id', 'grievance', 'note', 'is_internal',
            'added_by', 'added_by_name', 'created_at',
        ]
        read_only_fields = ['added_by']

    def create(self, validated_data):
        validated_data['added_by'] = self.context['request'].user
        return super().create(validated_data)


class GrievanceAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True, default=''
    )
    has_file = serializers.BooleanField(read_only=True)

    class Meta:
        model = GrievanceAttachment
        fields = [
            'id', 'grievance', 'title', 'description',
            'file_name', 'file_size', 'mime_type', 'has_file',
            'uploaded_by', 'uploaded_by_name', 'created_at',
        ]
        read_only_fields = ['file_name', 'file_size', 'mime_type', 'uploaded_by']

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)


class GrievanceListSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Grievance
        fields = [
            'id', 'grievance_number', 'employee', 'employee_name',
            'subject', 'category', 'category_name',
            'status', 'priority', 'submitted_date',
            'assigned_to', 'assigned_to_name',
            'escalation_level',
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else ''


class GrievanceDetailSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_data = GrievanceCategorySerializer(source='category', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    against_employee_name = serializers.SerializerMethodField()
    against_department_name = serializers.SerializerMethodField()
    against_manager_name = serializers.SerializerMethodField()
    escalated_to_name = serializers.SerializerMethodField()
    hr_representative_name = serializers.CharField(
        source='hr_representative.get_full_name', read_only=True, default=''
    )
    notes = GrievanceNoteSerializer(many=True, read_only=True)
    attachments = GrievanceAttachmentSerializer(many=True, read_only=True)
    resulting_cases = serializers.SerializerMethodField()

    class Meta:
        model = Grievance
        fields = [
            'id', 'grievance_number', 'employee', 'employee_name', 'employee_number',
            'category', 'category_name', 'category_data',
            'subject', 'description', 'incident_date', 'desired_outcome',
            'against_employee', 'against_employee_name',
            'against_department', 'against_department_name',
            'against_manager', 'against_manager_name',
            'status', 'priority', 'is_confidential', 'is_anonymous',
            'submitted_date', 'acknowledged_date',
            'target_resolution_date', 'resolution_date',
            'assigned_to', 'assigned_to_name',
            'hr_representative', 'hr_representative_name',
            'resolution', 'resolution_accepted', 'resolution_feedback',
            'escalation_level', 'escalated_to', 'escalated_to_name',
            'escalation_reason', 'escalated_date',
            'notes', 'attachments', 'resulting_cases',
            'created_at', 'updated_at',
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else ''

    def get_against_employee_name(self, obj):
        return obj.against_employee.full_name if obj.against_employee else ''

    def get_against_department_name(self, obj):
        return obj.against_department.name if obj.against_department else ''

    def get_against_manager_name(self, obj):
        return obj.against_manager.full_name if obj.against_manager else ''

    def get_escalated_to_name(self, obj):
        return obj.escalated_to.full_name if obj.escalated_to else ''

    def get_resulting_cases(self, obj):
        cases = obj.resulting_cases.all()
        return [{'id': str(c.id), 'case_number': c.case_number} for c in cases]


class GrievanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grievance
        fields = [
            'employee', 'category', 'subject', 'description',
            'incident_date', 'desired_outcome',
            'against_employee', 'against_department', 'against_manager',
            'priority', 'is_confidential', 'is_anonymous',
        ]

    def create(self, validated_data):
        today = date.today()
        prefix = f"GR-{today.strftime('%Y%m')}"
        last = (
            Grievance.objects
            .filter(grievance_number__startswith=prefix)
            .order_by('-grievance_number')
            .first()
        )
        if last:
            seq = int(last.grievance_number.split('-')[-1]) + 1
        else:
            seq = 1
        validated_data['grievance_number'] = f"{prefix}-{seq:04d}"

        # Set employee from request user if not provided
        request = self.context.get('request')
        if 'employee' not in validated_data or not validated_data.get('employee'):
            if request and hasattr(request.user, 'employee'):
                validated_data['employee'] = request.user.employee

        return super().create(validated_data)
