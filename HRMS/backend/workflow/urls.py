from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'definitions', views.WorkflowDefinitionViewSet, basename='workflow-definitions')

urlpatterns = [
    path('', include(router.urls)),
    path('my-approvals/', views.MyPendingApprovalsView.as_view(), name='my-approvals'),
    path('approvals/<uuid:pk>/action/', views.ApprovalActionView.as_view(), name='approval-action'),
    path('status/', views.ObjectApprovalStatusView.as_view(), name='approval-status'),
    path('stats/', views.ApprovalStatsView.as_view(), name='approval-stats'),
]
