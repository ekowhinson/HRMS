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

    # Two-Factor Authentication
    path('2fa/setup/', views.TwoFactorSetupView.as_view(), name='2fa-setup'),
    path('2fa/disable/', views.TwoFactorDisableView.as_view(), name='2fa-disable'),
    path('2fa/backup-codes/', views.TwoFactorBackupCodesView.as_view(), name='2fa-backup-codes'),
    path('2fa/policy/', views.TwoFactorPolicyStatusView.as_view(), name='2fa-policy-status'),
    path('2fa/send-code/', views.TwoFactorSendCodeView.as_view(), name='2fa-send-code'),

    # User profile
    path('me/', views.CurrentUserView.as_view(), name='current-user'),
    path('me/update/', views.UpdateProfileView.as_view(), name='update-profile'),

    # User management (admin)
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<uuid:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('users/<uuid:pk>/roles/', views.UserRoleListView.as_view(), name='user-role-list'),
    path('users/<uuid:pk>/roles/<uuid:role_pk>/', views.UserRoleDetailView.as_view(), name='user-role-detail'),
    path('users/<uuid:pk>/reset-password/', views.UserResetPasswordView.as_view(), name='user-reset-password'),
    path('users/<uuid:pk>/unlock/', views.UserUnlockView.as_view(), name='user-unlock'),
    path('users/<uuid:pk>/sessions/', views.UserSessionsView.as_view(), name='user-sessions'),

    # Role management
    path('roles/', views.RoleListView.as_view(), name='role-list'),
    path('roles/<uuid:pk>/', views.RoleDetailView.as_view(), name='role-detail'),
    path('roles/<uuid:pk>/users/', views.RoleUsersView.as_view(), name='role-users'),

    # Permission management
    path('permissions/', views.PermissionListView.as_view(), name='permission-list'),

    # Authentication logs
    path('auth-logs/', views.AuthenticationLogListView.as_view(), name='auth-log-list'),

    # Session management
    path('sessions/', views.UserSessionListView.as_view(), name='session-list'),
    path('sessions/<uuid:pk>/revoke/', views.RevokeSessionView.as_view(), name='revoke-session'),

    # Authentication providers (public)
    path('providers/', views.AuthProviderListView.as_view(), name='auth-providers'),
    path('ldap/login/', views.LDAPLoginView.as_view(), name='ldap-login'),
    path('azure/authorize/', views.AzureADAuthorizeView.as_view(), name='azure-authorize'),
    path('azure/callback/', views.AzureADCallbackView.as_view(), name='azure-callback'),

    # User linked providers
    path('me/providers/', views.UserLinkedProvidersView.as_view(), name='user-linked-providers'),

    # Admin provider management
    path('admin/providers/', views.AuthProviderAdminListView.as_view(), name='admin-providers'),
    path('admin/providers/<uuid:pk>/', views.AuthProviderAdminDetailView.as_view(), name='admin-provider-detail'),
    path('admin/providers/<uuid:pk>/test/', views.AuthProviderTestView.as_view(), name='admin-provider-test'),
]
