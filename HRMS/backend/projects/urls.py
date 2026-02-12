"""URL configuration for projects app."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'projects'

router = DefaultRouter()
router.register(r'projects', views.ProjectViewSet, basename='project')
router.register(r'tasks', views.ProjectTaskViewSet, basename='project-task')
router.register(r'resources', views.ResourceViewSet, basename='resource')
router.register(r'timesheets', views.TimesheetViewSet, basename='timesheet')
router.register(r'budgets', views.ProjectBudgetViewSet, basename='project-budget')
router.register(r'milestones', views.MilestoneViewSet, basename='milestone')
router.register(r'billings', views.ProjectBillingViewSet, basename='project-billing')

urlpatterns = [
    path('', include(router.urls)),
]
