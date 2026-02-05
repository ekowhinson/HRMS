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

from .models import User, Role, UserSession, AuthenticationLog, EmailVerificationToken
from .serializers import (
    LoginSerializer, UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    RoleSerializer, UserSessionSerializer, EmployeeSignupSerializer,
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
    queryset = User.objects.all()

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
        # Search by name or email
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(email__icontains=search)
            )
        return queryset


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a user."""
    queryset = User.objects.all()
    serializer_class = UserSerializer


class RoleListView(generics.ListCreateAPIView):
    """List and create roles."""
    queryset = Role.objects.filter(is_active=True)
    serializer_class = RoleSerializer


class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a role."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer


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
    rate = '5/hour'


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
        verification_url = f"{frontend_url}/signup/verify?token={token.token}"

        # Send verification email
        try:
            subject = 'NHIA HRMS - Complete Your Account Registration'
            message = f"""
Hello {employee.full_name},

You have initiated the account registration process for NHIA HRMS.

Please click the link below to complete your registration:
{verification_url}

This link will expire in 24 hours.

If you did not request this, please ignore this email or contact HR.

Best regards,
NHIA HRMS Team
            """

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )
        except Exception:
            # Log error but don't fail the request
            pass

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
