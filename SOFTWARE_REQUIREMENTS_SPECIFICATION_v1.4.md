# SOFTWARE REQUIREMENTS SPECIFICATION

## NHIA Payroll & Human Resource Management System (with ERP Extensions)

**Version 1.4**

---

**FAAB Systems Ghana Limited**
No.1 Shittor Street, Ajirigano, East Legon
Tel: 0543025893 / 0550186770
Email: info@faabsystems.com

**Prepared for:** National Health Insurance Authority (NHIA)

**Date:** February, 2026

**Classification:** CONFIDENTIAL

---

## Document Review History

| Version | Revised On | Description | By |
|---------|-----------|-------------|-----|
| 1.0 | 2-January-2026 | Initial Document Creation | Faab Systems |
| 1.2 | February 2026 | Review document, modification of process flow diagrams, include general application requirements, functional application requirements, security and controls requirement specification | NHIA and Faab |
| 1.3 | February 2026 | Added Training Management section (3.1.9), Payroll Validation section (3.2.5), corresponding RTM entries and use cases | Faab Systems |
| 1.4 | February 2026 | Added ERP extension modules: Finance/GL, Procurement, Inventory, Projects, Manufacturing. Added Tax Management, Credit/Debit Notes, Recurring Journals, Year-End Close, RFQ, Vendor Scorecards, Asset Disposal, Cycle Count, and complete Manufacturing module. Updated Scope, System Architecture, User Roles, Workflows, Annexes, RTM, and Use Cases. | Faab Systems |

---

## Key Terms and Definitions

| Acronym | Definition |
|---------|-----------|
| API | Application Programming Interface |
| AP | Accounts Payable |
| AR | Accounts Receivable |
| BOM | Bill of Materials |
| COGS | Cost of Goods Sold |
| COA | Chart of Accounts |
| CRUD | Create, Read, Update and Delete |
| DOB | Date of Birth |
| ERP | Enterprise Resource Planning |
| FRS | Functional Requirement Specifications |
| GL | General Ledger |
| GR | General Requirements |
| NHIA | National Health Insurance Authority |
| NHIS | National Health Insurance Scheme |
| OTP | One-time Password |
| PO | Purchase Order |
| PR | Purchase Requisition |
| REST | Representational State Transfer |
| RFQ | Request for Quotation |
| RBAC | Role-Based Access Control |
| SoD | Segregation of Duties |
| SSNIT | Social Security and National Insurance Trust |
| UI | User Interface |
| WIP | Work in Progress |
| WO | Work Order |

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for the National Health Insurance Authority (NHIA) Payroll & Human Resource Management System. It serves as the authoritative reference for system design, development, testing, deployment, and acceptance.

As of version 1.4, the scope has been extended to include integrated ERP modules (Finance/GL, Procurement, Inventory, Projects, and Manufacturing) that operate alongside the core HR and Payroll platform.

### 1.2 Intended Audience

- Executive Management (NHIA)
- HR Directors and Payroll Managers
- ICT Directorate
- Finance Officers and Chief Finance Officer
- Procurement and Supply Chain Managers
- Production and Manufacturing Managers
- Software Architects and Developers
- QA and Testing Teams
- System Integrators and Vendors
- Auditors and Compliance Officers

### 1.3 Scope

The system will support end-to-end employee lifecycle management, payroll processing, statutory compliance, workflow automation, analytics, and integrations required by NHIA across Head Office, Regional Offices, District Offices, and CPCs.

**Extended ERP Scope (v1.4):** The system additionally provides integrated modules for:

- **Finance & General Ledger** — Chart of Accounts, Journal Entries, Fiscal Periods, Financial Statements, Tax Management, Credit/Debit Notes, Recurring Journals, Year-End Close, and automatic GL postings from all operational modules
- **Procurement** — Purchase Requisitions, Purchase Orders, Vendor Management, Vendor Invoices, Request for Quotation (RFQ) with vendor evaluation, Vendor Scorecards and Blacklisting
- **Inventory & Assets** — Warehouses, Items, Stock Entries, Stock Ledger, Fixed Asset Register, Asset Depreciation, Asset Disposal with GL integration, Cycle Counts
- **Projects** — Project Management, Timesheets, Project Budgets, Project Cost Tracking with GL integration
- **Manufacturing** — Bill of Materials (BOM), Work Centers, Production Routing, Work Orders, Material Consumption, Quality Control, Production Batches, and Production Costing with GL integration

---

## 2. System Overview

The NHIA Payroll & HR System is a centralized, role-based Human Capital, Payroll, and ERP platform designed to:

- Manage employee records and employment events
- Automate payroll calculations using Ghanaian statutory rules
- Enforce approval hierarchies and business rules
- Provide employee self-service capabilities
- Support analytics, reporting, and audits
- Operate in an on-premise environment with offline support
- Manage the full procure-to-pay cycle
- Track inventory movements and fixed assets with automated depreciation
- Support manufacturing operations from BOM through production to finished goods
- Maintain a complete General Ledger with automatic postings from all modules
- Enforce Segregation of Duties (SoD) across financial and operational processes

---

## 3. Functional Requirements

### 3.1 HR Management Modules

#### 3.1.1 Employee Bio Data Management
- The system shall capture and store employee personal, employment, and compliance data
- The system shall auto-generate unique employee IDs
- Mandatory fields shall be configurable per organization
- Employee data updates shall be subject to approval workflows
- Supporting documents shall be securely stored and versioned

#### 3.1.2 Recruitment Management
- The system shall support vacancy creation and publication
- The system shall generate secure application URLs with optional token controls
- The system shall shortlist applicants based on job criteria
- Interview scoring templates shall be configurable
- Recruitment outcomes shall generate onboarding tasks

#### 3.1.3 Leave Management
- The system shall support multiple leave types and entitlements
- Leave applications shall follow multi-level approval workflows
- Leave balances, carry-overs, and restrictions shall be enforced
- Leave data shall integrate with payroll processing

#### 3.1.4 Benefits & Reimbursements
- The system shall manage employee benefits and loan schemes
- Eligibility rules and approval levels shall be configurable
- Approved benefits shall auto-post to payroll

#### 3.1.5 Appraisal & Performance Management
- The system shall support annual, mid-year, and end-year appraisals
- Performance objectives and competencies shall be configurable
- Appraisal outcomes shall integrate with increments and training

#### 3.1.6 Disciplinary & Grievance Management
- The system shall capture disciplinary cases and grievances
- Offences shall be categorized as minor, serious, or major
- Escalation rules and timelines shall be enforced
- Employees shall be able to respond to queries

#### 3.1.7 Company Policies & SOPs
- The system shall publish company policies and SOPs
- Employees shall acknowledge receipt electronically

#### 3.1.8 Exit Management
- The system shall manage resignation, retirement, and termination workflows
- Asset clearance and final payroll shall be enforced

#### 3.1.9 Training Management
- The system shall capture and maintain training records for all employees, whether training is delivered through the integrated Learning Management System (LMS) or externally
- The LMS shall be linked to the appraisal process so that training needs identified during performance reviews are automatically fed into training plans
- Training needs submitted by department heads shall also be captured and consolidated into the organization-wide training plan
- Employees shall be notified of their assigned training programs via in-app notifications, email, and/or SMS
- Upon completion of training, the employee shall submit a post-training report through the system
- The supervisor shall conduct and record an impact assessment and evaluation of staff performance after training
- The system shall capture the following training details: program name, date, venue, cost breakdown (per diem, other entitlements, program fees), and organizers/institution
- The system shall provide training analytics including: training completion rate per Directorate, total number of staff trained (local and foreign), training cost per employee and location (internal vs. external), and training cost vs. budget
- Training requests from employees shall be supported via Employee Self-Service and routed through the appropriate approval workflow

### 3.2 Payroll Management Modules

#### 3.2.1 Salary Structure Configuration
- The system shall support grades, bands, levels, and notches
- Salary rules shall support multiple pay groups and currencies

#### 3.2.2 Payroll Processing
- The system shall process monthly payroll cycles
- Payroll shall support statutory deductions (PAYE, SSNIT, Tier 2 & 3)
- Payroll runs shall support approvals, locking, and audit trails

