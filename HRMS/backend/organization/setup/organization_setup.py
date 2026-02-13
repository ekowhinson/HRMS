"""
Organization structure seeder: Job grades, job categories, holidays, work locations.
"""

from datetime import date

from .base import BaseSeeder


class OrganizationStructureSeeder(BaseSeeder):
    module_name = 'organization'

    def seed(self):
        self._seed_job_grades()
        self._seed_job_categories()
        self._seed_holidays()
        self._seed_sample_division()
        self._seed_headquarters()
        return self.stats

    def _seed_job_grades(self):
        from organization.models import JobGrade

        grades = [
            {'code': 'G01', 'name': 'Junior Staff I', 'level': 1, 'annual_leave_days': 21, 'sick_leave_days': 10, 'is_management': False},
            {'code': 'G02', 'name': 'Junior Staff II', 'level': 2, 'annual_leave_days': 21, 'sick_leave_days': 10, 'is_management': False},
            {'code': 'G03', 'name': 'Senior Staff I', 'level': 3, 'annual_leave_days': 22, 'sick_leave_days': 10, 'is_management': False},
            {'code': 'G04', 'name': 'Senior Staff II', 'level': 4, 'annual_leave_days': 23, 'sick_leave_days': 12, 'is_management': False},
            {'code': 'G05', 'name': 'Officer', 'level': 5, 'annual_leave_days': 24, 'sick_leave_days': 12, 'is_management': False},
            {'code': 'G06', 'name': 'Senior Officer', 'level': 6, 'annual_leave_days': 25, 'sick_leave_days': 12, 'is_management': False},
            {'code': 'G07', 'name': 'Manager', 'level': 7, 'annual_leave_days': 26, 'sick_leave_days': 15, 'is_management': True},
            {'code': 'G08', 'name': 'Senior Manager', 'level': 8, 'annual_leave_days': 27, 'sick_leave_days': 15, 'is_management': True},
            {'code': 'G09', 'name': 'Director', 'level': 9, 'annual_leave_days': 28, 'sick_leave_days': 15, 'is_management': True},
            {'code': 'G10', 'name': 'Executive', 'level': 10, 'annual_leave_days': 30, 'sick_leave_days': 15, 'is_management': True},
        ]

        for data in grades:
            code = data.pop('code')
            self._update_or_create(JobGrade, {'code': code}, data)

    def _seed_job_categories(self):
        from organization.models import JobCategory

        categories = [
            {'code': 'ADMIN', 'name': 'Administrative', 'description': 'Administrative and clerical positions'},
            {'code': 'TECH', 'name': 'Technical', 'description': 'Technical and engineering positions'},
            {'code': 'MED', 'name': 'Medical/Health', 'description': 'Medical, health, and clinical positions'},
            {'code': 'FIN', 'name': 'Financial', 'description': 'Finance, accounting, and audit positions'},
            {'code': 'LEGAL', 'name': 'Legal', 'description': 'Legal and compliance positions'},
            {'code': 'OPS', 'name': 'Operations', 'description': 'Operations and field positions'},
            {'code': 'IT', 'name': 'Information Technology', 'description': 'IT and digital services positions'},
            {'code': 'HR', 'name': 'Human Resources', 'description': 'HR and people management positions'},
        ]

        for data in categories:
            code = data.pop('code')
            self._update_or_create(JobCategory, {'code': code}, data)

    def _seed_holidays(self):
        from organization.models import Holiday

        # Ghana public holidays for the configured year
        holidays = [
            {'name': "New Year's Day", 'date': date(self.year, 1, 1)},
            {'name': 'Constitution Day', 'date': date(self.year, 1, 7)},
            {'name': 'Independence Day', 'date': date(self.year, 3, 6)},
            {'name': 'Good Friday', 'date': date(self.year, 4, 3)},
            {'name': 'Easter Monday', 'date': date(self.year, 4, 6)},
            {'name': 'May Day', 'date': date(self.year, 5, 1)},
            {'name': 'Africa Unity Day', 'date': date(self.year, 5, 25)},
            {'name': 'Eid al-Fitr', 'date': date(self.year, 3, 31)},
            {'name': 'Republic Day', 'date': date(self.year, 7, 1)},
            {'name': 'Eid al-Adha', 'date': date(self.year, 6, 7)},
            {'name': "Founders' Day", 'date': date(self.year, 8, 4)},
            {'name': 'Kwame Nkrumah Memorial Day', 'date': date(self.year, 9, 21)},
            {'name': "Farmers' Day", 'date': date(self.year, 12, 5)},
            {'name': 'Christmas Day', 'date': date(self.year, 12, 25)},
            {'name': 'Boxing Day', 'date': date(self.year, 12, 26)},
        ]

        for data in holidays:
            self._update_or_create(
                Holiday,
                {'name': data['name'], 'year': self.year},
                {
                    'date': data['date'],
                    'holiday_type': 'PUBLIC',
                    'is_paid': True,
                    'year': self.year,
                }
            )

    def _seed_sample_division(self):
        from organization.models import Division, Directorate

        div, _ = self._update_or_create(
            Division,
            {'code': 'HO'},
            {
                'name': 'Head Office',
                'short_name': 'HO',
                'description': 'Head Office Division',
                'sort_order': 1,
            }
        )

        self._update_or_create(
            Directorate,
            {'code': 'ADMIN'},
            {
                'name': 'Administration',
                'short_name': 'Admin',
                'division': div,
                'description': 'Administration Directorate',
                'sort_order': 1,
            }
        )

    def _seed_headquarters(self):
        from organization.models import WorkLocation

        self._update_or_create(
            WorkLocation,
            {'code': 'HQ'},
            {
                'name': 'Headquarters',
                'address': self.org.address or 'Head Office',
                'city': 'Accra',
                'is_headquarters': True,
                'is_active': True,
            }
        )
