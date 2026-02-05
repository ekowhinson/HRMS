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
]