#### 3.2.3 Overtime Processing
- Overtime rules shall be configurable
- Different rates shall apply for weekdays, weekends, and holidays

#### 3.2.4 Payroll Reporting
- The system shall generate statutory, management, and audit reports
- Reports shall be exportable in standard formats

#### 3.2.5 Payroll Validation (District-Level Employee Verification)
- Prior to each monthly payroll run, the system shall present the complete list of employees assigned to each district to the respective District Manager for validation
- The District Manager shall be able to review and confirm each employee's eligibility to remain on the payroll for the current pay period
- The District Manager shall be able to flag employees for removal from the current month's payroll by selecting the employee and providing a mandatory reason for exclusion (e.g., abandonment of post, unauthorized absence, transfer out, termination, death, retirement)
- The removal reason categories shall be configurable by the system administrator
- The validated employee list and all removal flags with reasons shall serve as a formal input to the monthly payroll computation; only employees confirmed or not flagged shall be included in the payroll run
- The payroll validation process shall enforce a submission deadline; the payroll team shall not process payroll until all districts have completed their validation or the deadline has elapsed
- Notifications shall be sent to District Managers when the validation window opens, and reminders shall be sent as the deadline approaches
- A comprehensive audit trail shall be maintained for all payroll validation actions, including: District Manager identity, timestamp, employees flagged, reasons provided, and final submission status
- The Payroll Manager and HR shall have a consolidated dashboard view showing validation status across all districts, including pending validations, completed validations, and employees flagged for removal with associated reasons

#### 3.2.6 Statutory Remittance Integration (v1.4)
- Upon payroll completion, the system shall automatically generate remittance records or vendor invoices for each statutory body (SSNIT, GRA for PAYE, Tier 2 provider, Tier 3 provider)
- Remittance amounts shall be aggregated from individual employee deduction lines
- Remittance records shall post to the General Ledger as Accounts Payable entries

### 3.3 Employee Self-Service
- Employees shall apply for leave, benefits, and requests
- Employees shall view payslips and personal data
- Employees shall track request status and responses

### 3.4 Finance & General Ledger Module (v1.4)

#### 3.4.1 Chart of Accounts
- The system shall support a hierarchical Chart of Accounts with account types: Asset, Liability, Equity, Revenue, Expense
- Each account shall have a unique code, name, account type, and optional parent account
- Accounts shall be flaggable as bank accounts for payment integration
- The COA shall be tenant-specific for multi-tenant deployments

#### 3.4.2 Fiscal Year and Period Management
- The system shall support configurable fiscal years with multiple periods (typically 12 monthly + adjustment periods)
- Periods shall be individually openable and closable
- Only open periods shall accept new journal entries
- Period close shall validate all entries are posted before allowing close

#### 3.4.3 Journal Entries
- The system shall support manual journal entry creation with multiple debit/credit lines
- Each journal entry shall balance (total debits = total credits) before posting
- Journal entries shall record source module, reference, and narration
- Journal entries shall support workflow-based approval before posting
- The system shall support auto-generated journal entries from operational modules (Payroll, Procurement, Inventory, Manufacturing)

#### 3.4.4 Tax Management
- The system shall support multiple tax types: VAT, WHT (Withholding Tax), NHIL, GETFund, COVID Levy, Customs Duty
- Each tax type shall have: code, name, rate (percentage), effective date range, and linked GL account
- Compound tax calculation shall be supported (tax-on-tax)
- Tax lines shall be automatically computed on vendor and customer invoices
- Tax summary reports shall be generated per period for statutory filing

#### 3.4.5 Credit Notes and Debit Notes
- The system shall support credit notes linked to original vendor or customer invoices
- Credit notes shall reverse or partially offset the original invoice amount
- Debit notes shall support additional charges against a vendor or customer
- Both credit and debit notes shall auto-generate corresponding journal entries on approval
- Approval workflow shall be required before notes take effect

#### 3.4.6 Recurring Journals
- The system shall support recurring journal templates with configurable frequency (Monthly, Quarterly, Annual)
- Each template shall reference a source journal entry whose lines are copied on each recurrence
- The system shall automatically generate recurring journal entries via scheduled task (Celery Beat)
- Users shall be able to activate, deactivate, and set end dates on recurring templates

#### 3.4.7 Financial Statements
- The system shall generate Trial Balance, Income Statement, and Balance Sheet from GL data
- Statements shall be filterable by fiscal year and period range
- Comparative statements (current vs. prior period/year) shall be supported

#### 3.4.8 Year-End Close
- The system shall provide a year-end close process that:
  - Validates all fiscal periods for the year are closed
  - Calculates net income (Revenue minus Expenses)
  - Creates a closing journal entry that zeros out all revenue and expense accounts, posting the net to Retained Earnings
  - Creates opening balance journal entries for the next fiscal year (carrying forward asset, liability, and equity balances)
  - Marks the fiscal year as closed (no further entries permitted)
- Year-end close shall be irreversible and require appropriate authorization

#### 3.4.9 Budgets
- The system shall support annual budgets per GL account and cost center
- Budget vs. actual comparison shall be available per period
- Budget alerts shall warn when expenditure approaches or exceeds budget limits

#### 3.4.10 GL Integration from Other Modules
- **Payroll → GL:** Payroll runs shall post journal entries for salary expense, statutory deductions payable, and net pay payable
- **Procurement → GL:** Approved vendor invoices shall post journal entries (Debit Expense/Inventory, Credit AP). Payments shall post (Debit AP, Credit Bank)
- **Inventory → GL:** Stock movements shall post journal entries for inventory valuation changes and COGS
- **Benefits → GL:** Approved benefit claims shall post (Debit Benefit Expense, Credit AP/Bank)
- **Loans → GL:** Loan disbursements shall post (Debit Loan Receivable, Credit Bank). Repayments shall post (Debit Bank, Credit Loan Receivable + Interest Income)
- **Assets → GL:** Asset disposals shall post gain/loss entries. Depreciation runs shall post periodic depreciation entries
- **Manufacturing → GL:** Production completions shall post (Debit Finished Goods Inventory, Credit WIP). Manufacturing variances shall be posted as separate entries
- **Projects → GL:** Project costs shall post (Debit WIP/Project Expense, Credit Accrued Payroll/AP) when fiscal periods are provided

### 3.5 Procurement Module (v1.4)

#### 3.5.1 Vendor Management
- The system shall maintain a vendor registry with contact details, tax identification, payment terms, and status
- Vendors shall be categorizable by type and industry
- Vendor performance history shall be accessible from the vendor profile

#### 3.5.2 Purchase Requisitions
- The system shall support purchase requisition creation with line items
- Requisitions shall follow configurable multi-level approval workflows
- Approved requisitions shall be convertible to Purchase Orders or RFQs

#### 3.5.3 Purchase Orders
- The system shall generate purchase orders from approved requisitions
- POs shall track status: Draft, Sent, Partially Received, Received, Cancelled
- PO receipt shall update inventory stock levels and create stock entries

#### 3.5.4 Vendor Invoices
- The system shall support vendor invoice matching against POs (2-way match: PO + Invoice; 3-way match: PO + Receipt + Invoice)
- Invoice approval shall post to the General Ledger (Debit Expense/Inventory, Credit AP)
- Tax lines shall be auto-calculated based on configured tax types

#### 3.5.5 Request for Quotation (RFQ)
- The system shall support RFQ creation linked to purchase requisitions
- RFQs shall track: RFQ number (unique), status (Draft, Sent, Received, Evaluated, Awarded, Cancelled), submission deadline, and evaluation criteria
- Multiple vendors shall be invitable per RFQ, with individual tracking of invitation date, response status, quoted amount, delivery timeline, and evaluation score
- RFQ items shall map to requisition line items with description, quantity, and specifications
- The system shall support side-by-side vendor quotation comparison for evaluation
- RFQ award shall be convertible to a Purchase Order

#### 3.5.6 Vendor Scorecards
- The system shall support periodic vendor performance scorecards with dimensions: Delivery, Quality, Price Competitiveness, and Compliance
- Each dimension shall be scored independently with an overall weighted score
- Scorecard history shall be maintained per vendor per evaluation period
- Low-scoring vendors shall be flaggable for review or blacklisting

