"""
Views for the Company Policy module.
"""

import base64
from django.db import models
from django.db.models import Count, Q
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import PolicyCategory, Policy, PolicyVersion, PolicyAcknowledgement, PolicyNotification
from .serializers import (
    PolicyCategorySerializer,
    PolicyListSerializer,
    PolicyDetailSerializer,
    PolicyCreateUpdateSerializer,
    PolicyVersionSerializer,
    PolicyAcknowledgementSerializer,
    AcknowledgePolicySerializer,
    PolicyNotificationSerializer,
    PolicyStatsSerializer,
)


class PolicyCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing policy categories.
    """
    queryset = PolicyCategory.objects.all()
    serializer_class = PolicyCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'sort_order', 'created_at']
    ordering = ['sort_order', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Annotate with policy count
        queryset = queryset.annotate(
            policy_count=Count('policies', filter=Q(policies__status='PUBLISHED'))
        )
        # Filter active only if requested
        if self.request.query_params.get('active_only') == 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


class PolicyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing policies and SOPs.
    """
    queryset = Policy.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'policy_type', 'status']
    search_fields = ['title', 'code', 'summary', 'content']
    ordering_fields = ['title', 'code', 'published_at', 'effective_date', 'created_at']
    ordering = ['-published_at', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return PolicyListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return PolicyCreateUpdateSerializer
        return PolicyDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Published only for non-admin
        if not self.request.user.is_staff:
            queryset = queryset.filter(status=Policy.Status.PUBLISHED)

        # Filter active policies
        if self.request.query_params.get('active_only') == 'true':
            today = timezone.now().date()
            queryset = queryset.filter(
                status=Policy.Status.PUBLISHED
            ).exclude(
                effective_date__gt=today
            ).exclude(
                expiry_date__lt=today
            )

        # Filter requiring acknowledgement
        if self.request.query_params.get('requires_acknowledgement') == 'true':
            queryset = queryset.filter(requires_acknowledgement=True)

        # Filter unacknowledged by current user
        if self.request.query_params.get('unacknowledged') == 'true':
            employee = getattr(self.request.user, 'employee', None)
            if employee:
                acknowledged_ids = PolicyAcknowledgement.objects.filter(
                    employee=employee
                ).values_list('policy_id', flat=True)
                queryset = queryset.exclude(id__in=acknowledged_ids)

        return queryset

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a policy."""
        policy = self.get_object()

        if policy.status == Policy.Status.PUBLISHED:
            return Response(
                {'detail': 'Policy is already published.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        policy.publish(request.user)
        return Response(PolicyDetailSerializer(policy, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a policy."""
        policy = self.get_object()
        policy.archive()
        return Response(PolicyDetailSerializer(policy, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge reading a policy."""
        policy = self.get_object()

        # Check if policy requires acknowledgement
        if not policy.requires_acknowledgement:
            return Response(
                {'detail': 'This policy does not require acknowledgement.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already acknowledged
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'User is not linked to an employee record.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if PolicyAcknowledgement.objects.filter(policy=policy, employee=employee).exists():
            return Response(
                {'detail': 'You have already acknowledged this policy.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AcknowledgePolicySerializer(
            data=request.data,
            context={'request': request, 'policy': policy}
        )
        serializer.is_valid(raise_exception=True)
        acknowledgement = serializer.save()

        return Response(
            PolicyAcknowledgementSerializer(acknowledgement).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'])
    def acknowledgements(self, request, pk=None):
        """Get all acknowledgements for a policy."""
        policy = self.get_object()
        acknowledgements = policy.acknowledgements.select_related('employee')

        # Pagination
        page = self.paginate_queryset(acknowledgements)
        if page is not None:
            serializer = PolicyAcknowledgementSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = PolicyAcknowledgementSerializer(acknowledgements, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get version history for a policy."""
        policy = self.get_object()
        versions = policy.versions.all()
        serializer = PolicyVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def download_attachment(self, request, pk=None):
        """Download policy attachment."""
        policy = self.get_object()

        if not policy.attachment:
            return Response(
                {'detail': 'No attachment found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        response = HttpResponse(
            policy.attachment,
            content_type=policy.attachment_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{policy.attachment_name}"'
        return response

    @action(detail=True, methods=['get'], url_path='view_attachment')
    def view_attachment(self, request, pk=None):
        """View policy attachment inline (for PDFs and images)."""
        policy = self.get_object()

        if not policy.attachment:
            return Response(
                {'detail': 'No attachment found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        content_type = policy.attachment_type or 'application/octet-stream'
        response = HttpResponse(policy.attachment, content_type=content_type)

        # Inline display for PDFs and images; download fallback for others
        if content_type in ('application/pdf',) or content_type.startswith('image/'):
            response['Content-Disposition'] = f'inline; filename="{policy.attachment_name}"'
        else:
            response['Content-Disposition'] = f'attachment; filename="{policy.attachment_name}"'

        return response

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get policy statistics."""
        today = timezone.now().date()

        total = Policy.objects.count()
        published = Policy.objects.filter(status=Policy.Status.PUBLISHED).count()
        draft = Policy.objects.filter(status=Policy.Status.DRAFT).count()

        total_acks = PolicyAcknowledgement.objects.count()

        # Pending acknowledgements (published policies requiring ack)
        from employees.models import Employee
        active_employees = Employee.objects.filter(status='ACTIVE').count()
        policies_requiring_ack = Policy.objects.filter(
            status=Policy.Status.PUBLISHED,
            requires_acknowledgement=True
        ).count()
        expected_acks = active_employees * policies_requiring_ack
        pending_acks = max(0, expected_acks - total_acks)

        # Overdue acknowledgements
        overdue_policies = Policy.objects.filter(
            status=Policy.Status.PUBLISHED,
            requires_acknowledgement=True,
        ).annotate(
            deadline=models.ExpressionWrapper(
                models.F('published_at') + models.DurationField(),
                output_field=models.DateTimeField()
            )
        )
        # Simplified: count policies past deadline with pending acks
        overdue_acks = 0  # Would need complex query

        # By category
        by_category = list(
            PolicyCategory.objects.annotate(
                count=Count('policies', filter=Q(policies__status='PUBLISHED'))
            ).values('name', 'count').order_by('-count')[:10]
        )

        # By type
        by_type = list(
            Policy.objects.filter(status=Policy.Status.PUBLISHED)
            .values('policy_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        data = {
            'total_policies': total,
            'published_policies': published,
            'draft_policies': draft,
            'total_acknowledgements': total_acks,
            'pending_acknowledgements': pending_acks,
            'overdue_acknowledgements': overdue_acks,
            'policies_by_category': by_category,
            'policies_by_type': by_type,
        }

        return Response(PolicyStatsSerializer(data).data)

    @action(detail=False, methods=['get'])
    def my_pending(self, request):
        """Get policies pending acknowledgement for current user."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response([])

        acknowledged_ids = PolicyAcknowledgement.objects.filter(
            employee=employee
        ).values_list('policy_id', flat=True)

        policies = Policy.objects.filter(
            status=Policy.Status.PUBLISHED,
            requires_acknowledgement=True
        ).exclude(id__in=acknowledged_ids)

        serializer = PolicyListSerializer(policies, many=True, context={'request': request})
        return Response(serializer.data)


class PolicyAcknowledgementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing policy acknowledgements.
    """
    queryset = PolicyAcknowledgement.objects.select_related('policy', 'employee')
    serializer_class = PolicyAcknowledgementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['policy', 'employee']
    search_fields = ['employee__first_name', 'employee__last_name', 'policy__title']
    ordering_fields = ['acknowledged_at', 'created_at']
    ordering = ['-acknowledged_at']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by employee if not admin
        if not self.request.user.is_staff:
            employee = getattr(self.request.user, 'employee', None)
            if employee:
                queryset = queryset.filter(employee=employee)
            else:
                queryset = queryset.none()

        return queryset

    @action(detail=False, methods=['get'])
    def my_acknowledgements(self, request):
        """Get current user's acknowledgements."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response([])

        acknowledgements = PolicyAcknowledgement.objects.filter(
            employee=employee
        ).select_related('policy')

        serializer = self.get_serializer(acknowledgements, many=True)
        return Response(serializer.data)


class PolicyNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing policy notifications.
    """
    queryset = PolicyNotification.objects.select_related('policy', 'employee')
    serializer_class = PolicyNotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['policy', 'notification_type', 'is_read']
    ordering = ['-sent_at']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by employee
        employee = getattr(self.request.user, 'employee', None)
        if employee:
            queryset = queryset.filter(employee=employee)
        elif not self.request.user.is_staff:
            queryset = queryset.none()

        return queryset

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read."""
        employee = getattr(request.user, 'employee', None)
        if employee:
            PolicyNotification.objects.filter(
                employee=employee,
                is_read=False
            ).update(is_read=True, read_at=timezone.now())
        return Response({'detail': 'All notifications marked as read.'})
