"""
Serializers for training module.
"""

from rest_framework import serializers
from .models import TrainingProgram, TrainingSession, TrainingEnrollment


# --- TrainingProgram Serializers ---

class TrainingProgramListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    type_display = serializers.CharField(source='get_training_type_display', read_only=True)
    session_count = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()

    class Meta:
        model = TrainingProgram
        fields = [
            'id', 'name', 'code', 'category', 'category_display',
            'training_type', 'type_display', 'duration_hours',
            'max_participants', 'is_mandatory', 'is_active',
            'cost_per_person', 'provider',
            'session_count', 'enrolled_count',
            'created_at', 'updated_at',
        ]

    def get_session_count(self, obj):
        return obj.sessions.count()

    def get_enrolled_count(self, obj):
        return TrainingEnrollment.objects.filter(session__program=obj).count()


class TrainingProgramDetailSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    type_display = serializers.CharField(source='get_training_type_display', read_only=True)
    session_count = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    sessions = serializers.SerializerMethodField()

    class Meta:
        model = TrainingProgram
        fields = [
            'id', 'name', 'code', 'description', 'category', 'category_display',
            'training_type', 'type_display', 'duration_hours',
            'max_participants', 'is_mandatory', 'is_active',
            'cost_per_person', 'provider', 'objectives', 'prerequisites',
            'target_departments', 'target_positions',
            'session_count', 'enrolled_count', 'sessions',
            'created_at', 'updated_at',
        ]

    def get_session_count(self, obj):
        return obj.sessions.count()

    def get_enrolled_count(self, obj):
        return TrainingEnrollment.objects.filter(session__program=obj).count()

    def get_sessions(self, obj):
        sessions = obj.sessions.all()[:10]
        return TrainingSessionListSerializer(sessions, many=True).data


class TrainingProgramCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingProgram
        fields = [
            'name', 'code', 'description', 'category', 'training_type',
            'duration_hours', 'max_participants', 'is_mandatory', 'is_active',
            'cost_per_person', 'provider', 'objectives', 'prerequisites',
            'target_departments', 'target_positions',
        ]


# --- TrainingSession Serializers ---

class TrainingSessionListSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    program_code = serializers.CharField(source='program.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    enrollment_count = serializers.SerializerMethodField()
    capacity = serializers.SerializerMethodField()

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'program', 'program_name', 'program_code',
            'title', 'facilitator', 'venue',
            'start_date', 'end_date', 'start_time', 'end_time',
            'status', 'status_display',
            'max_participants', 'enrollment_count', 'capacity',
            'created_at', 'updated_at',
        ]

    def get_enrollment_count(self, obj):
        return obj.enrollments.count()

    def get_capacity(self, obj):
        return obj.capacity


class TrainingSessionDetailSerializer(serializers.ModelSerializer):
    program_name = serializers.CharField(source='program.name', read_only=True)
    program_code = serializers.CharField(source='program.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    enrollment_count = serializers.SerializerMethodField()
    capacity = serializers.SerializerMethodField()
    enrollments = serializers.SerializerMethodField()

    class Meta:
        model = TrainingSession
        fields = [
            'id', 'program', 'program_name', 'program_code',
            'title', 'facilitator', 'venue',
            'start_date', 'end_date', 'start_time', 'end_time',
            'status', 'status_display', 'notes',
            'max_participants', 'enrollment_count', 'capacity',
            'enrollments',
            'created_at', 'updated_at',
        ]

    def get_enrollment_count(self, obj):
        return obj.enrollments.count()

    def get_capacity(self, obj):
        return obj.capacity

    def get_enrollments(self, obj):
        enrollments = obj.enrollments.select_related('employee').all()
        return TrainingEnrollmentListSerializer(enrollments, many=True).data


class TrainingSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSession
        fields = [
            'program', 'title', 'facilitator', 'venue',
            'start_date', 'end_date', 'start_time', 'end_time',
            'status', 'notes', 'max_participants',
        ]


# --- TrainingEnrollment Serializers ---

class TrainingEnrollmentListSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)

    class Meta:
        model = TrainingEnrollment
        fields = [
            'id', 'session', 'session_title', 'employee', 'employee_name',
            'employee_number', 'department_name',
            'status', 'status_display', 'attendance_date',
            'score', 'feedback', 'certificate_issued', 'certificate_date',
            'created_at', 'updated_at',
        ]

    def get_employee_name(self, obj):
        emp = obj.employee
        return f"{emp.first_name} {emp.last_name}"

    def get_department_name(self, obj):
        dept = obj.employee.department
        return dept.name if dept else ''


class TrainingEnrollmentDetailSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)
    program_name = serializers.CharField(source='session.program.name', read_only=True)

    class Meta:
        model = TrainingEnrollment
        fields = [
            'id', 'session', 'session_title', 'program_name',
            'employee', 'employee_name', 'employee_number', 'department_name',
            'status', 'status_display', 'attendance_date',
            'score', 'feedback', 'certificate_issued', 'certificate_date',
            'created_at', 'updated_at',
        ]

    def get_employee_name(self, obj):
        emp = obj.employee
        return f"{emp.first_name} {emp.last_name}"

    def get_department_name(self, obj):
        dept = obj.employee.department
        return dept.name if dept else ''


class TrainingEnrollmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingEnrollment
        fields = [
            'session', 'employee', 'status',
        ]
