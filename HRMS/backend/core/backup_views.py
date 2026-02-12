"""Views for tenant backup and restore management."""

from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .backup_models import TenantBackup, TenantRestore, BackupSchedule
from .backup_serializers import (
    TenantBackupSerializer, TenantBackupCreateSerializer,
    TenantRestoreSerializer, TenantRestoreCreateSerializer,
    BackupScheduleSerializer,
)
from .backup_service import TenantBackupService


class TenantBackupViewSet(viewsets.ModelViewSet):
    """Manage tenant backups."""
    serializer_class = TenantBackupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = TenantBackup.objects.all()
        if tenant:
            qs = qs.filter(organization=tenant)
        return qs.select_related('organization', 'created_by')

    def create(self, request, *args, **kwargs):
        serializer = TenantBackupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'No tenant context'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = TenantBackupService()
        backup = service.create_backup(
            organization=tenant,
            backup_type=serializer.validated_data['backup_type'],
            modules=serializer.validated_data.get('modules', []),
            name=serializer.validated_data['name'],
            created_by=request.user,
        )

        return Response(
            TenantBackupSerializer(backup).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download backup archive."""
        backup = self.get_object()
        if backup.status != TenantBackup.Status.COMPLETED:
            return Response(
                {'error': 'Backup is not completed'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if backup.file_data:
            data = bytes(backup.file_data)
        elif backup.file_path:
            with open(backup.file_path, 'rb') as f:
                data = f.read()
        else:
            return Response(
                {'error': 'No backup data available'},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = HttpResponse(data, content_type='application/gzip')
        response['Content-Disposition'] = (
            f'attachment; filename="{backup.backup_number}.json.gz"'
        )
        return response

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify backup integrity."""
        backup = self.get_object()
        service = TenantBackupService()
        result = service.verify_backup(backup)
        return Response(result)

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """Lock backup to prevent expiry."""
        backup = self.get_object()
        backup.is_locked = True
        backup.save(update_fields=['is_locked'])
        return Response({'status': 'locked'})

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        """Unlock backup."""
        backup = self.get_object()
        backup.is_locked = False
        backup.save(update_fields=['is_locked'])
        return Response({'status': 'unlocked'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Initiate restore from this backup."""
        backup = self.get_object()
        if backup.status != TenantBackup.Status.COMPLETED:
            return Response(
                {'error': 'Can only restore from completed backups'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TenantRestoreCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'No tenant context'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = TenantBackupService()
        restore = service.restore_backup(
            backup=backup,
            target_org=tenant,
            restore_type=serializer.validated_data['restore_type'],
            modules=serializer.validated_data.get('modules', []),
            restore_mode=serializer.validated_data['restore_mode'],
            initiated_by=request.user,
        )

        return Response(
            TenantRestoreSerializer(restore).data,
            status=status.HTTP_201_CREATED,
        )


class TenantRestoreViewSet(viewsets.ReadOnlyModelViewSet):
    """View restore operations."""
    serializer_class = TenantRestoreSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = TenantRestore.objects.all()
        if tenant:
            qs = qs.filter(organization=tenant)
        return qs.select_related('organization', 'backup', 'initiated_by')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a REPLACE restore (requires different user than initiator)."""
        restore = self.get_object()
        if restore.status != TenantRestore.Status.PENDING:
            return Response(
                {'error': 'Only pending restores can be approved'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if restore.initiated_by == request.user:
            return Response(
                {'error': 'Restore must be approved by a different user (SoD)'},
                status=status.HTTP_403_FORBIDDEN,
            )
        restore.approved_by = request.user
        restore.save(update_fields=['approved_by'])
        return Response({'status': 'approved'})


class BackupScheduleViewSet(viewsets.ModelViewSet):
    """Manage backup schedules."""
    serializer_class = BackupScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        qs = BackupSchedule.objects.all()
        if tenant:
            qs = qs.filter(organization=tenant)
        return qs.select_related('organization')

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            serializer.save(organization=tenant)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], url_path='run-now')
    def run_now(self, request, pk=None):
        """Trigger immediate backup from schedule."""
        schedule = self.get_object()
        service = TenantBackupService()
        backup = service.create_backup(
            organization=schedule.organization,
            backup_type=schedule.backup_type,
            modules=schedule.modules_included,
            name=f"Manual: {schedule.name}",
            created_by=request.user,
        )
        return Response(
            TenantBackupSerializer(backup).data,
            status=status.HTTP_201_CREATED,
        )
