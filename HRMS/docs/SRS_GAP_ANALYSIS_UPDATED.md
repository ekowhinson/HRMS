# Updated SRS Gap Analysis - February 2026

## Executive Summary

After comprehensive analysis of the HRMS codebase against the NHIA Software Requirements Specification, here is the updated status:

| Module | SRS Requirements | Current Implementation | Gap Status |
|--------|------------------|----------------------|------------|
| Employee Bio Data | 100% | 95% | Minor Gaps |
| Recruitment | 100% | 75% | **MEDIUM GAPS** |
| Leave Management | 100% | 90% | Minor Gaps |
| Benefits & Loans | 100% | 80% | **MEDIUM GAPS** |
| Payroll | 100% | 90% | Minor Gaps |
| Appraisal/Performance | 100% | 70% | **GAPS EXIST** |
| Discipline & Grievance | 100% | 85% | Minor Gaps |
| Company Policy | 100% | 70% | **GAPS EXIST** |
| Exit/Offboarding | 100% | 75% | **MEDIUM GAPS** |
| Employee Self-Service | 100% | 85% | Minor Gaps |
| Announcements | 100% | 60% | **GAPS EXIST** |
| Analytics Dashboard | 100% | 40% | **MAJOR GAPS** |
| User/Role Management | 100% | 95% | Minor Gaps |

---

## Detailed Gap Analysis by Module

### 1. RECRUITMENT MODULE (75% Complete)

#### Implemented Features:
- [x] Vacancy posting (internal/external)
- [x] Applicant tracking with source tracking
- [x] Interview scheduling & panel management
- [x] Interview feedback collection
- [x] Interview scoring templates
- [x] Job offers with offer letters
- [x] Shareable vacancy URLs with tokens
- [x] System-based shortlisting with criteria
- [x] Reference checking workflow
- [x] Applicant portal access

#### Missing/Incomplete per SRS:

**1.1 NHIA Standard Interview Scoring Sheets**
```
Status: PARTIAL - Generic templates exist, NHIA-specific missing
Priority: HIGH

SRS Requirement:
- Standard Recruitment Interview Form (100 points total):
  - A. Appearance (10 pts): Dress(2), Speech(1), Manner(3), Responsiveness(2), Confidence(2)
  - B. Background (20 pts): Education(10), Prof Education(4), Training(4), Social(2)
  - C. Experience (30 pts): Work Experience(10), Special Knowledge(7), Career(4), Leadership(5), Stability(4)
  - D. Intellect (30 pts): Conceptual(5), Logical(5), Comprehension(5), Analytical(5), Creativity(5), Technical(5)
  - E. Current Affairs (10 pts): Understanding(5), Appreciation(5)

- Promotion Interview Form (100 points):
  - Same structure with Annual Appraisal Score replacing Experience

- Drivers Interview Form (100 points):
  - Academic Qualification(10), Working Experience(10), Emotional Stability(10)
  - Manner(5), Speech(5), Organizational Skills(10), General Knowledge(10)
  - Communication(10), General Disposition(10), Driving Test Results(20% of DVLA)

Action: Create NHIA-specific scoring templates with exact criteria
```

**1.2 Interview Report Generation**
```
Status: PARTIAL - Basic report exists
Priority: MEDIUM

SRS Requirement:
- Panel composition list
- Average score calculation
- Individual panel scores
- Final remarks section for recruitment head
- Consensus/variance analysis

Action: Enhance InterviewReport to include full panel analysis
```

**1.3 Post-Interview Workflow Automation**
```
Status: PARTIAL
Priority: HIGH

Missing:
- Engagement letter generation (auto-populate from offer)
- Document checklist notifications:
  * Personal history form
  * Police report
  * Medical report
  * Bank account details
  * Provident fund forms
  * Tier 2 forms
- Multi-department notifications (MIS, FA, ADMIN, HR, EPFile)
- Unit head assumption date confirmation
- Prorate salary calculation from assumption date

Action: Implement post-offer onboarding automation
```

**1.4 Reference Form Auto-Send**
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

SRS Requirement:
- Auto-send reference form to previous employer email
- Track submission status
- Reference confidentiality

