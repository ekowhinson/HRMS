"""URL routing for report builder."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import builder_views

router = DefaultRouter()
router.register(r'saved', builder_views.ReportDefinitionViewSet, basename='report-definition')
router.register(r'scheduled', builder_views.ScheduledReportViewSet, basename='scheduled-report')

urlpatterns = [
    path('data-sources/', builder_views.data_sources_view, name='report-data-sources'),
    path('fields/<str:data_source>/', builder_views.fields_view, name='report-fields'),
    path('preview/', builder_views.preview_view, name='report-preview'),
    path('export/', builder_views.export_view, name='report-export'),
    path('', include(router.urls)),
]
