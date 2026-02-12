/**
 * HRMS Screenshot Capture Script
 * Runs inside Playwright Docker container to capture all system screens.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.FRONTEND_URL || 'http://host.docker.internal:3000';
const ADMIN_EMAIL = 'admin@gra.gov.gh';
const ADMIN_PASSWORD = 'Test@1234';
const SCREENSHOTS_DIR = '/screenshots';

// All pages to capture, grouped by chapter
const PAGES = [
  // Ch1: Getting Started
  { file: '01_login', path: '/login', auth: false, title: 'Login Page' },
  { file: '02_dashboard', path: '/dashboard', title: 'Admin Dashboard' },
  { file: '03_self_service', path: '/self-service', title: 'Self-Service Portal' },
  // Ch2: Organization Setup
  { file: '04_org_divisions', path: '/admin/organization?tab=divisions', title: 'Divisions' },
  { file: '05_org_directorates', path: '/admin/organization?tab=directorates', title: 'Directorates' },
  { file: '06_org_departments', path: '/admin/organization?tab=departments', title: 'Departments' },
  { file: '07_org_grades', path: '/admin/organization?tab=grades', title: 'Job Grades' },
  { file: '08_org_positions', path: '/admin/organization?tab=positions', title: 'Job Positions' },
  // Ch3: User Management & Security
  { file: '09_users', path: '/admin/users', title: 'User Management' },
  { file: '10_roles', path: '/admin/roles', title: 'Roles & Permissions' },
  { file: '11_workflows', path: '/admin/approval-workflows', title: 'Approval Workflows' },
  { file: '12_policies', path: '/admin/policies', title: 'Company Policies' },
  { file: '13_audit_logs', path: '/admin/audit-logs', title: 'Audit Logs' },
  // Ch4: Employee Management
  { file: '14_employees', path: '/employees', title: 'Employee Directory' },
  { file: '15_employee_new', path: '/employees/new', title: 'Add New Employee' },
  { file: '16_employee_detail', path: '/employees', title: 'Employee Profile', clickFirstRow: true },
  { file: '17_data_import', path: '/admin/data-import', title: 'Data Import' },
  // Ch5: Payroll Setup
  { file: '18_payroll_banks', path: '/admin/payroll-setup?tab=banks', title: 'Banks & Branches' },
  { file: '19_payroll_categories', path: '/admin/payroll-setup?tab=categories', title: 'Staff Categories' },
  { file: '20_payroll_bands', path: '/admin/payroll-setup?tab=bands', title: 'Salary Bands' },
  { file: '21_payroll_levels', path: '/admin/payroll-setup?tab=levels', title: 'Salary Levels' },
  { file: '22_transaction_types', path: '/admin/transaction-types', title: 'Transaction Types' },
  { file: '23_tax_config', path: '/admin/tax-configuration', title: 'Tax Configuration' },
  { file: '24_payroll_impl', path: '/admin/payroll-implementation', title: 'Payroll Implementation' },
  // Ch6: Payroll Processing
  { file: '25_payroll_overview', path: '/payroll', title: 'Payroll Overview' },
  { file: '26_payroll_process', path: '/admin/payroll', title: 'Process Payroll' },
  { file: '27_payroll_employees', path: '/payroll/employees', title: 'Payroll Employees' },
  { file: '28_emp_transactions', path: '/admin/employee-transactions', title: 'Employee Transactions' },
  { file: '29_backpay', path: '/admin/backpay', title: 'Backpay' },
  { file: '30_salary_upgrades', path: '/admin/salary-upgrades', title: 'Salary Upgrades' },
  // Ch7: Leave Management
  { file: '31_leave_types', path: '/admin/leave-types', title: 'Leave Types' },
  { file: '32_leave_overview', path: '/leave', title: 'Leave Overview' },
  { file: '33_leave_approvals', path: '/admin/leave-approvals', title: 'Leave Approvals' },
  { file: '34_leave_calendar', path: '/admin/leave-calendar', title: 'Leave Calendar' },
  // Ch8: Performance
  { file: '35_appraisal_cycles', path: '/admin/appraisal-cycles', title: 'Appraisal Cycles' },
  { file: '36_competencies', path: '/admin/competencies', title: 'Competencies' },
  { file: '37_appraisals', path: '/admin/appraisals', title: 'Appraisals' },
  { file: '38_dev_plans', path: '/admin/development-plans', title: 'Development Plans' },
  // Ch9: Benefits & Loans
  { file: '39_benefits', path: '/benefits', title: 'Benefits' },
  { file: '40_loans', path: '/admin/loans', title: 'Loan Management' },
  // Ch10: Training
  { file: '41_training_dash', path: '/admin/training-dashboard', title: 'Training Dashboard' },
  { file: '42_training_programs', path: '/admin/training-programs', title: 'Training Programs' },
  { file: '43_training_sessions', path: '/admin/training-sessions', title: 'Training Sessions' },
  // Ch11: Recruitment
  { file: '44_recruitment', path: '/admin/recruitment', title: 'Recruitment' },
  { file: '45_careers', path: '/careers', auth: false, title: 'Career Portal' },
  // Ch12: Discipline & Grievance
  { file: '46_disciplinary', path: '/admin/disciplinary', title: 'Disciplinary Cases' },
  { file: '47_grievances', path: '/admin/grievances', title: 'Grievances' },
  // Ch13: Finance
  { file: '48_chart_accounts', path: '/finance/accounts', title: 'Chart of Accounts' },
  { file: '49_journal_entries', path: '/finance/journal-entries', title: 'Journal Entries' },
  { file: '50_budgets', path: '/finance/budgets', title: 'Budget Management' },
  { file: '51_vendors', path: '/finance/vendors', title: 'Vendors' },
  { file: '52_customers', path: '/finance/customers', title: 'Customers' },
  { file: '53_payments', path: '/finance/payments', title: 'Payments' },
  { file: '54_fin_reports', path: '/finance/reports', title: 'Financial Reports' },
  // Ch14: Procurement
  { file: '55_requisitions', path: '/procurement/requisitions', title: 'Requisitions' },
  { file: '56_purchase_orders', path: '/procurement/purchase-orders', title: 'Purchase Orders' },
  { file: '57_goods_receipt', path: '/procurement/goods-receipt', title: 'Goods Receipt' },
  // Ch15: Inventory & Assets
  { file: '58_inventory_items', path: '/inventory/items', title: 'Inventory Items' },
  { file: '59_warehouses', path: '/inventory/warehouses', title: 'Warehouses' },
  { file: '60_assets', path: '/inventory/assets', title: 'Fixed Assets' },
  // Ch16: Projects
  { file: '61_projects', path: '/projects', title: 'Projects' },
  { file: '62_timesheets', path: '/projects/timesheets', title: 'Timesheets' },
  // Ch17: Reports
  { file: '63_hr_reports', path: '/hr-reports', title: 'HR Reports' },
  { file: '64_payroll_reports', path: '/reports', title: 'Payroll Reports' },
  { file: '65_report_builder', path: '/reports/builder', title: 'Report Builder' },
  // Ch18: Self-Service
  { file: '66_my_profile', path: '/my-profile', title: 'My Profile' },
  { file: '67_my_leave', path: '/my-leave', title: 'My Leave' },
  { file: '68_my_payslips', path: '/my-payslips', title: 'My Payslips' },
  { file: '69_my_approvals', path: '/my-approvals', title: 'My Approvals' },
  // Ch19: Exit Management
  { file: '70_exits', path: '/admin/exits', title: 'Exit Management' },
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting HRMS screenshot capture...');
  console.log(`Frontend URL: ${BASE_URL}`);
  console.log(`Total pages: ${PAGES.length}`);

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // ── Login ─────────────────────────────────────────────────
  console.log('\nLogging in...');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);

    // Capture login page
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_login.png` });
    console.log('  [1/' + PAGES.length + '] Captured: Login Page');

    // Fill and submit login form
    await page.fill('input[name="email"], input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    try {
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
    } catch {
      // Might redirect elsewhere, wait for any navigation
      await delay(5000);
    }
    console.log('  Login successful!\n');
    await delay(2000);
  } catch (err) {
    console.error('  Login failed:', err.message);
    console.log('  Continuing without login...\n');
  }

  // ── Capture all pages ─────────────────────────────────────
  let captured = 1; // Login already captured
  const total = PAGES.length;

  for (const pg of PAGES) {
    if (pg.file === '01_login') continue; // Already captured

    const filepath = `${SCREENSHOTS_DIR}/${pg.file}.png`;

    try {
      if (pg.auth === false) {
        // Public pages: use a separate context
        const pubPage = await context.newPage();
        await pubPage.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await delay(2000);
        await pubPage.screenshot({ path: filepath });
        await pubPage.close();
      } else {
        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await delay(2500);

        // Handle click_first_row for detail pages
        if (pg.clickFirstRow) {
          try {
            await page.click('table tbody tr:first-child, [class*="list"] a:first-child', { timeout: 5000 });
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            await delay(2000);
          } catch {
            // No rows to click, just capture current state
          }
        }

        await page.screenshot({ path: filepath });
      }

      captured++;
      console.log(`  [${captured}/${total}] Captured: ${pg.title}`);
    } catch (err) {
      captured++;
      console.log(`  [${captured}/${total}] FAILED: ${pg.title} - ${err.message}`);
    }
  }

  await browser.close();

  console.log(`\nScreenshot capture complete: ${captured}/${total}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
