# SRS Gap Analysis & Implementation Plan

## Overview

This document compares the Software Requirements Specification (SRS) with the current HRMS implementation to identify gaps, improvements, and new modules needed.

---

## Executive Summary

| Category | Status | Priority |
|----------|--------|----------|
| Employee Bio Data | 95% Complete | Low |
| Recruitment | 40% Complete | **HIGH** |
| Leave Management | 75% Complete | Medium |
| Benefits & Loans | 50% Complete | **HIGH** |
| Payroll | 85% Complete | Medium |
| Appraisal/Performance | 80% Complete | Medium |
| Discipline & Grievance | 90% Complete | Low |
| Company Policy | **NOT IMPLEMENTED** | **HIGH** |
| Exit/Offboarding | **NOT IMPLEMENTED** | **HIGH** |
| Employee Self-Service | 60% Complete | Medium |
| Announcements | **NOT IMPLEMENTED** | Medium |
| Analytics Dashboard | 50% Complete | Medium |

---

## 1. RECRUITMENT MODULE GAPS (HIGH PRIORITY)

### Current State
- Basic vacancy posting
- Applicant tracking
- Interview scheduling
- Job offers

### Missing Features from SRS

#### 1.1 Vacancy Publication System
```
Status: NOT IMPLEMENTED
Priority: HIGH

Requirements:
- Generate public URL for vacancy posting
- One-time token URLs for specific groups
- General URLs without token restrictions
- Token expiration on deadline or successful hire
- Link to organization website
```

#### 1.2 System-Based Shortlisting
```
Status: NOT IMPLEMENTED
Priority: HIGH

Requirements:
- Auto-shortlist based on job description criteria
- Qualification matching
- Experience matching
- Generate list of qualified applicants for HR
```

#### 1.3 Interview Scoring Sheets
```
Status: PARTIAL (basic feedback exists)
Priority: HIGH

Requirements:
- Standard Recruitment Interview Form (100 points)
  - Appearance (10 pts): Dress, Speech, Manner, Responsiveness, Confidence
  - Background (20 pts): Education, Professional Education, Training, Social
  - Experience (30 pts): Work Experience, Special Knowledge, Career, Leadership, Stability
  - Intellect (30 pts): Conceptual, Logical, Comprehension, Analytical, Creativity, Technical
  - Current Affairs (10 pts): Understanding, Appreciation

- Promotion Interview Form (100 points)
  - Similar structure with Annual Appraisal Score replacing Experience

- Drivers Interview Form (100 points)
  - Includes DVLA driving test results (20%)
  - Organizational skills, communication, disposition

- Interview Report Template
  - Panel composition
  - Average score calculation
  - Observations and recommendations
```

#### 1.4 Employment Reference System
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Requirements:
- Reference form sent to previous employer
- Criteria rating (Intellectual, Analytical, Leadership, etc.)
- Rehire recommendation
- Weaknesses/strengths assessment
- Confidential submission directly to HR
```

#### 1.5 Post-Interview Workflow
```
Status: PARTIAL
Priority: HIGH

Requirements:
- Engagement letter generation
- Acceptance letter upload from candidate
- Document checklist notification:
  - Personal history form
  - Police report
  - Medical report
  - Bank account details
  - Provident fund forms
  - Tier 2 forms
- Unit head confirmation of assumption date
- Multi-department notifications (MIS, FA, ADMIN, HR, EPFile)
- Active Directory credentials creation info
- Salary proration from assumption date
```

---

## 2. LEAVE MANAGEMENT GAPS (MEDIUM PRIORITY)

### Current State
- Leave types with accrual
- Leave requests and approvals
- Leave balance tracking
- Leave documents

### Missing Features from SRS

#### 2.1 Leave Planner
```
Status: NOT IMPLEMENTED
Priority: HIGH

Requirements:
- Mandatory annual leave planning at year start
- Plan approval workflow
- Calendar visualization of planned vs actual
```

#### 2.2 Location-Based Approval Workflow
```
Status: PARTIAL (basic approval exists)
Priority: MEDIUM

Requirements per SRS:
DISTRICT:
- Staff → District Manager (notify Regional HR)
- Line Manager → District Manager (notify Regional HR)
- District Manager → Regional Director (notify Regional HR)

