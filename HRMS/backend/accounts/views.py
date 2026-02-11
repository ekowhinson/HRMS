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
    """User login endpoint with 2FA support."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get_throttles(self):
        from core.throttling import LoginRateThrottle
        return [LoginRateThrottle()]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        two_factor_code = request.data.get('two_factor_code', '').strip()

        # Check if 2FA is enabled
        if user.two_factor_enabled:
            if not two_factor_code:
                # Auto-send code for EMAIL/SMS methods
                if user.two_factor_method in ('EMAIL', 'SMS'):
                    self._send_2fa_code(user)

                return Response({
                    'two_factor_required': True,
                    'method': user.two_factor_method,
                })

            # Verify the 2FA code
            if not self._verify_2fa_code(user, two_factor_code):
                # Log 2FA failure
                AuthenticationLog.objects.create(
                    user=user,
                    email=user.email,
                    event_type=AuthenticationLog.EventType.TWO_FACTOR_FAILED,
                    ip_address=self.get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                )
                return Response(
                    {'error': 'Invalid verification code.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Log 2FA success
            AuthenticationLog.objects.create(
                user=user,
                email=user.email,
                event_type=AuthenticationLog.EventType.TWO_FACTOR_SUCCESS,
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )

        # Reset failed login attempts
        user.reset_failed_login()

        # Check 2FA policy enforcement
        from .tfa_policy import TFAPolicy
        if TFAPolicy.is_required_for(user) and not user.two_factor_enabled:
            if not TFAPolicy.is_within_grace(user):
                return Response(
                    {'error': 'setup_required', 'message': 'Two-factor authentication is required by your organization. Please contact your administrator.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

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

        response_data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }

        # Grace period warning
        if TFAPolicy.is_required_for(user) and not user.two_factor_enabled:
            response_data['two_factor_setup_required'] = True

        return Response(response_data)

    def _send_2fa_code(self, user):
        """Generate and send OTP code for EMAIL/SMS 2FA methods."""
        import secrets as _secrets
        import hashlib as _hashlib
        from django.core.cache import cache

        code = f'{_secrets.randbelow(1000000):06d}'
        code_hash = _hashlib.sha256(code.encode()).hexdigest()
        cache.set(f'2fa_login_{user.id}', code_hash, 300)

        if user.two_factor_method == 'EMAIL':
            try:
                send_mail(
                    subject='HRMS - Your Login Verification Code',
                    message=f'Your verification code is: {code}\n\nThis code expires in 5 minutes.',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                pass

    def _verify_2fa_code(self, user, code):
        """Verify 2FA code (TOTP, EMAIL/SMS OTP, or backup code)."""
        import hashlib as _hashlib
        from django.core.cache import cache

        # Try TOTP verification
        if user.two_factor_method == 'TOTP' and user.two_factor_secret:
            import pyotp
            totp = pyotp.TOTP(user.two_factor_secret)
            if totp.verify(code, valid_window=1):
                return True

        # Try EMAIL/SMS OTP verification
        if user.two_factor_method in ('EMAIL', 'SMS'):
            cached_hash = cache.get(f'2fa_login_{user.id}')
            if cached_hash:
                code_hash = _hashlib.sha256(code.encode()).hexdigest()
                if code_hash == cached_hash:
                    cache.delete(f'2fa_login_{user.id}')
                    return True

        # Try backup code
        if user.backup_codes:
            code_hash = _hashlib.sha256(code.encode()).hexdigest()
            if code_hash in user.backup_codes:
                user.backup_codes.remove(code_hash)
                user.save(update_fields=['backup_codes'])
                return True

        return False

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

    def get_throttles(self):
        from core.throttling import PasswordResetRateThrottle
        return [PasswordResetRateThrottle()]

    def post(self, request):
        import logging
        logger = logging.getLogger(__name__)

        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']

        # Always return success to prevent email enumeration
        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            return Response({
                'message': 'If the email exists, a password reset link has been sent'
            })

        # Create password reset token (1 hour expiry)
        token = EmailVerificationToken.create_password_reset_token(
            email=email,
            expiry_hours=1
        )

        # Build reset URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_url = f"{frontend_url}/reset-password?token={token.token}"

        # Send reset email
        try:
            subject = 'HRMS - Password Reset Request'
            message = f"""
Hello {user.first_name or user.email},

We received a request to reset your password for your HRMS account.

