#!/usr/bin/env python3
"""
HRMS/ERP/Payroll User Manual Generator
Captures screenshots of all system screens and generates a comprehensive PDF manual.
"""

import os
import sys
import time
import shutil
from pathlib import Path
from datetime import datetime

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak,
    Table, TableStyle, KeepTogether, Flowable, NextPageTemplate,
    PageTemplate, Frame, BaseDocTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Configuration ─────────────────────────────────────────────────────────────

BASE_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
API_URL = os.getenv("API_URL", "http://localhost:8000")
ADMIN_EMAIL = "admin@gra.gov.gh"
ADMIN_PASSWORD = "Test@1234"

SCRIPT_DIR = Path(__file__).parent
SCREENSHOTS_DIR = SCRIPT_DIR / "screenshots"
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(SCRIPT_DIR / "output")))

# Colors
PRIMARY = HexColor("#1e40af")       # Blue-800
SECONDARY = HexColor("#1e3a5f")     # Dark navy
ACCENT = HexColor("#2563eb")        # Blue-600
LIGHT_BG = HexColor("#f0f4ff")      # Light blue bg
DARK_BG = HexColor("#111827")       # Gray-900
TEXT_COLOR = HexColor("#1f2937")     # Gray-800
MUTED = HexColor("#6b7280")         # Gray-500
SUCCESS = HexColor("#059669")       # Green-600
WARNING = HexColor("#d97706")       # Amber-600
BORDER = HexColor("#e5e7eb")        # Gray-200

PAGE_W, PAGE_H = A4
MARGIN = 0.75 * inch

# ── Screenshot definitions by chapter ─────────────────────────────────────────