REGIONAL:
- Officers → Unit Head (notify Regional HR + Director)
- Managers → Regional Director (notify Regional HR)
- Regional Director → Director MRO (notify Regional HR)

CPC (Claims Processing Centers):
- Officers → Supervisors (notify CPC Director, CPC HR)
- Managers → Deputy Director Claims (notify CPC HR)
- Deputy Director → Director Claims (notify CPC HR)

HEAD OFFICE:
- Officers → Unit Head
- Managers → Deputy Directors
- Deputy Directors → Directors
- Directors → DCE (Admin/HR, Finance, Operations)
- DCEs → CEO

STANDALONE:
- Internal Audit, Actuarial, Board Secretary → CEO
```

#### 2.3 Leave Types Enhancements
```
Status: PARTIAL
Priority: MEDIUM

Missing specifics:
- Maternity: 84 days normal, 98 days abnormal, 42 days baby loss
- Paternity: 5 working days (pending approval)
- Excuse Duty: Max 22 days/year, max 1 month continuous
- Sick Leave: Extended rules (1/2 salary after 12 months, 1/3 after 18 months)
- Leave of Absence: Once in 5 years, max 1 year, 3 years service required
- Compassionate: Max 5 days (after annual leave exhausted)
- Casual Leave: Max 5 days, deducted from annual (probation only)
- Disembarkation Leave: 2 working days after return from travel
```

#### 2.4 Leave Rollover & Recall
```
Status: PARTIAL
Priority: MEDIUM

Requirements:
- Max 5 days carry-over to January
- Rollover requires CEO approval
- Reminder in Q4 about outstanding balance
- Rollover request deadline: end of last quarter
- Leave recall with remaining days cancellation option
```

#### 2.5 Reliever Validation
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Requirements:
- Reliever must be on duty (not on leave)
- System validation before approval
```

---

## 3. BENEFITS & REIMBURSEMENTS GAPS (HIGH PRIORITY)

### Current State
- Basic benefit types
- Loan management with schedules
- Expense claims

### Missing Features from SRS

#### 3.1 Salary & Special Advance
```
Status: PARTIAL (loans exist, specific rules missing)
Priority: HIGH

Requirements:
- Salary Advance: 1 month gross, 12 months repayment, no interest
  - New application only 12 months after last deduction
- Special Advance: 2 months basic, 24 months repayment, no interest
  - New application only 12 months after last deduction
- Auto-post to payroll on approval
```

#### 3.2 Car Loans
```
Status: PARTIAL
Priority: HIGH

Requirements:
- Internal car loans: Up to 6 years tenure
- 6% reducing balance interest
- Auto-deduction through payroll
- Monthly and yearly interest reports
```

#### 3.3 Medical Lens
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Requirements:
- Paid once every 2 years
- Track eligibility based on last claim
```

#### 3.4 Funeral Grants
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Requirements:
- Request per beneficiary type
- Based on employee's registered beneficiaries
- Maximum 3 children eligible
- One-time request per beneficiary
```

#### 3.5 Professional Subscription
```
Status: NOT IMPLEMENTED
Priority: LOW

Requirements:
- Annual subscription approval
- Reimbursement for professional body memberships
```

#### 3.6 Personal Loans
```
Status: PARTIAL
Priority: MEDIUM

Requirements:
- Disposable income check before approval
- Monthly deduction must fall within threshold
- Top-up handling: Must terminate existing loan with evidence
- Apply fresh with top-up details
```

#### 3.7 Third-Party Loan Tracking
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Requirements:
- Track external loans with payroll deductions
- Credit union loans
- Student loans
- Rent deductions (Ministry of Works & Housing - 10%)
```

#### 3.8 Additional Benefits
```
Status: NOT IMPLEMENTED
Priority: LOW

Requirements:
- Vehicle Maintenance Allowance & Fuel
- Credit Union Savings/Shares
- Additional 6.5% PF Contribution option
```

---

## 4. COMPANY POLICY MODULE (NEW - HIGH PRIORITY)

### Current State
**NOT IMPLEMENTED**

### Required Features

```
Priority: HIGH

Models Needed:
- Policy (title, content, version, effective_date, category)
- PolicyVersion (for version history)
- PolicyAcknowledgement (employee, policy, acknowledged_at, ip_address)
- SOP (Standard Operating Procedure)