Please click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

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
            logger.error(f'Failed to send password reset email to {email}: {e}')

        return Response({
            'message': 'If the email exists, a password reset link has been sent'
        })


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""
    permission_classes = [permissions.AllowAny]

    def get_throttles(self):
        from core.throttling import PasswordResetRateThrottle
        return [PasswordResetRateThrottle()]

    def get(self, request):
        """Validate token and return status."""
        token_str = request.query_params.get('token')
        if not token_str:
            return Response(
                {'error': 'Token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = EmailVerificationToken.objects.get(
                token=token_str,
                token_type=EmailVerificationToken.TokenType.PASSWORD_RESET,
                is_used=False
            )
        except EmailVerificationToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if token.is_expired:
            return Response(
                {'error': 'This reset link has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'valid': True,
            'email': token.email
        })

    def post(self, request):
        """Reset password using token."""
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token_str = serializer.validated_data['token']

        try:
            token = EmailVerificationToken.objects.get(
                token=token_str,
                token_type=EmailVerificationToken.TokenType.PASSWORD_RESET,
                is_used=False
            )
        except EmailVerificationToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if token.is_expired:
            return Response(
                {'error': 'This reset link has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find the user
        try:
            user = User.objects.get(email=token.email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'User account not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reset the password
        user.set_password(serializer.validated_data['new_password'])
        user.failed_login_attempts = 0
        user.lockout_until = None
        user.save()

        # Mark token as used
        token.is_used = True
        token.used_at = timezone.now()
        token.save()

        # Log password reset
        AuthenticationLog.objects.create(
            user=user,
            email=user.email,
            event_type=AuthenticationLog.EventType.PASSWORD_RESET,
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )

        return Response({'message': 'Password has been reset successfully. You can now log in.'})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


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
    permission_classes = [permissions.IsAdminUser]

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
    permission_classes = [permissions.IsAdminUser]

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

        # Send email with temporary password
        try:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            subject = 'HRMS - Your Password Has Been Reset'
            message = f"""
Hello {user.first_name or user.email},

Your HRMS account password has been reset by an administrator.

Your temporary password is: {new_password}

Please log in at {frontend_url}/login and change your password immediately.

If you did not expect this, please contact your HR administrator.

Best regards,
HRMS Team
            """

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to send password reset email to {user.email}: {e}')

        return Response({
            'message': 'Password reset successfully. User must change password on next login.',
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


# ============================================
# Two-Factor Authentication Views
# ============================================

import pyotp
import qrcode
import io
import base64
import secrets
import hashlib

from django.core.cache import cache
from .serializers import TwoFactorSetupSerializer, TwoFactorDisableSerializer


class TwoFactorSetupView(APIView):
    """Setup / enable two-factor authentication."""

    def get(self, request):
        """
        GET: Generate setup info.
        For TOTP: returns secret + QR code.
        For EMAIL/SMS: returns confirmation of method.
        """
        from .tfa_policy import TFAPolicy

        method = request.query_params.get('method', 'EMAIL').upper()
        user = request.user

        # Check if method is allowed by policy
        allowed = TFAPolicy.allowed_methods()
        if method not in allowed:
            return Response(
                {'error': f'Method {method} is not allowed by organization policy. Allowed: {", ".join(allowed)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.two_factor_enabled:
            return Response(
                {'error': 'Two-factor authentication is already enabled. Disable it first to change method.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if method == 'TOTP':
            # Generate a new TOTP secret
            secret = pyotp.random_base32()
            # Store temporarily in cache (10 min)
            cache.set(f'2fa_setup_{user.id}', {'secret': secret, 'method': 'TOTP'}, 600)

            totp = pyotp.TOTP(secret)
            provisioning_uri = totp.provisioning_uri(
                name=user.email,
                issuer_name='HRMS',
            )

            # Generate QR code as base64 data URI
            img = qrcode.make(provisioning_uri)
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            return Response({
                'method': 'TOTP',
                'secret': secret,
                'qr_code': f'data:image/png;base64,{qr_base64}',
                'provisioning_uri': provisioning_uri,
            })

        elif method in ('EMAIL', 'SMS'):
            # Generate a 6-digit OTP and send it
            code = f'{secrets.randbelow(1000000):06d}'
            code_hash = hashlib.sha256(code.encode()).hexdigest()
            cache.set(f'2fa_setup_{user.id}', {'code_hash': code_hash, 'method': method}, 300)

            if method == 'EMAIL':
                try:
                    send_mail(
                        subject='HRMS - Two-Factor Authentication Setup Code',
                        message=f'Your verification code is: {code}\n\nThis code expires in 5 minutes.',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[user.email],
                        fail_silently=False,
                    )
                except Exception:
                    pass

            return Response({
                'method': method,
                'message': f'Verification code sent via {"email" if method == "EMAIL" else "SMS"}.',
            })

        return Response({'error': 'Invalid method'}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """Verify code and enable 2FA."""
        serializer = TwoFactorSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        code = serializer.validated_data['code']
        method = serializer.validated_data.get('method', 'EMAIL').upper()

        setup_data = cache.get(f'2fa_setup_{user.id}')
        if not setup_data:
            return Response(
                {'error': 'Setup session expired. Please start again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        actual_method = setup_data.get('method', method)

        if actual_method == 'TOTP':
            secret = setup_data.get('secret')
            totp = pyotp.TOTP(secret)
            if not totp.verify(code, valid_window=1):
                return Response(
                    {'error': 'Invalid code. Please try again.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.two_factor_secret = secret
        else:
            code_hash = hashlib.sha256(code.encode()).hexdigest()
            if code_hash != setup_data.get('code_hash'):
                return Response(
                    {'error': 'Invalid code. Please try again.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Generate backup codes
        backup_codes = [f'{secrets.randbelow(100000000):08d}' for _ in range(10)]
        hashed_backup_codes = [
            hashlib.sha256(c.encode()).hexdigest() for c in backup_codes
        ]

        user.two_factor_enabled = True
        user.two_factor_method = actual_method
        user.backup_codes = hashed_backup_codes
        if actual_method != 'TOTP':
            user.two_factor_secret = None
        user.save(update_fields=[
            'two_factor_enabled', 'two_factor_method',
            'two_factor_secret', 'backup_codes',
        ])

        # Clear setup cache
        cache.delete(f'2fa_setup_{user.id}')

        return Response({
            'message': 'Two-factor authentication enabled successfully.',
            'backup_codes': backup_codes,
        })


class TwoFactorDisableView(APIView):
    """Disable two-factor authentication."""

    def post(self, request):
        from .tfa_policy import TFAPolicy

        user = request.user

        # Block disable if policy requires 2FA for this user
        if TFAPolicy.is_required_for(user):
            return Response(
                {'error': 'Your organization requires two-factor authentication. You cannot disable it.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TwoFactorDisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not user.check_password(serializer.validated_data['password']):
            return Response(
                {'error': 'Incorrect password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.two_factor_enabled = False
        user.two_factor_secret = None
        user.two_factor_method = 'EMAIL'
        user.backup_codes = None
        user.save(update_fields=[
            'two_factor_enabled', 'two_factor_secret',
            'two_factor_method', 'backup_codes',
        ])

        return Response({'message': 'Two-factor authentication disabled.'})


class TwoFactorBackupCodesView(APIView):
    """Regenerate backup codes."""

    def post(self, request):
        user = request.user
        if not user.two_factor_enabled:
            return Response(
                {'error': 'Two-factor authentication is not enabled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        backup_codes = [f'{secrets.randbelow(100000000):08d}' for _ in range(10)]
        hashed_backup_codes = [
            hashlib.sha256(c.encode()).hexdigest() for c in backup_codes
        ]

        user.backup_codes = hashed_backup_codes
        user.save(update_fields=['backup_codes'])

        return Response({'backup_codes': backup_codes})


class TwoFactorPolicyStatusView(APIView):
    """Return 2FA policy status for the current authenticated user."""

    def get(self, request):
        from .tfa_policy import TFAPolicy

        user = request.user
        deadline = TFAPolicy.grace_deadline_for(user)

        return Response({
            'enforcement': TFAPolicy.get('tfa_enforcement'),
            'allowed_methods': TFAPolicy.allowed_methods(),
            'is_required': TFAPolicy.is_required_for(user),
            'grace_deadline': deadline.isoformat() if deadline else None,
        })


class TwoFactorSendCodeView(APIView):
    """Send OTP code via email or SMS (used during login)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response(
                {'error': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            # Don't reveal whether user exists
            return Response({'message': 'If the account exists, a code has been sent.'})

        if not user.two_factor_enabled:
            return Response({'message': 'If the account exists, a code has been sent.'})

        code = f'{secrets.randbelow(1000000):06d}'
        code_hash = hashlib.sha256(code.encode()).hexdigest()
        cache.set(f'2fa_login_{user.id}', code_hash, 300)

        if user.two_factor_method == 'EMAIL':
            try:
                send_mail(
                    subject='HRMS - Your Login Verification Code',
                    message=f'Your verification code is: {code}\n\nThis code expires in 5 minutes.',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                pass
        # SMS sending would go here when SMS provider is configured

        return Response({'message': 'Verification code sent.'})