#### 3.5.7 Vendor Blacklisting
- The system shall support vendor blacklisting with: reason, blacklisted-by user, effective date, and review date
- Blacklisted vendors shall be blocked from new POs and RFQ invitations while active
- Blacklist records shall be reviewable and reversible with authorization

#### 3.5.8 Payments
- The system shall support payment processing against approved vendor invoices
- Payments shall post to GL (Debit AP, Credit Bank)
- Payment status tracking: Pending, Processing, Completed, Failed

### 3.6 Inventory & Asset Management Module (v1.4)

#### 3.6.1 Warehouse Management
- The system shall support multiple warehouses with location details
- Each warehouse shall track stock levels per item

#### 3.6.2 Item Master
- The system shall maintain an item master with: code, name, description, category, unit of measure, reorder level, and cost
- Items shall be categorizable as raw materials, finished goods, consumables, or fixed assets

#### 3.6.3 Stock Entries and Ledger
- The system shall record all stock movements as Stock Entries (Receipt, Issue, Transfer, Adjustment)
- Each entry shall update the Stock Ledger with running quantity and valuation
- Stock entries shall post to the General Ledger for inventory valuation tracking

#### 3.6.4 Fixed Asset Register
- The system shall maintain a fixed asset register with: asset tag, description, category, acquisition date, acquisition cost, useful life, and depreciation method (straight-line, reducing balance)
- The system shall auto-calculate and post periodic depreciation
- Asset status tracking: Active, Under Maintenance, Disposed

#### 3.6.5 Asset Disposal
- The system shall support asset disposal requests with disposal types: Sale, Scrap, Donation, Transfer
- Disposal requests shall capture: disposal date, sale proceeds (if any), book value at disposal, and calculated gain/loss
- Disposal approval shall automatically post to the General Ledger:
  - Debit: Bank/Cash (proceeds) + Loss on Disposal (if applicable)
  - Credit: Asset Account + Accumulated Depreciation + Gain on Disposal (if applicable)
- Disposal approval shall require appropriate authorization (asset manager + finance for high-value items)

#### 3.6.6 Cycle Counts
- The system shall support planned cycle count sessions per warehouse
- Cycle count status: Planned, In Progress, Completed, Approved
- Each count session shall record: counted-by employee, system quantity, counted quantity, and variance per item
- Variances exceeding configurable thresholds shall require supervisor approval
- Approved cycle counts with variances shall auto-generate stock adjustment entries
- Cycle count history shall be maintained for audit purposes

#### 3.6.7 Reorder and Alerts
- The system shall alert when item stock falls below configured reorder levels
- Reorder suggestions shall be generatable as purchase requisitions

### 3.7 Project Management Module (v1.4)

#### 3.7.1 Project Management
- The system shall support project creation with: name, description, dates, status, budget, project manager, and linked cost center
- Project status tracking: Planning, Active, On Hold, Completed, Cancelled

#### 3.7.2 Timesheets
- The system shall capture employee time entries against projects
- Timesheets shall support approval workflows
- Approved timesheet hours shall contribute to project cost calculations

#### 3.7.3 Project Budgets and Costs
- The system shall track project budgets and actual costs
- Project cost sources: employee time (via timesheets × rates), procurement (linked POs), and direct charges
- Project costs shall post to GL when fiscal period is provided (Debit WIP/Project Expense, Credit Accrued Payroll/AP)

### 3.8 Manufacturing Module (v1.4)

#### 3.8.1 Bill of Materials (BOM)
- The system shall support Bill of Materials defining the raw materials and quantities needed to produce a finished product
- Each BOM shall have: unique code, name, linked finished product (from Item master), version number, yield quantity, and status (Draft, Active, Obsolete)
- BOM versioning shall be supported — multiple versions per product, with only one active version at a time
- BOM Lines shall specify: raw material item, quantity per unit, unit of measure, scrap percentage, and sort order
- Users shall be able to copy an existing BOM to create a new version

#### 3.8.2 Work Centers
- The system shall support work center definitions representing production areas or machine groups
- Each work center shall have: unique code, name, description, linked department, linked warehouse (for material staging), hourly labor rate, daily capacity, and active status
- Work center capacity and rates shall be used for production scheduling and costing

#### 3.8.3 Production Routing
- The system shall support production routing definitions linked to BOMs
- Each routing step shall specify: operation number, name, description, assigned work center, setup time (minutes), and run time per unit (minutes)
- Routing operations shall be sequenced by operation number
- Routing shall serve as the template for Work Order operations

#### 3.8.4 Work Orders
- The system shall support work order creation for production of finished goods
- Work order numbers shall be auto-generated in format `WO-YYYYMM-NNNN`
- Each work order shall reference: BOM, finished product, planned quantity, planned start/end dates, priority (1-5), and optionally a linked project and cost center
- Work order status lifecycle: **Draft → Released → In Progress → Completed** (with alternative states: Cancelled, On Hold)
- Work orders shall track: completed quantity, rejected quantity, estimated cost, and actual cost
- The following actions shall be supported:
  - **Release:** Validates BOM is active and materials are available in stock, transitions to Released
  - **Start:** Transitions to In Progress, records actual start date
  - **Issue Materials:** Creates stock entry (Issue type) for each material consumption line, deducting from warehouse inventory
  - **Report Production:** Records completed quantity, creates production batch and stock entry (Receipt type) for finished goods
  - **Complete:** Validates all operations are done, calculates final cost, creates GL postings, transitions to Completed
  - **Cancel / Hold:** Supports pausing or cancelling production with reason tracking

#### 3.8.5 Work Order Operations
- Each work order shall have operations derived from the BOM's production routing
- Operations shall track: planned and actual start/end times, setup time, run time, actual time, status (Pending, In Progress, Completed, Skipped), and completed-by employee
- Operation sequencing shall determine production flow

#### 3.8.6 Material Consumption
- The system shall track planned vs. actual material consumption per work order
- Material consumption shall link to stock entries (Issue type) for inventory deduction
- Material variance (planned vs. actual quantity) shall be reportable

#### 3.8.7 Quality Control
- The system shall support quality checks at multiple stages: In-Process, Final Inspection, and Incoming Material
- Each quality check shall capture: work order reference, check type, parameter name, specification (expected value/range), actual measured value, result (Pass, Fail, Conditional), inspector, timestamp, and notes
- Quality check results shall be aggregated for pass rate reporting
- Failed quality checks shall flag the work order and increment rejected quantity

#### 3.8.8 Production Batches
- The system shall support production batch tracking with auto-generated batch numbers (`BAT-YYYYMM-NNNN`)
- Each batch shall reference: work order, quantity produced, manufacture date, optional expiry date
- Batch creation shall generate a stock entry (Receipt type) for finished goods entering inventory
- Batch creation shall generate a journal entry for production cost posting to GL:
  - Debit: Finished Goods Inventory
  - Credit: Work-in-Progress (Raw Materials + Labor + Overhead)

#### 3.8.9 Production Costing
- The system shall calculate production costs per work order comprising:
  - **Material Cost:** Sum of (consumed quantity × item unit cost) for each material
  - **Labor Cost:** Sum of (actual operation time × work center hourly rate) for each operation
  - **Overhead:** Configurable overhead rate or allocation
- The system shall calculate manufacturing variance: planned cost vs. actual cost
- Variance journal entries shall be posted to GL on work order completion

#### 3.8.10 Manufacturing Dashboard
- The system shall provide a production dashboard displaying:
  - Active work order count (Released + In Progress)
  - Work orders completed today
  - Quality pass rate (percentage of quality checks with Pass result)
  - Material efficiency (completed quantity vs. planned quantity across completed work orders)
  - In-progress work orders with progress bars
  - Recent quality issues (work orders with rejected quantities)

### 3.9 Workflow & Approval Engine (v1.4 — Enhanced)

#### 3.9.1 Configurable Workflows
- The system shall support multi-level approval workflows configurable per document type
- Workflow definitions shall specify: document type, approval levels, required roles, and escalation rules
- Threshold-based routing shall be supported (e.g., POs above a threshold require additional CFO approval)

