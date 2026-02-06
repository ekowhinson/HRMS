"""
Views for accounts app.
"""

from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

from django.db import models

from .models import User, Role, Permission, UserRole, UserSession, AuthenticationLog, EmailVerificationToken
from .serializers import (
    LoginSerializer, UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    RoleSerializer, RoleUpdateSerializer, PermissionSerializer, UserRoleSerializer,
    UserRoleDetailSerializer, UserRoleAssignSerializer, UserSessionSerializer,
    AuthenticationLogSerializer, EmployeeSignupSerializer,
    VerifyEmailTokenSerializer, CompleteSignupSerializer, EmployeeInfoSerializer
)


class LoginView(APIView):
    """User login endpoint."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # Reset failed login attempts
        user.reset_failed_login()

        # Update last login info
        user.last_login_at = timezone.now()
        user.last_login_ip = self.get_client_ip(request)
        user.save(update_fields=['last_login_at', 'last_login_ip'])

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # Log successful login
        AuthenticationLog.objects.create(
            user=user,
            email=user.email,
            event_type=AuthenticationLog.EventType.LOGIN_SUCCESS,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class LogoutView(APIView):
    """User logout endpoint."""

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()

            # Log logout
            AuthenticationLog.objects.create(
                user=request.user,
                email=request.user.email,
                event_type=AuthenticationLog.EventType.LOGOUT,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )

            return Response({'message': 'Successfully logged out'})
        except Exception:
            return Response({'message': 'Successfully logged out'})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class CurrentUserView(generics.RetrieveAPIView):
    """Get current user profile."""
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UpdateProfileView(generics.UpdateAPIView):
    """Update current user profile."""
    serializer_class = UserUpdateSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """Change password endpoint."""

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.password_changed_at = timezone.now()
        user.must_change_password = False
        user.save()

        # Log password change
        AuthenticationLog.objects.create(
            user=user,
            email=user.email,
            event_type=AuthenticationLog.EventType.PASSWORD_CHANGE,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        return Response({'message': 'Password changed successfully'})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class PasswordResetRequestView(APIView):
    """Request password reset."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # TODO: Send password reset email
        # For now, just return success message
        return Response({
            'message': 'If the email exists, a password reset link has been sent'
        })


class PasswordResetConfirmView(APIView):
    """Confirm password reset."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # TODO: Validate token and reset password
        return Response({'message': 'Password has been reset successfully'})


class UserListView(generics.ListCreateAPIView):
    """List and create users."""
    queryset = User.objects.all().prefetch_related('user_roles__role')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        # Filter by staff status
        is_staff = self.request.query_params.get('is_staff')
        if is_staff is not None:
            queryset = queryset.filter(is_staff=is_staff.lower() == 'true')
        # Filter by role
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(user_roles__role_id=role, user_roles__is_active=True)
        # Search by name or email
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(email__icontains=search)
            )
        return queryset.distinct()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({'results': serializer.data})


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a user."""
    queryset = User.objects.all().prefetch_related('user_roles__role')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer


