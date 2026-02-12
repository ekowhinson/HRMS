"""Serializers for tenant/organization administration."""

import base64
from rest_framework import serializers
from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'code', 'slug',
            'logo_url', 'primary_color',
            'country', 'currency', 'currency_symbol', 'timezone',
            'date_format', 'financial_year_start_month',
            'leave_year_start_month', 'payroll_processing_day',
            'email_domain', 'website', 'address', 'phone', 'from_email',
            'is_active', 'subscription_plan',
            'max_employees', 'max_users', 'trial_expires_at',
            'modules_enabled', 'setup_completed',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_logo_url(self, obj):
        if obj.logo_data and obj.logo_mime_type:
            encoded = base64.b64encode(bytes(obj.logo_data)).decode('utf-8')
            return f"data:{obj.logo_mime_type};base64,{encoded}"
        return None


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            'name', 'code', 'country', 'currency', 'currency_symbol',
            'timezone', 'email_domain', 'subscription_plan',
            'max_employees', 'max_users', 'modules_enabled',
        ]


class OrganizationConfigSerializer(serializers.ModelSerializer):
    """Serializer for tenant configuration settings only."""

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'code', 'country', 'currency', 'currency_symbol',
            'timezone', 'date_format', 'financial_year_start_month',
            'leave_year_start_month', 'payroll_processing_day',
            'email_domain', 'from_email', 'website', 'address', 'phone',
            'modules_enabled', 'setup_completed',
        ]
        read_only_fields = ['id', 'code']


class OrganizationBrandingSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'logo_url', 'primary_color']
        read_only_fields = ['id', 'name']

    def get_logo_url(self, obj):
        if obj.logo_data and obj.logo_mime_type:
            encoded = base64.b64encode(bytes(obj.logo_data)).decode('utf-8')
            return f"data:{obj.logo_mime_type};base64,{encoded}"
        return None


class OrganizationStatsSerializer(serializers.Serializer):
    organization = OrganizationSerializer()
    employee_count = serializers.IntegerField()
    user_count = serializers.IntegerField()
    max_employees = serializers.IntegerField()
    max_users = serializers.IntegerField()
    employee_utilization = serializers.FloatField()
    user_utilization = serializers.FloatField()