#### 3.9.2 Seeded Workflow Configurations
The following workflow templates shall be provided:
- **Purchase Requisition:** 1-level (dept head); 2-level for amounts > threshold (adds finance)
- **Purchase Order:** 1-level (procurement manager); 2-level for amounts > threshold (adds CFO)
- **Vendor Invoice:** 1-level (finance officer); 2-level for amounts > threshold (adds CFO)
- **Journal Entry:** 1-level (accountant); 2-level for amounts > threshold (adds CFO)
- **Budget:** 1-level (dept head); 2-level (finance)
- **Asset Disposal:** 1-level (asset manager); 2-level (finance)

#### 3.9.3 Segregation of Duties (SoD)
- The system shall enforce SoD rules preventing conflicting permissions from being assigned to the same user
- The following SoD rules shall be enforced:
  - `create_purchase_order` ↔ `approve_purchase_order`
  - `create_vendor_invoice` ↔ `approve_vendor_invoice`
  - `create_journal_entry` ↔ `approve_journal_entry`
  - `create_rfq` ↔ `evaluate_rfq` (bid rigging prevention)
  - `create_credit_note` ↔ `approve_credit_note` (revenue manipulation prevention)
  - `initiate_stock_adjustment` ↔ `approve_stock_adjustment` (inventory fraud prevention)
  - `create_work_order` ↔ `approve_work_order` (production fraud prevention)

---

## 4. Non-Functional Requirements

### 4.1 Performance
- The system shall process payroll for 10,000+ employees in under 15 minutes
- User interfaces shall respond with minimal latency
- Redis caching shall be used for lookup data, dashboard statistics, and frequently accessed queries
- Background task processing (Celery) shall be used for long-running operations: report generation, payroll computation, GL posting, recurring journal generation, manufacturing cost calculations

### 4.2 Security
- Role-Based Access Control (RBAC)
- Two-Factor Authentication (2FA)
- Encryption at rest and in transit
- Comprehensive audit trails
- Segregation of Duties enforcement across financial and operational processes
- Module-level access control per tenant (multi-tenant module gating)

### 4.3 Scalability
- The system shall support horizontal and vertical scaling
- The system shall support multi-tenant configurations
- PostgreSQL with connection pooling for database tier
- Redis for caching and message brokering (Celery)

---

## 5. System Architecture

### 5.1 Technology Stack
- **Frontend:** React with TypeScript, TanStack Query, Tailwind CSS
- **Backend:** Python (Django REST Framework)
- **Database:** PostgreSQL
- **Caching:** Redis (multi-tier: default 5min, persistent 24hr, volatile 1min)
- **Task Queue:** Celery with Redis broker (queues: default, reports, payroll)
- **Task Scheduler:** Celery Beat for periodic tasks (recurring journals, overdue alerts, depreciation)
- **APIs:** REST with JWT authentication
- **Deployment:** On-premise Virtual Machines

### 5.2 Module Architecture
The system is organized into the following Django applications:

| Module | Description |
|--------|-------------|
| `accounts` | User accounts, authentication, roles, permissions, SoD |
| `core` | Base models, caching, middleware, pagination, audit logging |
| `organization` | Departments, locations, grades, cost centers |
| `employees` | Employee records, documents, employment events |
| `leave` | Leave types, entitlements, applications, approvals |
| `payroll` | Salary structures, payroll processing, statutory calculations |
| `benefits` | Loans, advances, benefits, reimbursements |
| `performance` | Appraisals, objectives, competencies, training |
| `discipline` | Disciplinary cases, grievances, queries |
| `recruitment` | Vacancies, applications, interviews, scoring |
| `workflow` | Approval engine, workflow definitions, SLA tracking |
| `reports` | Report generation, exports, scheduled reports |
| `finance` | Chart of Accounts, GL, Journal Entries, Tax, Credit/Debit Notes, Recurring Journals, Budgets, Financial Statements |
| `procurement` | Vendors, Requisitions, POs, Invoices, RFQs, Scorecards |
| `inventory` | Warehouses, Items, Stock, Assets, Depreciation, Disposal, Cycle Counts |
| `projects` | Projects, Timesheets, Budgets, Cost Tracking |
| `manufacturing` | BOMs, Work Centers, Routing, Work Orders, Quality, Batches |
| `logs` | System logging, audit trails |
| `licensing` | Per-tenant module licensing and access control |

---

## 6. User Roles

### 6.1 Core HR & Payroll Roles
- Super Administrator
- Administrator
- Director / Deputy Director
- HR Manager / HR Officer
- Payroll Manager / Payroll Officer
- Department Head
- Employee (Self-Service)
- Read-Only User

### 6.2 ERP Module Roles (v1.4)
- **Finance Officer** — GL entries, journal posting, financial reports
- **Chief Finance Officer (CFO)** — Financial approvals, year-end close, budget approval
- **Procurement Manager** — PO approval, RFQ management, vendor evaluation
- **Procurement Officer** — Requisitions, PO creation, RFQ creation
- **Inventory Manager** — Stock management, asset management, cycle count approval
- **Warehouse Clerk** — Stock receipts, issues, transfers
- **Project Manager** — Project creation, budget management, timesheet approval
- **Project Member** — Timesheet entry, task updates
- **Manufacturing Manager** — BOM management, work order approval, production planning
- **Production Supervisor** — Work order execution, material issue, production reporting
- **Quality Inspector** — Quality check recording, pass/fail determination

---

## 7. Key Workflows

### 7.1 Employee Onboarding Workflow
Recruitment → HR Setup → Document Upload → Salary Assignment → Activation

### 7.2 Payroll Workflow
District Validation → Input Validation → Computation → Approval → Lock → Reporting → Period Close → Statutory Remittance → GL Posting

### 7.3 Procure-to-Pay Workflow (v1.4)
Purchase Requisition → Approval → RFQ (optional) → Vendor Selection → Purchase Order → Goods Receipt → Vendor Invoice → 3-Way Match → Invoice Approval → GL Posting → Payment → Payment GL Posting

### 7.4 Manufacturing Workflow (v1.4)
BOM Definition → Routing Setup → Work Order Creation → Release (validate materials) → Material Issue (stock deduction) → Production Operations → Quality Checks → Report Production (stock receipt) → Work Order Completion → Cost Calculation → GL Posting (WIP → Finished Goods)

### 7.5 Asset Lifecycle Workflow (v1.4)
Asset Acquisition → Asset Registration → Periodic Depreciation → Disposal Request → Disposal Approval → GL Posting (Gain/Loss Recognition)

### 7.6 Year-End Close Workflow (v1.4)
Close All Fiscal Periods → Validate No Pending Entries → Calculate Net Income → Post Closing Entries (Zero Revenue/Expense) → Post to Retained Earnings → Create Opening Balances for Next Year → Mark Year Closed

---

## 8. Acceptance Criteria

- All functional requirements are implemented as specified
- Payroll calculations match statutory rules
- Performance benchmarks are met
- Security controls are validated
- Audit logs capture all critical activities
- GL postings from all modules balance correctly (debits = credits)
- Manufacturing work order lifecycle operates end-to-end: BOM → WO → Materials → Production → Quality → Finished Goods → GL
- SoD rules prevent conflicting role assignments
- Year-end close produces correct closing and opening entries
- RFQ vendor comparison produces accurate evaluations
- Asset disposal posts correct gain/loss to GL
- Cycle count variances generate appropriate adjustment entries
- Tax calculations apply correctly on invoices
- Credit/debit notes reverse original invoice amounts accurately
- Recurring journals generate on schedule

---

## 9. Future Enhancements

- AI-driven payroll anomaly detection
- Predictive attrition and performance analytics
- Chatbot-enabled employee support
- Biometric attendance integration
- Barcode/QR scanning for inventory and cycle counts
- Manufacturing shop-floor terminal interface
- Real-time production monitoring dashboard with WebSocket updates
- Demand forecasting and production planning optimization
- Multi-currency procurement and manufacturing costing
- Flower dashboard for Celery task monitoring
- pgBouncer connection pooling for high-concurrency scenarios

---

## 10. Implementation Phases

### Phase 1: Core HR & Payroll (Completed)
- Employee Bio Data, Recruitment, Leave, Benefits, Performance, Discipline, Payroll, Reporting, Employee Self-Service

### Phase 2: Workflow & Organization (Completed)
- Approval engine, workflow definitions, organization structure, multi-tenant support, audit logging

