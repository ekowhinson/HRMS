"""
File upload validation utilities.
"""

import os
from django.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'txt', 'rtf',
    'jpg', 'jpeg', 'png',
    'xls', 'xlsx',
}

ALLOWED_CONTENT_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'text/rtf',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}


def validate_uploaded_file(uploaded_file, max_size_mb=10):
    """Validate file size, extension, and content type."""
    if uploaded_file.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f'File exceeds {max_size_mb}MB limit.')

    ext = os.path.splitext(uploaded_file.name)[1].lstrip('.').lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f'File type ".{ext}" not allowed.')

    if uploaded_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(f'Content type "{uploaded_file.content_type}" not allowed.')
