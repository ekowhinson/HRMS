"""
Authentication and User Management URL configuration.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = 'accounts'

urlpatterns = [
    # Authentication
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # Employee signup
    path('signup/', views.EmployeeSignupView.as_view(), name='signup'),
    path('signup/verify/', views.VerifyEmailView.as_view(), name='signup-verify'),

    # Password management
    path('password/change/', views.ChangePasswordView.as_view(), name='change-password'),
    path('password/reset/', views.PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password/reset/confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),

    # User profile
    path('me/', views.CurrentUserView.as_view(), name='current-user'),
    path('me/update/', views.UpdateProfileView.as_view(), name='update-profile'),

    # User management (admin)
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<uuid:pk>/', views.UserDetailView.as_view(), name='user-detail'),

    # Role management
    path('roles/', views.RoleListView.as_view(), name='role-list'),
    path('roles/<uuid:pk>/', views.RoleDetailView.as_view(), name='role-detail'),

    # Session management
    path('sessions/', views.UserSessionListView.as_view(), name='session-list'),
    path('sessions/<uuid:pk>/revoke/', views.RevokeSessionView.as_view(), name='revoke-session'),
]
