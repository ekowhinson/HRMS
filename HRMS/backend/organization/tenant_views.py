"""Views for tenant/organization administration."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsSuperUser
from .models import Organization, License
from .serializers import LicenseSerializer, LicenseCreateSerializer
from .tenant_serializers import (
    OrganizationSerializer, OrganizationCreateSerializer,
    OrganizationConfigSerializer, OrganizationBrandingSerializer,
    OrganizationStatsSerializer,
)


class TenantSetupViewSet(viewsets.ModelViewSet):
    """Superuser-only management of organizations."""
    serializer_class = OrganizationSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return Organization.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        return OrganizationSerializer

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate an organization."""
        org = self.get_object()
        org.is_active = True
        org.save(update_fields=['is_active'])
        return Response({'status': 'activated'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate an organization."""
        org = self.get_object()
        org.is_active = False
        org.save(update_fields=['is_active'])
        return Response({'status': 'deactivated'})

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get usage statistics for an organization."""
        org = self.get_object()

        from employees.models import Employee
        from accounts.models import User
        from core.middleware import set_current_tenant, get_current_tenant

        prev_tenant = get_current_tenant()
        set_current_tenant(org)
        try:
            employee_count = Employee.objects.count()
            user_count = User.objects.filter(organization=org, is_active=True).count()
        finally:
            set_current_tenant(prev_tenant)

        data = {
            'organization': OrganizationSerializer(org).data,
            'employee_count': employee_count,
            'user_count': user_count,
            'max_employees': org.max_employees,
            'max_users': org.max_users,
            'employee_utilization': round(
                employee_count / org.max_employees * 100, 1
            ) if org.max_employees else 0,
            'user_utilization': round(
                user_count / org.max_users * 100, 1
            ) if org.max_users else 0,
        }
        return Response(data)

    @action(detail=True, methods=['post'])
    def modules(self, request, pk=None):
        """Enable/disable modules for an organization."""
        org = self.get_object()
        modules = request.data.get('modules_enabled', [])
        org.modules_enabled = modules
        org.save(update_fields=['modules_enabled'])
        return Response({'modules_enabled': org.modules_enabled})

    @action(detail=True, methods=['get', 'post'])
    def branding(self, request, pk=None):
        """Get or update branding (logo, colors) for a specific tenant."""
        org = self.get_object()

        if request.method == 'GET':
            return Response(OrganizationBrandingSerializer(org).data)

        logo = request.FILES.get('logo')
        if logo:
            org.logo_data = logo.read()
            org.logo_name = logo.name
            org.logo_mime_type = logo.content_type

        if request.data.get('remove_logo') == 'true':
            org.logo_data = None
            org.logo_name = None
            org.logo_mime_type = None

        primary_color = request.data.get('primary_color')
        if primary_color:
            org.primary_color = primary_color

        org.save()
        return Response(OrganizationBrandingSerializer(org).data)

    @action(detail=True, methods=['post'])
    def setup(self, request, pk=None):
        """Trigger organization setup with statutory and sample data."""
        org = self.get_object()

        modules = request.data.get('modules', None)
        year = request.data.get('year', None)
        force = request.data.get('force', False)
        run_async = request.data.get('async', False)

        if org.setup_completed and not force:
            return Response(
                {
                    'status': 'already_completed',
                    'setup_completed': True,
                    'message': 'Organization setup already completed. Use force=true to re-run.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if run_async:
            from .tasks import setup_organization_task
            task = setup_organization_task.delay(
                str(org.id), modules=modules, year=year
            )
            return Response({
                'status': 'started',
                'task_id': task.id,
            })

        from .setup import setup_organization
        result = setup_organization(org=org, modules=modules, year=year)
        return Response(result)

    @action(detail=True, methods=['get'], url_path='setup-status')
    def setup_status(self, request, pk=None):
        """Check setup status for an organization."""
        org = self.get_object()
        return Response({
            'setup_completed': org.setup_completed,
            'organization': OrganizationSerializer(org).data,
        })

    def perform_create(self, serializer):
        """Auto-trigger setup when a new organization is created."""
        org = serializer.save()
        try:
            from .tasks import setup_organization_task
            setup_organization_task.delay(str(org.id))
        except Exception:
            # Celery/Redis may not be available; setup can be triggered manually
            pass


class TenantConfigViewSet(viewsets.ViewSet):
    """Current tenant's configuration management."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Get current tenant's config."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'No tenant context'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = OrganizationConfigSerializer(tenant)
        return Response(serializer.data)

    def create(self, request):
        """Update current tenant's config."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'No tenant context'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = OrganizationConfigSerializer(tenant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['get', 'post'])
    def branding(self, request):
        """Get or update branding (logo, colors)."""
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response(
                {'error': 'No tenant context'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == 'GET':
            return Response(OrganizationBrandingSerializer(tenant).data)

        # Handle logo upload
        logo = request.FILES.get('logo')
        if logo:
            tenant.logo_data = logo.read()
            tenant.logo_name = logo.name
            tenant.logo_mime_type = logo.content_type

        # Handle logo removal
        if request.data.get('remove_logo') == 'true':
            tenant.logo_data = None
            tenant.logo_name = None
            tenant.logo_mime_type = None

        primary_color = request.data.get('primary_color')
        if primary_color:
            tenant.primary_color = primary_color

        tenant.save()
        return Response(OrganizationBrandingSerializer(tenant).data)


class LicenseViewSet(viewsets.ModelViewSet):
    """Superuser-only CRUD for licenses."""
    permission_classes = [IsSuperUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return LicenseCreateSerializer
        return LicenseSerializer

    def get_queryset(self):
        qs = License.objects.select_related('organization', 'issued_by')
        org_id = self.request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
        return qs

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a license."""
        license_obj = self.get_object()
        license_obj.is_active = True
        license_obj.save(update_fields=['is_active'])
        return Response(LicenseSerializer(license_obj).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a license."""
        license_obj = self.get_object()
        license_obj.is_active = False
        license_obj.save(update_fields=['is_active'])
        return Response(LicenseSerializer(license_obj).data)

    @action(detail=False, methods=['post'], url_path='generate-key')
    def generate_key(self, request):
        """Generate a new license key without creating a license."""
        key = License.generate_license_key()
        return Response({'license_key': key})
