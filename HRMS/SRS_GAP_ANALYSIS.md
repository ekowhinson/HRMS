# SRS Gap Analysis: ERP, Payroll & HRMS

**Generated:** 2026-02-12
**SRS Document:** ERP-HRMS-SRS-2026-001 v1.0
**Analysis Scope:** All 27 SRS sections vs. implemented codebase

---

## Summary

The system has **strong model/schema coverage** across all 20 Django apps, but most **cross-module integration logic**, **business rule enforcement**, and **non-functional requirements** remain unimplemented. The new ERP modules (Finance, Procurement, Inventory, Projects) have complete CRUD scaffolding (models, serializers, views, URLs, admin, frontend pages) but lack the business logic that connects them.

- **120+ frontend pages** across all modules
- **80+ Django models** across 20 apps
- **37 frontend API services**
- **All 4 new ERP apps** registered, migrated, and wired up

---

## Section 5: Human Resource Management (Enhance)

| Req ID | Requirement | Status | Gap |
|--------|-------------|--------|-----|
| FR-HR-ERP-001 | Add `cost_center` and `project` FK to Employee | **Partial** | `cost_center` FK exists. `project` FK missing. |
| FR-HR-ERP-002 | Employee as single source of truth across all modules | **Done** | All new modules FK to Employee. |
| FR-HR-ERP-003 | Add `budget_holder` flag and `spending_limit` | **Missing** | Neither field exists on Employee model. |
| FR-HR-ERP-004 | Employee termination triggers asset recovery workflow | **Missing** | No signal/task connecting exits app to inventory/assets. |
| FR-HR-ERP-005 | Department change triggers cost center reallocation | **Missing** | No signal/task for this. |
| FR-HR-ERP-006 | `employee_type` filter across new modules | **Partial** | New modules have employee FK but no employment_type filtering. |
| FR-HR-ERP-007 | Self-service: expense claims, asset requests, timesheets | **Partial** | Expense claims in benefits, timesheets in projects. Asset requests not in self-service. |

---

## Section 6: Payroll & Compensation (Finance Integration)

| Req ID | Requirement | Status | Gap |
|--------|-------------|--------|-----|
| FR-PAY-FIN-001 | Payroll run auto-generates GL journal entries | **Stub** | Celery task exists but body is TODO. |
| FR-PAY-FIN-002 | PayComponent maps to configurable GL account | **Missing** | No `gl_account` field on PayComponent. |
| FR-PAY-FIN-003 | Journal entries posted per cost center | **Missing** | Depends on FR-PAY-FIN-001. |
| FR-PAY-FIN-004 | SSNIT remittance through AP module | **Missing** | No integration. |
| FR-PAY-FIN-005 | Payroll-GL reconciliation report | **Missing** | No cross-reference. |
| FR-PAY-FIN-006 | Bank file integration with treasury | **Missing** | Not linked to finance. |
| FR-PAY-FIN-007 | Loan disbursements/recoveries in GL | **Missing** | No GL posting for loans. |
| FR-PAY-FIN-008 | Benefits accrual in GL | **Missing** | No accrual logic. |

---

## Section 7: Recruitment (Enhance)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Link vacancy budgets to finance | **Missing** | `budget_code` CharField, no FK to Budget. |
| Cost-per-hire tracking | **Missing** | No cost tracking. |
| Auto-create employee across modules on hire | **Missing** | No post-hire trigger. |

---

## Section 8: Performance Management (Enhance)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Performance ratings feed salary increments | **Missing** | No automated link. |
| Training budget linked to finance | **Missing** | No budget FK. |
| Training costs as GL expense | **Missing** | No GL posting. |

---

## Section 9: Leave & Attendance (Enhance)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Leave accrual liability posted to GL | **Missing** | |
| Leave encashment through payroll with GL | **Missing** | |
| Attendance feeds project timesheets | **Missing** | No attendance system. |

---

## Section 10: Benefits & Loans (Enhance)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Loan accounts in GL | **Missing** | |
| Expense claims routed through AP | **Missing** | |
| Benefit provisions in GL | **Missing** | |
| Third-party remittances through AP | **Missing** | |

---

## Section 12: Financial Management & Accounting

### 12.1 General Ledger

| Req ID | Requirement | Status | Gap |
|--------|-------------|--------|-----|
| FR-FIN-GL-001 | Hierarchical Chart of Accounts | **Done** | |
| FR-FIN-GL-002 | Multi-dimensional journal entries | **Partial** | Missing department, project, fund_source on JournalLine. |
| FR-FIN-GL-003 | Fiscal year/period open/close | **Done** | |
| FR-FIN-GL-004 | Auto journal from sub-ledgers | **Stub** | Tasks exist as stubs. |
| FR-FIN-GL-005 | Recurring journals with auto-reversal | **Missing** | |
| FR-FIN-GL-006 | Year-end closing with retained earnings | **Missing** | |
| FR-FIN-GL-007 | Financial statements (TB, BS, IS, CF) | **Partial** | TB + IS done. BS + CF missing. |
| FR-FIN-GL-008 | Multi-currency with exchange rates | **Partial** | Model exists, no conversion logic. |
| FR-FIN-GL-009 | Intercompany transactions | **Missing** | |
| FR-FIN-GL-010 | Complete GL audit trail | **Done** | |