Features:
- Create and publish SOPs and Policies
- Version control
- Staff notification on new/updated policies
- Read and acknowledge receipt tracking
- Acknowledgement reports
- Category management (HR, Finance, Operations, IT, etc.)
```

---

## 5. EXIT/OFFBOARDING MODULE (NEW - HIGH PRIORITY)

### Current State
**NOT IMPLEMENTED** (only employee status change to Terminated)

### Required Features

```
Priority: HIGH

Models Needed:
- ExitType (Resignation, Retirement, Termination, Dismissal, Death, End of Contract)
- ExitRequest (employee, type, requested_date, reason)
- ExitInterview (feedback, suggestions, reasons for leaving)
- ExitChecklist (clearance items)
- ExitClearance (department clearances)
- AssetReturn (assets to be returned)

Features:
- Resignation submission and approval
- Retirement processing (voluntary, medical, mandatory)
- Exit interview capture
- Asset clearance checklist:
  - ID Card
  - Laptop/Computer
  - Phone
  - Keys
  - Documents
  - Uniform
  - Vehicle
- Department clearance workflow:
  - IT (system access removal)
  - Finance (outstanding advances/loans)
  - HR (final settlement)
  - Admin (assets)
  - Department Head (handover)
- Final settlement calculation
- Workman's compensation handling
- Notice period tracking
- Severance calculation
```

---

## 6. EMPLOYEE SELF-SERVICE GAPS (MEDIUM PRIORITY)

### Current State
- Basic self-service portal
- Leave application
- Profile viewing

### Missing Features from SRS

#### 6.1 Data Update Requests
```
Status: NOT IMPLEMENTED
Priority: HIGH

Requirements:
- Employee submits profile updates
- HR reviews and approves changes
- Supporting document attachment
- Changes applied only after approval

Update Types:
- Bank Details Change
- Name Change
- Address Update
- Emergency Contact Update
- Dependent Update
```

#### 6.2 HR Service Requests
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Request Types:
- Introductory Letter
- Voluntary Transfer
- Study Leave with Pay
- Sponsorship Request
- Training Request
- Staff Petitions
- General HR Complaints

Features:
- Auto-response: "Request received, expect response within 10 working days"
- Status tracking with color coding:
  - Green: Within 10 days
  - Amber: 3-10 days remaining
  - Red: Overdue (> 10 days)
- Complaint filing after no response
- Auto-close after resolution notification (2 days)
- Location-based routing (District → Regional HR, etc.)
```

---

## 7. ANNOUNCEMENTS MODULE (NEW - MEDIUM PRIORITY)

### Current State
**NOT IMPLEMENTED**

### Required Features

```
Priority: MEDIUM

Models Needed:
- Announcement (title, content, priority, start_date, end_date)
- AnnouncementTarget (all, department, location, role)
- AnnouncementRead (employee tracking)

Features:
- Company-wide announcements
- Targeted announcements (department, region, role)
- Priority levels (Normal, Important, Urgent)
- Scheduled publishing
- Read tracking
- Dashboard widget
```

---

## 8. ANALYTICS & DASHBOARD GAPS (MEDIUM PRIORITY)

### Current State
- Basic dashboard with employee count
- Leave stats
- Payroll summary

### Missing KPIs from SRS

#### 8.1 Recruitment Analytics
```
- FTE (Full-Time Equivalent) count
- Hiring rate (new hires per quarter)
- Attrition rate per annum
- Cost per hire
- Offer acceptance rate
- Workforce growth rate
- Vacancies (internal vs external)
```

#### 8.2 Employee Demographics
```
- Age distribution
- Gender ratio
- Location distribution (HO/RO/CPC/Districts)
- Educational level breakdown
- Tenure (length of service)
- Grade distribution
- Disability (differently abled) count
```

#### 8.3 Training Analytics
```
- Training completion rate per Directorate
- Staff trained (local vs foreign)
- Training cost per employee/location
- Training cost vs budget
```

#### 8.4 Performance Analytics
```
- PMS completion rate
- High vs low performers
- Average score per Directorate/Region
- Staff on probation count
```