class UserRoleListView(APIView):
    """Manage user roles."""

    def get(self, request, pk):
        """Get user's roles."""
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        user_roles = user.user_roles.filter(is_active=True).select_related('role')
        serializer = UserRoleDetailSerializer(user_roles, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        """Assign a role to user."""
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = Role.objects.get(id=serializer.validated_data['role'])

        # Check if user already has this role
        if UserRole.objects.filter(user=user, role=role, is_active=True).exists():
            return Response(
                {'error': 'User already has this role'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # If setting as primary, unset other primary roles
        if serializer.validated_data.get('is_primary', False):
            user.user_roles.filter(is_primary=True).update(is_primary=False)

        user_role = UserRole.objects.create(
            user=user,
            role=role,
            scope_type=serializer.validated_data.get('scope_type', 'global'),
            scope_id=serializer.validated_data.get('scope_id'),
            is_primary=serializer.validated_data.get('is_primary', False),
            effective_from=serializer.validated_data.get('effective_from', timezone.now().date()),
            effective_to=serializer.validated_data.get('effective_to'),
        )

        return Response(UserRoleDetailSerializer(user_role).data, status=status.HTTP_201_CREATED)


class UserRoleDetailView(APIView):
    """Remove a role from user."""

    def delete(self, request, pk, role_pk):
        """Remove role from user."""
        try:
            user_role = UserRole.objects.get(pk=role_pk, user_id=pk)
        except UserRole.DoesNotExist:
            return Response({'error': 'User role not found'}, status=status.HTTP_404_NOT_FOUND)

        user_role.is_active = False
        user_role.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserResetPasswordView(APIView):
    """Admin reset user password."""

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Generate a random password
        import secrets
        import string
        new_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

        user.set_password(new_password)
        user.must_change_password = True
        user.save()

        # Log password reset
        AuthenticationLog.objects.create(
            user=user,
            email=user.email,
            event_type=AuthenticationLog.EventType.PASSWORD_RESET,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            extra_data={'reset_by': str(request.user.id)}
        )

        # TODO: Send email with new password
        return Response({
            'message': 'Password reset successfully. User must change password on next login.',
            'temporary_password': new_password  # Only for development
        })

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class UserUnlockView(APIView):
    """Unlock a user account."""

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        user.failed_login_attempts = 0
        user.lockout_until = None
        user.save(update_fields=['failed_login_attempts', 'lockout_until'])

        # Log account unlock
        AuthenticationLog.objects.create(
            user=user,
            email=user.email,
            event_type=AuthenticationLog.EventType.ACCOUNT_UNLOCKED,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            extra_data={'unlocked_by': str(request.user.id)}
        )

        return Response({'message': 'Account unlocked successfully'})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class UserSessionsView(generics.ListAPIView):
    """Get sessions for a specific user."""
    serializer_class = UserSessionSerializer

    def get_queryset(self):
        return UserSession.objects.filter(user_id=self.kwargs['pk'], is_active=True)


class RoleListView(generics.ListCreateAPIView):
    """List and create roles."""
    queryset = Role.objects.all().prefetch_related('role_permissions__permission')
    serializer_class = RoleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        is_system_role = self.request.query_params.get('is_system_role')
        if is_system_role is not None:
            queryset = queryset.filter(is_system_role=is_system_role.lower() == 'true')
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search) |
                models.Q(code__icontains=search)
            )
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a role."""
    queryset = Role.objects.all().prefetch_related('role_permissions__permission')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return RoleUpdateSerializer
        return RoleSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_system_role:
            return Response(
                {'error': 'Cannot delete system roles'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class RoleUsersView(generics.ListAPIView):
    """Get users with a specific role."""
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(
            user_roles__role_id=self.kwargs['pk'],
            user_roles__is_active=True
        ).prefetch_related('user_roles__role').distinct()


class PermissionListView(generics.ListAPIView):
    """List all permissions."""
    queryset = Permission.objects.filter(is_active=True)
    serializer_class = PermissionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(module=module)
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class AuthenticationLogListView(generics.ListAPIView):
    """List authentication logs."""
    serializer_class = AuthenticationLogSerializer
    queryset = AuthenticationLog.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()

        user = self.request.query_params.get('user')
        if user:
            queryset = queryset.filter(user_id=user)

        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(timestamp__date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(timestamp__date__lte=end_date)

        return queryset[:100]  # Limit to last 100 logs

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({'results': serializer.data})


class UserSessionListView(generics.ListAPIView):
    """List user sessions."""
    serializer_class = UserSessionSerializer

    def get_queryset(self):
        return UserSession.objects.filter(user=self.request.user, is_active=True)


class RevokeSessionView(APIView):
    """Revoke a user session."""

    def post(self, request, pk):
        try:
            session = UserSession.objects.get(pk=pk, user=request.user)
            session.is_active = False
            session.save()
            return Response({'message': 'Session revoked successfully'})
        except UserSession.DoesNotExist:
            return Response(
                {'error': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class SignupRateThrottle(AnonRateThrottle):
    """Rate limiting for signup endpoints."""
    rate = '30/hour'  # Increased from 5/hour for development


class EmployeeSignupView(APIView):
    """
    Initiate employee signup process.
    POST /auth/signup/
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        serializer = EmployeeSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        employee = serializer.validated_data['employee']

        # Create verification token
        token = EmailVerificationToken.create_signup_token(
            email=email,
            employee=employee,
            expiry_hours=24
        )

        # Build verification URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        verification_url = f"{frontend_url}/signup?token={token.token}"

        # Send verification email
        try:
            subject = 'HRMS - Complete Your Account Registration'
            message = f"""
Hello {employee.full_name},

You have initiated the account registration process for HRMS.

Please click the link below to complete your registration:
{verification_url}

This link will expire in 24 hours.

If you did not request this, please ignore this email or contact HR.

Best regards,
HRMS Team
            """

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            # Log error but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to send signup email to {email}: {e}')

        return Response({
            'message': 'Verification email sent. Please check your inbox.',
            'email': email,
            'employee_name': employee.full_name
        })


class VerifyEmailView(APIView):
    """
    Verify email token and complete signup.
    GET /auth/signup/verify/ - Validate token and return employee info
    POST /auth/signup/verify/ - Complete signup with password
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Validate token and return employee info."""
        token_str = request.query_params.get('token')
        if not token_str:
            return Response(
                {'error': 'Token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = VerifyEmailTokenSerializer(data={'token': token_str})
        serializer.is_valid(raise_exception=True)

        verification_token = serializer.context['verification_token']
        employee = verification_token.employee

        employee_serializer = EmployeeInfoSerializer(employee)
        return Response({
            'valid': True,
            'email': verification_token.email,
            'employee': employee_serializer.data
        })

    def post(self, request):
        """Complete signup with password."""
        serializer = CompleteSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        verification_token = serializer.context['verification_token']
        employee = verification_token.employee

        # Create user account
        user = User.objects.create_user(
            email=verification_token.email,
            password=serializer.validated_data['password'],
            first_name=employee.first_name,
            last_name=employee.last_name,
            middle_name=employee.middle_name,
            is_verified=True,
        )

        # Link user to employee
        employee.user = user
        employee.save(update_fields=['user'])

        # Mark token as used
        verification_token.is_used = True
        verification_token.used_at = timezone.now()
        verification_token.save()

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        # Log successful signup
        AuthenticationLog.objects.create(
            user=user,
            email=user.email,
            event_type=AuthenticationLog.EventType.LOGIN_SUCCESS,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            extra_data={'signup': True}
        )

        return Response({
            'message': 'Account created successfully',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


# ============================================
# Authentication Provider Views
# ============================================

from .models import AuthProvider, UserAuthProvider
from .serializers import AuthProviderSerializer, AuthProviderConfigSerializer


class AuthProviderListView(APIView):
    """
    Public endpoint to list enabled authentication providers.
    Used by login page to show available auth methods.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        providers = AuthProvider.objects.filter(is_enabled=True).order_by('priority')
        return Response([{
            'id': str(p.id),
            'name': p.name,
            'type': p.provider_type,
            'is_default': p.is_default,
        } for p in providers])


class LDAPLoginView(APIView):
    """
    LDAP/Active Directory authentication endpoint.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import authenticate
        user = authenticate(request, username=username, password=password)

        if not user:
            return Response(
                {'error': 'Invalid LDAP credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user is active
        if not user.is_active:
            return Response(
                {'error': 'User account is disabled'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Update last login info
        user.last_login_at = timezone.now()
        user.last_login_ip = self.get_client_ip(request)
        user.save(update_fields=['last_login_at', 'last_login_ip'])

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class AzureADAuthorizeView(APIView):
    """
    Generate Azure AD authorization URL for OAuth flow.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            provider = AuthProvider.objects.get(
                provider_type='AZURE_AD',
                is_enabled=True
            )
        except AuthProvider.DoesNotExist:
            return Response(
                {'error': 'Azure AD authentication not configured'},
                status=status.HTTP_400_BAD_REQUEST
            )

        config = provider.config
        redirect_uri = config.get('redirect_uri') or request.build_absolute_uri('/auth/azure/callback')

        from .backends.azure_ad import AzureADBackend
        auth_url, state = AzureADBackend.get_authorization_url(config, redirect_uri)

        if not auth_url:
            return Response(
                {'error': 'Failed to generate authorization URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'auth_url': auth_url,
            'state': state
        })


class AzureADCallbackView(APIView):
    """
    Handle Azure AD OAuth callback.
    Exchange authorization code for tokens and authenticate user.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get('code')
        state = request.data.get('state')

        if not code:
            return Response(
                {'error': 'Authorization code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate state
        from .backends.azure_ad import AzureADBackend
        if state and not AzureADBackend.validate_state(state):
            return Response(
                {'error': 'Invalid state parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            provider = AuthProvider.objects.get(
                provider_type='AZURE_AD',
                is_enabled=True
            )
        except AuthProvider.DoesNotExist:
            return Response(
                {'error': 'Azure AD authentication not configured'},
                status=status.HTTP_400_BAD_REQUEST
            )

        config = provider.config
        redirect_uri = config.get('redirect_uri') or request.build_absolute_uri('/auth/azure/callback')

        # Exchange code for tokens
        tokens = AzureADBackend.exchange_code_for_tokens(config, code, redirect_uri)

        if not tokens:
            return Response(
                {'error': 'Failed to exchange authorization code'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Authenticate user with tokens
        from django.contrib.auth import authenticate
        user = authenticate(request, azure_token=tokens)

        if not user:
            return Response(
                {'error': 'User authentication failed'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Update last login info
        user.last_login_at = timezone.now()
        user.last_login_ip = self.get_client_ip(request)
        user.save(update_fields=['last_login_at', 'last_login_ip'])

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


# ============================================
# Admin Authentication Provider Views
# ============================================

class AuthProviderAdminListView(APIView):
    """
    Admin endpoint to list all authentication providers.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        providers = AuthProvider.objects.all().order_by('priority')
        serializer = AuthProviderConfigSerializer(providers, many=True)
        return Response(serializer.data)


class AuthProviderAdminDetailView(APIView):
    """
    Admin endpoint to get/update a specific authentication provider.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        try:
            provider = AuthProvider.objects.get(pk=pk)
        except AuthProvider.DoesNotExist:
            return Response(
                {'error': 'Provider not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AuthProviderConfigSerializer(provider)
        return Response(serializer.data)

    def put(self, request, pk):
        try:
            provider = AuthProvider.objects.get(pk=pk)
        except AuthProvider.DoesNotExist:
            return Response(
                {'error': 'Provider not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AuthProviderConfigSerializer(provider, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            # Log configuration change
            AuthenticationLog.objects.create(
                user=request.user,
                email=request.user.email,
                event_type='PROVIDER_CFG',
                auth_provider=provider,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                extra_data={'action': 'update'}
            )

            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class AuthProviderTestView(APIView):
    """
    Admin endpoint to test authentication provider connection.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        try:
            provider = AuthProvider.objects.get(pk=pk)
        except AuthProvider.DoesNotExist:
            return Response(
                {'error': 'Provider not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        config = provider.config
        success = False
        message = "Unknown provider type"

        if provider.provider_type == 'LOCAL':
            success = True
            message = "Local authentication is always available"
        elif provider.provider_type == 'LDAP':
            from .backends.ldap import LDAPAuthBackend
            success, message = LDAPAuthBackend.test_connection(config)
        elif provider.provider_type == 'AZURE_AD':
            from .backends.azure_ad import AzureADBackend
            success, message = AzureADBackend.test_connection(config)

        # Update provider connection status
        provider.last_connection_test = timezone.now()
        provider.last_connection_status = success
        provider.last_connection_error = None if success else message
        provider.save(update_fields=['last_connection_test', 'last_connection_status', 'last_connection_error'])

        return Response({
            'success': success,
            'message': message
        })


class UserLinkedProvidersView(APIView):
    """
    Get providers linked to the current user.
    """
    def get(self, request):
        links = UserAuthProvider.objects.filter(
            user=request.user,
            is_active=True
        ).select_related('provider')

        return Response([{
            'id': str(link.id),
            'provider_id': str(link.provider.id),
            'provider_name': link.provider.name,
            'provider_type': link.provider.provider_type,
            'external_username': link.external_username,
            'is_primary': link.is_primary,
            'last_login': link.last_login,
            'login_count': link.login_count,
        } for link in links])
