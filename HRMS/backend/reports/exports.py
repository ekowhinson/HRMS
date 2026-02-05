"""
Report export utilities for generating Excel, CSV, and PDF files.
"""

import csv
import io
from datetime import datetime
from decimal import Decimal

from django.http import HttpResponse
from django.db.models import Sum, Count, F

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

from employees.models import Employee
from payroll.models import PayrollRun, PayrollItem, PayrollItemDetail
from leave.models import LeaveBalance, LeaveRequest
from benefits.models import LoanAccount


def decimal_to_float(obj):
    """Convert Decimal to float for serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


# =============================================================================
# CSV Export Functions
# =============================================================================

def generate_csv_response(data: list, headers: list, filename: str) -> HttpResponse:
    """Generate a CSV file response."""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(headers)

    for row in data:
        row_data = []
        for h in headers:
            key = h.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('%', '')
            row_data.append(decimal_to_float(row.get(key, '')))
        writer.writerow(row_data)

    return response


# =============================================================================
# Excel Export Functions
# =============================================================================

def generate_excel_response(data: list, headers: list, filename: str, title: str = None) -> HttpResponse:
    """Generate an Excel file response."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"

    # Styles
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    start_row = 1

    # Add title if provided
    if title:
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
        title_cell = ws.cell(row=1, column=1, value=title)
        title_cell.font = Font(bold=True, size=14)
        title_cell.alignment = Alignment(horizontal="center")
        start_row = 3

    # Write headers
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    # Write data
    for row_idx, row in enumerate(data, start_row + 1):
        for col_idx, header in enumerate(headers, 1):
            key = header.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('%', '')
            value = decimal_to_float(row.get(key, ''))
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
            if isinstance(value, (int, float)):
                cell.alignment = Alignment(horizontal="right")
                if 'salary' in key or 'amount' in key or 'balance' in key or 'paye' in key or 'ssnit' in key or 'deduction' in key or 'earning' in key or 'net' in key or 'gross' in key:
                    cell.number_format = '#,##0.00'

    # Auto-adjust column widths
    for col in range(1, len(headers) + 1):
        max_length = 0
        column_letter = get_column_letter(col)
        for row in range(start_row, len(data) + start_row + 1):
            cell = ws.cell(row=row, column=col)
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Create response
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response


# =============================================================================
# PDF Export Functions
# =============================================================================

def generate_pdf_response(data: list, headers: list, filename: str, title: str = None, landscape_mode: bool = False) -> HttpResponse:
    """Generate a PDF file response."""
    buffer = io.BytesIO()

    page_size = landscape(A4) if landscape_mode else A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )

    elements = []
    styles = getSampleStyleSheet()

    # Title
    if title:
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=20
        )
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 0.2*inch))

    # Subtitle with date
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        spaceAfter=20
    )
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 0.2*inch))

    # Prepare table data
    table_data = [headers]
    for row in data:
        row_data = []
        for header in headers:
            key = header.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('%', '')
            value = decimal_to_float(row.get(key, ''))
            if isinstance(value, float):
                value = f"{value:,.2f}"
            row_data.append(str(value) if value else '')
        table_data.append(row_data)

    # Calculate column widths based on content
    available_width = page_size[0] - 1*inch
    col_widths = [available_width / len(headers)] * len(headers)

    # Create table
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Table style
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F2F2F2')]),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ])
    table.setStyle(style)
    elements.append(table)

    # Build PDF
    doc.build(elements)
    buffer.seek(0)

    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# =============================================================================
# Report Data Extraction Functions
# =============================================================================

