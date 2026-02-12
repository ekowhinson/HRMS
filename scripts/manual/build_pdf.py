#!/usr/bin/env python3
"""
PDF Manual Builder - generates the comprehensive user manual from pre-captured screenshots.
"""

import os
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak,
    Flowable,
)

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
SCREENSHOTS_DIR = SCRIPT_DIR / "screenshots"
OUTPUT_DIR = SCRIPT_DIR / "output"

# ── Colors ────────────────────────────────────────────────────────────────────

PRIMARY = HexColor("#1e40af")
SECONDARY = HexColor("#1e3a5f")
LIGHT_BG = HexColor("#f0f4ff")
TEXT_COLOR = HexColor("#1f2937")
MUTED = HexColor("#6b7280")
BORDER = HexColor("#e5e7eb")

PAGE_W, PAGE_H = A4
MARGIN = 0.75 * inch

# ── Chapter definitions ───────────────────────────────────────────────────────

CHAPTERS = [
    {
        "number": "1",
        "title": "Getting Started",
        "intro": "This chapter covers how to access the HRMS system, log in with your credentials, and navigate the main dashboard. The system provides role-based access, ensuring each user sees only the features relevant to their responsibilities.",
        "sections": [
            {
                "title": "1.1 Login",
                "filename": "01_login",
                "description": "Navigate to the system URL in your web browser. You will be presented with the Login page. Enter your email address and password, then click <b>Sign In</b>.",
                "steps": [
                    "Open your browser and go to the HRMS system URL",
                    "Enter your <b>Email Address</b> in the email field",
                    "Enter your <b>Password</b> in the password field",
                    "Click the <b>Sign In</b> button",
                    "Upon successful login, you will be redirected to the Dashboard",
                ],
            },
            {
                "title": "1.2 Admin Dashboard",
                "filename": "02_dashboard",
                "description": "After logging in as an administrator, you are taken to the main Dashboard. This provides an at-a-glance overview of key HR metrics including total employees, pending leave requests, payroll summaries, and recent activity.",
                "steps": [
                    "View total employee count and department breakdown",
                    "Monitor pending leave requests and approvals",
                    "Review payroll processing status",
                    "Access quick links to common tasks from the dashboard cards",
                ],
            },
            {
                "title": "1.3 Self-Service Portal",
                "filename": "03_self_service",
                "description": "Regular employees access the Self-Service Portal upon login. This portal allows employees to manage their personal information, submit leave requests, view payslips, and access training resources.",
                "steps": [
                    "View your personal dashboard with leave balances and announcements",
                    "Access quick actions: Apply for Leave, View Payslip, Update Profile",
                    "Navigate to specific modules using the sidebar menu",
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
                "filename": "04_org_divisions",
                "description": "Divisions represent the highest level of the organizational hierarchy. Each division contains multiple directorates. Click <b>Add Division</b> to create a new division with a code and name.",
                "steps": [
                    "Navigate to <b>Organization</b> in the HR sidebar menu",
                    "Select the <b>Divisions</b> tab",
                    "Click <b>Add Division</b> to create a new division",
                    "Enter the division <b>Code</b> (e.g., DIV-RO) and <b>Name</b>",
                    "Click <b>Save</b> to create the division",
                ],
            },
            {
                "title": "2.2 Directorates",
                "filename": "05_org_directorates",
                "description": "Directorates sit under Divisions and contain Departments. When creating a directorate, you must assign it to a parent Division.",
                "steps": [
                    "Select the <b>Directorates</b> tab",
                    "Click <b>Add Directorate</b>",
                    "Enter the directorate <b>Code</b> and <b>Name</b>",
                    "Select the parent <b>Division</b> from the dropdown",
                    "Click <b>Save</b>",
                ],
            },
            {
                "title": "2.3 Departments",
                "filename": "06_org_departments",
                "description": "Departments are the operational units where employees are assigned. Each department belongs to a directorate and may have a designated head.",
                "steps": [
                    "Select the <b>Departments</b> tab",
                    "Click <b>Add Department</b>",
                    "Enter department <b>Code</b>, <b>Name</b>, and select the parent <b>Directorate</b>",
                    "Optionally assign a <b>Department Head</b>",
                    "Click <b>Save</b>",
                ],
            },
            {
                "title": "2.4 Job Grades",
                "filename": "07_org_grades",
                "description": "Job Grades define the classification levels for positions in the organization. Each grade is linked to salary bands to determine compensation ranges.",
                "steps": [
                    "Select the <b>Job Grades</b> tab",
                    "Click <b>Add Grade</b>",
                    "Enter grade <b>Code</b> (e.g., GR-01), <b>Name</b>, and <b>Level</b>",
                    "Click <b>Save</b>",
                ],
            },
            {
                "title": "2.5 Job Positions",
                "filename": "08_org_positions",
                "description": "Job Positions define specific roles within departments. Each position is assigned to a department and linked to a job grade.",
                "steps": [
                    "Select the <b>Positions</b> tab",
                    "Click <b>Add Position</b>",
                    "Enter position <b>Code</b>, <b>Title</b>, select <b>Department</b> and <b>Grade</b>",
                    "Set the number of <b>Authorized Positions</b>",
                    "Click <b>Save</b>",
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
                "filename": "09_users",
                "description": "The User Management page lists all system users. Administrators can create new users, activate/deactivate accounts, reset passwords, and assign roles.",
                "steps": [
                    "Navigate to <b>Administration > User Management</b>",
                    "View the list of all users with their status and roles",
                    "Click <b>Add User</b> to create a new account",
                    "Enter user details: email, name, and initial password",
                    "Assign one or more <b>Roles</b> to define access permissions",
                    "Click <b>Save</b> to create the user",
                ],
            },
            {
                "title": "3.2 Roles & Permissions",
                "filename": "10_roles",
                "description": "Roles define what features and data a user can access. The system comes with predefined roles (Super Admin, HR Manager, Payroll Officer, Department Head, Employee) that can be customized.",
                "steps": [
                    "Navigate to <b>Administration > Roles & Permissions</b>",
                    "View existing roles and their assigned permissions",
                    "Click on a role to edit its permissions",
                    "Toggle individual permissions for each module",
                    "Click <b>Save</b> to update the role",
                ],
            },
            {
                "title": "3.3 Approval Workflows",
                "filename": "11_workflows",
                "description": "Approval Workflows define the chain of approvers for various transactions such as leave requests, expense claims, and payroll changes.",
                "steps": [
                    "Navigate to <b>Administration > Approval Workflows</b>",
                    "View existing workflow templates",
                    "Click <b>Add Workflow</b> to create a new approval chain",
                    "Define the workflow <b>Type</b> (Leave, Expense, etc.)",
                    "Add approval <b>Steps</b> with approver roles and conditions",
                    "Click <b>Save</b>",
                ],
            },
            {
                "title": "3.4 Company Policies",
                "filename": "12_policies",
                "description": "Company Policies are published documents accessible to all employees through the self-service portal. Policies cover HR rules, code of conduct, and operational guidelines.",
                "steps": [
                    "Navigate to <b>Administration > Company Policies</b>",
                    "View all published and draft policies",
                    "Click <b>Add Policy</b> to create a new policy document",
                    "Enter policy title, category, effective date, and content",
                    "Click <b>Publish</b> to make it visible to employees",
                ],
            },
            {
                "title": "3.5 Audit Logs",
                "filename": "13_audit_logs",
                "description": "Audit Logs track all significant actions performed in the system. This provides a complete trail for compliance and security purposes.",
                "steps": [
                    "Navigate to <b>Administration > Audit Logs</b>",
                    "Filter logs by <b>User</b>, <b>Action</b>, <b>Module</b>, or <b>Date Range</b>",
                    "Click on an entry to view detailed change information",
                    "Export logs to CSV or PDF for compliance reporting",
                ],
            },
        ],
    },
    {
        "number": "4",
        "title": "Employee Management",
        "intro": "The Employee Management module is the core of the HRMS. It manages the complete employee lifecycle from onboarding to separation, including personal records, employment history, qualifications, and emergency contacts.",
        "sections": [
            {"title": "4.1 Employee Directory", "filename": "14_employees",
             "description": "The Employee Directory displays all employees with search, filter, and sort capabilities. You can filter by department, status, grade, and other attributes.",
             "steps": ["Navigate to <b>Employees</b> in the HR sidebar", "View the employee list with key details (name, department, grade, status)", "Use the <b>Search</b> bar to find specific employees", "Apply <b>Filters</b> to narrow down the list", "Click on an employee name to view their full profile"]},
            {"title": "4.2 Add New Employee", "filename": "15_employee_new",
             "description": "Create a new employee record by filling in their personal details, employment information, and organizational assignment. The system auto-generates an employee number.",
             "steps": ["Click <b>Add Employee</b> from the Employee Directory", "Fill in <b>Personal Information</b>: name, date of birth, gender, nationality", "Enter <b>Contact Details</b>: email, phone, address", "Set <b>Employment Details</b>: hire date, employment type, department, position, grade", "Add <b>Emergency Contact</b> information", "Click <b>Save</b> to create the employee record"]},
            {"title": "4.3 Employee Profile", "filename": "16_employee_detail",
             "description": "The Employee Profile provides a comprehensive view of an employee's record including personal details, employment history, qualifications, dependents, bank accounts, and documents.",
             "steps": ["Click on an employee name from the directory", "View tabbed sections: <b>Personal</b>, <b>Employment</b>, <b>Qualifications</b>, <b>Dependents</b>, <b>Documents</b>", "Edit any section by clicking the <b>Edit</b> button", "Upload documents using the <b>Documents</b> tab", "View employment history and status changes"]},
            {"title": "4.4 Data Import", "filename": "17_data_import",
             "description": "Bulk import employee data from CSV or Excel files. The system validates data, maps columns, and provides a preview before import.",
             "steps": ["Navigate to <b>Administration > Data Import</b>", "Select the <b>Import Type</b> (Employees, Payroll, etc.)", "Upload your CSV or Excel file", "Map spreadsheet columns to system fields", "Preview the data and review validation results", "Click <b>Execute Import</b> to process the data"]},
        ],
    },
    {
        "number": "5",
        "title": "Payroll Setup",
        "intro": "Before processing payroll, the payroll module must be configured with banks, staff categories, salary structures, tax brackets, and pay components. This setup determines how salaries are calculated and reported.",
        "sections": [
            {"title": "5.1 Banks & Branches", "filename": "18_payroll_banks",
             "description": "Configure the banks and branches used for salary payments. Each employee's bank account is linked to a bank and branch configured here.",
             "steps": ["Navigate to <b>Payroll > Setup > Banks</b>", "Click <b>Add Bank</b> to register a new bank", "Enter bank <b>Code</b>, <b>Name</b>, and <b>Swift Code</b>", "Add bank <b>Branches</b> with sort codes", "Click <b>Save</b>"]},
            {"title": "5.2 Staff Categories", "filename": "19_payroll_categories",
             "description": "Staff Categories group employees for payroll processing (e.g., Senior Management, Management, Senior Staff, Junior Staff). Each category can have different salary structures.",
             "steps": ["Navigate to <b>Payroll > Setup > Staff Categories</b>", "Click <b>Add Category</b>", "Enter category <b>Code</b> and <b>Name</b>", "Click <b>Save</b>"]},
            {"title": "5.3 Salary Bands", "filename": "20_payroll_bands",
             "description": "Salary Bands define broad compensation ranges. Each band contains multiple salary levels and notches that determine specific pay points.",
             "steps": ["Navigate to <b>Payroll > Setup > Salary Bands</b>", "Click <b>Add Band</b>", "Enter band <b>Code</b> (e.g., BAND-A), <b>Name</b>, and pay range", "Click <b>Save</b>"]},
            {"title": "5.4 Salary Levels & Notches", "filename": "21_payroll_levels",
             "description": "Salary Levels sit within bands and contain notches. Notches represent the specific pay points within a level, allowing for incremental salary progression.",
             "steps": ["Navigate to <b>Payroll > Setup > Salary Levels</b>", "Click <b>Add Level</b>", "Select the parent <b>Salary Band</b>", "Enter level <b>Code</b> and <b>Name</b>", "Add <b>Notches</b> with specific GHS amounts", "Click <b>Save</b>"]},
            {"title": "5.5 Transaction Types", "filename": "22_transaction_types",
             "description": "Transaction Types (Pay Components) define the earnings and deductions that appear on payslips. These include Basic Salary, Housing Allowance, SSNIT contributions, PAYE tax, etc.",
             "steps": ["Navigate to <b>Payroll > Setup > Transaction Types</b>", "View existing pay components (earnings and deductions)", "Click <b>Add Component</b> to create a new one", "Set component <b>Type</b> (Earning/Deduction), <b>Code</b>, and <b>Name</b>", "Configure calculation method: <b>Fixed</b>, <b>Percentage</b>, or <b>Formula</b>", "Click <b>Save</b>"]},
            {"title": "5.6 Tax Configuration", "filename": "23_tax_config",
             "description": "Configure Ghana PAYE tax brackets, SSNIT rates (Tier 1, 2, 3), and tax reliefs. These settings are used to automatically calculate statutory deductions during payroll processing.",
             "steps": ["Navigate to <b>Payroll > Setup > Tax Configuration</b>", "View and edit <b>PAYE Tax Brackets</b> (income ranges and rates)", "Configure <b>SSNIT Rates</b> for Tier 1, Tier 2, and Tier 3", "Set <b>Tax Reliefs</b> (personal relief, marriage, disability)", "Click <b>Save</b> to update the configuration"]},
            {"title": "5.7 Payroll Implementation", "filename": "24_payroll_impl",
             "description": "Payroll Implementation allows bulk uploading of employee salary data including base pay, allowances, and deductions. This is typically used during initial system setup.",
             "steps": ["Navigate to <b>Payroll > Data Loading > Payroll Implementation</b>", "Upload a CSV file with employee salary details", "Map columns to salary components", "Preview and validate the data", "Click <b>Process</b> to load salary records"]},
        ],
    },
    {
        "number": "6",
        "title": "Payroll Processing",
        "intro": "This chapter covers the monthly payroll processing cycle, from computing salaries to generating payslips and statutory reports. The system automates tax calculations, SSNIT deductions, and loan repayments.",
        "sections": [
            {"title": "6.1 Payroll Overview", "filename": "25_payroll_overview",
             "description": "The Payroll Overview provides a summary of the current payroll period, recent payroll runs, and key payroll metrics.",
             "steps": ["Navigate to <b>Payroll > Payroll Overview</b>", "View current period status and summary statistics", "Review recent payroll runs with their status (Draft, Computed, Approved, Paid)", "Click on a payroll run to view details"]},
            {"title": "6.2 Process Payroll", "filename": "26_payroll_process",
             "description": "The Process Payroll page is where you compute monthly salaries, review results, and finalize the payroll run. The system calculates gross pay, deductions, and net pay for each employee.",
             "steps": ["Navigate to <b>Payroll > Processing > Process Payroll</b>", "Select the <b>Payroll Period</b> (month/year)", "Click <b>Compute Payroll</b> to calculate all salaries", "Review the computation results for each employee", "Make adjustments if needed (ad-hoc payments, corrections)", "Click <b>Approve</b> to finalize the payroll run", "Click <b>Mark as Paid</b> after bank transfers are complete"]},
            {"title": "6.3 Employee Payroll Directory", "filename": "27_payroll_employees",
             "description": "The Payroll Employee Directory shows all employees with their current salary information. Click on an employee to view their complete payroll history.",
             "steps": ["Navigate to <b>Payroll > Employee Directory</b>", "View employee salary summaries", "Click an employee to view their detailed payroll record", "Review salary structure, components, and payment history"]},
            {"title": "6.4 Employee Transactions", "filename": "28_emp_transactions",
             "description": "Employee Transactions allow you to add one-time or recurring adjustments to an employee's payroll, such as bonuses, deductions, or allowance changes.",
             "steps": ["Navigate to <b>Payroll > Transactions > Employee Transactions</b>", "Click <b>Add Transaction</b>", "Select the <b>Employee</b> and <b>Transaction Type</b>", "Enter the <b>Amount</b> and <b>Effective Period</b>", "Set whether it is <b>One-time</b> or <b>Recurring</b>", "Click <b>Save</b>"]},
            {"title": "6.5 Backpay Processing", "filename": "29_backpay",
             "description": "Backpay handles retroactive salary adjustments when an employee's pay needs to be recalculated for previous periods (e.g., due to a delayed promotion).",
             "steps": ["Navigate to <b>Payroll > Processing > Backpay</b>", "Select the employee and affected periods", "Enter the new salary details", "The system calculates the difference automatically", "Approve the backpay for inclusion in the next payroll run"]},
            {"title": "6.6 Salary Upgrades", "filename": "30_salary_upgrades",
             "description": "Salary Upgrades process bulk or individual salary changes such as annual increments, promotions, or grade changes.",
             "steps": ["Navigate to <b>Payroll > Processing > Salary Upgrades</b>", "Select upgrade type: <b>Individual</b> or <b>Bulk</b>", "Choose employees and new salary levels", "Set the <b>Effective Date</b>", "Review and approve the changes"]},
        ],
    },
    {
        "number": "7",
        "title": "Leave Management",
        "intro": "The Leave Management module handles all aspects of employee time-off, from configuring leave types and policies to processing requests and tracking balances.",
        "sections": [
            {"title": "7.1 Leave Types Setup", "filename": "31_leave_types",
             "description": "Define the types of leave available in the organization, along with their default entitlements, carry-forward rules, and eligibility criteria.",
             "steps": ["Navigate to <b>Leave > Leave Types</b>", "View existing leave types", "Click <b>Add Leave Type</b>", "Enter <b>Code</b>, <b>Name</b>, and <b>Default Days</b>", "Configure carry-forward rules and maximum accumulation", "Click <b>Save</b>"]},
            {"title": "7.2 Leave Overview", "filename": "32_leave_overview",
             "description": "The Leave Overview provides a dashboard of all leave activity, including pending requests, approved leaves, and team calendars.",
             "steps": ["Navigate to <b>Leave > Leave Overview</b>", "View pending, approved, and rejected requests", "Filter by department, leave type, or date range", "Click on a request to view details and take action"]},
            {"title": "7.3 Leave Approvals", "filename": "33_leave_approvals",
             "description": "Process pending leave requests. Approvers can view request details, check team availability, and approve or reject requests.",
             "steps": ["Navigate to <b>Leave > Leave Approvals</b>", "View all pending leave requests", "Click on a request to see full details", "Check the <b>Team Calendar</b> for conflicts", "Click <b>Approve</b> or <b>Reject</b> with comments"]},
            {"title": "7.4 Leave Calendar", "filename": "34_leave_calendar",
             "description": "The Leave Calendar provides a visual view of all approved leaves across the organization.",
             "steps": ["Navigate to <b>Leave > Leave Calendar</b>", "View the monthly/weekly calendar with leave overlays", "Filter by department or team", "Click on a date to see who is on leave"]},
        ],
    },
    {
        "number": "8",
        "title": "Performance Management",
        "intro": "The Performance module manages the complete appraisal cycle including goal setting, competency assessment, peer feedback, and development planning.",
        "sections": [
            {"title": "8.1 Appraisal Cycles", "filename": "35_appraisal_cycles",
             "description": "Appraisal Cycles define the review periods. Each cycle has phases: goal setting, mid-year review, and year-end appraisal.",
             "steps": ["Navigate to <b>Performance > Appraisal Cycles</b>", "View active and completed cycles", "Click <b>Create Cycle</b>", "Set cycle <b>Name</b>, <b>Start/End Dates</b>, and <b>Phases</b>", "Click <b>Activate</b> to begin"]},
            {"title": "8.2 Competencies", "filename": "36_competencies",
             "description": "Define organizational competencies that employees are assessed against during appraisals.",
             "steps": ["Navigate to <b>Performance > Competencies</b>", "View existing competencies by category", "Click <b>Add Competency</b>", "Enter <b>Name</b>, <b>Category</b>, and <b>Description</b>", "Click <b>Save</b>"]},
            {"title": "8.3 Appraisals", "filename": "37_appraisals",
             "description": "View and manage all employee appraisals within the active cycle.",
             "steps": ["Navigate to <b>Performance > Appraisals</b>", "View appraisals by status", "Click on an appraisal to review goals and ratings", "Supervisors provide ratings and feedback"]},
            {"title": "8.4 Development Plans", "filename": "38_dev_plans",
             "description": "Development Plans outline training and growth activities for employees, typically created after performance reviews.",
             "steps": ["Navigate to <b>Training & Development > Development Plans</b>", "View existing plans by status", "Click <b>Create Plan</b>", "Select the employee and define development objectives", "Add specific <b>Activities</b> with target dates"]},
        ],
    },
    {
        "number": "9",
        "title": "Benefits & Loans",
        "intro": "The Benefits module manages employee benefits enrollment, loan processing, expense claims, and third-party deductions.",
        "sections": [
            {"title": "9.1 Benefits Overview", "filename": "39_benefits",
             "description": "The Benefits page provides an overview of all benefit programs, enrollments, and claims.",
             "steps": ["Navigate to <b>Payroll > Transactions > Benefits</b>", "View benefit types: Medical, Insurance, Housing, etc.", "See active enrollments and pending claims", "Click <b>Add Benefit Type</b> to create a new benefit program"]},
            {"title": "9.2 Loan Management", "filename": "40_loans",
             "description": "Manage employee loan applications, approvals, disbursements, and repayment schedules. Loan repayments are automatically deducted from monthly payroll.",
             "steps": ["Navigate to <b>Payroll > Transactions > Loan Management</b>", "View all loan accounts with their status", "Click <b>New Loan</b>", "Select <b>Loan Type</b>, <b>Employee</b>, and <b>Amount</b>", "Set <b>Interest Rate</b> and <b>Repayment Period</b>", "The system auto-generates a repayment schedule", "Approve the loan for automatic payroll deduction"]},
        ],
    },
    {
        "number": "10",
        "title": "Training & Development",
        "intro": "The Training module manages training programs, session scheduling, employee enrollments, and post-training evaluations.",
        "sections": [
            {"title": "10.1 Training Dashboard", "filename": "41_training_dash",
             "description": "The Training Dashboard provides an overview of training activity, upcoming sessions, and enrollment statistics.",
             "steps": ["Navigate to <b>Training & Development > Dashboard</b>", "View training metrics and upcoming sessions", "Monitor enrollment rates and completion status"]},
            {"title": "10.2 Training Programs", "filename": "42_training_programs",
             "description": "Training Programs define the available courses and certifications.",
             "steps": ["Navigate to <b>Training & Development > Programs</b>", "View all training programs", "Click <b>Add Program</b>", "Enter program <b>Name</b>, <b>Type</b>, <b>Category</b>, and <b>Duration</b>", "Click <b>Save</b>"]},
            {"title": "10.3 Training Sessions", "filename": "43_training_sessions",
             "description": "Training Sessions are specific instances of training programs with dates, venues, and enrollment.",
             "steps": ["Navigate to <b>Training & Development > Sessions</b>", "Click <b>Add Session</b>", "Select the parent <b>Training Program</b>", "Set <b>Title</b>, <b>Dates</b>, <b>Venue</b>, and <b>Facilitator</b>", "Enroll employees in the session"]},
        ],
    },
    {
        "number": "11",
        "title": "Recruitment",
        "intro": "The Recruitment module manages the complete hiring process from job posting through interviews to offer letters.",
        "sections": [
            {"title": "11.1 Vacancies", "filename": "44_recruitment",
             "description": "Manage job vacancies including creating postings, reviewing applications, scheduling interviews, and extending offers.",
             "steps": ["Navigate to <b>Recruitment</b> in the HR sidebar", "View all vacancies with their status", "Click <b>Create Vacancy</b>", "Enter job details: title, department, grade, requirements", "Monitor applications as they come in"]},
            {"title": "11.2 Career Portal", "filename": "45_careers",
             "description": "The external Career Portal allows job seekers to browse open positions and submit applications.",
             "steps": ["External candidates navigate to the Careers portal URL", "Browse available job openings", "Click on a job to view full details", "Click <b>Apply Now</b>", "Fill in personal details and upload CV", "Submit the application"]},
        ],
    },
    {
        "number": "12",
        "title": "Discipline & Grievance",
        "intro": "This module handles disciplinary proceedings and employee grievances with proper documentation, due process, and record-keeping.",
        "sections": [
            {"title": "12.1 Disciplinary Cases", "filename": "46_disciplinary",
             "description": "Manage disciplinary proceedings including case creation, hearing scheduling, and action recording.",
             "steps": ["Navigate to <b>Discipline & Grievance > Disciplinary Cases</b>", "View all cases by status", "Click <b>New Case</b>", "Select the employee and misconduct category", "Record the incident details and evidence", "Schedule a disciplinary hearing", "Record the outcome and actions taken"]},
            {"title": "12.2 Grievances", "filename": "47_grievances",
             "description": "Track and resolve employee grievances through the full lifecycle from submission to resolution.",
             "steps": ["Navigate to <b>Discipline & Grievance > Grievances</b>", "View all grievances by status", "Click on a grievance to review details", "Assign an investigator and track progress", "Record the resolution and follow-up actions"]},
        ],
    },
    {
        "number": "13",
        "title": "Finance Module (ERP)",
        "intro": "The Finance module provides comprehensive financial management including general ledger, accounts payable/receivable, budgeting, and financial reporting. It integrates with Payroll for automatic journal entries.",
        "sections": [
            {"title": "13.1 Chart of Accounts", "filename": "48_chart_accounts",
             "description": "The Chart of Accounts defines all financial accounts organized hierarchically by type: Assets, Liabilities, Equity, Revenue, and Expenses.",
             "steps": ["Navigate to <b>Finance > Chart of Accounts</b>", "View the account hierarchy by type", "Click <b>Add Account</b>", "Enter account <b>Code</b>, <b>Name</b>, <b>Type</b>, and parent", "Click <b>Save</b>"]},
            {"title": "13.2 Journal Entries", "filename": "49_journal_entries",
             "description": "Create and manage journal entries. The system enforces double-entry bookkeeping where debits must equal credits.",
             "steps": ["Navigate to <b>Finance > Journal Entries</b>", "View existing entries with status", "Click <b>New Entry</b>", "Enter <b>Date</b>, <b>Reference</b>, and <b>Description</b>", "Add <b>Debit</b> and <b>Credit</b> lines (must balance)", "Click <b>Post</b> to finalize"]},
            {"title": "13.3 Budget Management", "filename": "50_budgets",
             "description": "Create and monitor departmental and project budgets with variance analysis.",
             "steps": ["Navigate to <b>Finance > Budgets</b>", "View budgets by fiscal year and department", "Click <b>Create Budget</b>", "Select <b>Department</b>, <b>Account</b>, and <b>Fiscal Year</b>", "Enter budget amounts", "Monitor actual vs. budgeted spending"]},
            {"title": "13.4 Vendors & Payables", "filename": "51_vendors",
             "description": "Manage vendor records and accounts payable. Track invoices, payments, and outstanding balances.",
             "steps": ["Navigate to <b>Finance > Accounts Payable > Vendors</b>", "View all vendors with outstanding balances", "Click <b>Add Vendor</b>", "Enter vendor details: name, tax ID, contact, bank info", "Create vendor invoices and process payments"]},
            {"title": "13.5 Customers & Receivables", "filename": "52_customers",
             "description": "Manage customer records and accounts receivable.",
             "steps": ["Navigate to <b>Finance > Accounts Receivable > Customers</b>", "View all customers with their balances", "Click <b>Add Customer</b>", "Create customer invoices and record payments"]},
            {"title": "13.6 Payments", "filename": "53_payments",
             "description": "Process vendor payments and record customer receipts.",
             "steps": ["Navigate to <b>Finance > Accounts Payable > Payments</b>", "View pending and processed payments", "Click <b>New Payment</b>", "Select the vendor and invoices to pay", "Click <b>Process Payment</b>"]},
            {"title": "13.7 Financial Reports", "filename": "54_fin_reports",
             "description": "Generate standard financial reports: Trial Balance, Income Statement, Balance Sheet, and Cash Flow Statement.",
             "steps": ["Navigate to <b>Finance > Financial Reports</b>", "Select the report type", "Choose the <b>Fiscal Period</b>", "Click <b>Generate</b>", "Export to <b>PDF</b> or <b>Excel</b>"]},
        ],
    },
    {
        "number": "14",
        "title": "Procurement",
        "intro": "The Procurement module manages the purchasing lifecycle from requisitions through purchase orders to goods receipt.",
        "sections": [
            {"title": "14.1 Purchase Requisitions", "filename": "55_requisitions",
             "description": "Purchase Requisitions are internal requests for goods or services that require approval before conversion to purchase orders.",
             "steps": ["Navigate to <b>Procurement > Requisitions</b>", "Click <b>New Requisition</b>", "Enter requisition details and add line items", "Submit for approval", "Once approved, convert to a Purchase Order"]},
            {"title": "14.2 Purchase Orders", "filename": "56_purchase_orders",
             "description": "Purchase Orders are formal orders sent to vendors, created from approved requisitions or directly.",
             "steps": ["Navigate to <b>Procurement > Purchase Orders</b>", "View all POs with their status", "Click <b>Create PO</b>", "Select the vendor and add line items", "Submit for approval and send to vendor"]},
            {"title": "14.3 Goods Receipt", "filename": "57_goods_receipt",
             "description": "Record the receipt of goods from vendors against purchase orders.",
             "steps": ["Navigate to <b>Procurement > Goods Receipt</b>", "Click <b>New Receipt</b>", "Select the <b>Purchase Order</b>", "Enter received quantities", "Click <b>Confirm Receipt</b>"]},
        ],
    },
    {
        "number": "15",
        "title": "Inventory & Assets",
        "intro": "The Inventory module tracks stock items, warehouses, and fixed assets with support for stock movements and depreciation.",
        "sections": [
            {"title": "15.1 Items & Stock", "filename": "58_inventory_items",
             "description": "Manage inventory items including stock levels, reorder points, and item categories.",
             "steps": ["Navigate to <b>Inventory > Items</b>", "View all items with current stock levels", "Click <b>Add Item</b>", "Enter item details and reorder settings"]},
            {"title": "15.2 Warehouses", "filename": "59_warehouses",
             "description": "Manage warehouse locations where inventory is stored.",
             "steps": ["Navigate to <b>Inventory > Warehouses</b>", "View all warehouse locations", "Click <b>Add Warehouse</b>", "Enter warehouse name, location, and capacity"]},
            {"title": "15.3 Fixed Assets", "filename": "60_assets",
             "description": "The Asset Register tracks all organizational fixed assets with acquisition cost, depreciation, and custodian assignment.",
             "steps": ["Navigate to <b>Inventory > Fixed Assets > Asset Register</b>", "View all assets with current book values", "Click <b>Add Asset</b>", "Enter asset details: name, category, cost, date acquired", "Assign <b>Custodian</b> and set <b>Depreciation Method</b>"]},
        ],
    },
    {
        "number": "16",
        "title": "Projects",
        "intro": "The Projects module supports project planning, resource allocation, time tracking, and milestone monitoring.",
        "sections": [
            {"title": "16.1 Projects", "filename": "61_projects",
             "description": "Create and manage organizational projects with milestones, budgets, and team assignments.",
             "steps": ["Navigate to <b>Projects</b> in the sidebar", "View all projects with status and progress", "Click <b>New Project</b>", "Enter project details and add <b>Milestones</b>", "Assign team members and set budget"]},
            {"title": "16.2 Timesheets", "filename": "62_timesheets",
             "description": "Track employee time allocation across projects.",
             "steps": ["Navigate to <b>Projects > Timesheets</b>", "View timesheet entries", "Click <b>New Timesheet</b>", "Select project, task, and enter hours", "Submit for approval"]},
        ],
    },
    {
        "number": "17",
        "title": "Reports",
        "intro": "The system provides comprehensive reporting across all modules. Reports can be exported to PDF, Excel, and CSV formats.",
        "sections": [
            {"title": "17.1 HR Reports", "filename": "63_hr_reports",
             "description": "Access 10 pre-built HR reports covering demographics, headcount, turnover, leave, and performance.",
             "steps": ["Navigate to <b>HR Reports</b>", "Click on a report to generate it", "Apply filters", "View interactive charts and data tables", "Export to <b>PDF</b>, <b>Excel</b>, or <b>CSV</b>"]},
            {"title": "17.2 Payroll Reports", "filename": "64_payroll_reports",
             "description": "Generate payroll-specific reports including Payroll Master, Reconciliation, and Journal reports.",
             "steps": ["Navigate to <b>Payroll > Reports</b>", "Select report type and payroll period", "Click <b>Generate</b>", "Export for statutory filing"]},
            {"title": "17.3 Report Builder", "filename": "65_report_builder",
             "description": "Create custom reports by selecting data sources, fields, filters, and visualization types.",
             "steps": ["Navigate to <b>Administration > Report Builder</b>", "Click <b>New Report</b>", "Select data source", "Choose fields to include", "Add filters and sorting", "Select visualization type", "Click <b>Save</b>"]},
        ],
    },
    {
        "number": "18",
        "title": "Self-Service Portal",
        "intro": "The Employee Self-Service Portal empowers employees to manage their own HR tasks including viewing payslips, applying for leave, and updating personal information.",
        "sections": [
            {"title": "18.1 My Profile", "filename": "66_my_profile",
             "description": "View and request updates to personal information including contact details, emergency contacts, and bank account information.",
             "steps": ["Navigate to <b>My Profile</b>", "View personal details and employment info", "Click <b>Request Update</b> to submit a change", "Changes go through approval before being applied"]},
            {"title": "18.2 My Leave", "filename": "67_my_leave",
             "description": "View leave balances, submit leave applications, and track request status.",
             "steps": ["Navigate to <b>My Leave</b>", "View leave balances by type", "Click <b>Apply for Leave</b>", "Select <b>Leave Type</b> and dates", "Add supporting documents", "Submit for approval"]},
            {"title": "18.3 My Payslips", "filename": "68_my_payslips",
             "description": "Access current and historical payslips with detailed breakdowns of earnings, deductions, and net pay.",
             "steps": ["Navigate to <b>My Payslips</b>", "View payslips by month", "Click on a payslip for full details", "Download as <b>PDF</b>"]},
            {"title": "18.4 My Approvals", "filename": "69_my_approvals",
             "description": "Supervisors and managers see pending items requiring their approval.",
             "steps": ["Navigate to <b>My Approvals</b>", "View all pending approval requests", "Click on an item to review", "Click <b>Approve</b> or <b>Reject</b> with comments"]},
        ],
    },
    {
        "number": "19",
        "title": "Exit Management",
        "intro": "The Exit Management module handles the employee separation process including resignation, termination, retirement, clearance procedures, and final settlement.",
        "sections": [
            {"title": "19.1 Exit Management", "filename": "70_exits",
             "description": "Manage employee exits including initiating separation, conducting exit interviews, processing clearance, and calculating final settlements.",
             "steps": ["Navigate to <b>Exit Management</b>", "View all exit cases by status", "Click <b>Initiate Exit</b>", "Select the employee and exit type", "Set the <b>Last Working Day</b>", "Process clearance checklist", "Calculate and process final settlement"]},
        ],
    },
]


# ── Custom Flowables ──────────────────────────────────────────────────────────

class CoverPage(Flowable):
    def __init__(self, width, height):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height

        c.setFillColor(PRIMARY)
        c.rect(0, h - 4 * inch, w, 4 * inch, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(w / 2, h - 1.8 * inch, "HRMS / ERP / Payroll")
        c.drawCentredString(w / 2, h - 2.4 * inch, "System")

        c.setFont("Helvetica", 20)
        c.drawCentredString(w / 2, h - 3.2 * inch, "Comprehensive User Manual")

        c.setStrokeColor(white)
        c.setLineWidth(2)
        c.line(w / 2 - 1.5 * inch, h - 2.7 * inch, w / 2 + 1.5 * inch, h - 2.7 * inch)

        c.setFillColor(TEXT_COLOR)
        y = h - 5.2 * inch
        for label, value in [
            ("Organization", "Ghana Revenue Authority"),
            ("System", "Human Resource Management & ERP System"),
            ("Version", "1.0"),
            ("Date", datetime.now().strftime("%B %d, %Y")),
            ("Classification", "Internal Use Only"),
        ]:
            c.setFont("Helvetica-Bold", 11)
            c.drawString(1.2 * inch, y, f"{label}:")
            c.setFont("Helvetica", 11)
            c.drawString(3.0 * inch, y, value)
            y -= 0.35 * inch

        c.setFillColor(MUTED)
        c.setFont("Helvetica", 9)
        c.drawCentredString(w / 2, 0.8 * inch, "This document is confidential and intended for authorized personnel only.")


class ChapterHeader(Flowable):
    def __init__(self, number, title, width):
        super().__init__()
        self.number = number
        self.title = title
        self.width = width
        self.height = 0.9 * inch

    def draw(self):
        c = self.canv
        c.setFillColor(PRIMARY)
        c.roundRect(0, 0, self.width, self.height, 6, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 28)
        c.drawString(0.3 * inch, 0.25 * inch, f"Chapter {self.number}")
        c.setFont("Helvetica", 18)
        c.drawString(2.5 * inch, 0.3 * inch, self.title)


# ── PDF Builder ───────────────────────────────────────────────────────────────

def build_pdf():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "HRMS_ERP_Payroll_User_Manual.pdf"
    usable_width = PAGE_W - 2 * MARGIN

    styles = getSampleStyleSheet()

    s_body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14,
                            textColor=TEXT_COLOR, alignment=TA_JUSTIFY, spaceAfter=8)
    s_section = ParagraphStyle("Section", parent=styles["Heading2"], fontSize=14, leading=18,
                               textColor=PRIMARY, spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold")
    s_step_hdr = ParagraphStyle("StepHdr", parent=styles["Normal"], fontSize=10, leading=14,
                                textColor=SECONDARY, fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4)
    s_step = ParagraphStyle("Step", parent=styles["Normal"], fontSize=10, leading=14,
                            textColor=TEXT_COLOR, leftIndent=20, bulletIndent=8, spaceAfter=3)
    s_intro = ParagraphStyle("Intro", parent=styles["Normal"], fontSize=10.5, leading=15,
                             textColor=TEXT_COLOR, alignment=TA_JUSTIFY, spaceBefore=12, spaceAfter=16,
                             backColor=LIGHT_BG, borderPadding=(8, 10, 8, 10))
    s_toc_title = ParagraphStyle("TOCTitle", parent=styles["Heading1"], fontSize=24, leading=30,
                                 textColor=PRIMARY, spaceBefore=20, spaceAfter=30, fontName="Helvetica-Bold")
    s_toc_ch = ParagraphStyle("TOCCh", parent=styles["Normal"], fontSize=12, leading=20,
                              textColor=PRIMARY, fontName="Helvetica-Bold")
    s_toc_sec = ParagraphStyle("TOCSec", parent=styles["Normal"], fontSize=10, leading=16,
                               textColor=TEXT_COLOR, leftIndent=20)
    s_caption = ParagraphStyle("Caption", parent=styles["Normal"], fontSize=8, textColor=MUTED,
                               alignment=TA_CENTER, spaceAfter=10)

    story = []

    # Cover
    story.append(CoverPage(usable_width, PAGE_H - 2 * MARGIN))
    story.append(PageBreak())

    # TOC
    story.append(Paragraph("Table of Contents", s_toc_title))
    for ch in CHAPTERS:
        story.append(Paragraph(f"Chapter {ch['number']}: {ch['title']}", s_toc_ch))
        for sec in ch["sections"]:
            story.append(Paragraph(f"  {sec['title']}", s_toc_sec))
    story.append(PageBreak())

    # Chapters
    for ch in CHAPTERS:
        story.append(ChapterHeader(ch["number"], ch["title"], usable_width))
        story.append(Spacer(1, 12))
        story.append(Paragraph(ch["intro"], s_intro))

        for sec in ch["sections"]:
            story.append(Paragraph(sec["title"], s_section))
            story.append(Paragraph(sec["description"], s_body))

            img_path = SCREENSHOTS_DIR / f"{sec['filename']}.png"
            if img_path.exists():
                try:
                    img = Image(str(img_path), width=usable_width, height=usable_width * 0.625)
                    story.append(Spacer(1, 6))
                    story.append(img)
                    story.append(Spacer(1, 4))
                    story.append(Paragraph(f"<i>Figure: {sec['title']}</i>", s_caption))
                except Exception as e:
                    story.append(Paragraph(f"<i>[Screenshot: {sec['title']}]</i>", s_body))

            if sec.get("steps"):
                story.append(Paragraph("Procedure:", s_step_hdr))
                for i, step in enumerate(sec["steps"], 1):
                    story.append(Paragraph(f"<b>Step {i}.</b> {step}", s_step))

            story.append(Spacer(1, 12))

        story.append(PageBreak())

    # Build
    def on_page(canvas, doc):
        page_num = canvas.getPageNumber()
        if page_num > 2:
            canvas.saveState()
            canvas.setFont("Helvetica", 9)
            canvas.setFillColor(MUTED)
            canvas.drawCentredString(PAGE_W / 2, 0.4 * inch, f"Page {page_num - 2}")
            canvas.setStrokeColor(BORDER)
            canvas.setLineWidth(0.5)
            canvas.line(MARGIN, PAGE_H - 0.5 * inch, PAGE_W - MARGIN, PAGE_H - 0.5 * inch)
            canvas.setFont("Helvetica", 8)
            canvas.drawString(MARGIN, PAGE_H - 0.45 * inch, "HRMS/ERP/Payroll System - User Manual")
            canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.45 * inch, "Confidential")
            canvas.restoreState()

    doc = SimpleDocTemplate(
        str(output_path), pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=0.65 * inch, bottomMargin=0.65 * inch,
        title="HRMS/ERP/Payroll System - User Manual",
        author="System Administrator",
        subject="Comprehensive User Manual",
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"PDF generated: {output_path}")
    print(f"  Size: {size_mb:.1f} MB")
    return output_path


if __name__ == "__main__":
    print("Building HRMS User Manual PDF...")
    print(f"Screenshots: {SCREENSHOTS_DIR}")
    print(f"Output: {OUTPUT_DIR}")

    count = len(list(SCREENSHOTS_DIR.glob("*.png")))
    print(f"Found {count} screenshots\n")

    pdf_path = build_pdf()
    print(f"\nDone! Manual at: {pdf_path}")