### 12.2 Accounts Payable

| Req ID | Requirement | Status | Gap |
|--------|-------------|--------|-----|
| FR-FIN-AP-001 | Vendor invoice + OCR | **Partial** | Model exists, no OCR. |
| FR-FIN-AP-002 | 3-way matching (PO-GRN-Invoice) | **Missing** | |
| FR-FIN-AP-003 | Payment run management | **Partial** | Model exists, no batch runs. |
| FR-FIN-AP-004 | AP aging reports | **Missing** | |
| FR-FIN-AP-005 | Invoice approval workflow | **Missing** | |
| FR-FIN-AP-006 | Withholding tax (GRA) | **Missing** | |
| FR-FIN-AP-007 | Vendor credit/debit notes | **Missing** | |
| FR-FIN-AP-008 | SSNIT/SLTF remittance integration | **Missing** | |

### 12.3 Accounts Receivable

| Requirement | Status | Gap |
|-------------|--------|-----|
| Customer master | **Done** | |
| Invoice generation | **Done** | |
| Payment allocation | **Partial** | No auto-matching. |
| AR aging reports | **Missing** | |
| Revenue recognition (IFRS) | **Missing** | |
| Dunning/reminder process | **Missing** | |

### 12.4 Banking & Treasury

| Requirement | Status | Gap |
|-------------|--------|-----|
| Bank account management | **Done** | |
| Automated bank reconciliation | **Partial** | Models exist, no auto-matching. |
| Cash flow forecasting | **Missing** | |
| Petty cash management | **Missing** | |

### 12.5 Budgeting & Cost Control

| Requirement | Status | Gap |
|-------------|--------|-----|
| Multi-dimensional budgets | **Partial** | Missing department, project, period. |
| Budget commitment at PO/PR | **Partial** | Model exists, no enforcement. |
| Budget vs. actual with alerts | **Missing** | |
| Budget approval workflow | **Missing** | |
| Budget import from Excel | **Missing** | |

### 12.6 Tax Management (Ghana)

| Requirement | Status | Gap |
|-------------|--------|-----|
| VAT, WHT, corporate tax | **Missing** | Only PAYE exists. |
| VAT returns | **Missing** | |
| WHT on vendor payments | **Missing** | |
| GRA e-filing | **Missing** | Future phase. |

---

## Section 13: Procurement & Supply Chain

| Req ID | Requirement | Status | Gap |
|--------|-------------|--------|-----|
| FR-PRO-PO-001 | PR with amount-based approval | **Partial** | No routing rules. |
| FR-PRO-PO-002 | Budget check blocks PR | **Missing** | |
| FR-PRO-PO-003 | Convert PR to PO | **Missing** | |
| FR-PRO-PO-004 | RFQ/bidding | **Missing** | No RFQ models. |
| FR-PRO-PO-005 | PO lifecycle tracking | **Done** | |
| FR-PRO-PO-006 | PO amendment/versioning | **Missing** | |
| FR-PRO-PO-007 | Blanket/framework POs | **Missing** | |
| GRN auto-updates inventory | **Missing** | No signal. |
| Vendor performance scorecards | **Missing** | |
| 3-way matching | **Missing** | |

---

## Section 14: Inventory & Asset Management

### Inventory

| Requirement | Status | Gap |
|-------------|--------|-----|
| Item master | **Done** | |
| Real-time stock levels | **Done** | |
| Stock movements | **Done** | |
| Valuation (WAVG, FIFO) | **Missing** | |
| Cycle counting | **Missing** | |
| Auto reorder | **Missing** | |
| Barcode/QR | **Missing** | |
| GRN integration | **Missing** | |

### Fixed Assets

| Req ID | Requirement | Status | Gap |
|--------|-------------|--------|-----|
| FR-AST-001 | Asset register | **Done** | |
| FR-AST-002 | Depreciation calculation | **Partial** | Method choices exist, no calculation engine. |
| FR-AST-003 | Monthly depreciation + GL posting | **Missing** | |
| FR-AST-004 | Asset lifecycle | **Done** | |
| FR-AST-005 | Asset transfer + approval | **Done** | |
| FR-AST-006 | Maintenance scheduling | **Partial** | Model exists, no auto-scheduling. |
| FR-AST-007 | Barcode/QR | **Missing** | |
| FR-AST-008 | Disposal with GL posting | **Partial** | Action exists, no GL. |
| FR-AST-009 | Termination triggers asset recovery | **Missing** | |
| FR-AST-010 | Capital PO auto-creates asset | **Missing** | |

---

## Section 15: Project & Contract Management

