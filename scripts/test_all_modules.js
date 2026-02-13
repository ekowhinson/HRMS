const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const results = [];
  let jsErrors = [];
  let apiErrors = [];
  page.on('pageerror', e => jsErrors.push('UNCAUGHT: ' + e.message));
  page.on('response', async r => {
    if (r.url().includes('/api/') && r.status() >= 400) {
      let body = ''; try { body = await r.text(); } catch {}
      apiErrors.push({ status: r.status(), url: r.url().split('/api/')[1]?.substring(0, 80), body: body.substring(0, 200) });
    }
  });

  function reset() { jsErrors = []; apiErrors = []; }
  function check(label) {
    const hasUncaught = jsErrors.some(e => e.startsWith('UNCAUGHT'));
    const hasApi = apiErrors.length > 0;
    const icon = (hasUncaught || hasApi) ? 'FAIL' : 'PASS';
    let line = '  [' + icon + '] ' + label;
    if (hasApi) line += '\n        API: ' + apiErrors.map(e => e.status + ' ' + e.url).join('\n        API: ');
    if (hasUncaught) line += '\n        JS: ' + jsErrors.filter(e => e.startsWith('UNCAUGHT')).map(e => e.substring(0, 200)).join('\n        JS: ');
    console.log(line);
    results.push({ label, pass: !hasUncaught && !hasApi, errors: hasApi ? apiErrors.map(e=>e.status+' '+e.url) : hasUncaught ? jsErrors.filter(e=>e.startsWith('UNCAUGHT')) : [] });
  }

  async function testPage(path, label) {
    reset();
    await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    check(label);
  }

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.fill('input[type="email"]', 'admin@gra.gov.gh');
  await page.fill('input[type="password"]', 'Test@1234');
  await page.click('button[type="submit"]');
  try { await page.waitForURL('**/dashboard**', { timeout: 10000 }); } catch {}
  await new Promise(r => setTimeout(r, 2000));
  console.log('Logged in\n');

  // ===== DASHBOARD =====
  console.log('=== DASHBOARD ===');
  await testPage('/dashboard', 'Dashboard');

  // ===== EMPLOYEES =====
  console.log('\n=== EMPLOYEES ===');
  await testPage('/employees', 'Employee list');
  const empLinks = await page.$$eval('a[href*="/employees/"]', links =>
    [...new Set(links.map(l => l.getAttribute('href')).filter(h => h && h.match(/\/employees\/[a-f0-9-]+$/)))]
  );
  if (empLinks.length > 0) {
    await testPage(empLinks[0], 'Employee detail');
  }

  // ===== ORGANIZATION =====
  console.log('\n=== ORGANIZATION ===');
  await testPage('/admin/organization', 'Organization');

  // ===== LEAVE =====
  console.log('\n=== LEAVE ===');
  await testPage('/leave', 'My Leave');
  await testPage('/admin/leave-approvals', 'Leave Approvals');
  await testPage('/admin/leave-types', 'Leave Type Setup');
  await testPage('/admin/leave-calendar', 'Leave Calendar');

  // ===== PAYROLL =====
  console.log('\n=== PAYROLL ===');
  await testPage('/admin/payroll', 'Payroll Processing');
  await testPage('/admin/payroll-setup', 'Payroll Setup');
  await testPage('/admin/payroll-implementation', 'Payroll Implementation');
  await testPage('/admin/loans', 'Loan Management');
  await testPage('/admin/transaction-types', 'Transaction Types');
  await testPage('/admin/employee-transactions', 'Employee Transactions');
  await testPage('/admin/tax-configuration', 'Tax Configuration');
  await testPage('/admin/backpay', 'Backpay');
  await testPage('/admin/salary-upgrades', 'Salary Upgrades');

  // ===== PERFORMANCE =====
  console.log('\n=== PERFORMANCE ===');
  await testPage('/admin/appraisal-cycles', 'Appraisal Cycles');
  await testPage('/admin/appraisals', 'Appraisals');
  await testPage('/admin/competencies', 'Competencies');
  await testPage('/admin/core-values', 'Core Values');
  await testPage('/admin/probation-assessments', 'Probation Assessments');
  await testPage('/admin/training-needs', 'Training Needs');
  await testPage('/admin/performance-appeals', 'Performance Appeals');

  // ===== TRAINING =====
  console.log('\n=== TRAINING ===');
  await testPage('/admin/training-dashboard', 'Training Dashboard');
  await testPage('/admin/training-programs', 'Training Programs');
  await testPage('/admin/training-sessions', 'Training Sessions');
  await testPage('/admin/development-plans', 'Development Plans');

  // ===== DISCIPLINE & GRIEVANCE =====
  console.log('\n=== DISCIPLINE & GRIEVANCE ===');
  await testPage('/admin/disciplinary', 'Disciplinary');
  await testPage('/admin/grievances', 'Grievances');

  // ===== EXITS =====
  console.log('\n=== EXITS ===');
  await testPage('/admin/exits', 'Exits');

  // ===== POLICIES =====
  console.log('\n=== POLICIES ===');
  await testPage('/admin/policies', 'Policies');

  // ===== WORKFLOWS =====
  console.log('\n=== WORKFLOWS ===');
  await testPage('/admin/approval-workflows', 'Approval Workflows');

  // ===== ANNOUNCEMENTS =====
  console.log('\n=== ANNOUNCEMENTS ===');
  await testPage('/admin/announcements', 'Announcements');

  // ===== SYSTEM ADMIN =====
  console.log('\n=== SYSTEM ADMIN ===');
  await testPage('/admin/users', 'User Management');
  await testPage('/admin/roles', 'Role Management');
  await testPage('/admin/auth-providers', 'Auth Providers');
  await testPage('/admin/audit-logs', 'Audit Logs');
  await testPage('/admin/data-import', 'Data Import');
  await testPage('/admin/data-analyzer', 'Data Analyzer');
  await testPage('/admin/backup', 'Backup Management');

  // ===== REPORTS =====
  console.log('\n=== REPORTS ===');
  await testPage('/reports', 'Reports main');
  const reportPaths = [
    '/reports/headcount', '/reports/turnover', '/reports/leave',
    '/reports/payroll-summary', '/reports/benefits', '/reports/recruitment',
    '/reports/training', '/reports/compliance', '/reports/diversity',
    '/reports/compensation'
  ];
  for (const rp of reportPaths) {
    await testPage(rp, 'Report: ' + rp.split('/').pop());
  }

  // ===== SUMMARY =====
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log('\n========================================');
  console.log('  TOTAL: ' + results.length + ' | PASSED: ' + passed + ' | FAILED: ' + failed);
  console.log('========================================');
  if (failed > 0) {
    console.log('\nFailed pages:');
    results.filter(r => !r.pass).forEach(r => {
      console.log('  - ' + r.label);
      r.errors.forEach(e => console.log('      ' + e));
    });
  }

  await browser.close();
})();
