const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const apiErrors = [];
  const jsErrors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) jsErrors.push(m.text()); });
  page.on('pageerror', e => jsErrors.push('UNCAUGHT: ' + e.message));
  page.on('response', async r => {
    if (r.url().includes('/api/') && r.status() >= 400) {
      let body = ''; try { body = await r.text(); } catch {}
      apiErrors.push({ status: r.status(), url: r.url().split('/api/')[1], body });
    }
  });

  let authToken = '';
  // Capture auth token
  page.on('response', async r => {
    if (r.url().includes('/auth/login') && r.status() === 200) {
      try {
        const data = JSON.parse(await r.text());
        if (data.access) authToken = data.access;
      } catch {}
    }
  });

  function resetErrors() { jsErrors.length = 0; apiErrors.length = 0; }
  function check(label) {
    const hasUncaught = jsErrors.some(e => e.startsWith('UNCAUGHT'));
    const hasApiErr = apiErrors.length > 0;
    const icon = (hasUncaught || hasApiErr) ? 'FAIL' : 'PASS';
    let line = `  [${icon}] ${label}`;
    if (hasApiErr) line += `\n        API: ${apiErrors.map(e => `${e.status} ${e.url}: ${e.body?.substring(0, 200)}`).join('\n        ')}`;
    if (hasUncaught) line += `\n        JS: ${jsErrors.filter(e => e.startsWith('UNCAUGHT'))[0]?.substring(0, 150)}`;
    console.log(line);
    return !hasUncaught && !hasApiErr;
  }

  // Helper: API call via page context
  async function apiCall(method, endpoint, body) {
    return page.evaluate(async ({ method, endpoint, body, token }) => {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`http://localhost:8000/api/v1${endpoint}`, opts);
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    }, { method, endpoint, body, token: authToken });
  }

  // ========== LOGIN ==========
  console.log('=== STEP 1: LOGIN ===');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.fill('input[type="email"]', 'admin@gra.gov.gh');
  await page.fill('input[type="password"]', 'Test@1234');
  await page.click('button[type="submit"]');
  try { await page.waitForURL('**/dashboard**', { timeout: 10000 }); } catch {}
  await new Promise(r => setTimeout(r, 2000));

  // Get token from localStorage
  authToken = await page.evaluate(() => {
    const stored = localStorage.getItem('hrms-auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.tokens?.access || '';
    }
    return '';
  });
  console.log(`  Token: ${authToken ? authToken.substring(0, 20) + '...' : 'NOT FOUND'}`);

  if (!authToken) {
    console.log('  Cannot proceed without auth token');
    await browser.close();
    return;
  }

  // ========== FETCH LOOKUP DATA ==========
  console.log('\n=== STEP 2: FETCH LOOKUP DATA ===');
  const depts = await apiCall('GET', '/organization/departments/?page_size=100');
  const positions = await apiCall('GET', '/organization/positions/?page_size=100');
  const grades = await apiCall('GET', '/organization/grades/?page_size=100');
  const locations = await apiCall('GET', '/organization/locations/');

  const dept = (depts.data.results || depts.data)[0];
  const position = (positions.data.results || positions.data)[0];
  const grade = (grades.data.results || grades.data)[0];
  const locList = locations.data.results || locations.data;
  const location = Array.isArray(locList) ? locList.find(l => l.name?.includes('Head') || l.name?.includes('HEAD')) || locList[0] : null;

  console.log(`  Department: ${dept?.name} (${dept?.id})`);
  console.log(`  Position: ${position?.name} (${position?.id})`);
  console.log(`  Grade: ${grade?.name} (${grade?.id})`);
  console.log(`  Location: ${location?.name} (${location?.id})`);
  console.log(`  Locations loaded: ${Array.isArray(locList) ? locList.length : '?'}`);

  // ========== CREATE VACANCY ==========
  console.log('\n=== STEP 3: CREATE VACANCY ===');
  resetErrors();
  const vacancyData = {
    job_title: 'E2E Test - Software Engineer',
    position: position.id,
    department: dept.id,
    grade: grade.id,
    work_location: location?.id || null,
    job_description: 'End-to-end test vacancy for recruitment pipeline.',
    requirements: 'BSc Computer Science, 3+ years experience.',
    responsibilities: 'Develop and maintain software applications.',
    qualifications: 'BSc or higher in Computer Science.',
    experience_required: '3-5 years',
    number_of_positions: 2,
    employment_type: 'PERMANENT',
    posting_type: 'BOTH',
    status: 'DRAFT',
    closing_date: '2026-12-31',
  };
  const createVac = await apiCall('POST', '/recruitment/vacancies/', vacancyData);
  const vacancy = createVac.data;
  if (createVac.status === 201) {
    console.log(`  [PASS] Created vacancy: ${vacancy.vacancy_number} (${vacancy.id})`);
  } else {
    console.log(`  [FAIL] Create vacancy: ${createVac.status} ${JSON.stringify(createVac.data).substring(0, 300)}`);
    await browser.close();
    return;
  }

  // ========== VIEW VACANCY ON FRONTEND ==========
  console.log('\n=== STEP 4: VIEW VACANCY (FRONTEND) ===');
  resetErrors();
  await page.goto(`http://localhost:3000/admin/recruitment/vacancies/${vacancy.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  check('Vacancy detail page loads');

  // ========== PUBLISH VACANCY ==========
  console.log('\n=== STEP 5: PUBLISH VACANCY ===');
  const publishRes = await apiCall('POST', `/recruitment/vacancies/${vacancy.id}/publish/`);
  if (publishRes.status === 200 && publishRes.data.status === 'PUBLISHED') {
    console.log(`  [PASS] Vacancy published: status=${publishRes.data.status}`);
  } else {
    console.log(`  [FAIL] Publish: ${publishRes.status} ${JSON.stringify(publishRes.data).substring(0, 200)}`);
  }

  // ========== CREATE APPLICANT ==========
  console.log('\n=== STEP 6: CREATE APPLICANT ===');
  const applicantData = {
    vacancy: vacancy.id,
    first_name: 'Kwesi',
    last_name: 'Appiah',
    email: `kwesi.appiah.e2e.${Date.now()}@test.com`,
    phone: '+233241234567',
    address: '123 Test Street',
    city: 'Accra',
    region: 'Greater Accra',
    gender: 'MALE',
    nationality: 'Ghanaian',
    highest_education: 'BACHELORS',
    institution: 'University of Ghana',
    graduation_year: 2018,
    years_of_experience: 5,
    current_employer: 'Tech Corp Ltd',
    current_position: 'Junior Developer',
    expected_salary: 8000,
    source: 'WEBSITE',
    cover_letter: 'I am excited to apply for this position...',
  };
  const createApp = await apiCall('POST', '/recruitment/applicants/', applicantData);
  const applicant = createApp.data;
  if (createApp.status === 201) {
    console.log(`  [PASS] Created applicant: ${applicant.applicant_number} - ${applicant.full_name} (status: ${applicant.status})`);
  } else {
    console.log(`  [FAIL] Create applicant: ${createApp.status} ${JSON.stringify(createApp.data).substring(0, 300)}`);
    await browser.close();
    return;
  }

  // ========== VIEW APPLICANT ON FRONTEND ==========
  console.log('\n=== STEP 7: VIEW APPLICANT (FRONTEND) ===');
  resetErrors();
  await page.goto(`http://localhost:3000/admin/recruitment/applicants/${applicant.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  const appPageOk = check('Applicant detail page loads');
  if (appPageOk) {
    const name = await page.textContent('h1').catch(() => '');
    console.log(`        Showing: ${name.trim()}`);
  }

  // ========== SCREENING ==========
  console.log('\n=== STEP 8: START SCREENING ===');
  const screenRes = await apiCall('POST', `/recruitment/applicants/${applicant.id}/update_status/`, { status: 'SCREENING' });
  if (screenRes.status === 200 && screenRes.data.status === 'SCREENING') {
    console.log(`  [PASS] Status: ${screenRes.data.status}`);
  } else {
    console.log(`  [FAIL] Screening: ${screenRes.status} ${JSON.stringify(screenRes.data).substring(0, 200)}`);
  }

  // Verify on frontend
  resetErrors();
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  check('Applicant page after screening');

  // ========== SHORTLIST ==========
  console.log('\n=== STEP 9: SHORTLIST ===');
  const shortlistRes = await apiCall('POST', `/recruitment/applicants/${applicant.id}/shortlist/`);
  if (shortlistRes.status === 200 && shortlistRes.data.status === 'SHORTLISTED') {
    console.log(`  [PASS] Status: ${shortlistRes.data.status}`);
  } else {
    console.log(`  [FAIL] Shortlist: ${shortlistRes.status} ${JSON.stringify(shortlistRes.data).substring(0, 200)}`);
  }

  // ========== SCHEDULE INTERVIEW ==========
  console.log('\n=== STEP 10: MOVE TO INTERVIEW ===');
  const interviewStatusRes = await apiCall('POST', `/recruitment/applicants/${applicant.id}/schedule_interview/`);
  if (interviewStatusRes.status === 200 && interviewStatusRes.data.status === 'INTERVIEW') {
    console.log(`  [PASS] Status: ${interviewStatusRes.data.status}`);
  } else {
    console.log(`  [FAIL] Interview status: ${interviewStatusRes.status} ${JSON.stringify(interviewStatusRes.data).substring(0, 200)}`);
  }

  // Create actual interview
  console.log('\n=== STEP 11: CREATE INTERVIEW ===');
  const interviewData = {
    applicant: applicant.id,
    interview_type: 'PANEL',
    round_number: 1,
    scheduled_date: '2026-03-15',
    scheduled_time: '10:00:00',
    duration_minutes: 60,
    location: 'GRA Head Office, Conference Room A',
    notes: 'First round panel interview for E2E test applicant.',
  };
  const createIntv = await apiCall('POST', '/recruitment/interviews/', interviewData);
  const interview = createIntv.data;
  if (createIntv.status === 201) {
    console.log(`  [PASS] Created interview: ${interview.id} (type: ${interview.interview_type}, date: ${interview.scheduled_date})`);
  } else {
    console.log(`  [FAIL] Create interview: ${createIntv.status} ${JSON.stringify(createIntv.data).substring(0, 300)}`);
  }

  // Verify interview on applicant detail
  resetErrors();
  await page.goto(`http://localhost:3000/admin/recruitment/applicants/${applicant.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  // Click interviews tab
  const intvTab = await page.$('button:has-text("Interviews")');
  if (intvTab) {
    await intvTab.click();
    await new Promise(r => setTimeout(r, 1500));
    check('Interviews tab with new interview');
  }

  // ========== COMPLETE INTERVIEW ==========
  console.log('\n=== STEP 12: COMPLETE INTERVIEW ===');
  if (interview?.id) {
    const completeRes = await apiCall('POST', `/recruitment/interviews/${interview.id}/complete/`);
    if (completeRes.status === 200) {
      console.log(`  [PASS] Interview completed: status=${completeRes.data.status}`);
    } else {
      console.log(`  [FAIL] Complete interview: ${completeRes.status} ${JSON.stringify(completeRes.data).substring(0, 200)}`);
    }
  }

  // ========== MOVE TO OFFER STAGE ==========
  console.log('\n=== STEP 13: MOVE TO OFFER STAGE ===');
  const offerStatusRes = await apiCall('POST', `/recruitment/applicants/${applicant.id}/update_status/`, { status: 'OFFER' });
  if (offerStatusRes.status === 200 && offerStatusRes.data.status === 'OFFER') {
    console.log(`  [PASS] Status: ${offerStatusRes.data.status}`);
  } else {
    console.log(`  [FAIL] Offer status: ${offerStatusRes.status} ${JSON.stringify(offerStatusRes.data).substring(0, 200)}`);
  }

  // ========== CREATE JOB OFFER ==========
  console.log('\n=== STEP 14: CREATE JOB OFFER ===');
  const offerData = {
    applicant: applicant.id,
    vacancy: vacancy.id,
    position: position.id,
    department: dept.id,
    grade: grade.id,
    basic_salary: 8000.00,
    allowances: 1500.00,
    total_compensation: 9500.00,
    compensation_notes: 'Includes housing and transport allowances.',
    offer_date: '2026-03-01',
    response_deadline: '2026-03-20',
    proposed_start_date: '2026-04-01',
  };
  const createOffer = await apiCall('POST', '/recruitment/offers/', offerData);
  const offer = createOffer.data;
  if (createOffer.status === 201) {
    console.log(`  [PASS] Created offer: ${offer.offer_number || offer.id} (salary: ${offer.offered_salary})`);
  } else {
    console.log(`  [FAIL] Create offer: ${createOffer.status} ${JSON.stringify(createOffer.data).substring(0, 300)}`);
  }

  // Verify offer on applicant detail
  resetErrors();
  await page.goto(`http://localhost:3000/admin/recruitment/applicants/${applicant.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  const offersTab = await page.$('button:has-text("Offers")');
  if (offersTab) {
    await offersTab.click();
    await new Promise(r => setTimeout(r, 1500));
    check('Offers tab with new offer');
  }

  // ========== SEND OFFER ==========
  console.log('\n=== STEP 15: SEND OFFER ===');
  if (offer?.id) {
    const sendRes = await apiCall('POST', `/recruitment/offers/${offer.id}/send/`);
    if (sendRes.status === 200) {
      console.log(`  [PASS] Offer sent: status=${sendRes.data.status}`);
    } else {
      console.log(`  [FAIL] Send offer: ${sendRes.status} ${JSON.stringify(sendRes.data).substring(0, 200)}`);
    }
  }

  // ========== ACCEPT OFFER (HIRE) ==========
  console.log('\n=== STEP 16: ACCEPT OFFER (HIRE) ===');
  if (offer?.id) {
    const acceptRes = await apiCall('POST', `/recruitment/offers/${offer.id}/accept/`);
    if (acceptRes.status === 200) {
      console.log(`  [PASS] Offer accepted: status=${acceptRes.data.status}`);
    } else {
      console.log(`  [FAIL] Accept offer: ${acceptRes.status} ${JSON.stringify(acceptRes.data).substring(0, 200)}`);
    }
  }

  // ========== VERIFY APPLICANT IS HIRED ==========
  console.log('\n=== STEP 17: VERIFY APPLICANT HIRED ===');
  const verifyRes = await apiCall('GET', `/recruitment/applicants/${applicant.id}/`);
  if (verifyRes.status === 200) {
    console.log(`  [${verifyRes.data.status === 'HIRED' ? 'PASS' : 'FAIL'}] Applicant status: ${verifyRes.data.status}`);
  }

  // Verify on frontend
  resetErrors();
  await page.goto(`http://localhost:3000/admin/recruitment/applicants/${applicant.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  check('Hired applicant detail page');
  const badge = await page.textContent('h1 + span, h1 ~ span, .flex.items-center.gap-3 span').catch(() => '');
  console.log(`        Status badge: ${badge?.trim()}`);

  // Check timeline
  const timelineTab = await page.$('button:has-text("Timeline")');
  if (timelineTab) {
    await timelineTab.click();
    await new Promise(r => setTimeout(r, 1500));
    resetErrors();
    check('Timeline tab for hired applicant');
  }

  // ========== CHECK RECRUITMENT DASHBOARD ==========
  console.log('\n=== STEP 18: VERIFY RECRUITMENT DASHBOARD ===');
  resetErrors();
  await page.goto('http://localhost:3000/admin/recruitment', { waitUntil: 'networkidle', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  check('Recruitment dashboard after full cycle');

  // ========== CLEANUP ==========
  console.log('\n=== CLEANUP ===');
  // Delete the test vacancy (cascades to applicant, interview, offer)
  const delRes = await apiCall('DELETE', `/recruitment/vacancies/${vacancy.id}/`);
  console.log(`  Vacancy deleted: ${delRes.status === 204 ? 'YES' : 'NO (' + delRes.status + ')'}`);

  await browser.close();
  console.log('\n=== END-TO-END RECRUITMENT TEST COMPLETE ===');
})();
