"""
Leave seeder: 9 standard leave types for Ghana.
"""

from decimal import Decimal

from .base import BaseSeeder


class LeaveSeeder(BaseSeeder):
    module_name = 'leave'

    def seed(self):
        self._seed_leave_types()
        return self.stats

    def _seed_leave_types(self):
        from leave.models import LeaveType

        leave_types = [
            {
                'code': 'ANNUAL',
                'name': 'Annual Leave',
                'description': 'Standard annual leave entitlement per Ghana Labour Act',
                'default_days': Decimal('21'),
                'max_days': Decimal('30'),
                'accrual_type': 'YEARLY',
                'allow_carry_forward': True,
                'max_carry_forward_days': Decimal('5'),
                'carry_forward_expiry_months': 3,
                'is_paid': True,
                'requires_approval': True,
                'applies_to_gender': 'A',
                'advance_notice_days': 14,
                'color_code': '#3B82F6',
                'sort_order': 1,
            },
            {
                'code': 'SICK',
                'name': 'Sick Leave',
                'description': 'Paid sick leave with medical certificate required after 2 days',
                'default_days': Decimal('10'),
                'max_days': Decimal('15'),
                'accrual_type': 'YEARLY',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'requires_document': True,
                'document_required_after_days': 2,
                'applies_to_gender': 'A',
                'is_emergency': True,
                'color_code': '#EF4444',
                'sort_order': 2,
            },
            {
                'code': 'MATERNITY',
                'name': 'Maternity Leave',
                'description': '12 weeks maternity leave per Ghana Labour Act 2003',
                'default_days': Decimal('90'),
                'max_days': Decimal('90'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'requires_document': True,
                'applies_to_gender': 'F',
                'consecutive_days_only': True,
                'include_weekends': True,
                'include_holidays': True,
                'color_code': '#EC4899',
                'sort_order': 3,
            },
            {
                'code': 'PATERNITY',
                'name': 'Paternity Leave',
                'description': 'Paternity leave for male employees on birth of child',
                'default_days': Decimal('5'),
                'max_days': Decimal('5'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'requires_document': True,
                'applies_to_gender': 'M',
                'max_instances_per_year': 1,
                'color_code': '#6366F1',
                'sort_order': 4,
            },
            {
                'code': 'COMPASSIONATE',
                'name': 'Compassionate Leave',
                'description': 'Leave for bereavement or family emergencies',
                'default_days': Decimal('5'),
                'max_days': Decimal('5'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'applies_to_gender': 'A',
                'is_emergency': True,
                'max_instances_per_year': 3,
                'color_code': '#8B5CF6',
                'sort_order': 5,
            },
            {
                'code': 'STUDY',
                'name': 'Study Leave',
                'description': 'Leave for approved study programs and examinations',
                'default_days': Decimal('30'),
                'max_days': Decimal('30'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'requires_document': True,
                'applies_to_gender': 'A',
                'min_service_months': 12,
                'color_code': '#F59E0B',
                'sort_order': 6,
            },
            {
                'code': 'UNPAID',
                'name': 'Unpaid Leave',
                'description': 'Leave without pay for personal reasons',
                'default_days': Decimal('365'),
                'max_days': Decimal('365'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': False,
                'requires_approval': True,
                'applies_to_gender': 'A',
                'advance_notice_days': 30,
                'color_code': '#6B7280',
                'sort_order': 7,
            },
            {
                'code': 'EXAM',
                'name': 'Exam Leave',
                'description': 'Leave for sitting approved examinations',
                'default_days': Decimal('5'),
                'max_days': Decimal('10'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'requires_document': True,
                'applies_to_gender': 'A',
                'color_code': '#10B981',
                'sort_order': 8,
            },
            {
                'code': 'CASUAL',
                'name': 'Casual Leave',
                'description': 'Short casual leave for urgent personal matters',
                'default_days': Decimal('3'),
                'max_days': Decimal('5'),
                'accrual_type': 'NONE',
                'allow_carry_forward': False,
                'is_paid': True,
                'requires_approval': True,
                'applies_to_gender': 'A',
                'is_emergency': True,
                'max_instances_per_year': 6,
                'color_code': '#14B8A6',
                'sort_order': 9,
            },
        ]

        for data in leave_types:
            code = data.pop('code')
            self._update_or_create(LeaveType, {'code': code}, data)
