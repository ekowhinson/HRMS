from django.contrib import admin
from .models import TrainingProgram, TrainingSession, TrainingEnrollment


@admin.register(TrainingProgram)
class TrainingProgramAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'training_type', 'is_mandatory', 'is_active']
    list_filter = ['category', 'training_type', 'is_mandatory', 'is_active']
    search_fields = ['name', 'code', 'description']


@admin.register(TrainingSession)
class TrainingSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'program', 'start_date', 'end_date', 'status']
    list_filter = ['status', 'program']
    search_fields = ['title', 'facilitator', 'venue']


@admin.register(TrainingEnrollment)
class TrainingEnrollmentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'session', 'status', 'score', 'certificate_issued']
    list_filter = ['status', 'certificate_issued']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__employee_number']