Action: Add email automation for reference requests
```

---

### 2. LEAVE MANAGEMENT MODULE (90% Complete)

#### Implemented Features:
- [x] All leave types (annual, maternity, sick, etc.)
- [x] Multi-level approval workflow
- [x] Location-specific workflows (District/Regional/CPC/HQ)
- [x] Leave balance tracking with accrual
- [x] Leave planning with approval
- [x] Carry forward with limits
- [x] Leave recall
- [x] Reliever assignment

#### Missing/Incomplete per SRS:

**2.1 Specific Leave Rules**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirements to verify:
- Maternity: 84 days normal, 98 days abnormal, 42 days baby loss
- Paternity: 5 working days
- Excuse Duty: Max 22 days/year, max 1 month continuous
- Sick Leave: 1/2 salary after 12 months, 1/3 after 18 months
- Leave of Absence: Once in 5 years, max 1 year
- Compassionate: Max 5 days (after annual exhausted)
- Casual Leave: Max 5 days (probation only, deducted from annual)
- Disembarkation: 2 working days after return from travel

Action: Verify leave type configurations match SRS exactly
```

**2.2 Q4 Balance Reminder**
```
Status: NEEDS VERIFICATION
Priority: LOW

SRS Requirement:
- Reminder at beginning of last quarter about outstanding balance
- Carry forward request deadline: end of last quarter

Action: Verify automated reminder functionality
```

**2.3 Reliever On-Duty Validation**
```
Status: MODEL EXISTS - Verify implementation
Priority: MEDIUM

SRS Requirement:
- System must validate reliever is not on leave
- Block approval if reliever unavailable

Action: Verify LeaveRelieverValidation is enforced in approval workflow
```

---

### 3. BENEFITS & LOANS MODULE (80% Complete)

#### Implemented Features:
- [x] Loan types with eligibility rules
- [x] Loan accounts with repayment schedules
- [x] Funeral grants by beneficiary type
- [x] Medical lens (2-year eligibility)
- [x] Professional subscriptions
- [x] Third-party deductions (credit union, student loan, rent)
- [x] Expense reimbursement

#### Missing/Incomplete per SRS:

**3.1 Salary/Special Advance Cooldown**
```
Status: NEEDS VERIFICATION
Priority: HIGH

SRS Requirement:
- Salary Advance: 1 month gross, 12 months repayment, no interest
  * NEW application only 12 months AFTER LAST DEDUCTION
- Special Advance: 2 months basic, 24 months repayment, no interest
  * NEW application only 12 months AFTER LAST DEDUCTION

Action: Verify cooldown enforcement from last deduction date
```

**3.2 Car Loan Interest Calculation**
```
Status: PARTIAL
Priority: HIGH

SRS Requirement:
- Up to 6 years tenure
- 6% reducing balance interest
- Monthly and yearly interest reports

Action: Verify 6% reducing balance implementation
```

**3.3 Vehicle Maintenance Allowance & Fuel**
```
Status: NOT IMPLEMENTED
Priority: LOW

SRS Requirement:
- Vehicle maintenance allowance
- Fuel allowance

Action: Add as benefit types
```

**3.4 Additional 6.5% PF Contribution Option**
```
Status: NOT IMPLEMENTED
Priority: LOW

SRS Requirement:
- Allow employees to opt for additional 6.5% provident fund

Action: Add as optional employee transaction
```

**3.5 Credit Union Savings/Shares Tracking**
```
Status: PARTIAL - Model exists
Priority: MEDIUM

SRS Requirement:
- Track savings contributions
- Track share purchases

Action: Verify CreditUnionAccount tracks both savings and shares
```

---

### 4. PAYROLL MODULE (90% Complete)

#### Implemented Features:
- [x] Ghana PAYE calculation
- [x] SSNIT Tier 1/2/3
- [x] Overtime & bonus tax
- [x] Salary structures by grade
- [x] Bank file generation
- [x] Payslip generation
- [x] Multi-level approval

#### Missing/Incomplete per SRS:

**4.1 Missing Payroll Reports**
```
Status: PARTIAL
Priority: MEDIUM

SRS Required Reports (verify existence):
- [ ] Reconciliation/Movement Report
- [ ] Internal Car Loan Deductions Report
- [ ] Salary/Special Advance Deductions Report
- [ ] Monthly Interest (Internal Car Loan) Report
- [ ] Yearly Interest (Internal Car Loan) Report
- [ ] PAWU Dues Report
- [ ] UNICOF Dues Report
- [ ] Credit Union Contribution Report
- [ ] Credit Union Loan Deductions Report
- [ ] Credit Union Loan Summary Report
- [ ] Student Loan Report
- [ ] Student Loan Summary
- [ ] Rent Deductions Report
- [ ] Audit Trail Report
- [ ] Payroll Journal
- [ ] Variance Report
- [ ] Shares Report

Action: Implement missing report types
```

**4.2 Payslip YTD Display**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- PF and Credit Union on payslip show current month AND YTD
- YTD resets every year