### Phase 3: ERP Foundation (Completed)
- Finance/GL, Procurement, Inventory, Projects, Reporting enhancements

### Phase 4: ERP Advanced + Manufacturing (Completed in v1.4)
- Tax Management, Credit/Debit Notes, Recurring Journals, Year-End Close
- RFQ, Vendor Scorecards, Vendor Blacklisting
- Asset Disposal, Cycle Counts
- Manufacturing module (BOM, Work Centers, Routing, Work Orders, Quality, Batches)
- Cross-module GL integration (all modules post to GL)
- Enhanced SoD rules, seeded workflow configurations, ERP role definitions

---

## ANNEX A: BUSINESS RULES & POLICY MAPPING

### A1. Purpose of This Annex
This annex documents the business rules, statutory requirements, and policy-driven constraints that are enforced by the NHIA Payroll & HR System. It provides traceability between organizational policies, collective agreements, statutory obligations, and system behavior.

This annex complements the Core SRS and is intended for:
- Auditors and regulators
- HR and Payroll leadership
- ICT governance teams
- System testers and implementers

### A2. Payroll Business Rules

#### A2.1 Salary Proration Rules
- Salary shall be prorated based on the employee assumption date
- Full salary shall apply only when assumption date is the first working day of the month
- Public holidays shall be treated as paid days
- Backdating of assumption dates shall not be permitted

System Enforcement:
- Payroll engine auto-calculates proration
- Validation blocks invalid effective dates

#### A2.2 Statutory Deductions (Ghana)
- PAYE shall be calculated using GRA-issued tax bands
- SSNIT Tier 1: Employee 5.5%, Employer 13%
- Tier 2 Pension: 5%
- Tier 3 Pension: Configurable (Employee and Employer portions)

System Enforcement:
- Statutory tables are versioned and configurable
- Payroll cannot be finalized if statutory validation fails

#### A2.3 Loans & Advances
- Salary advance limited to one-month gross salary (12 months recovery)
- Special advance limited to two months basic salary (24 months recovery)
- Car loans subject to interest and repayment tenure rules
- Disposable income thresholds must be met before approval

System Enforcement:
- Eligibility checks executed before approval
- Approved loans auto-post to payroll deductions

### A3. Leave Management Rules

#### A3.1 Annual Leave Entitlements
- Deputy Directors and below: 28 working days
- Directors: 36 working days
- Leave applications must be submitted at least 10 working days in advance (except emergencies)

#### A3.2 Maternity & Paternity Leave
- Normal delivery: 12 weeks (84 days)
- Abnormal delivery: 98 days
- Paternity leave: 5 working days (subject to policy approval)
- Loss of baby at birth: 6 weeks

#### A3.3 Sick Leave & Excuse Duty
- Excuse duty limited to 22 days per year
- Sick leave beyond one month requires HR approval
- Salary reduction rules apply for extended sick leave durations

System Enforcement:
- Automatic balance tracking and alerts
- HR escalation triggers for threshold breaches

#### A3.4 Leave Carry-Over Rules
- Maximum of 5 working days may be carried into January
- Carry-over requires approval
- Unapproved carry-over lapses at year-end

### A4. Disciplinary Rules

#### A4.1 Offence Classification
- Minor offences
- Serious offences
- Major offences

#### A4.2 Escalation Logic
- Three minor offences within 12 months allowed
- Fourth minor offence escalates automatically
- Serious and major offences escalate immediately to higher authority

#### A4.3 Approval Hierarchy
- District → Region → Head Office
- Each escalation requires documented justification

System Enforcement:
- Automated escalation based on offence count and category
- Notifications sent to all required parties

### A5. Grievance Handling Rules
- Grievances must first be reported to immediate supervisor
- Unresolved grievances escalate according to defined timelines
- Employees may close grievances after resolution

System Enforcement:
- SLA timers and escalation alerts
- Status tracking visible to employees and HR

### A6. Approval & SLA Rules

#### A6.1 SLA Color Coding
- Green: Response within 10 working days
- Amber: 3–10 working days remaining
- Red: SLA breached (>10 working days)

#### A6.2 Approval Hierarchies
- Approval levels are role-based and configurable
- Overrides require justification and audit logging

### A7. Compliance & Audit Rules
- All critical actions shall be logged
- Audit logs shall be immutable
- Data retention minimum: 7 years
- System shall comply with Data Protection Act and ISO standards

### A8. Policy-to-System Mapping (Sample)

| Policy Area | Policy Rule | System Feature |
|-------------|------------|----------------|
| Payroll | Salary proration | Payroll Engine |
| Leave | Carry-over limits | Leave Validation |
| Discipline | Auto escalation | Workflow Engine |
| Security | RBAC | Access Control |
| Finance | Journal balancing | GL Engine |
| Procurement | PO approval thresholds | Workflow Engine |
| Inventory | Reorder alerts | Stock Management |
| Manufacturing | BOM versioning | Manufacturing Module |

### A9. ERP Business Rules (v1.4)

#### A9.1 Finance Rules
- Journal entries must balance before posting (total debits = total credits)
- Only open fiscal periods accept new journal entries
- Year-end close is irreversible once executed
- Recurring journals execute only when the template is active and next_run_date is due
- Credit notes cannot exceed the original invoice amount
- Tax rates are date-bounded; the system applies the rate effective on the transaction date

#### A9.2 Procurement Rules
- Purchase requisitions require department head approval
- Purchase orders above configurable thresholds require additional CFO approval
- RFQ evaluation must be performed by a different user than the RFQ creator (SoD)
- Vendor invoices require 3-way matching (PO + Receipt + Invoice) for goods-based procurement
- Blacklisted vendors are automatically excluded from new PO and RFQ creation

#### A9.3 Inventory Rules
- Stock cannot go negative (issue entries are validated against available stock)
- Cycle count variances above threshold require supervisor approval before adjustment
- Asset disposal requires finance approval for items above configurable value threshold
- Depreciation runs are automated via Celery Beat on configurable schedule

#### A9.4 Manufacturing Rules
- Work orders can only be released when the referenced BOM is in Active status
- Material issue validates sufficient stock is available in the staging warehouse
- Quality checks with Fail result increment the work order's rejected quantity
- Work order completion requires all operations to be in Completed or Skipped status
- Production cost variance (planned vs. actual) is posted to GL as a separate variance entry
- Only one BOM version per product may be Active at any time

---

## ANNEX B: FORMS, TEMPLATES & QUESTIONNAIRES APPENDIX

### B1. Purpose of This Annex
This annex consolidates all operational forms, templates, and requirements-gathering questionnaires referenced by the NHIA Payroll & HR System. These items are implementation inputs and user-facing artifacts and are intentionally separated from the Core SRS to keep requirements clean and testable.

### B2. Recruitment Forms & Templates

#### B2.1 Vacancy Publication & Application Templates
- Vacancy Posting Template (internal publication)
- Public Application Page Template (URL-based)
- Token-based Application Access (one-time token)

#### B2.2 Recruitment Interview Appraisal Form (NHIA)
Sections:
- Part A: General Particulars
- Part B: Appraisal Criteria and Scoring (Appearance, Background, Experience, Intellect, Current Affairs, Impression/Comments, Recommendation)
- Panelist Identification & Sign-off

#### B2.3 Drivers' Interview Score Sheet
Sections:
- General Particulars
- Appraisal Criteria (Academic Qualification, Experience, Stability, etc.)
- Driving Test Results (DVLA-derived component)
- Impression/Comments
- Recommendation & Sign-off

#### B2.4 Promotion Interview Appraisal Form
Sections:
- General Particulars
- Appraisal Criteria and Scoring
- Impression/Comments
- Recommendation & Sign-off

#### B2.5 Interview Panel Report Template
Includes:
- Interview date/venue
- Panel composition
- Candidate information
- Scoring breakdown and final average score
- Observations and discrepancies (e.g., date-of-birth mismatch)
- Recommendations and actions
- Panel signatures

#### B2.6 Employment Reference Confidential Form
Includes:
- Applicant details
- Previous employment profile
- Performance/competency ratings grid
- Strengths/weaknesses narrative
- Rehire recommendation
- Referee seal/stamp requirement

### B3. Onboarding & Employee Records Forms