CHAPTERS = [
    {
        "number": "1",
        "title": "Getting Started",
        "intro": "This chapter covers how to access the HRMS system, log in with your credentials, and navigate the main dashboard. The system provides role-based access, ensuring each user sees only the features relevant to their responsibilities.",
        "sections": [
            {
                "title": "1.1 Login",
                "path": "/login",
                "filename": "01_login",
                "wait_for": "form",
                "auth": False,
                "description": "Navigate to the system URL in your web browser. You will be presented with the Login page. Enter your email address and password, then click <b>Sign In</b>.",
                "steps": [
                    "Open your browser and go to the HRMS system URL",
                    "Enter your <b>Email Address</b> in the email field",
                    "Enter your <b>Password</b> in the password field",
                    "Click the <b>Sign In</b> button",
                    "Upon successful login, you will be redirected to the Dashboard"
                ],
            },
            {
                "title": "1.2 Admin Dashboard",
                "path": "/dashboard",
                "filename": "02_dashboard",
                "wait_for": "main",
                "description": "After logging in as an administrator, you are taken to the main Dashboard. This provides an at-a-glance overview of key HR metrics including total employees, pending leave requests, payroll summaries, and recent activity.",
                "steps": [
                    "View total employee count and department breakdown",
                    "Monitor pending leave requests and approvals",
                    "Review payroll processing status",
                    "Access quick links to common tasks from the dashboard cards"
                ],
            },
            {
                "title": "1.3 Self-Service Portal",
                "path": "/self-service",
                "filename": "03_self_service",
                "wait_for": "main",
                "description": "Regular employees access the Self-Service Portal upon login. This portal allows employees to manage their personal information, submit leave requests, view payslips, and access training resources.",
                "steps": [
                    "View your personal dashboard with leave balances and announcements",
                    "Access quick actions: Apply for Leave, View Payslip, Update Profile",
                    "Navigate to specific modules using the sidebar menu"
                ],
            },
        ],
    },
    {
        "number": "2",
        "title": "Organization Setup",
        "intro": "Before adding employees or processing payroll, the organization structure must be configured. This includes creating divisions, directorates, departments, job grades, and positions. This hierarchy forms the backbone of the entire HRMS system.",
        "sections": [
            {
                "title": "2.1 Divisions",
                "path": "/admin/organization?tab=divisions",
                "filename": "04_org_divisions",
                "wait_for": "main",
                "description": "Divisions represent the highest level of the organizational hierarchy. Each division contains multiple directorates. Click <b>Add Division</b> to create a new division with a code and name.",
                "steps": [
                    "Navigate to <b>Organization</b> in the HR sidebar menu",
                    "Select the <b>Divisions</b> tab",
                    "Click <b>Add Division</b> to create a new division",
                    "Enter the division <b>Code</b> (e.g., DIV-RO) and <b>Name</b>",
                    "Click <b>Save</b> to create the division"
                ],
            },
            {
                "title": "2.2 Directorates",
                "path": "/admin/organization?tab=directorates",
                "filename": "05_org_directorates",
                "wait_for": "main",
                "description": "Directorates sit under Divisions and contain Departments. When creating a directorate, you must assign it to a parent Division.",
                "steps": [
                    "Select the <b>Directorates</b> tab",
                    "Click <b>Add Directorate</b>",
                    "Enter the directorate <b>Code</b> and <b>Name</b>",
                    "Select the parent <b>Division</b> from the dropdown",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "2.3 Departments",
                "path": "/admin/organization?tab=departments",
                "filename": "06_org_departments",
                "wait_for": "main",
                "description": "Departments are the operational units where employees are assigned. Each department belongs to a directorate and may have a designated head.",
                "steps": [
                    "Select the <b>Departments</b> tab",
                    "Click <b>Add Department</b>",
                    "Enter department <b>Code</b>, <b>Name</b>, and select the parent <b>Directorate</b>",
                    "Optionally assign a <b>Department Head</b>",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "2.4 Job Grades",
                "path": "/admin/organization?tab=grades",
                "filename": "07_org_grades",
                "wait_for": "main",
                "description": "Job Grades define the classification levels for positions in the organization. Each grade is linked to salary bands to determine compensation ranges.",
                "steps": [
                    "Select the <b>Job Grades</b> tab",
                    "Click <b>Add Grade</b>",
                    "Enter grade <b>Code</b> (e.g., GR-01), <b>Name</b>, and <b>Level</b>",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "2.5 Job Positions",
                "path": "/admin/organization?tab=positions",
                "filename": "08_org_positions",
                "wait_for": "main",
                "description": "Job Positions define specific roles within departments. Each position is assigned to a department and linked to a job grade.",
                "steps": [
                    "Select the <b>Positions</b> tab",
                    "Click <b>Add Position</b>",
                    "Enter position <b>Code</b>, <b>Title</b>, select <b>Department</b> and <b>Grade</b>",
                    "Set the number of <b>Authorized Positions</b>",
                    "Click <b>Save</b>"
                ],
            },
        ],
    },
    {
        "number": "3",
        "title": "User Management & Security",
        "intro": "System administrators manage user accounts, roles, and permissions. This ensures that each user has appropriate access to system features based on their job function.",
        "sections": [
            {
                "title": "3.1 User Management",
                "path": "/admin/users",
                "filename": "09_users",
                "wait_for": "main",
                "description": "The User Management page lists all system users. Administrators can create new users, activate/deactivate accounts, reset passwords, and assign roles.",
                "steps": [
                    "Navigate to <b>Administration > User Management</b>",
                    "View the list of all users with their status and roles",
                    "Click <b>Add User</b> to create a new account",
                    "Enter user details: email, name, and initial password",
                    "Assign one or more <b>Roles</b> to define access permissions",
                    "Click <b>Save</b> to create the user"
                ],
            },
            {
                "title": "3.2 Roles & Permissions",
                "path": "/admin/roles",
                "filename": "10_roles",
                "wait_for": "main",
                "description": "Roles define what features and data a user can access. The system comes with predefined roles (Super Admin, HR Manager, Payroll Officer, Department Head, Employee) that can be customized.",
                "steps": [
                    "Navigate to <b>Administration > Roles & Permissions</b>",
                    "View existing roles and their assigned permissions",
                    "Click on a role to edit its permissions",
                    "Toggle individual permissions for each module",
                    "Click <b>Save</b> to update the role"
                ],
            },
            {
                "title": "3.3 Approval Workflows",
                "path": "/admin/approval-workflows",
                "filename": "11_workflows",
                "wait_for": "main",
                "description": "Approval Workflows define the chain of approvers for various transactions such as leave requests, expense claims, and payroll changes.",
                "steps": [
                    "Navigate to <b>Administration > Approval Workflows</b>",
                    "View existing workflow templates",
                    "Click <b>Add Workflow</b> to create a new approval chain",
                    "Define the workflow <b>Type</b> (Leave, Expense, etc.)",
                    "Add approval <b>Steps</b> with approver roles and conditions",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "3.4 Company Policies",
                "path": "/admin/policies",
                "filename": "12_policies",
                "wait_for": "main",
                "description": "Company Policies are published documents accessible to all employees through the self-service portal. Policies cover HR rules, code of conduct, and operational guidelines.",
                "steps": [
                    "Navigate to <b>Administration > Company Policies</b>",
                    "View all published and draft policies",
                    "Click <b>Add Policy</b> to create a new policy document",
                    "Enter policy title, category, effective date, and content",
                    "Click <b>Publish</b> to make it visible to employees"
                ],
            },
            {
                "title": "3.5 Audit Logs",
                "path": "/admin/audit-logs",
                "filename": "13_audit_logs",
                "wait_for": "main",
                "description": "Audit Logs track all significant actions performed in the system. This provides a complete trail for compliance and security purposes.",
                "steps": [
                    "Navigate to <b>Administration > Audit Logs</b>",
                    "Filter logs by <b>User</b>, <b>Action</b>, <b>Module</b>, or <b>Date Range</b>",
                    "Click on an entry to view detailed change information",
                    "Export logs to CSV or PDF for compliance reporting"
                ],
            },
        ],
    },
    {
        "number": "4",
        "title": "Employee Management",
        "intro": "The Employee Management module is the core of the HRMS. It manages the complete employee lifecycle from onboarding to separation, including personal records, employment history, qualifications, and emergency contacts.",
        "sections": [
            {
                "title": "4.1 Employee Directory",
                "path": "/employees",
                "filename": "14_employees",
                "wait_for": "main",
                "description": "The Employee Directory displays all employees with search, filter, and sort capabilities. You can filter by department, status, grade, and other attributes.",
                "steps": [
                    "Navigate to <b>Employees</b> in the HR sidebar",
                    "View the employee list with key details (name, department, grade, status)",
                    "Use the <b>Search</b> bar to find specific employees",
                    "Apply <b>Filters</b> to narrow down the list",
                    "Click on an employee name to view their full profile"
                ],
            },
            {
                "title": "4.2 Add New Employee",
                "path": "/employees/new",
                "filename": "15_employee_new",
                "wait_for": "main",
                "description": "Create a new employee record by filling in their personal details, employment information, and organizational assignment. The system auto-generates an employee number.",
                "steps": [
                    "Click <b>Add Employee</b> from the Employee Directory",
                    "Fill in <b>Personal Information</b>: name, date of birth, gender, nationality",
                    "Enter <b>Contact Details</b>: email, phone, address",
                    "Set <b>Employment Details</b>: hire date, employment type, department, position, grade",
                    "Add <b>Emergency Contact</b> information",
                    "Click <b>Save</b> to create the employee record"
                ],
            },
            {
                "title": "4.3 Employee Profile",
                "path": "/employees",
                "filename": "16_employee_detail",
                "wait_for": "main",
                "click_first_row": True,
                "description": "The Employee Profile provides a comprehensive view of an employee's record including personal details, employment history, qualifications, dependents, bank accounts, and documents.",
                "steps": [
                    "Click on an employee name from the directory",
                    "View tabbed sections: <b>Personal</b>, <b>Employment</b>, <b>Qualifications</b>, <b>Dependents</b>, <b>Documents</b>",
                    "Edit any section by clicking the <b>Edit</b> button",
                    "Upload documents using the <b>Documents</b> tab",
                    "View employment history and status changes"
                ],
            },
            {
                "title": "4.4 Data Import",
                "path": "/admin/data-import",
                "filename": "17_data_import",
                "wait_for": "main",
                "description": "Bulk import employee data from CSV or Excel files. The system validates data, maps columns, and provides a preview before import.",
                "steps": [
                    "Navigate to <b>Administration > Data Import</b>",
                    "Select the <b>Import Type</b> (Employees, Payroll, etc.)",
                    "Upload your CSV or Excel file",
                    "Map spreadsheet columns to system fields",
                    "Preview the data and review validation results",
                    "Click <b>Execute Import</b> to process the data"
                ],
            },
        ],
    },
    {
        "number": "5",
        "title": "Payroll Setup",
        "intro": "Before processing payroll, the payroll module must be configured with banks, staff categories, salary structures, tax brackets, and pay components. This setup determines how salaries are calculated and reported.",
        "sections": [
            {
                "title": "5.1 Banks & Branches",
                "path": "/admin/payroll-setup?tab=banks",
                "filename": "18_payroll_banks",
                "wait_for": "main",
                "description": "Configure the banks and branches used for salary payments. Each employee's bank account is linked to a bank and branch configured here.",
                "steps": [
                    "Navigate to <b>Payroll > Setup > Banks</b>",
                    "Click <b>Add Bank</b> to register a new bank",
                    "Enter bank <b>Code</b>, <b>Name</b>, and <b>Swift Code</b>",
                    "Add bank <b>Branches</b> with sort codes",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "5.2 Staff Categories",
                "path": "/admin/payroll-setup?tab=categories",
                "filename": "19_payroll_categories",
                "wait_for": "main",
                "description": "Staff Categories group employees for payroll processing (e.g., Senior Management, Management, Senior Staff, Junior Staff). Each category can have different salary structures.",
                "steps": [
                    "Navigate to <b>Payroll > Setup > Staff Categories</b>",
                    "Click <b>Add Category</b>",
                    "Enter category <b>Code</b> and <b>Name</b>",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "5.3 Salary Bands",
                "path": "/admin/payroll-setup?tab=bands",
                "filename": "20_payroll_bands",
                "wait_for": "main",
                "description": "Salary Bands define broad compensation ranges. Each band contains multiple salary levels and notches that determine specific pay points.",
                "steps": [
                    "Navigate to <b>Payroll > Setup > Salary Bands</b>",
                    "Click <b>Add Band</b>",
                    "Enter band <b>Code</b> (e.g., BAND-A), <b>Name</b>, and pay range",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "5.4 Salary Levels & Notches",
                "path": "/admin/payroll-setup?tab=levels",
                "filename": "21_payroll_levels",
                "wait_for": "main",
                "description": "Salary Levels sit within bands and contain notches. Notches represent the specific pay points within a level, allowing for incremental salary progression.",
                "steps": [
                    "Navigate to <b>Payroll > Setup > Salary Levels</b>",
                    "Click <b>Add Level</b>",
                    "Select the parent <b>Salary Band</b>",
                    "Enter level <b>Code</b> and <b>Name</b>",
                    "Add <b>Notches</b> with specific GHS amounts",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "5.5 Transaction Types",
                "path": "/admin/transaction-types",
                "filename": "22_transaction_types",
                "wait_for": "main",
                "description": "Transaction Types (Pay Components) define the earnings and deductions that appear on payslips. These include Basic Salary, Housing Allowance, SSNIT contributions, PAYE tax, etc.",
                "steps": [
                    "Navigate to <b>Payroll > Setup > Transaction Types</b>",
                    "View existing pay components (earnings and deductions)",
                    "Click <b>Add Component</b> to create a new one",
                    "Set component <b>Type</b> (Earning/Deduction), <b>Code</b>, and <b>Name</b>",
                    "Configure calculation method: <b>Fixed</b>, <b>Percentage</b>, or <b>Formula</b>",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "5.6 Tax Configuration",
                "path": "/admin/tax-configuration",
                "filename": "23_tax_config",
                "wait_for": "main",
                "description": "Configure Ghana PAYE tax brackets, SSNIT rates (Tier 1, 2, 3), and tax reliefs. These settings are used to automatically calculate statutory deductions during payroll processing.",
                "steps": [
                    "Navigate to <b>Payroll > Setup > Tax Configuration</b>",
                    "View and edit <b>PAYE Tax Brackets</b> (income ranges and rates)",
                    "Configure <b>SSNIT Rates</b> for Tier 1, Tier 2, and Tier 3",
                    "Set <b>Tax Reliefs</b> (personal relief, marriage, disability)",
                    "Click <b>Save</b> to update the configuration"
                ],
            },
            {
                "title": "5.7 Payroll Implementation",
                "path": "/admin/payroll-implementation",
                "filename": "24_payroll_impl",
                "wait_for": "main",
                "description": "Payroll Implementation allows bulk uploading of employee salary data including base pay, allowances, and deductions. This is typically used during initial system setup.",
                "steps": [
                    "Navigate to <b>Payroll > Data Loading > Payroll Implementation</b>",
                    "Upload a CSV file with employee salary details",
                    "Map columns to salary components",
                    "Preview and validate the data",
                    "Click <b>Process</b> to load salary records"
                ],
            },
        ],
    },
    {
        "number": "6",
        "title": "Payroll Processing",
        "intro": "This chapter covers the monthly payroll processing cycle, from computing salaries to generating payslips and statutory reports. The system automates tax calculations, SSNIT deductions, and loan repayments.",
        "sections": [
            {
                "title": "6.1 Payroll Overview",
                "path": "/payroll",
                "filename": "25_payroll_overview",
                "wait_for": "main",
                "description": "The Payroll Overview provides a summary of the current payroll period, recent payroll runs, and key payroll metrics.",
                "steps": [
                    "Navigate to <b>Payroll > Payroll Overview</b>",
                    "View current period status and summary statistics",
                    "Review recent payroll runs with their status (Draft, Computed, Approved, Paid)",
                    "Click on a payroll run to view details"
                ],
            },
            {
                "title": "6.2 Process Payroll",
                "path": "/admin/payroll",
                "filename": "26_payroll_process",
                "wait_for": "main",
                "description": "The Process Payroll page is where you compute monthly salaries, review results, and finalize the payroll run. The system calculates gross pay, deductions, and net pay for each employee.",
                "steps": [
                    "Navigate to <b>Payroll > Processing > Process Payroll</b>",
                    "Select the <b>Payroll Period</b> (month/year)",
                    "Click <b>Compute Payroll</b> to calculate all salaries",
                    "Review the computation results for each employee",
                    "Make adjustments if needed (ad-hoc payments, corrections)",
                    "Click <b>Approve</b> to finalize the payroll run",
                    "Click <b>Mark as Paid</b> after bank transfers are complete"
                ],
            },
            {
                "title": "6.3 Employee Payroll Directory",
                "path": "/payroll/employees",
                "filename": "27_payroll_employees",
                "wait_for": "main",
                "description": "The Payroll Employee Directory shows all employees with their current salary information. Click on an employee to view their complete payroll history.",
                "steps": [
                    "Navigate to <b>Payroll > Employee Directory</b>",
                    "View employee salary summaries",
                    "Click an employee to view their detailed payroll record",
                    "Review salary structure, components, and payment history"
                ],
            },
            {
                "title": "6.4 Employee Transactions",
                "path": "/admin/employee-transactions",
                "filename": "28_emp_transactions",
                "wait_for": "main",
                "description": "Employee Transactions allow you to add one-time or recurring adjustments to an employee's payroll, such as bonuses, deductions, or allowance changes.",
                "steps": [
                    "Navigate to <b>Payroll > Transactions > Employee Transactions</b>",
                    "Click <b>Add Transaction</b>",
                    "Select the <b>Employee</b> and <b>Transaction Type</b>",
                    "Enter the <b>Amount</b> and <b>Effective Period</b>",
                    "Set whether it is <b>One-time</b> or <b>Recurring</b>",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "6.5 Backpay Processing",
                "path": "/admin/backpay",
                "filename": "29_backpay",
                "wait_for": "main",
                "description": "Backpay handles retroactive salary adjustments when an employee's pay needs to be recalculated for previous periods (e.g., due to a delayed promotion).",
                "steps": [
                    "Navigate to <b>Payroll > Processing > Backpay</b>",
                    "Select the employee and affected periods",
                    "Enter the new salary details",
                    "The system calculates the difference automatically",
                    "Approve the backpay for inclusion in the next payroll run"
                ],
            },
            {
                "title": "6.6 Salary Upgrades",
                "path": "/admin/salary-upgrades",
                "filename": "30_salary_upgrades",
                "wait_for": "main",
                "description": "Salary Upgrades process bulk or individual salary changes such as annual increments, promotions, or grade changes.",
                "steps": [
                    "Navigate to <b>Payroll > Processing > Salary Upgrades</b>",
                    "Select upgrade type: <b>Individual</b> or <b>Bulk</b>",
                    "Choose employees and new salary levels",
                    "Set the <b>Effective Date</b>",
                    "Review and approve the changes"
                ],
            },
        ],
    },
    {
        "number": "7",
        "title": "Leave Management",
        "intro": "The Leave Management module handles all aspects of employee time-off, from configuring leave types and policies to processing requests and tracking balances. It supports annual leave, sick leave, maternity/paternity leave, and custom leave types.",
        "sections": [
            {
                "title": "7.1 Leave Types Setup",
                "path": "/admin/leave-types",
                "filename": "31_leave_types",
                "wait_for": "main",
                "description": "Define the types of leave available in the organization, along with their default entitlements, carry-forward rules, and eligibility criteria.",
                "steps": [
                    "Navigate to <b>Leave > Leave Types</b>",
                    "View existing leave types with their configurations",
                    "Click <b>Add Leave Type</b>",
                    "Enter <b>Code</b>, <b>Name</b>, and <b>Default Days</b>",
                    "Configure carry-forward rules and maximum accumulation",
                    "Set gender-specific eligibility if needed (e.g., Maternity)",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "7.2 Leave Overview",
                "path": "/leave",
                "filename": "32_leave_overview",
                "wait_for": "main",
                "description": "The Leave Overview provides a dashboard of all leave activity, including pending requests, approved leaves, and team calendars.",
                "steps": [
                    "Navigate to <b>Leave > Leave Overview</b>",
                    "View pending, approved, and rejected requests",
                    "Filter by department, leave type, or date range",
                    "Click on a request to view details and take action"
                ],
            },
            {
                "title": "7.3 Leave Approvals",
                "path": "/admin/leave-approvals",
                "filename": "33_leave_approvals",
                "wait_for": "main",
                "description": "Process pending leave requests. Approvers can view request details, check team availability, and approve or reject requests.",
                "steps": [
                    "Navigate to <b>Leave > Leave Approvals</b>",
                    "View all pending leave requests",
                    "Click on a request to see full details",
                    "Check the <b>Team Calendar</b> for conflicts",
                    "Click <b>Approve</b> or <b>Reject</b> with comments",
                ],
            },
            {
                "title": "7.4 Leave Calendar",
                "path": "/admin/leave-calendar",
                "filename": "34_leave_calendar",
                "wait_for": "main",
                "description": "The Leave Calendar provides a visual view of all approved leaves across the organization. It helps managers plan work schedules and identify coverage gaps.",
                "steps": [
                    "Navigate to <b>Leave > Leave Calendar</b>",
                    "View the monthly/weekly calendar with leave overlays",
                    "Filter by department or team",
                    "Click on a date to see who is on leave",
                    "Export the calendar for planning purposes"
                ],
            },
        ],
    },
    {
        "number": "8",
        "title": "Performance Management",
        "intro": "The Performance module manages the complete appraisal cycle including goal setting, competency assessment, peer feedback, and development planning. It supports 360-degree reviews and performance improvement plans.",
        "sections": [
            {
                "title": "8.1 Appraisal Cycles",
                "path": "/admin/appraisal-cycles",
                "filename": "35_appraisal_cycles",
                "wait_for": "main",
                "description": "Appraisal Cycles define the review periods (annual, semi-annual). Each cycle has phases: goal setting, mid-year review, and year-end appraisal.",
                "steps": [
                    "Navigate to <b>Performance > Appraisal Cycles</b>",
                    "View active and completed cycles",
                    "Click <b>Create Cycle</b> to start a new appraisal period",
                    "Set cycle <b>Name</b>, <b>Start Date</b>, <b>End Date</b>, and <b>Phases</b>",
                    "Click <b>Activate</b> to begin the cycle"
                ],
            },
            {
                "title": "8.2 Competencies",
                "path": "/admin/competencies",
                "filename": "36_competencies",
                "wait_for": "main",
                "description": "Define organizational competencies that employees are assessed against during appraisals. Competencies can be categorized as Core, Functional, Leadership, or Technical.",
                "steps": [
                    "Navigate to <b>Performance > Competencies</b>",
                    "View existing competencies by category",
                    "Click <b>Add Competency</b>",
                    "Enter <b>Name</b>, <b>Category</b>, and <b>Description</b>",
                    "Define behavioral indicators for each rating level",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "8.3 Appraisals",
                "path": "/admin/appraisals",
                "filename": "37_appraisals",
                "wait_for": "main",
                "description": "View and manage all employee appraisals within the active cycle. Track progress of goal completion, competency assessments, and overall ratings.",
                "steps": [
                    "Navigate to <b>Performance > Appraisals</b>",
                    "View appraisals by status: Draft, In Progress, Completed",
                    "Click on an appraisal to review goals and ratings",
                    "Supervisors can provide ratings and feedback",
                    "Track goal progress percentages"
                ],
            },
            {
                "title": "8.4 Development Plans",
                "path": "/admin/development-plans",
                "filename": "38_dev_plans",
                "wait_for": "main",
                "description": "Development Plans outline training and growth activities for employees. These are typically created after performance reviews to address skill gaps.",
                "steps": [
                    "Navigate to <b>Training & Development > Development Plans</b>",
                    "View existing plans by status",
                    "Click <b>Create Plan</b>",
                    "Select the employee and define development objectives",
                    "Add specific <b>Activities</b> with target dates",
                    "Monitor progress and completion"
                ],
            },
        ],
    },
    {
        "number": "9",
        "title": "Benefits & Loans",
        "intro": "The Benefits module manages employee benefits enrollment, loan processing, expense claims, and third-party deductions. It provides a complete view of all non-salary compensation and financial transactions.",
        "sections": [
            {
                "title": "9.1 Benefits Overview",
                "path": "/benefits",
                "filename": "39_benefits",
                "wait_for": "main",
                "description": "The Benefits page provides an overview of all benefit programs, enrollments, and claims. HR administrators can manage benefit types and process claims.",
                "steps": [
                    "Navigate to <b>Payroll > Transactions > Benefits</b>",
                    "View benefit types: Medical, Insurance, Housing, Transport, etc.",
                    "See active enrollments and pending claims",
                    "Click <b>Add Benefit Type</b> to create a new benefit program",
                    "Process benefit claims and reimbursements"
                ],
            },
            {
                "title": "9.2 Loan Management",
                "path": "/admin/loans",
                "filename": "40_loans",
                "wait_for": "main",
                "description": "Manage employee loan applications, approvals, disbursements, and repayment schedules. Loan repayments are automatically deducted from monthly payroll.",
                "steps": [
                    "Navigate to <b>Payroll > Transactions > Loan Management</b>",
                    "View all loan accounts with their status",
                    "Click <b>New Loan</b> to create a loan application",
                    "Select <b>Loan Type</b>, <b>Employee</b>, and <b>Amount</b>",
                    "Set <b>Interest Rate</b> and <b>Repayment Period</b>",
                    "The system auto-generates a repayment schedule",
                    "Approve the loan for automatic payroll deduction"
                ],
            },
        ],
    },
    {
        "number": "10",
        "title": "Training & Development",
        "intro": "The Training module manages training programs, session scheduling, employee enrollments, and post-training evaluations. It supports both internal and external training activities.",
        "sections": [
            {
                "title": "10.1 Training Dashboard",
                "path": "/admin/training-dashboard",
                "filename": "41_training_dash",
                "wait_for": "main",
                "description": "The Training Dashboard provides an overview of training activity, upcoming sessions, enrollment statistics, and training budget utilization.",
                "steps": [
                    "Navigate to <b>Training & Development > Dashboard</b>",
                    "View training metrics and upcoming sessions",
                    "Monitor enrollment rates and completion status",
                    "Track training budget utilization"
                ],
            },
            {
                "title": "10.2 Training Programs",
                "path": "/admin/training-programs",
                "filename": "42_training_programs",
                "wait_for": "main",
                "description": "Training Programs define the available courses and certifications. Each program has a type, category, duration, and associated sessions.",
                "steps": [
                    "Navigate to <b>Training & Development > Programs</b>",
                    "View all training programs",
                    "Click <b>Add Program</b> to create a new one",
                    "Enter program <b>Name</b>, <b>Type</b>, <b>Category</b>, and <b>Duration</b>",
                    "Add a detailed <b>Description</b> and objectives",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "10.3 Training Sessions",
                "path": "/admin/training-sessions",
                "filename": "43_training_sessions",
                "wait_for": "main",
                "description": "Training Sessions are specific instances of training programs. Each session has a date, venue, facilitator, and maximum capacity.",
                "steps": [
                    "Navigate to <b>Training & Development > Sessions</b>",
                    "Click <b>Add Session</b>",
                    "Select the parent <b>Training Program</b>",
                    "Set <b>Title</b>, <b>Start/End Dates</b>, <b>Venue</b>, and <b>Facilitator</b>",
                    "Enroll employees in the session",
                    "Track attendance and completion"
                ],
            },
        ],
    },
    {
        "number": "11",
        "title": "Recruitment",
        "intro": "The Recruitment module manages the complete hiring process from job posting through interviews to offer letters. It includes an external career portal for applicants.",
        "sections": [
            {
                "title": "11.1 Vacancies",
                "path": "/admin/recruitment",
                "filename": "44_recruitment",
                "wait_for": "main",
                "description": "Manage job vacancies including creating postings, reviewing applications, scheduling interviews, and extending offers.",
                "steps": [
                    "Navigate to <b>Recruitment</b> in the HR sidebar",
                    "View all vacancies with their status (Open, Closed, On Hold)",
                    "Click <b>Create Vacancy</b> to post a new job",
                    "Enter job details: title, department, grade, requirements",
                    "Set application deadline and publishing options",
                    "Monitor applications as they come in"
                ],
            },
            {
                "title": "11.2 Career Portal",
                "path": "/careers",
                "filename": "45_careers",
                "wait_for": "main",
                "auth": False,
                "description": "The external Career Portal allows job seekers to browse open positions and submit applications. It is publicly accessible without login.",
                "steps": [
                    "External candidates navigate to the Careers portal URL",
                    "Browse available job openings",
                    "Click on a job to view full details and requirements",
                    "Click <b>Apply Now</b> to start the application process",
                    "Fill in personal details and upload CV/documents",
                    "Submit the application"
                ],
            },
        ],
    },
    {
        "number": "12",
        "title": "Discipline & Grievance",
        "intro": "This module handles disciplinary proceedings and employee grievances. It ensures proper documentation, due process, and record-keeping for all cases.",
        "sections": [
            {
                "title": "12.1 Disciplinary Cases",
                "path": "/admin/disciplinary",
                "filename": "46_disciplinary",
                "wait_for": "main",
                "description": "Manage disciplinary proceedings including case creation, hearing scheduling, and action recording. All cases maintain a complete audit trail.",
                "steps": [
                    "Navigate to <b>Discipline & Grievance > Disciplinary Cases</b>",
                    "View all cases by status",
                    "Click <b>New Case</b> to initiate a disciplinary proceeding",
                    "Select the employee and misconduct category",
                    "Record the incident details and evidence",
                    "Schedule a disciplinary hearing",
                    "Record the outcome and any actions taken"
                ],
            },
            {
                "title": "12.2 Grievances",
                "path": "/admin/grievances",
                "filename": "47_grievances",
                "wait_for": "main",
                "description": "Track and resolve employee grievances. The system supports the full grievance lifecycle from submission through investigation to resolution.",
                "steps": [
                    "Navigate to <b>Discipline & Grievance > Grievances</b>",
                    "View all grievances by status",
                    "Click on a grievance to review details",
                    "Assign an investigator and track progress",
                    "Record the resolution and any follow-up actions"
                ],
            },
        ],
    },
    {
        "number": "13",
        "title": "Finance Module (ERP)",
        "intro": "The Finance module provides comprehensive financial management capabilities including general ledger, accounts payable/receivable, budgeting, and financial reporting. It integrates with Payroll for automatic journal entries.",
        "sections": [
            {
                "title": "13.1 Chart of Accounts",
                "path": "/finance/accounts",
                "filename": "48_chart_accounts",
                "wait_for": "main",
                "description": "The Chart of Accounts defines all financial accounts used in the organization. It is organized hierarchically with account types: Assets, Liabilities, Equity, Revenue, and Expenses.",
                "steps": [
                    "Navigate to <b>Finance > Chart of Accounts</b>",
                    "View the account hierarchy by type",
                    "Click <b>Add Account</b> to create a new account",
                    "Enter account <b>Code</b>, <b>Name</b>, <b>Type</b>, and parent account",
                    "Set whether the account is a <b>Control Account</b> or <b>Detail Account</b>",
                    "Click <b>Save</b>"
                ],
            },
            {
                "title": "13.2 Journal Entries",
                "path": "/finance/journal-entries",
                "filename": "49_journal_entries",
                "wait_for": "main",
                "description": "Create and manage journal entries for recording financial transactions. The system enforces double-entry bookkeeping where debits must equal credits.",
                "steps": [
                    "Navigate to <b>Finance > Journal Entries</b>",
                    "View existing entries with status (Draft, Posted, Reversed)",
                    "Click <b>New Entry</b>",
                    "Enter the entry <b>Date</b>, <b>Reference</b>, and <b>Description</b>",
                    "Add <b>Debit</b> and <b>Credit</b> lines (must balance)",
                    "Click <b>Post</b> to finalize the entry"
                ],
            },
            {
                "title": "13.3 Budget Management",
                "path": "/finance/budgets",
                "filename": "50_budgets",
                "wait_for": "main",
                "description": "Create and monitor departmental and project budgets. The system tracks actual spending against budgets and provides variance analysis.",
                "steps": [
                    "Navigate to <b>Finance > Budgets > Budget Management</b>",
                    "View budgets by fiscal year and department",
                    "Click <b>Create Budget</b>",
                    "Select the <b>Department</b>, <b>Account</b>, and <b>Fiscal Year</b>",
                    "Enter monthly or quarterly budget amounts",
                    "Monitor actual vs. budgeted spending"
                ],
            },
            {
                "title": "13.4 Vendors & Payables",
                "path": "/finance/vendors",
                "filename": "51_vendors",
                "wait_for": "main",
                "description": "Manage vendor records and accounts payable. Track vendor invoices, payments, and outstanding balances.",
                "steps": [
                    "Navigate to <b>Finance > Accounts Payable > Vendors</b>",
                    "View all vendors with their outstanding balances",
                    "Click <b>Add Vendor</b> to register a new supplier",
                    "Enter vendor details: name, tax ID, contact, bank info",
                    "Create vendor invoices and process payments"
                ],
            },
            {
                "title": "13.5 Customers & Receivables",
                "path": "/finance/customers",
                "filename": "52_customers",
                "wait_for": "main",
                "description": "Manage customer records and accounts receivable. Track customer invoices, receipts, and aging analysis.",
                "steps": [
                    "Navigate to <b>Finance > Accounts Receivable > Customers</b>",
                    "View all customers with their balances",
                    "Click <b>Add Customer</b>",
                    "Create customer invoices and record payments"
                ],
            },
            {
                "title": "13.6 Payments",
                "path": "/finance/payments",
                "filename": "53_payments",
                "wait_for": "main",
                "description": "Process vendor payments and record customer receipts. The system supports multiple payment methods including bank transfer, cheque, and mobile money.",
                "steps": [
                    "Navigate to <b>Finance > Accounts Payable > Payments</b>",
                    "View pending and processed payments",
                    "Click <b>New Payment</b>",
                    "Select the vendor and invoices to pay",
                    "Enter payment method and reference",
                    "Click <b>Process Payment</b>"
                ],
            },
            {
                "title": "13.7 Financial Reports",
                "path": "/finance/reports",
                "filename": "54_fin_reports",
                "wait_for": "main",
                "description": "Generate standard financial reports including Trial Balance, Income Statement, Balance Sheet, and Cash Flow Statement.",
                "steps": [
                    "Navigate to <b>Finance > Financial Reports</b>",
                    "Select the report type",
                    "Choose the <b>Fiscal Period</b> or date range",
                    "Click <b>Generate</b> to view the report",
                    "Export to <b>PDF</b> or <b>Excel</b> for distribution"
                ],
            },
        ],
    },
    {
        "number": "14",
        "title": "Procurement",
        "intro": "The Procurement module manages the purchasing lifecycle from requisitions through purchase orders to goods receipt. It enforces approval workflows and budget controls.",
        "sections": [
            {
                "title": "14.1 Purchase Requisitions",
                "path": "/procurement/requisitions",
                "filename": "55_requisitions",
                "wait_for": "main",
                "description": "Purchase Requisitions are internal requests for goods or services. They require approval before being converted to purchase orders.",
                "steps": [
                    "Navigate to <b>Procurement > Requisitions</b>",
                    "Click <b>New Requisition</b>",
                    "Enter requisition details and add line items",
                    "Submit for approval through the defined workflow",
                    "Once approved, convert to a Purchase Order"
                ],
            },
            {
                "title": "14.2 Purchase Orders",
                "path": "/procurement/purchase-orders",
                "filename": "56_purchase_orders",
                "wait_for": "main",
                "description": "Purchase Orders are formal orders sent to vendors. They are created from approved requisitions or directly for routine purchases.",
                "steps": [
                    "Navigate to <b>Procurement > Purchase Orders</b>",
                    "View all POs with their status",
                    "Click <b>Create PO</b> or convert from a requisition",
                    "Select the vendor and add line items with quantities and prices",
                    "Submit for approval and send to vendor"
                ],
            },
            {
                "title": "14.3 Goods Receipt",
                "path": "/procurement/goods-receipt",
                "filename": "57_goods_receipt",
                "wait_for": "main",
                "description": "Record the receipt of goods from vendors against purchase orders. This updates inventory quantities and triggers vendor invoice matching.",
                "steps": [
                    "Navigate to <b>Procurement > Goods Receipt</b>",
                    "Click <b>New Receipt</b>",
                    "Select the <b>Purchase Order</b>",
                    "Enter received quantities and inspect quality",
                    "Click <b>Confirm Receipt</b>"
                ],
            },
        ],
    },
    {
        "number": "15",
        "title": "Inventory & Assets",
        "intro": "The Inventory module tracks stock items, warehouses, and fixed assets. It supports stock movements, asset depreciation, and disposal tracking.",
        "sections": [
            {
                "title": "15.1 Items & Stock",
                "path": "/inventory/items",
                "filename": "58_inventory_items",
                "wait_for": "main",
                "description": "Manage inventory items including stock levels, reorder points, and item categories. The system tracks stock movements across warehouses.",
                "steps": [
                    "Navigate to <b>Inventory > Items</b>",
                    "View all items with current stock levels",
                    "Click <b>Add Item</b> to register a new inventory item",
                    "Enter item <b>Code</b>, <b>Name</b>, <b>Category</b>, and <b>Unit of Measure</b>",
                    "Set <b>Reorder Level</b> and <b>Minimum Quantity</b>"
                ],
            },
            {
                "title": "15.2 Warehouses",
                "path": "/inventory/warehouses",
                "filename": "59_warehouses",
                "wait_for": "main",
                "description": "Manage warehouse locations where inventory is stored. Each warehouse tracks its own stock quantities.",
                "steps": [
                    "Navigate to <b>Inventory > Warehouses</b>",
                    "View all warehouse locations",
                    "Click <b>Add Warehouse</b>",
                    "Enter warehouse name, location, and capacity"
                ],
            },
            {
                "title": "15.3 Fixed Assets",
                "path": "/inventory/assets",
                "filename": "60_assets",
                "wait_for": "main",
                "description": "The Asset Register tracks all organizational fixed assets including their acquisition cost, current value, depreciation, and assigned custodian.",
                "steps": [
                    "Navigate to <b>Inventory > Fixed Assets > Asset Register</b>",
                    "View all assets with their current book values",
                    "Click <b>Add Asset</b> to register a new fixed asset",
                    "Enter asset details: name, category, cost, date acquired",
                    "Assign a <b>Custodian</b> and <b>Location</b>",
                    "Set <b>Depreciation Method</b> and <b>Useful Life</b>"
                ],
            },
        ],
    },
    {
        "number": "16",
        "title": "Projects",
        "intro": "The Projects module supports project planning, resource allocation, time tracking, and milestone monitoring. It integrates with Finance for project costing and with HR for resource management.",
        "sections": [
            {
                "title": "16.1 Projects",
                "path": "/projects",
                "filename": "61_projects",
                "wait_for": "main",
                "description": "Create and manage organizational projects with milestones, budgets, and team assignments.",
                "steps": [
                    "Navigate to <b>Projects</b> in the sidebar",
                    "View all projects with status and progress",
                    "Click <b>New Project</b>",
                    "Enter project <b>Name</b>, <b>Description</b>, <b>Start/End Dates</b>",
                    "Add <b>Milestones</b> with deadlines",
                    "Assign team members and set budget"
                ],
            },
            {
                "title": "16.2 Timesheets",
                "path": "/projects/timesheets",
                "filename": "62_timesheets",
                "wait_for": "main",
                "description": "Track employee time allocation across projects. Timesheets support daily or weekly entry with project/task assignments.",
                "steps": [
                    "Navigate to <b>Projects > Timesheets</b>",
                    "View timesheet entries by employee or project",
                    "Click <b>New Timesheet</b>",
                    "Select the project, task, and date",
                    "Enter hours worked",
                    "Submit for approval"
                ],
            },
        ],
    },
    {
        "number": "17",
        "title": "Reports",
        "intro": "The system provides comprehensive reporting capabilities across all modules. Reports can be exported to PDF, Excel, and CSV formats. The Report Builder allows creating custom reports.",
        "sections": [
            {
                "title": "17.1 HR Reports",
                "path": "/hr-reports",
                "filename": "63_hr_reports",
                "wait_for": "main",
                "description": "Access 10 pre-built HR reports covering employee demographics, headcount analysis, turnover, leave balances, and performance metrics.",
                "steps": [
                    "Navigate to <b>HR Reports</b> in the sidebar",
                    "Click on a report to generate it",
                    "Apply filters (department, date range, etc.)",
                    "View interactive charts and data tables",
                    "Export to <b>PDF</b>, <b>Excel</b>, or <b>CSV</b>"
                ],
            },
            {
                "title": "17.2 Payroll Reports",
                "path": "/reports",
                "filename": "64_payroll_reports",
                "wait_for": "main",
                "description": "Generate payroll-specific reports including Payroll Master, Reconciliation, Journal, and Salary Reconciliation reports.",
                "steps": [
                    "Navigate to <b>Payroll > Reports</b>",
                    "Select the report type and payroll period",
                    "Click <b>Generate</b>",
                    "Review the report data",
                    "Export for statutory filing or internal use"
                ],
            },
            {
                "title": "17.3 Report Builder",
                "path": "/reports/builder",
                "filename": "65_report_builder",
                "wait_for": "main",
                "description": "Create custom reports by selecting data sources, fields, filters, and visualization types. Saved reports can be shared with other users.",
                "steps": [
                    "Navigate to <b>Administration > Report Builder</b>",
                    "Click <b>New Report</b>",
                    "Select the data source (Employees, Payroll, Leave, etc.)",
                    "Choose the fields to include",
                    "Add filters and sorting rules",
                    "Select visualization type (Table, Chart, Summary)",
                    "Click <b>Save</b> and optionally share the report"
                ],
            },
        ],
    },
    {
        "number": "18",
        "title": "Self-Service Portal",
        "intro": "The Employee Self-Service Portal empowers employees to manage their own HR tasks including viewing payslips, applying for leave, updating personal information, and accessing training resources.",
        "sections": [
            {
                "title": "18.1 My Profile",
                "path": "/my-profile",
                "filename": "66_my_profile",
                "wait_for": "main",
                "description": "Employees can view and request updates to their personal information including contact details, emergency contacts, and bank account information.",
                "steps": [
                    "Navigate to <b>My Profile</b> in the Self-Service sidebar",
                    "View your personal details, employment info, and qualifications",
                    "Click <b>Request Update</b> to submit a change request",
                    "Changes go through approval before being applied"
                ],
            },
            {
                "title": "18.2 My Leave",
                "path": "/my-leave",
                "filename": "67_my_leave",
                "wait_for": "main",
                "description": "View leave balances, submit leave applications, and track request status. Employees can also view the team leave calendar.",
                "steps": [
                    "Navigate to <b>My Leave</b> in the sidebar",
                    "View your leave balances by type",
                    "Click <b>Apply for Leave</b>",
                    "Select <b>Leave Type</b>, <b>Start Date</b>, and <b>End Date</b>",
                    "Add any supporting documents",
                    "Submit the request for approval"
                ],
            },
            {
                "title": "18.3 My Payslips",
                "path": "/my-payslips",
                "filename": "68_my_payslips",
                "wait_for": "main",
                "description": "Access current and historical payslips. Employees can view detailed breakdowns of earnings, deductions, and net pay, and download payslips as PDF.",
                "steps": [
                    "Navigate to <b>My Payslips</b> in the sidebar",
                    "View payslips by month",
                    "Click on a payslip to see full details",
                    "Download as <b>PDF</b> for personal records"
                ],
            },
            {
                "title": "18.4 My Approvals",
                "path": "/my-approvals",
                "filename": "69_my_approvals",
                "wait_for": "main",
                "description": "Supervisors and managers see pending items that require their approval, including leave requests, expense claims, and other workflow items.",
                "steps": [
                    "Navigate to <b>My Approvals</b> in the sidebar",
                    "View all pending approval requests",
                    "Click on an item to review details",
                    "Click <b>Approve</b> or <b>Reject</b> with comments"
                ],
            },
        ],
    },
    {
        "number": "19",
        "title": "Exit Management",
        "intro": "The Exit Management module handles the employee separation process including resignation, termination, and retirement. It manages exit interviews, clearance procedures, and final settlement calculations.",
        "sections": [
            {
                "title": "19.1 Exit Management",
                "path": "/admin/exits",
                "filename": "70_exits",
                "wait_for": "main",
                "description": "Manage employee exits including initiating separation, conducting exit interviews, processing clearance, and calculating final settlements.",
                "steps": [
                    "Navigate to <b>Exit Management</b> in the HR sidebar",
                    "View all exit cases by status",
                    "Click <b>Initiate Exit</b> to start a separation process",
                    "Select the employee and exit type (Resignation, Termination, Retirement)",
                    "Set the <b>Last Working Day</b>",
                    "Process clearance checklist from each department",
                    "Calculate and process final settlement"
                ],
            },
        ],
    },
]

# ── Screenshot Capture ────────────────────────────────────────────────────────

def capture_screenshots():
    """Capture screenshots of all defined pages."""
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Starting screenshot capture...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )

        # ── Login first ──────────────────────────────────────────────
        page = context.new_page()
        print("  Logging in...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
        time.sleep(2)

        # Capture login page before filling
        page.screenshot(
            path=str(SCREENSHOTS_DIR / "01_login.png"),
            full_page=False,
        )
        print("    Captured: Login page")

        # Fill login form
        try:
            page.fill('input[name="email"], input[type="email"]', ADMIN_EMAIL)
            page.fill('input[name="password"], input[type="password"]', ADMIN_PASSWORD)
            page.click('button[type="submit"]')
            page.wait_for_url("**/dashboard**", timeout=15000)
            print("    Login successful!")
            time.sleep(2)
        except PWTimeout:
            print("    WARNING: Login redirect timed out, trying to continue...")
            time.sleep(3)

        # ── Capture all pages ────────────────────────────────────────
        total = sum(len(ch["sections"]) for ch in CHAPTERS)
        captured = 1  # Already captured login

        for chapter in CHAPTERS:
            print(f"\n  Chapter {chapter['number']}: {chapter['title']}")
            for section in chapter["sections"]:
                filename = section["filename"]

                # Skip login (already captured)
                if filename == "01_login":
                    continue

                path = section["path"]
                is_auth = section.get("auth", True)

                try:
                    if not is_auth:
                        # Open a new context without auth for public pages
                        pub_page = context.new_page()
                        pub_page.goto(
                            f"{BASE_URL}{path}",
                            wait_until="networkidle",
                            timeout=20000,
                        )
                        time.sleep(2)
                        pub_page.screenshot(
                            path=str(SCREENSHOTS_DIR / f"{filename}.png"),
                            full_page=False,
                        )
                        pub_page.close()
                    else:
                        page.goto(
                            f"{BASE_URL}{path}",
                            wait_until="networkidle",
                            timeout=20000,
                        )
                        time.sleep(2)

                        # Handle click_first_row for employee detail
                        if section.get("click_first_row"):
                            try:
                                page.click("table tbody tr:first-child", timeout=5000)
                                page.wait_for_load_state("networkidle", timeout=10000)
                                time.sleep(2)
                            except Exception:
                                pass

                        page.screenshot(
                            path=str(SCREENSHOTS_DIR / f"{filename}.png"),
                            full_page=False,
                        )

                    captured += 1
                    print(f"    Captured: {section['title']} ({captured}/{total})")

                except Exception as e:
                    print(f"    ERROR capturing {section['title']}: {e}")
                    # Create a placeholder
                    _create_placeholder(SCREENSHOTS_DIR / f"{filename}.png", section["title"])
                    captured += 1

        browser.close()

    print(f"\nScreenshot capture complete: {captured}/{total} pages")
    return captured


def _create_placeholder(path, title):
    """Create a placeholder image for failed screenshots."""
    from PIL import Image as PILImage, ImageDraw, ImageFont

    img = PILImage.new("RGB", (1440, 900), color=(240, 244, 255))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    except Exception:
        font = ImageFont.load_default()
    draw.text((400, 400), f"Page: {title}", fill=(100, 100, 100), font=font)
    draw.text((400, 450), "(Screenshot not available)", fill=(150, 150, 150), font=font)
    img.save(str(path))


# ── PDF Generation ────────────────────────────────────────────────────────────

class NumberedCanvas:
    """Canvas helper for page numbers and headers."""

    def __init__(self, canvas, doc):
        self.canvas = canvas
        self.doc = doc

    @staticmethod
    def afterPage(canvas, doc):
        page_num = canvas.getPageNumber()
        if page_num > 2:  # Skip cover and TOC
            canvas.saveState()
            # Footer with page number
            canvas.setFont("Helvetica", 9)
            canvas.setFillColor(MUTED)
            canvas.drawCentredString(
                PAGE_W / 2, 0.4 * inch,
                f"Page {page_num - 2}"
            )
            # Header line
            canvas.setStrokeColor(BORDER)
            canvas.setLineWidth(0.5)
            canvas.line(MARGIN, PAGE_H - 0.5 * inch, PAGE_W - MARGIN, PAGE_H - 0.5 * inch)
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(MUTED)
            canvas.drawString(MARGIN, PAGE_H - 0.45 * inch, "HRMS/ERP/Payroll System - User Manual")
            canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.45 * inch, "Confidential")
            canvas.restoreState()


class CoverPage(Flowable):
    """Custom cover page flowable."""

    def __init__(self, width, height):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height

        # Background gradient effect
        c.setFillColor(PRIMARY)
        c.rect(0, h - 4 * inch, w, 4 * inch, fill=True, stroke=False)

        # Title
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(w / 2, h - 1.8 * inch, "HRMS / ERP / Payroll")
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(w / 2, h - 2.4 * inch, "System")

        c.setFont("Helvetica", 20)
        c.drawCentredString(w / 2, h - 3.2 * inch, "Comprehensive User Manual")

        # Decorative line
        c.setStrokeColor(white)
        c.setLineWidth(2)
        c.line(w / 2 - 1.5 * inch, h - 2.7 * inch, w / 2 + 1.5 * inch, h - 2.7 * inch)

        # Metadata section
        c.setFillColor(TEXT_COLOR)
        c.setFont("Helvetica", 13)
        y = h - 5.2 * inch
        details = [
            ("Organization", "Ghana Revenue Authority"),
            ("System", "Human Resource Management & ERP System"),
            ("Version", "1.0"),
            ("Date", datetime.now().strftime("%B %d, %Y")),
            ("Classification", "Internal Use Only"),
        ]
        for label, value in details:
            c.setFont("Helvetica-Bold", 11)
            c.drawString(1.2 * inch, y, f"{label}:")
            c.setFont("Helvetica", 11)
            c.drawString(3.0 * inch, y, value)
            y -= 0.35 * inch

        # Footer
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 9)
        c.drawCentredString(w / 2, 0.8 * inch, "This document is confidential and intended for authorized personnel only.")


class ChapterHeader(Flowable):
    """Chapter title banner."""

    def __init__(self, number, title, width):
        super().__init__()
        self.number = number
        self.title = title
        self.width = width
        self.height = 0.9 * inch

    def draw(self):
        c = self.canv
        # Blue banner
        c.setFillColor(PRIMARY)
        c.roundRect(0, 0, self.width, self.height, 6, fill=True, stroke=False)
        # Chapter number
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 28)
        c.drawString(0.3 * inch, 0.25 * inch, f"Chapter {self.number}")
        # Title
        c.setFont("Helvetica", 18)
        c.drawString(2.5 * inch, 0.3 * inch, self.title)


def build_pdf():
    """Generate the comprehensive PDF manual."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "HRMS_ERP_Payroll_User_Manual.pdf"

    usable_width = PAGE_W - 2 * MARGIN

    # ── Styles ──────────────────────────────────────────────────────
    styles = getSampleStyleSheet()

    style_body = ParagraphStyle(
        "ManualBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=TEXT_COLOR,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
    )
    style_section = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=PRIMARY,
        spaceBefore=16,
        spaceAfter=8,
        fontName="Helvetica-Bold",
    )
    style_step_header = ParagraphStyle(
        "StepHeader",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=SECONDARY,
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=4,
    )
    style_step = ParagraphStyle(
        "Step",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=TEXT_COLOR,
        leftIndent=20,
        bulletIndent=8,
        spaceAfter=3,
    )
    style_intro = ParagraphStyle(
        "ChapterIntro",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=15,
        textColor=TEXT_COLOR,
        alignment=TA_JUSTIFY,
        spaceBefore=12,
        spaceAfter=16,
        backColor=LIGHT_BG,
        borderPadding=(8, 10, 8, 10),
    )
    style_toc_title = ParagraphStyle(
        "TOCTitle",
        parent=styles["Heading1"],
        fontSize=24,
        leading=30,
        textColor=PRIMARY,
        spaceBefore=20,
        spaceAfter=30,
        fontName="Helvetica-Bold",
    )
    style_toc_chapter = ParagraphStyle(
        "TOCChapter",
        parent=styles["Normal"],
        fontSize=12,
        leading=20,
        textColor=PRIMARY,
        fontName="Helvetica-Bold",
        leftIndent=0,
    )
    style_toc_section = ParagraphStyle(
        "TOCSection",
        parent=styles["Normal"],
        fontSize=10,
        leading=16,
        textColor=TEXT_COLOR,
        leftIndent=20,
    )

    # ── Build story ─────────────────────────────────────────────────
    story = []

    # Cover page
    story.append(CoverPage(usable_width, PAGE_H - 2 * MARGIN))
    story.append(PageBreak())

    # Table of Contents
    story.append(Paragraph("Table of Contents", style_toc_title))
    for chapter in CHAPTERS:
        story.append(
            Paragraph(
                f"Chapter {chapter['number']}: {chapter['title']}",
                style_toc_chapter,
            )
        )
        for section in chapter["sections"]:
            story.append(Paragraph(f"  {section['title']}", style_toc_section))
    story.append(PageBreak())

    # Chapters
    for chapter in CHAPTERS:
        # Chapter header banner
        story.append(ChapterHeader(chapter["number"], chapter["title"], usable_width))
        story.append(Spacer(1, 12))

        # Chapter introduction
        story.append(Paragraph(chapter["intro"], style_intro))

        for section in chapter["sections"]:
            # Section title
            story.append(Paragraph(section["title"], style_section))

            # Description
            story.append(Paragraph(section["description"], style_body))

            # Screenshot
            img_path = SCREENSHOTS_DIR / f"{section['filename']}.png"
            if img_path.exists():
                try:
                    img = Image(
                        str(img_path),
                        width=usable_width,
                        height=usable_width * 0.625,  # 16:10 aspect ratio
                    )
                    story.append(Spacer(1, 6))
                    story.append(img)
                    story.append(Spacer(1, 4))
                    story.append(
                        Paragraph(
                            f"<i>Figure: {section['title']}</i>",
                            ParagraphStyle(
                                "Caption",
                                parent=styles["Normal"],
                                fontSize=8,
                                textColor=MUTED,
                                alignment=TA_CENTER,
                                spaceAfter=10,
                            ),
                        )
                    )
                except Exception as e:
                    story.append(
                        Paragraph(
                            f"<i>[Screenshot: {section['title']}]</i>",
                            style_body,
                        )
                    )

            # Steps
            if section.get("steps"):
                story.append(Paragraph("Procedure:", style_step_header))
                for i, step in enumerate(section["steps"], 1):
                    story.append(
                        Paragraph(
                            f"<b>Step {i}.</b> {step}",
                            style_step,
                        )
                    )

            story.append(Spacer(1, 12))

        story.append(PageBreak())

    # ── Build document ──────────────────────────────────────────────
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
        title="HRMS/ERP/Payroll System - User Manual",
        author="System Administrator",
        subject="Comprehensive User Manual",
    )

    def on_page(canvas, doc):
        NumberedCanvas.afterPage(canvas, doc)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    print(f"\nPDF generated: {output_path}")
    print(f"  Size: {output_path.stat().st_size / 1024 / 1024:.1f} MB")
    return output_path


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("HRMS/ERP/Payroll User Manual Generator")
    print("=" * 60)

    # Step 1: Capture screenshots
    print("\n[Phase 1] Capturing screenshots...")
    count = capture_screenshots()

    # Step 2: Generate PDF
    print(f"\n[Phase 2] Generating PDF manual...")
    pdf_path = build_pdf()

    print("\n" + "=" * 60)
    print(f"Manual generated successfully!")
    print(f"  Screenshots: {count}")
    print(f"  Output: {pdf_path}")
    print("=" * 60)