def get_employee_master_data(filters: dict = None):
    """Get employee master report data."""
    queryset = Employee.objects.select_related(
        'department', 'grade', 'position'
    ).filter(status='ACTIVE')

    if filters:
        if filters.get('department'):
            queryset = queryset.filter(department_id=filters['department'])
        if filters.get('grade'):
            queryset = queryset.filter(grade_id=filters['grade'])
        if filters.get('status'):
            queryset = queryset.filter(status=filters['status'].upper())

    headers = [
        'Employee Number', 'First Name', 'Last Name', 'Email', 'Phone',
        'Department', 'Position', 'Grade', 'Employment Type',
        'Date of Joining', 'Status'
    ]

    data = []
    for emp in queryset:
        data.append({
            'employee_number': emp.employee_number,
            'first_name': emp.first_name,
            'last_name': emp.last_name,
            'email': emp.work_email or emp.personal_email or '',
            'phone': emp.mobile_phone or '',
            'department': emp.department.name if emp.department else '',
            'position': emp.position.title if emp.position else '',
            'grade': emp.grade.name if emp.grade else '',
            'employment_type': emp.employment_type,
            'date_of_joining': emp.date_of_joining.strftime('%Y-%m-%d') if emp.date_of_joining else '',
            'status': emp.status,
        })

    return data, headers


def get_headcount_data(filters: dict = None):
    """Get headcount report data."""
    queryset = Employee.objects.filter(status='ACTIVE')

    by_department = queryset.values(
        department_name=F('department__name')
    ).annotate(count=Count('id')).order_by('-count')

    headers = ['Department', 'Headcount']
    data = [{'department': row['department_name'] or 'Unassigned', 'headcount': row['count']} for row in by_department]

    return data, headers


def get_payroll_summary_data(payroll_run_id: str = None):
    """Get payroll summary data."""
    if payroll_run_id:
        try:
            payroll_run = PayrollRun.objects.get(id=payroll_run_id)
        except PayrollRun.DoesNotExist:
            payroll_run = None
    else:
        payroll_run = PayrollRun.objects.filter(
            status__in=['COMPUTED', 'APPROVED', 'PAID']
        ).order_by('-run_date').first()

    if not payroll_run:
        return [], ['No Data']

    items = PayrollItem.objects.filter(
        payroll_run=payroll_run
    ).select_related('employee', 'employee__department')

    headers = [
        'Employee Number', 'Employee Name', 'Department',
        'Basic Salary', 'Gross Earnings', 'SSNIT Employee', 'PAYE Tax',
        'Total Deductions', 'Net Salary', 'Bank', 'Account Number'
    ]

    data = []
    for item in items:
        data.append({
            'employee_number': item.employee.employee_number,
            'employee_name': item.employee.full_name,
            'department': item.employee.department.name if item.employee.department else '',
            'basic_salary': float(item.basic_salary),
            'gross_earnings': float(item.gross_earnings),
            'ssnit_employee': float(item.ssnit_employee),
            'paye_tax': float(item.paye),
            'total_deductions': float(item.total_deductions),
            'net_salary': float(item.net_salary),
            'bank': item.bank_name or '',
            'account_number': item.bank_account_number or '',
        })

    return data, headers


def get_paye_data(payroll_run_id: str = None):
    """Get PAYE tax report data."""
    if payroll_run_id:
        items = PayrollItem.objects.filter(payroll_run_id=payroll_run_id)
    else:
        latest_run = PayrollRun.objects.filter(
            status__in=['COMPUTED', 'APPROVED', 'PAID']
        ).order_by('-run_date').first()
        if latest_run:
            items = PayrollItem.objects.filter(payroll_run=latest_run)
        else:
            items = PayrollItem.objects.none()

    items = items.select_related('employee').filter(paye__gt=0)

    headers = [
        'Employee Number', 'Employee Name', 'TIN Number',
        'Gross Salary', 'Taxable Income', 'PAYE Tax'
    ]

    data = []
    for item in items:
        data.append({
            'employee_number': item.employee.employee_number,
            'employee_name': item.employee.full_name,
            'tin_number': item.employee.tin_number or '',
            'gross_salary': float(item.gross_earnings),
            'taxable_income': float(item.taxable_income),
            'paye_tax': float(item.paye),
        })

    return data, headers