#### B3.1 Personal History Form (NHIA)
Includes:
- Personal information (name, DOB, nationality, ID type)
- Contact information
- Family information (parents, spouse, dependents)
- Next of kin and emergency contact
- Education and professional membership
- Language proficiency and computer skills
- Employment record and unemployment periods
- Security/background declarations
- References and certification statement

#### B3.2 Employee Accounts Details Form
Includes:
- Bank details
- Account number and branch
- SSNIT number
- Ghana Card number
- Employee signature and date

### B4. Pension & Provident Fund Enrollment Forms

#### B4.1 Third-Party Pension Enrollment Forms
- Pension enrollment templates used for scheme registration
- Employer verification and stamping requirements
- Member declaration sections

Note: Some pension templates may be image-based in source materials; conversion to fillable digital forms requires access to original editable source files.

### B5. Employee Self-Service Request Templates

#### B5.1 Standard Request Acknowledgement Template
- System-generated acknowledgement message
- SLA guidance and escalation instruction
- Color-coded SLA status (Green/Amber/Red)

#### B5.2 Request Categories List (As Supported by ESS)
- Change of bank details
- Salary/special advance
- Funeral donation/announcement
- Voluntary transfer
- Introductory letter
- Personal records update
- Leave absence without pay
- Frame and lenses
- Additional PF contribution
- Sick leave
- Third-party loans
- Change of name
- Credit union savings/shares
- Staff petitions
- Training and development requests
- Workman's compensation
- Resignation
- Retirement (voluntary/medical)

### B6. Client Requirements Questionnaire (Checkbox Form)

#### B6.1 Organization Information
- Organization structure (single/multi-branch/departments)
- Pay cycle
- Work schedule

#### B6.2 Employee Bio Data Requirements
- Mandatory fields checklist
- Documents required checklist

#### B6.3 Payroll Requirements
- Salary structure setup (grades, bands, levels, etc.)
- Allowances and deductions checklists
- Overtime rules reference
- Loans and savings rules checklist

#### B6.4 Payroll Reports Checklist
- Pay slip
- Payroll summary
- Bank schedules
- Statutory schedules (SSNIT, PAYE, Tier 2/3)
- Loan and deductions reports
- Audit trail and custom reports

#### B6.5 Infrastructure Requirements
- Deployment model (on-prem)
- Staging and production server specs
- Network requirements (VPN, offline support)
- Remote access and audit logging requirements

#### B6.6 Integrations
- SMS gateway
- Email (Microsoft Graph)
- Active Directory / LDAP
- LMS
- Custom APIs

#### B6.7 Compliance Requirements
- 2FA
- Audit trails
- Encryption
- Data retention (7 years)
- ISO standards reference

### B7. Report Templates Index
- Disciplinary actions report
- Resignation reports
- Third-party loan reports
- Transfers and promotions reports
- Funeral grants/donations reports
- Payroll journals and reconciliation reports
- Trial Balance, Income Statement, Balance Sheet (v1.4)
- Vendor performance reports (v1.4)
- Stock movement and valuation reports (v1.4)
- Production cost and variance reports (v1.4)
- Quality pass rate reports (v1.4)

### B8. Appendix Governance
- This annex is normative for UI/forms replication only
- Business rules referenced by these forms are defined in Annex A
- System behavior and requirements remain authoritative in the Core SRS

---

## REQUIREMENTS TRACEABILITY MATRIX (RTM) & USE CASE INDEX

### 1. Purpose
This document provides:
- A Requirements Traceability Matrix (RTM) to link requirements to their sources, modules, and acceptance criteria.
- A Use Case Index to support implementation planning, testing, and stakeholder validation.

The RTM is designed to be expanded during delivery. This version covers the major requirements groups extracted from the Core SRS and Annex A, including ERP module requirements added in v1.4.

### 2. Requirements Traceability Matrix (RTM)

**Legend:**
- **Req ID:** Unique requirement identifier
- **Source:** Origin of the requirement
- **Module:** System module responsible
- **Priority:** Must / Should / Could
- **Acceptance Criteria:** Testable condition for acceptance

#### 2.1 Core Platform & Security

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| SEC-01 | Enforce role-based access control (RBAC) for all modules | NHIA security requirement | Security | Must | User actions are permitted/blocked strictly by role; verified via test roles |
| SEC-02 | Provide immutable audit logs for critical actions | Audit/compliance requirement | Security/Audit | Must | All configured actions are recorded with timestamp, actor, action, entity, outcome |
| SEC-03 | Support 2FA for key roles | Compliance requirement | Security | Should | 2FA can be enabled; key roles require second factor on login |
| SEC-04 | Encrypt data in transit and at rest | Compliance requirement | Security | Must | TLS enforced; database encryption configured and verified |
| SEC-05 | Alert on repeated failed login attempts for key roles | Security requirement | Security | Should | After 3 failed attempts, alerts are generated and logged |
| SEC-06 | Enforce Segregation of Duties rules across financial/operational permissions | Compliance requirement | Security/Accounts | Must | Conflicting permissions cannot be assigned to same user; system blocks at assignment |

#### 2.2 Employee Bio Data

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| HR-01 | Capture employee personal and employment details | HR operations | Employee Bio Data | Must | Mandatory fields enforceable; records create/update successfully |
| HR-02 | Auto-generate unique employee IDs | HR operations | Employee Bio Data | Must | Unique ID generated on create; uniqueness verified across tenant |
| HR-03 | Store documents securely (contracts, IDs, certificates) | HR operations | Document Management | Must | Upload, view, versioning, permissions verified |
| HR-04 | Support periodic employee data update subject to approval | HR operations | Employee Bio Data/Workflow | Must | Employee edits go to pending state; HR approves before effective |

#### 2.3 Recruitment

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| REC-01 | Publish vacancies in-house and generate application URL | Recruitment process | Recruitment | Must | Vacancy generates URL; URL accessible as configured |
| REC-02 | Support token-based access and token expiry rules | Recruitment process | Recruitment | Should | Tokens validate once; unused tokens expire on deadline |
| REC-03 | Shortlist applicants based on job criteria | Recruitment process | Recruitment | Must | System produces shortlist matching configured criteria |
| REC-04 | Support configurable interview scoring templates | Recruitment process | Recruitment | Must | Templates can be created/edited; scoring totals computed |
| REC-05 | Generate interview report with averages and remarks | Recruitment process | Recruitment/Reports | Must | Report includes panel, scores, averages, remarks, exportable |

#### 2.4 Leave Management

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| LV-01 | Support multiple leave types and entitlements | HR leave policy | Leave | Must | Leave types configurable; entitlements applied correctly |
| LV-02 | Enforce annual leave entitlements by grade category | HR leave policy | Leave | Must | 28/36 day entitlements applied based on grade mapping |
| LV-03 | Enforce submission lead-time for annual leave | HR leave policy | Leave/Workflow | Should | System blocks late submissions unless emergency flagged |
| LV-04 | Enforce excuse duty max 22 days/year | HR leave policy | Leave | Must | Requests beyond threshold are blocked/flagged |
| LV-05 | Enforce carry-over limit (max 5 working days) | HR leave policy | Leave | Must | Carry-over beyond limit blocked unless approved |
| LV-06 | Provide leave planner | HR operations | Leave | Should | Employee can plan annual leave; plans tracked |
| LV-07 | Support multi-level approvals | HR operations | Workflow | Must | At least 3 stages supported; configurable |
| LV-08 | Integrate approved leave with payroll | Payroll integration | Leave/Payroll | Must | Approved leave impacts payroll calculations |

#### 2.5 Benefits, Loans & Reimbursements

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| BEN-01 | Support salary advance and special advance rules | Benefits policy | Benefits/Loans | Must | Limits and tenure enforced; deductions scheduled |
| BEN-02 | Support car loans with configured interest and tenure | Benefits policy | Benefits/Loans | Should | Interest computed; repayment schedule correct |
| BEN-03 | Validate disposable income thresholds before loan approval | Benefits policy | Benefits/Loans | Must | Disposable income check blocks non-qualifying |
| BEN-04 | Provide two-level approval (HR and Finance) | Benefits policy | Workflow | Must | Routing matches configured roles; audit trail |
| BEN-05 | Auto-post approved benefits/loans to payroll | Payroll integration | Benefits/Payroll | Must | Items appear in payroll input and deductions |

