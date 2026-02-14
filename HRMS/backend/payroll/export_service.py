"""
Payroll export services — bank file generation and payslip PDF creation.
"""

import csv
import io
from decimal import Decimal
from datetime import date

from django.db.models import Sum
from django.utils import timezone

from .models import (
    PayrollRun, PayrollItem, PayrollItemDetail, BankFile, Payslip,
)


class PayrollExportService:
    """Service for generating bank files and payslips."""

    def __init__(self, payroll_run: PayrollRun):
        self.payroll_run = payroll_run
        self.period = payroll_run.payroll_period

    def generate_bank_file(self, user, file_format: str = 'CSV') -> list[BankFile]:
        """Generate bank payment file grouped by bank."""
        if self.payroll_run.status not in [PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]:
            raise ValueError(f'Cannot generate bank file for payroll in status: {self.payroll_run.status}')

        items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status__in=[PayrollItem.Status.APPROVED, PayrollItem.Status.PAID],
            bank_account_number__isnull=False
        ).select_related('employee').order_by('bank_name', 'employee__employee_number')

        banks = {}
        for item in items:
            bank_name = item.bank_name or 'UNKNOWN'
            if bank_name not in banks:
                banks[bank_name] = []
            banks[bank_name].append(item)

        bank_files = []

        for bank_name, bank_items in banks.items():
            output = io.StringIO()
            writer = csv.writer(output)

            writer.writerow([
                'Employee Number',
                'Employee Name',
                'Bank Account',
                'Bank Branch',
                'Amount',
                'Reference'
            ])

            total_amount = Decimal('0')
            for item in bank_items:
                writer.writerow([
                    item.employee.employee_number,
                    item.employee.full_name,
                    item.bank_account_number,
                    item.bank_branch or '',
                    str(item.net_salary),
                    f'{self.payroll_run.run_number}-{item.employee.employee_number}'
                ])
                total_amount += item.net_salary

            file_content = output.getvalue().encode('utf-8')
            safe_bank_name = bank_name.replace(' ', '_').replace('/', '_')
            file_name = f'{self.payroll_run.run_number}_{safe_bank_name}_{date.today().strftime("%Y%m%d")}.csv'

            bank_file = BankFile.objects.create(
                payroll_run=self.payroll_run,
                bank_name=bank_name,
                file_data=file_content,
                file_name=file_name,
                file_size=len(file_content),
                mime_type='text/csv',
                file_format='CSV',
                total_amount=total_amount,
                transaction_count=len(bank_items),
                generated_by=user,
                generated_at=timezone.now(),
            )
            bank_files.append(bank_file)

        return bank_files

    def generate_payslips(self, user) -> list[Payslip]:
        """Generate payslips for all employees in the payroll run."""
        start_time = timezone.now()

        if self.payroll_run.status not in [PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]:
            raise ValueError(f'Cannot generate payslips for payroll in status: {self.payroll_run.status}')

        items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run
        ).exclude(
            status=PayrollItem.Status.ERROR
        ).select_related(
            'employee', 'employee__department', 'employee__position',
            'employee__division', 'employee__directorate', 'employee__grade',
            'employee__salary_notch', 'employee__salary_notch__level',
            'employee__salary_notch__level__band', 'employee__work_location'
        ).prefetch_related('details', 'details__pay_component')

        payslips = []

        for item in items:
            if hasattr(item, 'payslip'):
                continue

            payslip_number = f'PS-{self.payroll_run.run_number}-{item.employee.employee_number}'

            # Generate PDF payslip
            file_content = self._generate_payslip_pdf(item)
            file_name = f'{payslip_number}.pdf'

            payslip = Payslip.objects.create(
                payroll_item=item,
                payslip_number=payslip_number,
                file_data=file_content,
                file_name=file_name,
                file_size=len(file_content),
                mime_type='application/pdf',
                generated_at=timezone.now(),
            )
            payslips.append(payslip)

        # Create summary audit log entry
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        try:
            from core.models import AuditLog
            from core.middleware import get_current_user, get_current_request

            audit_user = get_current_user() or user
            ip_address = None
            user_agent = ''
            request = get_current_request()
            if request:
                x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
                ip_address = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
                user_agent = request.META.get('HTTP_USER_AGENT', '')

            AuditLog.objects.create(
                user=audit_user,
                action=AuditLog.ActionType.CREATE,
                model_name='Payslip',
                object_id=str(self.payroll_run.pk),
                object_repr=f'Payslip generation: {self.payroll_run.run_number}'[:255],
                changes={
                    'started_at': start_time.isoformat(),
                    'completed_at': end_time.isoformat(),
                    'duration_seconds': round(duration, 2),
                    'payslips_generated': len(payslips),
                    'period_name': self.period.name,
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception:
            import logging
            logging.getLogger('hrms').warning(
                'Failed to create payslip generation audit log', exc_info=True
            )

        return payslips

    def _generate_payslip_pdf(self, item: PayrollItem) -> bytes:
        """Generate payslip as PDF matching NHIS design."""
        import io
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )

        elements = []
        styles = getSampleStyleSheet()

        # Colors matching the sample
        header_green = colors.HexColor('#008751')
        header_blue = colors.HexColor('#0077B6')

        # Custom styles
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=header_green,
            alignment=TA_CENTER,
            spaceAfter=2,
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )

        # Get employee data
        emp = item.employee
        period_name = self.period.name if self.period else 'N/A'

        # Get organization info from tenant
        from organization.utils import get_org_settings
        org = get_org_settings()
        org_name = org['name']
        org_code = org['code']

        # Get salary notch info
        old_notch = ''
        new_notch = ''
        if emp.salary_notch:
            notch = emp.salary_notch
            if notch.level and notch.level.band:
                new_notch = f"Band {notch.level.band.code}/Level {notch.level.code}/Notch {notch.code}"
                old_notch = new_notch  # Same for now, can be enhanced with history

        # === HEADER WITH LOGO PLACEHOLDER ===
        logo_style = ParagraphStyle(
            'Logo',
            parent=styles['Normal'],
            fontSize=24,
            textColor=header_green,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        )

        if org.get('logo_data'):
            from reportlab.platypus import Image
            logo_img = Image(io.BytesIO(org['logo_data']), width=2.5*cm, height=2.5*cm)
            header_data = [[logo_img, Paragraph(f'<u>{org_name.upper()}</u>', title_style)]]
        else:
            logo_text = f'<font color="#008751"><b>{org_code}</b></font>'
            header_data = [[
                Paragraph(logo_text, logo_style),
                Paragraph(f'<u>{org_name.upper()}</u>', title_style)
            ]]
        header_table = Table(header_data, colWidths=[3*cm, 13.5*cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ]))
        elements.append(header_table)
        elements.append(Paragraph(f'<u>PAYSLIP FOR</u>&nbsp;&nbsp;&nbsp;&nbsp;<u>{period_name.upper()}</u>', subtitle_style))
        elements.append(Spacer(1, 10))

        # === EMPLOYEE INFO TABLE ===
        emp_info_data = [
            ['FULL NAME:', emp.full_name, 'BANK NAME:', item.bank_name or ''],
            ['STAFF ID:', emp.employee_number, 'BANK BRANCH:', item.bank_branch or ''],
            ['DEPARTMENT:', emp.department.name if emp.department else '', 'ACCOUNT #:', item.bank_account_number or ''],
            ['LOCATION:', emp.work_location.name if emp.work_location else 'HEAD OFFICE', 'SOCIAL SECURITY #:', emp.ssnit_number or ''],
            ['JOB TITLE:', emp.position.title if emp.position else '', 'GRADE:', emp.grade.name if emp.grade else ''],
            ['OLD LEVEL/NOTCH:', old_notch, 'NEW LEVEL/NOTCH:', new_notch],
        ]

        emp_table = Table(emp_info_data, colWidths=[2.5*cm, 5.5*cm, 3*cm, 5.5*cm])
        emp_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F5F5')),
            ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#F5F5F5')),
        ]))
        elements.append(emp_table)
        elements.append(Spacer(1, 10))

        # === BASIC SALARY ===
        basic_data = [['BASIC SALARY', f'{float(item.basic_salary):,.2f}']]
        basic_table = Table(basic_data, colWidths=[13*cm, 3.5*cm])
        basic_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(basic_table)

        # === ALLOWANCES AND DEDUCTIONS ===
        allowances = []
        for detail in item.details.all():
            if detail.pay_component.component_type == 'EARNING' and detail.pay_component.code != 'BASIC':
                allowances.append((detail.pay_component.name, float(detail.amount)))

        deductions = []
        for detail in item.details.all():
            if detail.pay_component.component_type == 'DEDUCTION':
                deductions.append((detail.pay_component.name, float(detail.amount)))

        # Add statutory deductions
        if item.ssnit_employee and float(item.ssnit_employee) > 0:
            deductions.append(('Employee SSF', float(item.ssnit_employee)))
        if item.paye and float(item.paye) > 0:
            deductions.append(('Income Tax', float(item.paye)))

        # Build allowances/deductions table
        max_rows = max(len(allowances), len(deductions), 1)
        allow_ded_data = [['ALLOWANCES', 'AMOUNT', 'DEDUCTIONS', 'AMOUNT']]

        for i in range(max_rows):
            row = []
            if i < len(allowances):
                row.extend([allowances[i][0], f'{allowances[i][1]:,.2f}'])
            else:
                row.extend(['', ''])
            if i < len(deductions):
                row.extend([deductions[i][0], f'{deductions[i][1]:,.2f}'])
            else:
                row.extend(['', ''])
            allow_ded_data.append(row)

        allow_ded_table = Table(allow_ded_data, colWidths=[5*cm, 3.25*cm, 5*cm, 3.25*cm])
        allow_ded_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), header_blue),
            ('BACKGROUND', (2, 0), (3, 0), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('LINEAFTER', (1, 0), (1, -1), 1, colors.grey),
        ]))
        elements.append(allow_ded_table)
        elements.append(Spacer(1, 10))

        # === PAY SUMMARY ===
        summary_header = [['PAY SUMMARY']]
        summary_header_table = Table(summary_header, colWidths=[16.5*cm])
        summary_header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_header_table)

        # Get YTD values
        total_earnings = float(item.gross_earnings)
        total_deductions = float(item.total_deductions)
        net_salary = float(item.net_salary)
        tax_relief = 0.00

        # Calculate YTD by querying all payroll items for the same employee in the current year
        current_year = self.period.year if self.period else timezone.now().year

        ytd_items = PayrollItem.objects.filter(
            employee=emp,
            payroll_run__payroll_period__year=current_year,
            payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]
        ).aggregate(
            total_earnings=Sum('gross_earnings'),
            total_ssf=Sum('ssnit_employee'),
            total_tax=Sum('paye'),
            total_net=Sum('net_salary'),
            total_deductions=Sum('total_deductions')
        )

        earnings_ytd = float(ytd_items['total_earnings'] or total_earnings)
        ssf_ytd = float(ytd_items['total_ssf'] or item.ssnit_employee or 0)
        tax_ytd = float(ytd_items['total_tax'] or item.paye or 0)
        net_ytd = float(ytd_items['total_net'] or net_salary)

        # Calculate PF YTD from payroll item details
        pf_ytd_items = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__payroll_period__year=current_year,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__code__icontains='PF'
        ).filter(
            pay_component__component_type='DEDUCTION'
        ).aggregate(total=Sum('amount'))
        pf_ytd = float(pf_ytd_items['total'] or 0)

        # Calculate loan deductions YTD
        loan_ytd_items = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__payroll_period__year=current_year,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__name__icontains='loan'
        ).aggregate(total=Sum('amount'))
        loans_ytd = float(loan_ytd_items['total'] or 0)

        # Employee PF calculation (from current period details)
        emp_pf = 0.00
        employer_pf = 0.00
        for detail in item.details.all():
            if 'provident' in detail.pay_component.name.lower() or 'pf' in detail.pay_component.code.lower():
                if detail.pay_component.component_type == 'DEDUCTION':
                    emp_pf = float(detail.amount)
                elif detail.pay_component.component_type == 'EMPLOYER':
                    employer_pf = float(detail.amount)

        # Calculate cumulative PF to date
        emp_pf_ytd = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__code__icontains='PF',
            pay_component__component_type='DEDUCTION'
        ).aggregate(total=Sum('amount'))

        employer_pf_ytd = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__code__icontains='PF',
            pay_component__component_type='EMPLOYER'
        ).aggregate(total=Sum('amount'))

        emp_pf_to_date = float(emp_pf_ytd['total'] or emp_pf)
        employer_pf_to_date = float(employer_pf_ytd['total'] or employer_pf)
        total_pf_to_date = emp_pf_to_date + employer_pf_to_date

        summary_data = [
            ['TOTAL EARNINGS', f'{total_earnings:,.2f}', 'TOTAL DEDUCTIONS', f'{total_deductions:,.2f}'],
            ['TAX RELIEF', f'{tax_relief:,.2f}', 'NET SALARY', f'{net_salary:,.2f}'],
            ['', '', '', ''],
            ['TOTAL EARNINGS YTD', f'{earnings_ytd:,.2f}', 'EMPLOYEE PF TO DATE', f'{emp_pf_to_date:,.2f}'],
            ['EMPLOYEE SSF YTD', f'{ssf_ytd:,.2f}', '', ''],
            ['EMPLOYEE PF YTD', f'{pf_ytd:,.2f}', 'EMPLOYER PF TO DATE', f'{employer_pf_to_date:,.2f}'],
            ['INCOME TAX YTD', f'{tax_ytd:,.2f}', '', ''],
            ['LOANS & ADV. DED. YTD', f'{loans_ytd:,.2f}', 'TOTAL PF TO DATE', f'{total_pf_to_date:,.2f}'],
            ['NET SALARY YTD', f'{net_ytd:,.2f}', '', ''],
        ]

        summary_table = Table(summary_data, colWidths=[4.5*cm, 3.75*cm, 4.5*cm, 3.75*cm])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('LINEAFTER', (1, 0), (1, -1), 1, colors.grey),
            # Underline key values
            ('LINEBELOW', (1, 0), (1, 0), 1, colors.black),  # Total Earnings
            ('LINEBELOW', (3, 0), (3, 0), 1, colors.black),  # Total Deductions
            ('LINEBELOW', (3, 1), (3, 1), 1.5, colors.black),  # Net Salary
            ('LINEBELOW', (1, 3), (1, 3), 1, colors.black),  # Earnings YTD
            ('LINEBELOW', (1, 8), (1, 8), 1, colors.black),  # Net Salary YTD
            ('LINEBELOW', (3, 7), (3, 7), 1, colors.black),  # Total PF
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 10))

        # === LOAN DETAILS ===
        loan_header = [['LOAN DETAILS']]
        loan_header_table = Table(loan_header, colWidths=[16.5*cm])
        loan_header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(loan_header_table)

        # Get loan deductions from payroll item details
        loan_details = []
        for detail in item.details.all():
            if 'loan' in detail.pay_component.name.lower():
                loan_details.append([detail.pay_component.name, f'{float(detail.amount):,.2f}'])

        if loan_details:
            loan_table = Table(loan_details, colWidths=[12*cm, 4.5*cm])
            loan_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(loan_table)
        else:
            # Empty loan section
            empty_loan = Table([['No active loans']], colWidths=[16.5*cm])
            empty_loan.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.grey),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(empty_loan)

        elements.append(Spacer(1, 20))

        # === FOOTER ===
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_LEFT
        )
        elements.append(Paragraph(f'Printed On: {timezone.now().isoformat()}', footer_style))

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.read()
