"""Serializers for tenant backup and restore."""

from rest_framework import serializers
from .backup_models import TenantBackup, TenantRestore, BackupSchedule


class TenantBackupSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TenantBackup
        fields = [
            'id', 'organization', 'organization_name', 'backup_number',
            'name', 'description', 'backup_type', 'modules_included',
            'status', 'progress_percent', 'progress_detail',
            'file_size_bytes', 'file_checksum', 'file_format',
            'record_counts', 'total_records', 'tables_included',
            'started_at', 'completed_at', 'duration_seconds',
            'error_message', 'created_by', 'created_by_name',
            'retention_days', 'expires_at', 'is_locked',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'backup_number', 'status', 'progress_percent',
            'progress_detail', 'file_size_bytes', 'file_checksum',
            'record_counts', 'total_records', 'tables_included',
            'started_at', 'completed_at', 'duration_seconds',
            'error_message', 'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'System'


class TenantBackupCreateSerializer(serializers.Serializer):
    """Serializer for creating a new backup."""
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, default='')
    backup_type = serializers.ChoiceField(
        choices=TenantBackup.BackupType.choices,
        default='FULL',
    )
    modules = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )


class TenantRestoreSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    backup_number = serializers.CharField(source='backup.backup_number', read_only=True)

    class Meta:
        model = TenantRestore
        fields = [
            'id', 'organization', 'organization_name', 'backup',
            'backup_number', 'restore_number',
            'restore_type', 'modules_restored', 'restore_mode',
            'pre_restore_backup', 'pre_restore_completed',
            'status', 'progress_percent', 'progress_detail',
            'records_restored', 'records_skipped', 'records_failed',
            'total_restored', 'total_skipped', 'total_failed',
            'error_log', 'started_at', 'completed_at', 'duration_seconds',
            'initiated_by', 'approved_by', 'created_at',
        ]
        read_only_fields = fields


class TenantRestoreCreateSerializer(serializers.Serializer):
    """Serializer for initiating a restore."""
    restore_type = serializers.ChoiceField(
        choices=TenantRestore.RestoreType.choices,
        default='FULL',
    )
    modules = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    restore_mode = serializers.ChoiceField(
        choices=TenantRestore.RestoreMode.choices,
        default='OVERWRITE',
    )


class BackupScheduleSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = BackupSchedule
        fields = [
            'id', 'organization', 'organization_name', 'name',
            'is_active', 'schedule_type', 'schedule_config',
            'backup_type', 'modules_included', 'retention_days',
            'max_backups', 'last_run_at', 'next_run_at', 'last_status',
            'consecutive_failures', 'notify_on_completion',
            'notify_on_failure', 'notification_emails',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'last_run_at', 'next_run_at', 'last_status',
            'consecutive_failures', 'created_at', 'updated_at',
        ]