| Requirement | Status | Gap |
|-------------|--------|-----|
| Project with WBS | **Done** | |
| Resource allocation | **Done** | |
| Timesheets + approval | **Done** | |
| Project budgeting from GL | **Partial** | No actual cost from GL. |
| Milestones | **Done** | |
| Project billing | **Partial** | No auto AR invoice. |
| Project costs to GL | **Missing** | |
| Timesheets feed payroll | **Missing** | |

---

## Section 16: Non-Functional Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| Page load ≤ 2s | **Met** | Redis + React Query. |
| API CRUD ≤ 500ms | **Met** | |
| 5,000 concurrent users | **Untested** | |
| Elasticsearch cross-module search | **Missing** | |
| AES-256 encryption at rest | **Missing** | |
| SoD enforcement | **Minimal** | Only backup restore. |
| Finance session auto-lock | **Missing** | |
| IP whitelisting | **Missing** | |

---

## Section 18: Integration Requirements

**ALL 12 cross-module integrations are unimplemented:**

| Flow | Status |
|------|--------|
| Payroll → Finance GL | **Stub** |
| Payroll → Finance AP (SSNIT) | **Missing** |
| Benefits → Finance GL | **Missing** |
| Procurement → Finance Budget | **Missing** |
| Procurement → Inventory (GRN) | **Missing** |
| Procurement → Finance AP | **Missing** |
| Inventory → Finance GL | **Missing** |
| Assets → Finance GL | **Stub** |
| Assets → Procurement | **Missing** |
| Projects → Finance GL | **Missing** |
| HR Exits → Assets | **Missing** |
| Workflow → All Modules | **Missing** |

---

## Section 19: User Management & Access Control

| Requirement | Status | Gap |
|-------------|--------|-----|
| New ERP roles | **Missing** | No finance/procurement roles seeded. |
| 8 SoD conflict pairs | **Missing** | No enforcement. |

---

## Section 20: Reporting & Analytics

| Requirement | Status | Gap |
|-------------|--------|-----|
| Existing HR reports | **Done** | |
| Trial Balance | **Done** | |
| Balance Sheet | **Missing** | |
| Income Statement | **Done** | |
| Cash Flow Statement | **Missing** | |
| AP/AR Aging | **Missing** | |
| Budget vs Actual | **Missing** | |
| Stock Valuation | **Missing** | |
| Asset Register report | **Missing** | |
| Depreciation Schedule | **Missing** | |
| ERP dashboards (4 new) | **Missing** | |

---

## Section 22: Compliance & Audit

| Requirement | Status | Gap |
|-------------|--------|-----|
| Audit trail with before/after | **Done** | |
| GL immutable once posted | **Partial** | Reversal exists, no edit block. |
| 7-year retention | **Missing** | |

---

## Section 23: Workflow & Approval Engine

| Requirement | Status | Gap |
|-------------|--------|-----|
| Leave workflows | **Done** | |
| Payroll approval | **Done** | |
| PR approval (amount-based) | **Stub** | |
| PO approval (amount-based) | **Stub** | |
| Vendor Invoice approval | **Missing** | |
| Journal Entry approval | **Missing** | |
| SMS notifications | **Missing** | |

---

## Section 24: Mobile & Accessibility

| Requirement | Status | Gap |
|-------------|--------|-----|
| Responsive design | **Done** | |
| PWA capability | **Missing** | |
| WCAG 2.1 AA | **Partial** | |

---

## Section 25: AI & Machine Learning

All items **Missing** (Phase 2-3 per SRS).

---

## Section 26: Testing

| Requirement | Status | Gap |
|-------------|--------|-----|
| Unit tests 80%+ | **Minimal** | Only payroll has tests (561 lines). All others empty. |
| Integration tests | **Missing** | |
| Load testing | **Missing** | |
| Security testing | **Missing** | |

---

## Priority Gap Summary

### Critical (Must-Have)
1. PayrollGL integration — implement post_payroll_to_gl task
2. PayComponent GL account mapping — add gl_account FK
3. Budget enforcement on procurement — block PR/PO when insufficient
4. 3-way matching (PO-GRN-Invoice)
5. Depreciation calculation engine + GL posting
6. GRN → Inventory integration
7. SoD enforcement for finance/procurement
8. New ERP roles seeding

### High Priority
9. Employee budget_holder + spending_limit + project FK
10. JournalLine dimensions (department, project)
11. Balance Sheet + Cash Flow statements
12. AP/AR aging reports
13. Budget vs. Actual variance
14. Amount-based workflow routing
15. Cross-module dashboard APIs
16. Unit test coverage

### Medium Priority
17. RFQ/bidding module
18. Inventory valuation (WAVG, FIFO)
19. Bank reconciliation auto-matching
20. Year-end closing process
21. Recurring journals
22. Vendor performance scorecards
23. PR to PO conversion
24. Management commands for seed data

### Lower Priority (Future Phases)
25. AI/ML features
26. Multi-currency gain/loss
27. Intercompany transactions
28. Elasticsearch
29. SMS notifications
30. PWA/offline support