#### 2.6 Appraisal, Performance & Training

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| PERF-01 | Support appraisal cycle stages (begin/mid/end year) | HR performance process | Performance | Must | Cycle stages configurable; deadlines enforceable |
| PERF-02 | Link appraisal outcomes to increments | HR policy | Performance/Payroll | Should | Increment eligibility computed from score rules |
| PERF-03 | Capture training needs and track training programs | HR operations | Training/LMS | Should | Training needs recorded; assignments tracked |
| PERF-04 | Support probation assessments | HR operations | Performance | Should | Notifications generated; assessment forms tracked |

#### 2.7 Disciplinary & Grievance

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| DISC-01 | Categorize offences as minor/serious/major | Disciplinary policy | Disciplinary | Must | Category drives workflow |
| DISC-02 | Enforce escalation district → region → head office | Disciplinary policy | Workflow | Must | Cases escalate automatically per category |
| DISC-03 | Enforce "4th minor offence within 12 months escalates" | Disciplinary policy | Disciplinary/Workflow | Must | Fourth case triggers escalation |
| DISC-04 | Allow employee responses to queries | Disciplinary process | Employee Self-Service | Must | Employee can respond; responses visible |
| GRV-01 | Grievances start with supervisor and escalate if unresolved | Grievance process | Grievance/Workflow | Must | Escalation per configured timeline |
| GRV-02 | Allow employee to mark grievance resolved and close | Grievance process | Employee Self-Service | Should | Closure audited |

#### 2.8 Company Policies & SOPs

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| SOP-01 | Publish SOPs and policies | HR/Administration | Policy Library | Should | Documents published and searchable |
| SOP-02 | Staff acknowledge receipt of published policies | Compliance requirement | Policy Library/ESS | Should | Acknowledgement captured per user per document |

#### 2.9 Payroll Processing & Reporting

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| PAY-01 | Support salary structure configuration | Payroll operations | Payroll Config | Must | Structures configurable; used by payroll engine |
| PAY-02 | Monthly payroll runs with approvals and locking | Payroll operations | Payroll/Workflow | Must | Approval steps enforced; locked periods prevent edits |
| PAY-03 | Compute statutory deductions (PAYE, SSNIT, Tier 2/3) | Statutory rules | Payroll Engine | Must | Computations match statutory tables |
| PAY-04 | Support arrears, retro payments, adjustments, prorating | Payroll operations | Payroll Engine | Must | Scenarios compute correctly; audit trail |
| PAY-05 | Process 10,000+ employees in < 15 minutes | Performance NFR | Payroll Engine | Must | Benchmark tests pass |
| PAY-06 | Generate pay slips and core reports | Payroll reporting | Reports | Must | Reports downloadable, accurate, access-controlled |
| PAY-07 | Provide variance and reconciliation reports | Audit/Finance | Reports | Should | Variance reports reconcile |
| PAY-08 | District-level payroll validation | Payroll/HR operations | Payroll Validation/Workflow | Must | District Managers validate; flagged excluded; audit trail |

#### 2.10 Integrations & Infrastructure

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| INT-01 | Integrate with Active Directory/LDAP | IT requirement | Integrations | Should | Users authenticate via AD/LDAP when enabled |
| INT-02 | Support email integration (Microsoft Graph) | IT requirement | Integrations | Should | Email notifications delivered and logged |
| INT-03 | Support SMS integration via gateway | Business requirement | Integrations | Could | SMS sent for configured events |
| INF-01 | Deploy on-premises virtual machines | IT requirement | DevOps | Must | Deployment matches agreed topology |
| INF-02 | Provide offline support capability | Operational requirement | Platform | Should | Offline mode available; sync tested |

#### 2.11 Finance & General Ledger (v1.4)

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| FIN-01 | Maintain Chart of Accounts with hierarchy | Financial management | Finance | Must | COA configurable; account types enforced |
| FIN-02 | Support fiscal year and period management | Financial management | Finance | Must | Periods open/close correctly; only open periods accept entries |
| FIN-03 | Create and post journal entries with balancing validation | Financial management | Finance | Must | Unbalanced entries rejected; posted entries update GL |
| FIN-04 | Auto-generate GL postings from operational modules | Cross-module integration | Finance | Must | Payroll, Procurement, Inventory, Manufacturing post correctly |
| FIN-05 | Support tax type management (VAT, WHT, NHIL, etc.) | Statutory compliance | Finance | Must | Tax types configurable; applied correctly on invoices |
| FIN-06 | Support credit notes and debit notes | Financial management | Finance | Must | Notes link to original invoices; GL entries generated on approval |
| FIN-07 | Support recurring journal templates | Financial management | Finance | Should | Templates execute on schedule; entries generated correctly |
| FIN-08 | Generate financial statements (TB, IS, BS) | Financial reporting | Finance | Must | Statements balance; comparative periods supported |
| FIN-09 | Support year-end close process | Financial management | Finance | Must | Revenue/expense zeroed; retained earnings updated; next year opened |
| FIN-10 | Support budget management per GL account | Financial management | Finance | Should | Budget vs. actual comparison available; alerts functional |

#### 2.12 Procurement (v1.4)

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| PROC-01 | Maintain vendor registry with performance tracking | Procurement operations | Procurement | Must | Vendor CRUD operational; history accessible |
| PROC-02 | Support purchase requisition with approval workflow | Procurement operations | Procurement/Workflow | Must | Requisitions route through configured approvals |
| PROC-03 | Generate purchase orders from approved requisitions | Procurement operations | Procurement | Must | PO created with correct line items; status tracked |
| PROC-04 | Support vendor invoice matching (2-way/3-way) | Financial compliance | Procurement | Must | Mismatches flagged; matched invoices proceed to approval |
| PROC-05 | Support Request for Quotation (RFQ) with vendor evaluation | Procurement operations | Procurement | Should | RFQ created; vendors invited; quotes compared; award generates PO |
| PROC-06 | Maintain vendor performance scorecards | Procurement operations | Procurement | Should | Scorecards generated per period; scores tracked historically |
| PROC-07 | Support vendor blacklisting with review mechanism | Risk management | Procurement | Should | Blacklisted vendors blocked from new transactions |

#### 2.13 Inventory & Assets (v1.4)

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| INV-01 | Support multiple warehouses with stock tracking | Inventory management | Inventory | Must | Warehouse CRUD; stock levels tracked per item |
| INV-02 | Maintain item master with categorization | Inventory management | Inventory | Must | Items categorized; reorder levels configurable |
| INV-03 | Record all stock movements with ledger tracking | Inventory management | Inventory | Must | Stock entries create ledger records; GL posted |
| INV-04 | Maintain fixed asset register with depreciation | Asset management | Inventory | Must | Assets tracked; depreciation auto-calculated |
| INV-05 | Support asset disposal with GL integration | Asset management | Inventory | Must | Disposal posts gain/loss to GL correctly |
| INV-06 | Support cycle count with variance management | Inventory management | Inventory | Should | Counts recorded; variances highlighted; adjustments generated |
| INV-07 | Alert on reorder levels | Inventory management | Inventory | Should | Alerts triggered when stock below reorder level |

#### 2.14 Manufacturing (v1.4)

| Req ID | Requirement | Source | Module | Priority | Acceptance Criteria |
|--------|------------|--------|--------|----------|-------------------|
| MFG-01 | Support Bill of Materials with versioning | Manufacturing operations | Manufacturing | Must | BOM CRUD; versions tracked; only one active per product |
| MFG-02 | Define work centers with capacity and rates | Manufacturing operations | Manufacturing | Must | Work centers configurable; rates used in costing |
| MFG-03 | Support production routing linked to BOMs | Manufacturing operations | Manufacturing | Must | Routing steps defined; used as WO operation templates |
| MFG-04 | Create and manage work orders through full lifecycle | Manufacturing operations | Manufacturing | Must | WO created, released, started, completed; status tracked |
| MFG-05 | Issue materials against work orders with stock deduction | Manufacturing operations | Manufacturing/Inventory | Must | Stock entries created; inventory reduced; consumption tracked |
| MFG-06 | Record quality checks with pass/fail/conditional results | Quality management | Manufacturing | Must | QC recorded; fail increments rejected qty; pass rate reportable |
| MFG-07 | Track production batches with inventory receipts | Manufacturing operations | Manufacturing/Inventory | Must | Batches created; finished goods enter inventory |
| MFG-08 | Calculate production cost (material + labor + overhead) | Cost accounting | Manufacturing/Finance | Must | Costs calculated; variance posted; GL entries created |
| MFG-09 | Post manufacturing costs to General Ledger | Financial integration | Manufacturing/Finance | Must | WIP → Finished Goods GL posting on completion |
| MFG-10 | Provide production dashboard with KPIs | Manufacturing reporting | Manufacturing | Should | Dashboard displays active WOs, pass rate, efficiency |