Action: Verify payslip includes YTD values
```

---

### 5. APPRAISAL/PERFORMANCE MODULE (70% Complete)

#### Implemented Features:
- [x] Appraisal cycles with phases
- [x] Goal setting
- [x] Competency assessment
- [x] Rating scales
- [x] Peer feedback
- [x] Performance improvement plans
- [x] Development plans

#### Missing/Incomplete per SRS:

**5.1 Core Values Assessment**
```
Status: MODEL EXISTS - Frontend may be incomplete
Priority: HIGH

SRS Requirement:
- Appraisal has THREE components:
  1. Performance Objectives
  2. Core Competencies
  3. Core Values ← May be missing in UI

Action: Verify Core Values tab in appraisal form
```

**5.2 Probation Assessment Workflow**
```
Status: MODEL EXISTS - Verify completeness
Priority: HIGH

SRS Requirement:
- Assessment at 3 months
- Assessment at 6 months
- Assessment at 12 months (Directors only)
- Notification to line manager AND HR head office
- Supervisor-employee goal setting
- Confirmation workflow

Action: Verify full probation assessment implementation
```

**5.3 LMS Integration for Training Needs**
```
Status: NOT IMPLEMENTED
Priority: LOW (Future)

SRS Requirement:
- Link appraisal to LMS for training needs
- Training assignment from appraisal

Action: Placeholder for future LMS integration
```

**5.4 Appraisal-Increment Linkage**
```
Status: NEEDS VERIFICATION
Priority: HIGH

SRS Requirement:
- Link appraisal to increments based on:
  * Timelines
  * Scores
  * Level of achievement

Action: Verify increment eligibility based on appraisal scores
```

---

### 6. DISCIPLINE & GRIEVANCE MODULE (85% Complete)

#### Implemented Features:
- [x] Misconduct categories (minor/serious/major)
- [x] Disciplinary case workflow
- [x] Investigation tracking
- [x] Show cause letters
- [x] Hearing management
- [x] Appeal process

#### Missing/Incomplete per SRS:

**6.1 Location-Based Escalation**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- District: 3 minor → escalate to Region
- Region: After final warning → escalate to Head Office
- Head Office: Disciplinary Committee referral
- 12-month expiry on minor offenses

Action: Verify escalation rules are enforced
```

**6.2 Grievance SLA Tracking**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- 21 days with immediate supervisor
- 14 days with Head of Division
- 14 days with DCE Admin/HR
- 21 days with CEO
- Escalation to Union after CEO

Action: Verify grievance SLA tracking
```

---

### 7. COMPANY POLICY MODULE (70% Complete)

#### Implemented Features:
- [x] Policy/SOP creation
- [x] Policy categories
- [x] Version control
- [x] Publishing workflow

#### Missing/Incomplete per SRS:

**7.1 Policy Acknowledgement Tracking**
```
Status: NEEDS VERIFICATION
Priority: HIGH

SRS Requirement:
- Staff read and acknowledge receipt
- Acknowledgement tracking per employee
- Acknowledgement report

Action: Verify PolicyAcknowledgement model and UI implementation
```

**7.2 New Policy Notifications**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- Staff notification on new/updated policies

Action: Verify notification system for policy updates
```

---

### 8. EXIT/OFFBOARDING MODULE (75% Complete)

#### Implemented Features:
- [x] Exit types (resignation, retirement, termination)
- [x] Exit request workflow
- [x] Notice period tracking
- [x] Clearance workflow

#### Missing/Incomplete per SRS:

**8.1 Asset Return Checklist**
```
Status: NEEDS VERIFICATION
Priority: HIGH

SRS Requirement:
- ID Card
- Laptop/Computer
- Phone
- Keys
- Documents
- Uniform
- Vehicle

Action: Verify asset return tracking in clearance
```

**8.2 Department Clearance Workflow**
```
Status: PARTIAL
Priority: HIGH

SRS Requirement:
- IT (system access removal)
- Finance (outstanding advances/loans)
- HR (final settlement)
- Admin (assets)
- Department Head (handover)

Action: Verify multi-department clearance implementation
```

**8.3 Final Settlement Calculation**
```
Status: NEEDS VERIFICATION
Priority: HIGH

SRS Requirement:
- Calculate final settlement
- Outstanding loan recovery
- Severance calculation
- Workman's compensation

Action: Verify final settlement automation
```

**8.4 Exit Interview Capture**
```
Status: MODEL EXISTS - Verify UI
Priority: MEDIUM

SRS Requirement:
- Capture feedback
- Capture suggestions
- Capture reasons for leaving

Action: Verify exit interview form in UI
```

---

### 9. SELF-SERVICE PORTAL (85% Complete)

#### Implemented Features:
- [x] Profile viewing
- [x] Leave application
- [x] Leave planning
- [x] Data update requests
- [x] Service requests
- [x] Appraisal participation

#### Missing/Incomplete per SRS:

