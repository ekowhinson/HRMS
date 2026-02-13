"""
URL configuration for HRMS project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from core.health import healthz, readyz

urlpatterns = [
    # Admin (obscured URL for security)
    path(settings.ADMIN_URL_PATH, admin.site.urls),

    # ── Health probes (no auth, no middleware overhead) ────────────────────
    path('healthz/', healthz, name='healthz'),   # Liveness — always 200
    path('readyz/', readyz, name='readyz'),       # Readiness — checks DB, Redis

    # API v1
    path('api/v1/', include([
        path('auth/', include('accounts.urls')),
        path('employees/', include('employees.urls')),
        path('organization/', include('organization.urls')),
        path('leave/', include('leave.urls')),
        path('benefits/', include('benefits.urls')),
        path('payroll/', include('payroll.urls')),
        path('performance/', include('performance.urls')),
        path('reports/', include('reports.urls')),
        path('core/', include('core.urls')),  # Cache, lookups, dashboard stats, system status
        path('policies/', include('policies.urls')),  # Company policies & SOPs
        path('exits/', include('exits.urls')),  # Exit/Offboarding management
        path('recruitment/', include('recruitment.urls')),  # Recruitment & interview scoring
        path('discipline/', include('discipline.urls')),  # Discipline & Grievance management
        path('workflow/', include('workflow.urls')),  # Approval workflow engine
        path('training/', include('training.urls')),  # Training & Development
        path('finance/', include('finance.urls')),  # Finance & GL
        path('procurement/', include('procurement.urls')),  # Procurement & AP
        path('inventory/', include('inventory.urls')),  # Inventory & Assets
        path('projects/', include('projects.urls')),  # Projects & Timesheets
        path('assistant/', include('assistant.urls')),  # AI Assistant
    ])),

    # Legacy health check (kept for backwards compatibility)
    path('health/', include('core.urls', namespace='core-health')),
]

# Serve media files and API docs in development only
if settings.DEBUG:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Customize admin site
admin.site.site_header = 'HRMS Administration'
admin.site.site_title = 'HRMS'
admin.site.index_title = 'Human Resource Management System'