---

### 3. Use Case Index

#### 3.1 HR – Employee Bio Data
- UC-HR-01: Create Employee Record
- UC-HR-02: Upload Employee Documents
- UC-HR-03: Update Employee Personal Data (Approval Required)
- UC-HR-04: Transfer/Reassignment of Employee
- UC-HR-05: Change of Bank Details (Approval Required)

#### 3.2 Recruitment
- UC-REC-01: Create Vacancy and Publish URL
- UC-REC-02: Issue One-Time Token to Candidate Group
- UC-REC-03: Candidate Submits Application with Attachments
- UC-REC-04: System Shortlists Candidates
- UC-REC-05: Schedule Interview and Notify Panel
- UC-REC-06: Panel Scores Candidate and Submits Comments
- UC-REC-07: Generate Interview Report and Recommendation
- UC-REC-08: Create Engagement and Onboarding Tasks

#### 3.3 Leave
- UC-LV-01: Employee Plans Annual Leave (Leave Planner)
- UC-LV-02: Employee Applies for Leave
- UC-LV-03: Multi-Level Leave Approval Workflow
- UC-LV-04: Leave Recall and Cancellation of Remaining Days
- UC-LV-05: Leave Rollover Request and Approval
- UC-LV-06: Leave Balance and Utilization Reporting

#### 3.4 Benefits, Loans & Reimbursements
- UC-BEN-01: Employee Applies for Salary/Special Advance
- UC-BEN-02: Employee Applies for Car Loan
- UC-BEN-03: HR/Finance Approves Benefit/Loan
- UC-BEN-04: Auto-Post Approved Loan to Payroll
- UC-BEN-05: Employee Requests Funeral Grant / Medical Lens

#### 3.5 Performance & Training
- UC-PERF-01: Set Annual Objectives and Submit for Approval
- UC-PERF-02: Mid-Year Review and Approval
- UC-PERF-03: End-Year Review and Final Rating
- UC-PERF-04: Identify Training Needs and Create Training Plan
- UC-PERF-05: Probation Assessment and Confirmation Workflow
- UC-TRN-01: Capture Training Needs from Appraisal and Department Heads
- UC-TRN-02: Assign Training Program and Notify Employee
- UC-TRN-03: Submit Post-Training Report and Impact Assessment
- UC-TRN-04: Record Training Details (Program, Cost, Venue, Organizer)
- UC-TRN-05: Generate Training Analytics and Budget Reports

#### 3.6 Disciplinary & Grievance
- UC-DISC-01: Record Offence and Notify Stakeholders
- UC-DISC-02: Issue Query and Capture Employee Response
- UC-DISC-03: Escalate Case by Category/Threshold
- UC-DISC-04: Capture Hearing Outcome and Final Report
- UC-GRV-01: Employee Submits Grievance to Supervisor
- UC-GRV-02: Supervisor Records Action Taken
- UC-GRV-03: Escalate Unresolved Grievance per SLA
- UC-GRV-04: Employee Confirms Resolution and Closes Case

#### 3.7 Payroll
- UC-PAY-01: Configure Salary Structure
- UC-PAY-02: Import Monthly Variables (Overtime/Allowances/Deductions)
- UC-PAY-03: Run Payroll Calculation
- UC-PAY-04: Payroll Review, Approval, and Lock
- UC-PAY-05: Generate Pay slips and Bank Advice
- UC-PAY-06: Generate Statutory Reports (PAYE/SSNIT/Tier 2/3)
- UC-PAY-07: Run Reconciliation and Variance Analysis
- UC-PAY-08: District Manager Validates Employee Payroll List
- UC-PAY-09: Flag Employee for Removal from Payroll with Reason
- UC-PAY-10: Review Payroll Validation Dashboard and Process Payroll

#### 3.8 Policies & SOPs
- UC-SOP-01: Publish Policy/SOP Document
- UC-SOP-02: Employee Acknowledges Policy Receipt

#### 3.9 Finance & General Ledger (v1.4)
- UC-FIN-01: Create and Post Journal Entry
- UC-FIN-02: Configure Chart of Accounts
- UC-FIN-03: Open and Close Fiscal Periods
- UC-FIN-04: Generate Trial Balance
- UC-FIN-05: Generate Income Statement and Balance Sheet
- UC-FIN-06: Create and Manage Tax Types
- UC-FIN-07: Issue Credit Note Against Invoice
- UC-FIN-08: Issue Debit Note for Additional Charges
- UC-FIN-09: Create Recurring Journal Template
- UC-FIN-10: Execute Year-End Close Process
- UC-FIN-11: Create and Monitor Budgets
- UC-FIN-12: View Auto-Generated GL Entries from Operational Modules

#### 3.10 Procurement (v1.4)
- UC-PROC-01: Create and Submit Purchase Requisition
- UC-PROC-02: Approve Purchase Requisition (Multi-Level)
- UC-PROC-03: Convert Requisition to Purchase Order
- UC-PROC-04: Create Request for Quotation (RFQ) from Requisition
- UC-PROC-05: Invite Vendors to RFQ and Record Quotations
- UC-PROC-06: Evaluate and Compare Vendor Quotations
- UC-PROC-07: Award RFQ and Generate Purchase Order
- UC-PROC-08: Record Vendor Invoice and Match to PO/Receipt
- UC-PROC-09: Approve Vendor Invoice and Post to GL
- UC-PROC-10: Process Payment Against Approved Invoice
- UC-PROC-11: Generate Vendor Performance Scorecard
- UC-PROC-12: Blacklist Vendor with Review Date

#### 3.11 Inventory & Assets (v1.4)
- UC-INV-01: Create Warehouse and Configure Stock Locations
- UC-INV-02: Create Item in Item Master
- UC-INV-03: Record Stock Entry (Receipt/Issue/Transfer/Adjustment)
- UC-INV-04: View Stock Ledger and Current Balances
- UC-INV-05: Register Fixed Asset and Configure Depreciation
- UC-INV-06: Run Depreciation Schedule
- UC-INV-07: Submit Asset Disposal Request
- UC-INV-08: Approve Asset Disposal and Post GL Entry (Gain/Loss)
- UC-INV-09: Plan and Execute Cycle Count
- UC-INV-10: Review Cycle Count Variances and Approve Adjustments
- UC-INV-11: View Reorder Alerts and Generate Requisition

#### 3.12 Manufacturing (v1.4)
- UC-MFG-01: Create Bill of Materials with Line Items
- UC-MFG-02: Create New BOM Version (Copy Existing)
- UC-MFG-03: Activate/Deactivate BOM Version
- UC-MFG-04: Define Work Center with Capacity and Rates
- UC-MFG-05: Define Production Routing for BOM
- UC-MFG-06: Create Work Order for Production
- UC-MFG-07: Release Work Order (Validate BOM and Materials)
- UC-MFG-08: Start Work Order and Begin Operations
- UC-MFG-09: Issue Materials to Work Order (Stock Deduction)
- UC-MFG-10: Record Work Order Operation Progress
- UC-MFG-11: Record Quality Check (In-Process / Final / Incoming)
- UC-MFG-12: Report Production Output and Create Batch
- UC-MFG-13: Complete Work Order and Calculate Costs
- UC-MFG-14: Post Manufacturing Costs to GL (WIP → Finished Goods)
- UC-MFG-15: View Production Dashboard and KPIs
- UC-MFG-16: Cancel or Hold Work Order

---

*End of Software Requirements Specification v1.4*