**9.1 HR Service Request SLA**
```
Status: MODEL EXISTS - Verify UI
Priority: MEDIUM

SRS Requirement:
- "Request received, expect response within 10 working days"
- Color coding:
  * Green: Within 10 days
  * Amber: 3-10 days remaining
  * Red: After 10 days (overdue)
- Auto-close after resolution notification (2 days)

Action: Verify SLA tracking and color coding in UI
```

**9.2 Resignation Submission**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- Self-service resignation submission
- Links to exit workflow

Action: Verify portal includes resignation feature
```

**9.3 Workman's Compensation Request**
```
Status: NOT IMPLEMENTED
Priority: LOW

SRS Requirement:
- Request for workman's compensation through portal

Action: Add as service request type
```

---

### 10. ANNOUNCEMENTS MODULE (60% Complete)

#### Implemented Features:
- [x] AnnouncementsPage exists
- [x] Basic announcement management

#### Missing/Incomplete per SRS:

**10.1 Targeted Announcements**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- Company-wide announcements
- Targeted by department
- Targeted by region
- Targeted by role
- Priority levels (Normal, Important, Urgent)

Action: Verify targeting capabilities
```

**10.2 Read Tracking**
```
Status: NEEDS VERIFICATION
Priority: MEDIUM

SRS Requirement:
- Track which employees have read announcements
- Dashboard widget for new announcements

Action: Verify read tracking implementation
```

**10.3 Scheduled Publishing**
```
Status: NEEDS VERIFICATION
Priority: LOW

SRS Requirement:
- Schedule announcements for future publishing

Action: Verify scheduled publishing
```

---

### 11. ANALYTICS DASHBOARD (40% Complete) - **MAJOR GAPS**

#### Implemented Features:
- [x] Basic dashboard with employee count
- [x] Leave stats
- [x] Payroll summary

#### Missing KPIs per SRS:

**11.1 Recruitment Analytics**
```
Status: NOT IMPLEMENTED
Priority: HIGH

Required KPIs:
- FTE count (active: present, seconded, study leave with pay)
- Hiring rate (new hires per quarter)
- Attrition rate per annum
- Cost per hire
- Offer acceptance rate
- Workforce growth rate
- Vacancies (internal vs external)
```

**11.2 Employee Demographics**
```
Status: PARTIAL
Priority: HIGH

Required KPIs:
- Age distribution
- Gender ratio
- Location distribution (HO/RO/CPC/Districts)
- Educational level breakdown
- Tenure (length of service)
- Grade distribution
- Disability count
```

**11.3 Training Analytics**
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Required KPIs:
- Training completion rate per Directorate
- Staff trained (local vs foreign)
- Training cost per employee/location
- Training cost vs budget
```

**11.4 Performance Analytics**
```
Status: PARTIAL
Priority: HIGH

Required KPIs:
- PMS completion rate
- High vs low performers
- Average score per Directorate/Region
- Staff on probation count
```

**11.5 Compensation Analytics**
```
Status: PARTIAL
Priority: HIGH

Required KPIs:
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

**11.6 Exit Analytics**
```
Status: NOT IMPLEMENTED
Priority: MEDIUM

Required KPIs:
- Turnover rate
- Exit breakdown (retired, resigned, terminated, dismissed, deceased)
- Monthly and YTD tracking
```

**11.7 Master Dashboard**
```
Status: PARTIAL
Priority: HIGH

Required KPIs:
- Total staff count ✓
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

## Implementation Priority

### Phase 1: Critical Gaps (Weeks 1-2)
1. **Dashboard Analytics** - Add missing KPIs (HIGH IMPACT)
2. **Interview Scoring Templates** - NHIA standard forms
3. **Core Values Assessment** - Verify/complete in appraisal UI
4. **Exit Clearance Workflow** - Department clearance completion

### Phase 2: Process Improvements (Weeks 3-4)
5. **Payroll Reports** - Add missing report types
6. **Policy Acknowledgement** - Verify tracking UI
7. **Announcement Targeting** - Verify/enhance
8. **HR Service Request SLA** - Color coding in UI

### Phase 3: Verification & Polish (Weeks 5-6)
9. **Leave Type Rules** - Verify exact SRS compliance
10. **Loan Cooldown** - Verify 12-month enforcement
11. **Recruitment Post-Offer** - Document checklist automation
12. **Probation Assessment** - Verify full workflow

---

## Next Steps

1. Create detailed technical tickets for Phase 1 items
2. Begin implementation of Dashboard Analytics
3. Create NHIA interview scoring templates
4. Verify and enhance Core Values in appraisal
5. Complete exit clearance workflow

---

*Document generated: February 2026*
*Analysis based on codebase exploration and SRS comparison*
