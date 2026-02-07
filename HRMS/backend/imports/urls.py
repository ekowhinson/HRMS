"""
URL configuration for imports app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'imports'

router = DefaultRouter()
router.register(r'jobs', views.ImportJobViewSet, basename='import-job')
router.register(r'templates', views.ImportTemplateViewSet, basename='import-template')
router.register(r'batches', views.MultiFileImportBatchViewSet, basename='import-batch')
router.register(r'datasets', views.DatasetViewSet, basename='dataset')

urlpatterns = [
    path('', include(router.urls)),
    path('fields/<str:target_model>/', views.FieldDefinitionsView.as_view(), name='field-definitions'),
    path('unified/', views.UnifiedImportView.as_view(), name='unified-import'),
    path('unified/status/<str:task_id>/', views.UnifiedImportStatusView.as_view(), name='unified-import-status'),
    path('salary-structure/', views.SalaryStructureImportView.as_view(), name='salary-structure-import'),
    path('employee-update/', views.EmployeeUpdateImportView.as_view(), name='employee-update-import'),
    path('payroll-setup/upload/', views.PayrollSetupUploadView.as_view(), name='payroll-setup-upload'),
    path('payroll-setup/execute/', views.PayrollSetupExecuteView.as_view(), name='payroll-setup-execute'),
    path('payroll-setup/progress/<str:task_id>/', views.PayrollSetupProgressView.as_view(), name='payroll-setup-progress'),
    path('payroll-setup/reset/', views.PayrollSetupResetView.as_view(), name='payroll-setup-reset'),
]