def get_ssnit_data(payroll_run_id: str = None):
    """Get SSNIT contribution report data."""
    if payroll_run_id:
        items = PayrollItem.objects.filter(payroll_run_id=payroll_run_id)
    else:
        latest_run = PayrollRun.objects.filter(
            status__in=['COMPUTED', 'APPROVED', 'PAID']
        ).order_by('-run_date').first()
        if latest_run:
            items = PayrollItem.objects.filter(payroll_run=latest_run)
        else:
            items = PayrollItem.objects.none()

    items = items.select_related('employee')

    headers = [
        'Employee Number', 'Employee Name', 'SSNIT Number',
        'Basic Salary', 'SSNIT Employee 5.5', 'SSNIT Employer 13',
        'Tier 2 Employer 5', 'Total Contribution'
    ]

    data = []
    for item in items:
        total = float(item.ssnit_employee) + float(item.ssnit_employer) + float(item.tier2_employer)
        data.append({
            'employee_number': item.employee.employee_number,
            'employee_name': item.employee.full_name,
            'ssnit_number': item.employee.ssnit_number or '',
            'basic_salary': float(item.basic_salary),
            'ssnit_employee_5.5': float(item.ssnit_employee),
            'ssnit_employer_13': float(item.ssnit_employer),
            'tier_2_employer_5': float(item.tier2_employer),
            'total_contribution': total,
        })

    return data, headers


def get_bank_advice_data(payroll_run_id: str = None):
    """Get bank advice report data."""
    if payroll_run_id:
        items = PayrollItem.objects.filter(payroll_run_id=payroll_run_id)
    else:
        latest_run = PayrollRun.objects.filter(
            status__in=['COMPUTED', 'APPROVED', 'PAID']
        ).order_by('-run_date').first()
        if latest_run:
            items = PayrollItem.objects.filter(payroll_run=latest_run)
        else:
            items = PayrollItem.objects.none()

    items = items.select_related('employee', 'payroll_run').filter(
        bank_account_number__isnull=False
    ).order_by('bank_name', 'employee__employee_number')

    headers = [
        'Bank', 'Employee Number', 'Employee Name',
        'Account Number', 'Branch', 'Net Salary', 'Reference'
    ]

    data = []
    for item in items:
        data.append({
            'bank': item.bank_name or '',
            'employee_number': item.employee.employee_number,
            'employee_name': item.employee.full_name,
            'account_number': item.bank_account_number or '',
            'branch': item.bank_branch or '',
            'net_salary': float(item.net_salary),
            'reference': item.payment_reference or f'{item.payroll_run.run_number}-{item.employee.employee_number}',
        })

    return data, headers


def get_leave_balance_data(filters: dict = None):
    """Get leave balance report data."""
    from django.utils import timezone
    year = filters.get('year', timezone.now().year) if filters else timezone.now().year

    balances = LeaveBalance.objects.filter(
        year=year
    ).select_related('employee', 'leave_type', 'employee__department')

    if filters and filters.get('department'):
        balances = balances.filter(employee__department_id=filters['department'])

    headers = [
        'Employee Number', 'Employee Name', 'Department', 'Leave Type',
        'Opening Balance', 'Earned', 'Taken', 'Pending', 'Available'
    ]

    data = []
    for bal in balances:
        available = (bal.opening_balance or 0) + (bal.earned or 0) - (bal.taken or 0) - (bal.pending or 0)
        data.append({
            'employee_number': bal.employee.employee_number,
            'employee_name': bal.employee.full_name,
            'department': bal.employee.department.name if bal.employee.department else '',
            'leave_type': bal.leave_type.name if bal.leave_type else '',
            'opening_balance': float(bal.opening_balance or 0),
            'earned': float(bal.earned or 0),
            'taken': float(bal.taken or 0),
            'pending': float(bal.pending or 0),
            'available': float(available),
        })

    return data, headers


def get_loan_outstanding_data(filters: dict = None):
    """Get outstanding loans report data."""
    queryset = LoanAccount.objects.filter(
        status__in=['ACTIVE', 'DISBURSED']
    ).select_related('employee', 'loan_type', 'employee__department')

    if filters and filters.get('department'):
        queryset = queryset.filter(employee__department_id=filters['department'])

    headers = [
        'Loan Number', 'Employee Number', 'Employee Name', 'Department',
        'Loan Type', 'Principal Amount', 'Disbursed Amount',
        'Principal Paid', 'Outstanding Balance', 'Monthly Installment'
    ]

    data = []
    for loan in queryset:
        data.append({
            'loan_number': loan.loan_number,
            'employee_number': loan.employee.employee_number,
            'employee_name': loan.employee.full_name,
            'department': loan.employee.department.name if loan.employee.department else '',
            'loan_type': loan.loan_type.name if loan.loan_type else '',
            'principal_amount': float(loan.principal_amount or 0),
            'disbursed_amount': float(loan.disbursed_amount or 0),
            'principal_paid': float(loan.principal_paid or 0),
            'outstanding_balance': float(loan.outstanding_balance or 0),
            'monthly_installment': float(loan.monthly_installment or 0),
        })

    return data, headers


