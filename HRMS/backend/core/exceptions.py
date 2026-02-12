"""
Custom exception handling for the HRMS API.
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404

logger = logging.getLogger('hrms')


class HRMSException(Exception):
    """Base exception for HRMS application."""
    default_message = "An error occurred"
    default_code = "error"

    def __init__(self, message=None, code=None, extra_data=None):
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.extra_data = extra_data or {}
        super().__init__(self.message)


class ValidationException(HRMSException):
    """Raised when data validation fails."""
    default_message = "Validation failed"
    default_code = "validation_error"


class PermissionDeniedException(HRMSException):
    """Raised when user doesn't have permission."""
    default_message = "You don't have permission to perform this action"
    default_code = "permission_denied"


class ResourceNotFoundException(HRMSException):
    """Raised when a resource is not found."""
    default_message = "Resource not found"
    default_code = "not_found"


class BusinessRuleException(HRMSException):
    """Raised when a business rule is violated."""
    default_message = "Business rule violation"
    default_code = "business_rule_violation"


class WorkflowException(HRMSException):
    """Raised when workflow state transition is invalid."""
    default_message = "Invalid workflow transition"
    default_code = "workflow_error"


class PayrollException(HRMSException):
    """Raised when payroll processing fails."""
    default_message = "Payroll processing error"
    default_code = "payroll_error"


class LeaveException(HRMSException):
    """Raised when leave processing fails."""
    default_message = "Leave processing error"
    default_code = "leave_error"


class LoanException(HRMSException):
    """Raised when loan processing fails."""
    default_message = "Loan processing error"
    default_code = "loan_error"


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        custom_response_data = {
            'success': False,
            'error': {
                'code': getattr(exc, 'default_code', 'error'),
                'message': str(exc.detail) if hasattr(exc, 'detail') else str(exc),
                'status_code': response.status_code
            }
        }

        # Handle DRF validation errors
        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                custom_response_data['error']['details'] = exc.detail
            elif isinstance(exc.detail, list):
                custom_response_data['error']['details'] = exc.detail

        response.data = custom_response_data
        return response

    # Handle custom HRMS exceptions
    if isinstance(exc, HRMSException):
        logger.warning(f"HRMS Exception: {exc.code} - {exc.message}")
        return Response({
            'success': False,
            'error': {
                'code': exc.code,
                'message': exc.message,
                'status_code': status.HTTP_400_BAD_REQUEST,
                'extra_data': exc.extra_data
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    # Handle Django validation errors
    if isinstance(exc, DjangoValidationError):
        logger.warning(f"Django Validation Error: {exc}")
        return Response({
            'success': False,
            'error': {
                'code': 'validation_error',
                'message': 'Validation failed',
                'status_code': status.HTTP_400_BAD_REQUEST,
                'details': exc.message_dict if hasattr(exc, 'message_dict') else str(exc)
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    # Handle 404 errors
    if isinstance(exc, Http404):
        return Response({
            'success': False,
            'error': {
                'code': 'not_found',
                'message': 'Resource not found',
                'status_code': status.HTTP_404_NOT_FOUND
            }
        }, status=status.HTTP_404_NOT_FOUND)

    # Log unexpected errors
    logger.error(f"Unexpected error: {type(exc).__name__} - {exc}", exc_info=True)

    # Return generic error for unhandled exceptions
    return Response({
        'success': False,
        'error': {
            'code': 'internal_error',
            'message': 'An internal server error occurred',
            'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR
        }
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