#### 8.5 Compensation Analytics
```
- Total payroll cost (monthly/YTD)
- Payroll cost vs budget
- Average salary per staff
- Average salary per location
- Payroll cost variance
- Leave utilization trend
- Sick leave/medical excuse trend
- Maternity leave count
- Severance cost per year
```

#### 8.6 Exit Analytics
```
- Turnover rate
- Exit breakdown (retired, resigned, terminated, dismissed, deceased)
- Monthly and YTD tracking
```

#### 8.7 Master Dashboard
```
- Total staff count
- Promotions count and rate
- Transfers (voluntary vs non-voluntary)
- Total emolument (monthly/YTD)
- Attrition rate
- Payroll variance
- Payroll cost by Directorate
- Staff due for retirement (current year)
- Retiring soon (5 years and below)
- Workforce growth rate
```

---

## 9. PAYROLL REPORT GAPS (MEDIUM PRIORITY)

### Current State
- Payslips
- Bank schedules
- SSNIT/PAYE reports

### Missing Reports from SRS

```
- Reconciliation/Movement Report (variance analysis)
- Internal Car Loan Deductions Report
- Salary/Special Advance Deductions Report
- Monthly Interest (Internal Car Loan)
- Yearly Interest (Internal Car Loan)
- PAWU Dues Report
- UNICOF Dues Report
- Credit Union Contribution Report
- Credit Union Loan Deductions Report
- Credit Union Loan Summary Report
- Student Loan Report
- Student Loan Summary
- Rent Deductions Report
- Audit Trail Report
- Payroll Journal
- Variance Report
- Shares Report
```

---

## 10. SECURITY ENHANCEMENTS (MEDIUM PRIORITY)

### Current State
- 2FA implemented
- Session tracking
- Authentication logging

### Missing Features

```
- Email alerts for failed login attempts (3 attempts) by key roles
- Role-specific security notifications
- Data retention policy enforcement (7 years)
```

---

## 11. INTEGRATION REQUIREMENTS (FUTURE)

### Current State
- Email via SMTP
- Basic API

### Future Integrations from SRS

```
Priority: LOW (Phase 2)

- SMS Gateway integration
- Microsoft Graph API (Email)
- Active Directory/LDAP authentication
- LMS (Learning Management System) integration
- Custom API connectors
```

---

## Implementation Phases

### Phase 1: Critical Modules (Weeks 1-4)
1. **Company Policy Module** - New
2. **Exit/Offboarding Module** - New
3. **Benefits Enhancements** - Salary/Special Advance, Car Loans
4. **Recruitment Scoring Sheets** - Interview forms

### Phase 2: Process Improvements (Weeks 5-8)
5. **Leave Planner** - Mandatory annual planning
6. **Employee Self-Service Requests** - Data updates, HR requests
7. **Announcements Module** - New
8. **Recruitment Workflow** - Post-interview automation

### Phase 3: Analytics & Reporting (Weeks 9-12)
9. **Dashboard KPIs** - All analytics modules
10. **Payroll Reports** - Missing reports
11. **Leave Approval Workflow** - Location-based

### Phase 4: Advanced Features (Weeks 13-16)
12. **Recruitment URL System** - Token-based URLs
13. **System Shortlisting** - Auto-qualification matching
14. **Integration Preparation** - API foundations

---

## Priority Implementation Order

| # | Feature | Priority | Effort | Impact |
|---|---------|----------|--------|--------|
| 1 | Company Policy Module | HIGH | Medium | HIGH |
| 2 | Exit/Offboarding Module | HIGH | High | HIGH |
| 3 | Salary/Special Advance | HIGH | Low | HIGH |
| 4 | Interview Scoring Sheets | HIGH | Medium | HIGH |
| 5 | Leave Planner | MEDIUM | Medium | HIGH |
| 6 | Employee Data Update Requests | MEDIUM | Medium | MEDIUM |
| 7 | Announcements Module | MEDIUM | Low | MEDIUM |
| 8 | Dashboard KPIs | MEDIUM | High | HIGH |
| 9 | HR Service Requests | MEDIUM | Medium | MEDIUM |
| 10 | Payroll Reports | MEDIUM | Medium | MEDIUM |

---

## Next Steps

1. Review this gap analysis with stakeholders
2. Prioritize based on business needs
3. Create detailed technical specifications for Phase 1
4. Begin implementation of Company Policy and Exit modules