# =============================================================================
# Export Functions (CSV, Excel, PDF)
# =============================================================================

def export_employee_master(filters: dict = None, format: str = 'csv') -> HttpResponse:
    """Export employee master report."""
    data, headers = get_employee_master_data(filters)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Employee Master Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'employee_master_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'employee_master_{timestamp}.pdf', title, landscape_mode=True)
    else:
        return generate_csv_response(data, headers, f'employee_master_{timestamp}.csv')


def export_headcount(filters: dict = None, format: str = 'csv') -> HttpResponse:
    """Export headcount report."""
    data, headers = get_headcount_data(filters)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Headcount Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'headcount_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'headcount_{timestamp}.pdf', title)
    else:
        return generate_csv_response(data, headers, f'headcount_{timestamp}.csv')


def export_payroll_summary(payroll_run_id: str = None, format: str = 'csv') -> HttpResponse:
    """Export payroll summary."""
    data, headers = get_payroll_summary_data(payroll_run_id)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Payroll Summary Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'payroll_summary_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'payroll_summary_{timestamp}.pdf', title, landscape_mode=True)
    else:
        return generate_csv_response(data, headers, f'payroll_summary_{timestamp}.csv')


def export_paye_report(payroll_run_id: str = None, format: str = 'csv') -> HttpResponse:
    """Export PAYE tax report."""
    data, headers = get_paye_data(payroll_run_id)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "PAYE Tax Report (GRA)"

    if format == 'excel':
        return generate_excel_response(data, headers, f'paye_report_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'paye_report_{timestamp}.pdf', title)
    else:
        return generate_csv_response(data, headers, f'paye_report_{timestamp}.csv')


def export_ssnit_report(payroll_run_id: str = None, format: str = 'csv') -> HttpResponse:
    """Export SSNIT contribution report."""
    data, headers = get_ssnit_data(payroll_run_id)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "SSNIT Contribution Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'ssnit_report_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'ssnit_report_{timestamp}.pdf', title, landscape_mode=True)
    else:
        return generate_csv_response(data, headers, f'ssnit_report_{timestamp}.csv')


def export_bank_advice(payroll_run_id: str = None, format: str = 'csv') -> HttpResponse:
    """Export bank advice report."""
    data, headers = get_bank_advice_data(payroll_run_id)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Bank Advice Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'bank_advice_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'bank_advice_{timestamp}.pdf', title, landscape_mode=True)
    else:
        return generate_csv_response(data, headers, f'bank_advice_{timestamp}.csv')


def export_leave_balance(filters: dict = None, format: str = 'csv') -> HttpResponse:
    """Export leave balance report."""
    data, headers = get_leave_balance_data(filters)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Leave Balance Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'leave_balance_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'leave_balance_{timestamp}.pdf', title, landscape_mode=True)
    else:
        return generate_csv_response(data, headers, f'leave_balance_{timestamp}.csv')


def export_loan_outstanding(filters: dict = None, format: str = 'csv') -> HttpResponse:
    """Export outstanding loans report."""
    data, headers = get_loan_outstanding_data(filters)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Outstanding Loans Report"

    if format == 'excel':
        return generate_excel_response(data, headers, f'outstanding_loans_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_pdf_response(data, headers, f'outstanding_loans_{timestamp}.pdf', title, landscape_mode=True)
    else:
        return generate_csv_response(data, headers, f'outstanding_loans_{timestamp}.csv')


def get_payroll_master_data(payroll_run_id: str = None, department_id: str = None):
    """
    Get Payroll Master Report data with detailed breakdown per employee.
    Shows ALL individual transactions for earnings, deductions, and employer contributions.
    """
    from collections import OrderedDict

    if payroll_run_id:
        try:
            payroll_run = PayrollRun.objects.get(id=payroll_run_id)
        except PayrollRun.DoesNotExist:
            payroll_run = None
    else:
        payroll_run = PayrollRun.objects.filter(
            status__in=['COMPUTED', 'APPROVED', 'PAID']
        ).order_by('-run_date').first()

    if not payroll_run:
        return [], ['No Data']

    items_list = list(PayrollItem.objects.filter(
        payroll_run=payroll_run
    ).select_related(
        'employee', 'employee__department', 'employee__position'
    ).prefetch_related(
        'details', 'details__pay_component'
    ).order_by('employee__employee_number'))

    if department_id:
        items_list = [item for item in items_list if str(item.employee.department_id) == department_id]

    if not items_list:
        return [], ['No Data']

    # First pass: collect all unique pay components by type (ordered by display_order)
    earning_components = OrderedDict()  # code -> name
    deduction_components = OrderedDict()
    employer_components = OrderedDict()

    for item in items_list:
        for detail in item.details.all():
            comp = detail.pay_component
            if comp.component_type == 'EARNING':
                if comp.code not in earning_components:
                    earning_components[comp.code] = comp.name
            elif comp.component_type == 'DEDUCTION':
                if comp.code not in deduction_components:
                    deduction_components[comp.code] = comp.name
            elif comp.component_type == 'EMPLOYER':
                if comp.code not in employer_components:
                    employer_components[comp.code] = comp.name

    # Add standard SSNIT/PAYE if not already in details (from PayrollItem fields)
    if 'SSNIT_EMP' not in deduction_components:
        deduction_components['SSNIT_EMP'] = 'SSNIT Employee (5.5%)'
    if 'PAYE' not in deduction_components:
        deduction_components['PAYE'] = 'PAYE Tax'
    if 'SSNIT_EMPLOYER' not in employer_components:
        employer_components['SSNIT_EMPLOYER'] = 'SSNIT Employer (13%)'
    if 'TIER2_EMPLOYER' not in employer_components:
        employer_components['TIER2_EMPLOYER'] = 'Tier 2 Employer (5%)'

    # Build headers list and corresponding keys for data extraction
    headers = []
    column_keys = []  # Parallel list to track how to get data for each column

    # Basic employee info
    headers.extend(['Employee ID', 'Employee Name', 'Department', 'Position'])
    column_keys.extend(['employee_id', 'employee_name', 'department', 'position'])

    # Earnings section - each earning component as its own column
    earning_codes = list(earning_components.keys())
    for code in earning_codes:
        headers.append(earning_components[code])
        column_keys.append(f'earning_{code}')
    headers.append('GROSS SALARY')
    column_keys.append('gross_salary')

    # Deductions section - each deduction component as its own column
    deduction_codes = list(deduction_components.keys())
    for code in deduction_codes:
        headers.append(deduction_components[code])
        column_keys.append(f'deduction_{code}')
    headers.append('TOTAL DEDUCTIONS')
    column_keys.append('total_deductions')

    # Net salary
    headers.append('NET SALARY')
    column_keys.append('net_salary')

    # Employer contributions section - each employer component as its own column
    employer_codes = list(employer_components.keys())
    for code in employer_codes:
        headers.append(employer_components[code])
        column_keys.append(f'employer_{code}')
    headers.append('TOTAL EMPLOYER COST')
    column_keys.append('total_employer_cost')

    # Second pass: build data rows
    data = []
    for item in items_list:
        # Create a dict to hold component amounts by code
        component_amounts = {}
        for detail in item.details.all():
            component_amounts[detail.pay_component.code] = float(detail.amount)

        # Build row using column_keys for consistent mapping
        row = {}

        # Basic info
        row['employee_id'] = item.employee.employee_number
        row['employee_name'] = item.employee.full_name
        row['department'] = item.employee.department.name if item.employee.department else ''
        row['position'] = item.employee.position.title if item.employee.position else ''

        # Earnings
        for code in earning_codes:
            row[f'earning_{code}'] = component_amounts.get(code, 0.0)
        row['gross_salary'] = float(item.gross_earnings)

        # Deductions
        for code in deduction_codes:
            if code == 'SSNIT_EMP':
                # Use PayrollItem field value, fall back to detail
                row[f'deduction_{code}'] = float(item.ssnit_employee) if item.ssnit_employee else component_amounts.get(code, 0.0)
            elif code == 'PAYE':
                row[f'deduction_{code}'] = float(item.paye) if item.paye else component_amounts.get(code, 0.0)
            else:
                row[f'deduction_{code}'] = component_amounts.get(code, 0.0)
        row['total_deductions'] = float(item.total_deductions)

        # Net salary
        row['net_salary'] = float(item.net_salary)

        # Employer contributions
        for code in employer_codes:
            if code == 'SSNIT_EMPLOYER':
                row[f'employer_{code}'] = float(item.ssnit_employer) if item.ssnit_employer else component_amounts.get(code, 0.0)
            elif code == 'TIER2_EMPLOYER':
                row[f'employer_{code}'] = float(item.tier2_employer) if item.tier2_employer else component_amounts.get(code, 0.0)
            else:
                row[f'employer_{code}'] = component_amounts.get(code, 0.0)
        row['total_employer_cost'] = float(item.employer_cost)

        data.append(row)

    return data, headers, column_keys


def export_payroll_master(payroll_run_id: str = None, department_id: str = None, format: str = 'csv') -> HttpResponse:
    """Export Payroll Master Report with all individual transactions."""
    result = get_payroll_master_data(payroll_run_id, department_id)

    # Handle the case where no data is found
    if len(result) == 2:
        data, headers = result
        column_keys = None
    else:
        data, headers, column_keys = result

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title = "Payroll Master Report"

    if not data or headers == ['No Data']:
        # Return empty response
        if format == 'excel':
            return generate_excel_response([], ['No Data Available'], f'payroll_master_{timestamp}.xlsx', title)
        elif format == 'pdf':
            return generate_pdf_response([], ['No Data Available'], f'payroll_master_{timestamp}.pdf', title)
        else:
            return generate_csv_response([], ['No Data Available'], f'payroll_master_{timestamp}.csv')

    # Use custom generators that use column_keys for proper data mapping
    if format == 'excel':
        return generate_payroll_master_excel(data, headers, column_keys, f'payroll_master_{timestamp}.xlsx', title)
    elif format == 'pdf':
        return generate_payroll_master_pdf(data, headers, column_keys, f'payroll_master_{timestamp}.pdf', title)
    else:
        return generate_payroll_master_csv(data, headers, column_keys, f'payroll_master_{timestamp}.csv')


def generate_payroll_master_csv(data: list, headers: list, column_keys: list, filename: str) -> HttpResponse:
    """Generate CSV for Payroll Master Report using column_keys mapping."""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(headers)

    for row in data:
        row_data = []
        for key in column_keys:
            value = row.get(key, '')
            if isinstance(value, float):
                row_data.append(value)
            else:
                row_data.append(value)
        writer.writerow(row_data)

    return response


def generate_payroll_master_excel(data: list, headers: list, column_keys: list, filename: str, title: str = None) -> HttpResponse:
    """Generate Excel for Payroll Master Report using column_keys mapping."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Payroll Master"

    # Styles
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    earning_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    deduction_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
    employer_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
    total_fill = PatternFill(start_color="BDD7EE", end_color="BDD7EE", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    start_row = 1

    # Add title if provided
    if title:
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
        title_cell = ws.cell(row=1, column=1, value=title)
        title_cell.font = Font(bold=True, size=14)
        title_cell.alignment = Alignment(horizontal="center")
        start_row = 3

    # Write headers with color coding
    for col, (header, key) in enumerate(zip(headers, column_keys), 1):
        cell = ws.cell(row=start_row, column=col, value=header)
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

        # Color code by section
        if key.startswith('earning_') or header == 'GROSS SALARY':
            cell.fill = PatternFill(start_color="006400", end_color="006400", fill_type="solid")  # Dark green
        elif key.startswith('deduction_') or header == 'TOTAL DEDUCTIONS':
            cell.fill = PatternFill(start_color="8B0000", end_color="8B0000", fill_type="solid")  # Dark red
        elif key.startswith('employer_') or header == 'TOTAL EMPLOYER COST':
            cell.fill = PatternFill(start_color="B8860B", end_color="B8860B", fill_type="solid")  # Dark goldenrod
        elif header == 'NET SALARY':
            cell.fill = PatternFill(start_color="4B0082", end_color="4B0082", fill_type="solid")  # Indigo
        else:
            cell.fill = header_fill

    # Write data
    for row_idx, row in enumerate(data, start_row + 1):
        for col_idx, key in enumerate(column_keys, 1):
            value = row.get(key, '')
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border

            if isinstance(value, (int, float)):
                cell.alignment = Alignment(horizontal="right")
                cell.number_format = '#,##0.00'

                # Light background colors for data cells
                if key.startswith('earning_') or key == 'gross_salary':
                    cell.fill = earning_fill
                elif key.startswith('deduction_') or key == 'total_deductions':
                    cell.fill = deduction_fill
                elif key.startswith('employer_') or key == 'total_employer_cost':
                    cell.fill = employer_fill
                elif key == 'net_salary':
                    cell.fill = total_fill

    # Auto-adjust column widths
    for col in range(1, len(headers) + 1):
        max_length = 0
        column_letter = get_column_letter(col)
        for row in range(start_row, len(data) + start_row + 1):
            cell = ws.cell(row=row, column=col)
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        adjusted_width = min(max_length + 2, 30)
        ws.column_dimensions[column_letter].width = max(adjusted_width, 12)

    # Create response
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response


def generate_payroll_master_pdf(data: list, headers: list, column_keys: list, filename: str, title: str = None) -> HttpResponse:
    """Generate PDF for Payroll Master Report using column_keys mapping."""
    buffer = io.BytesIO()

    # Always use landscape for payroll master (many columns)
    page_size = landscape(A4)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        rightMargin=0.3*inch,
        leftMargin=0.3*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )

    elements = []
    styles = getSampleStyleSheet()

    # Title
    if title:
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=10
        )
        elements.append(Paragraph(title, title_style))

    # Subtitle with date
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        spaceAfter=10
    )
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 0.1*inch))

    # Prepare table data
    table_data = [headers]
    for row in data:
        row_data = []
        for key in column_keys:
            value = row.get(key, '')
            if isinstance(value, float):
                value = f"{value:,.2f}"
            row_data.append(str(value) if value else '')
        table_data.append(row_data)

    # Calculate column widths
    available_width = page_size[0] - 0.6*inch
    col_widths = [available_width / len(headers)] * len(headers)

    # Create table
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Build style commands with color coding
    style_commands = [
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 6),
        ('FONTSIZE', (0, 1), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (4, 1), (-1, -1), 'RIGHT'),  # Numeric columns right-aligned
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ]

    # Color code headers based on section
    for col_idx, key in enumerate(column_keys):
        if key.startswith('earning_') or key == 'gross_salary':
            style_commands.append(('BACKGROUND', (col_idx, 0), (col_idx, 0), colors.HexColor('#006400')))
        elif key.startswith('deduction_') or key == 'total_deductions':
            style_commands.append(('BACKGROUND', (col_idx, 0), (col_idx, 0), colors.HexColor('#8B0000')))
        elif key.startswith('employer_') or key == 'total_employer_cost':
            style_commands.append(('BACKGROUND', (col_idx, 0), (col_idx, 0), colors.HexColor('#B8860B')))
        elif key == 'net_salary':
            style_commands.append(('BACKGROUND', (col_idx, 0), (col_idx, 0), colors.HexColor('#4B0082')))
        else:
            style_commands.append(('BACKGROUND', (col_idx, 0), (col_idx, 0), colors.HexColor('#4472C4')))

    # Alternating row colors
    style_commands.append(('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F2F2F2')]))

    table.setStyle(TableStyle(style_commands))
    elements.append(table)

    # Build PDF
    doc.build(elements)
    buffer.seek(0)

    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
