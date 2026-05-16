// ═══════════════════════════════════════════════
//  PAYSLIP MANAGER — APP.JS
// ═══════════════════════════════════════════════

const EMPLOYER = {
  name: 'Alrica Lelanie van der Merwe',
  id: '8204010285088',
  address: '15 Garb Street',
  city: 'Beaufort West',
  postalCode: '6970',
  cell: '074 091 5178',
  uif: '2692709/8'
};

const GITHUB_USER = 'pirot79';
const GITHUB_REPO = 'payslip-manager';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── STATE ───────────────────────────────────────
let state = {
  employees: [],
  timesheets: {},   // key: empId_YYYY_MM  value: { w1:{Mon:h,...}, w2:..., w3:..., w4:... }
  payslips: [],     // generated payslips history
  gitToken: localStorage.getItem('pm_git_token') || ''
};

// ─── INIT ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  loadLocal();
  renderAll();
  if (state.gitToken) await syncFromGitHub();
});

// ─── LOCAL STORAGE ────────────────────────────────
function saveLocal() {
  localStorage.setItem('pm_employees', JSON.stringify(state.employees));
  localStorage.setItem('pm_timesheets', JSON.stringify(state.timesheets));
  localStorage.setItem('pm_payslips', JSON.stringify(state.payslips));
}

function loadLocal() {
  try {
    state.employees = JSON.parse(localStorage.getItem('pm_employees')) || [];
    state.timesheets = JSON.parse(localStorage.getItem('pm_timesheets')) || {};
    state.payslips = JSON.parse(localStorage.getItem('pm_payslips')) || [];
  } catch { }
}

// ─── GITHUB SYNC ──────────────────────────────────
async function syncFromGitHub() {
  if (!state.gitToken) return;
  showToast('Syncing from GitHub…');
  try {
    const data = await ghRead('data/app-data.json');
    if (data) {
      if (data.employees) state.employees = data.employees;
      if (data.timesheets) state.timesheets = data.timesheets;
      if (data.payslips) state.payslips = data.payslips;
      saveLocal();
      renderAll();
      showToast('Synced ✓', 'success');
    }
  } catch (e) { showToast('Sync failed — using local data', 'error'); }
}

async function syncToGitHub() {
  if (!state.gitToken) { showToast('Add GitHub token in Settings', 'error'); return; }
  const btn = document.getElementById('syncBtn');
  if (btn) { btn.classList.add('syncing'); btn.innerHTML = '<span class="spinner"></span> Syncing'; }
  try {
    const content = { employees: state.employees, timesheets: state.timesheets, payslips: state.payslips };
    await ghWrite('data/app-data.json', content);
    showToast('Saved to GitHub ✓', 'success');
  } catch (e) { showToast('GitHub save failed', 'error'); }
  finally {
    if (btn) { btn.classList.remove('syncing'); btn.innerHTML = '☁ Sync'; }
  }
}

async function ghRead(path) {
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${path}`;
  const r = await fetch(url, { headers: { Authorization: `token ${state.gitToken}`, Accept: 'application/vnd.github.v3+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub read error');
  const json = await r.json();
  return JSON.parse(atob(json.content.replace(/\n/g, '')));
}

async function ghWrite(path, content) {
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${path}`;
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
  // get SHA if exists
  let sha;
  try {
    const r = await fetch(url, { headers: { Authorization: `token ${state.gitToken}`, Accept: 'application/vnd.github.v3+json' } });
    if (r.ok) { const j = await r.json(); sha = j.sha; }
  } catch { }
  const body = { message: `Update ${new Date().toISOString()}`, content: b64 };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `token ${state.gitToken}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('GitHub write error');
}

// ─── TABS ─────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = tab === 'employees' ? 'flex' : 'none';
  if (tab === 'timesheet') renderTimesheetView();
  if (tab === 'payslips') renderPayslipsView();
  if (tab === 'settings') renderSettingsView();
}

// ─── RENDER ALL ───────────────────────────────────
function renderAll() {
  renderEmployeesView();
  renderTimesheetView();
  renderPayslipsView();
  renderSettingsView();
}

// ─── EMPLOYEES VIEW ───────────────────────────────
function renderEmployeesView() {
  const list = document.getElementById('empList');
  if (!list) return;
  if (state.employees.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">No employees yet</div><div class="empty-sub">Tap + to add your first employee</div></div>`;
  } else {
    list.innerHTML = state.employees.map(e => `
      <div class="employee-item" onclick="openEditEmployee('${e.id}')">
        <div class="emp-avatar">${initials(e.name)}</div>
        <div class="emp-info">
          <div class="emp-name">${e.name}</div>
          <div class="emp-role">${e.role || 'Domestic Worker'}</div>
          <div class="emp-rate">R${(+e.rate).toFixed(2)}/hr</div>
        </div>
        <div class="emp-actions">
          <button class="btn btn-ghost" onclick="event.stopPropagation(); deleteEmployee('${e.id}')" title="Delete">🗑</button>
        </div>
      </div>
    `).join('');
  }
  const cnt = document.getElementById('empCount');
  if (cnt) cnt.textContent = state.employees.length;
}

// ─── EMPLOYEE MODAL ───────────────────────────────
function openAddEmployee() {
  const m = document.getElementById('empModal');
  document.getElementById('empModalTitle').textContent = 'Add Employee';
  document.getElementById('empForm').reset();
  document.getElementById('empFormId').value = '';
  m.classList.add('open');
}

function openEditEmployee(id) {
  const emp = state.employees.find(e => e.id === id);
  if (!emp) return;
  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  document.getElementById('empFormId').value = emp.id;
  document.getElementById('empName').value = emp.name;
  document.getElementById('empIdNum').value = emp.idNum || '';
  document.getElementById('empRole').value = emp.role || '';
  document.getElementById('empStartDate').value = emp.startDate || '';
  document.getElementById('empRate').value = emp.rate || '';
  document.getElementById('empUif').value = emp.uif || '';
  document.getElementById('empModal').classList.add('open');
}

function closeEmpModal() {
  document.getElementById('empModal').classList.remove('open');
}

function saveEmployee() {
  const id = document.getElementById('empFormId').value;
  const name = document.getElementById('empName').value.trim();
  const idNum = document.getElementById('empIdNum').value.trim();
  const role = document.getElementById('empRole').value.trim();
  const startDate = document.getElementById('empStartDate').value;
  const rate = document.getElementById('empRate').value;
  const uif = document.getElementById('empUif').value.trim();

  if (!name || !rate) { showToast('Name and rate are required', 'error'); return; }

  if (id) {
    const i = state.employees.findIndex(e => e.id === id);
    if (i >= 0) state.employees[i] = { ...state.employees[i], name, idNum, role, startDate, rate, uif };
  } else {
    state.employees.push({ id: uid(), name, idNum, role: role || 'Domestic Worker', startDate, rate, uif });
  }
  saveLocal();
  renderEmployeesView();
  closeEmpModal();
  showToast('Employee saved', 'success');
}

function deleteEmployee(id) {
  if (!confirm('Remove this employee?')) return;
  state.employees = state.employees.filter(e => e.id !== id);
  saveLocal();
  renderEmployeesView();
  showToast('Employee removed');
}

// ─── TIMESHEET VIEW ───────────────────────────────
let tsEmpId = null;
let tsYear = new Date().getFullYear();
let tsMonth = new Date().getMonth();

function renderTimesheetView() {
  const view = document.getElementById('view-timesheet');
  if (!view) return;

  if (state.employees.length === 0) {
    view.innerHTML = `<div class="empty-state"><div class="empty-icon">🕐</div><div class="empty-title">No employees yet</div><div class="empty-sub">Add employees first</div></div>`;
    return;
  }

  if (!tsEmpId || !state.employees.find(e => e.id === tsEmpId)) {
    tsEmpId = state.employees[0].id;
  }
  const emp = state.employees.find(e => e.id === tsEmpId);
  const key = tsKey(tsEmpId, tsYear, tsMonth);
  const ts = state.timesheets[key] || { w1: {}, w2: {}, w3: {}, w4: {} };

  view.innerHTML = `
    <div class="month-selector">
      <span class="month-icon">📅</span>
      <select onchange="tsChangeMonth(this.value)" id="tsMonthSel">
        ${MONTHS.map((m, i) => `<option value="${i}" ${i === tsMonth ? 'selected' : ''}>${m} ${tsYear}</option>`).join('')}
      </select>
      <button class="btn btn-ghost" onclick="tsChangeYear(-1)">◀</button>
      <button class="btn btn-ghost" onclick="tsChangeYear(1)">▶</button>
    </div>

    <div class="section-header">
      <span class="section-title">Employee</span>
    </div>
    <div class="emp-select-list" style="margin-bottom:16px;">
      ${state.employees.map(e => `
        <div class="emp-select-item ${e.id === tsEmpId ? 'selected' : ''}" onclick="tsSelectEmp('${e.id}')">
          <div class="emp-avatar" style="width:32px;height:32px;font-size:13px;">${initials(e.name)}</div>
          <div><div style="font-size:14px;font-weight:600;">${e.name}</div><div style="font-size:11px;color:var(--text-dim)">R${(+e.rate).toFixed(2)}/hr</div></div>
        </div>
      `).join('')}
    </div>

    ${[1,2,3,4].map(w => renderWeekBlock(w, ts[`w${w}`] || {}, +emp.rate)).join('')}

    <div class="card" style="background:linear-gradient(135deg,rgba(200,169,110,0.1),var(--card));">
      <div class="card-header"><span class="card-title">Monthly Summary</span></div>
      ${monthlySummaryRows(ts, +emp.rate, emp.name)}
    </div>

    <button class="btn btn-primary btn-full" style="margin-top:8px;" onclick="saveTimesheet()">💾 Save Timesheet</button>
  `;
}

function renderWeekBlock(wNum, wData, rate) {
  const hrs = DAYS.map(d => +(wData[d] || 0));
  const total = hrs.reduce((a, b) => a + b, 0);
  return `
    <div class="week-block">
      <div class="week-label">Week ${wNum}</div>
      ${DAYS.map((d, i) => `
        <div class="day-row">
          <div class="day-name">${d}</div>
          <input type="number" min="0" max="24" step="0.5" class="hours-input"
            id="ts_w${wNum}_${d}" value="${hrs[i] || ''}" placeholder="0"
            oninput="updateWeekTotal(${wNum})">
          <div class="day-total" id="tot_w${wNum}_${d}">R ${(hrs[i] * rate).toFixed(2)}</div>
        </div>
      `).join('')}
      <div class="week-subtotal">Week total: <strong>${total.toFixed(1)} hrs — R${(total * rate).toFixed(2)}</strong></div>
    </div>
  `;
}

function updateWeekTotal(wNum) {
  const emp = state.employees.find(e => e.id === tsEmpId);
  const rate = emp ? +emp.rate : 0;
  let total = 0;
  DAYS.forEach(d => {
    const val = +document.getElementById(`ts_w${wNum}_${d}`).value || 0;
    total += val;
    const tot = document.getElementById(`tot_w${wNum}_${d}`);
    if (tot) tot.textContent = `R ${(val * rate).toFixed(2)}`;
  });
  // update week subtotal
  const sub = document.querySelector(`#ts_w${wNum}_Mon`)?.closest('.week-block')?.querySelector('.week-subtotal');
  if (sub) sub.innerHTML = `Week total: <strong>${total.toFixed(1)} hrs — R${(total * rate).toFixed(2)}</strong>`;
}

function monthlySummaryRows(ts, rate, name) {
  let totalHrs = 0;
  [1,2,3,4].forEach(w => {
    DAYS.forEach(d => { totalHrs += +(ts[`w${w}`]?.[d] || 0); });
  });
  const gross = totalHrs * rate;
  const empUif = gross * 0.01;
  const emplUif = gross * 0.01;
  const net = gross - empUif;
  return `
    <div class="summary-row"><span class="summary-label">Total Hours</span><span class="summary-value">${totalHrs.toFixed(1)} hrs</span></div>
    <div class="summary-row"><span class="summary-label">Hourly Rate</span><span class="summary-value">R${rate.toFixed(2)}</span></div>
    <div class="summary-row"><span class="summary-label">Gross Pay</span><span class="summary-value">R${gross.toFixed(2)}</span></div>
    <div class="summary-row deduction"><span class="summary-label">UIF (Employee 1%)</span><span class="summary-value">-R${empUif.toFixed(2)}</span></div>
    <div class="summary-row" style="color:var(--text-muted);font-size:12px;"><span class="summary-label">UIF (Employer 1%)</span><span class="summary-value">R${emplUif.toFixed(2)}</span></div>
    <div class="summary-row total"><span class="summary-label">Net Pay</span><span class="summary-value">R${net.toFixed(2)}</span></div>
  `;
}

function saveTimesheet() {
  const key = tsKey(tsEmpId, tsYear, tsMonth);
  const ts = { w1: {}, w2: {}, w3: {}, w4: {} };
  [1,2,3,4].forEach(w => {
    DAYS.forEach(d => {
      const el = document.getElementById(`ts_w${w}_${d}`);
      if (el && +el.value > 0) ts[`w${w}`][d] = +el.value;
    });
  });
  state.timesheets[key] = ts;
  saveLocal();
  showToast('Timesheet saved', 'success');
}

function tsSelectEmp(id) { tsEmpId = id; renderTimesheetView(); }
function tsChangeMonth(m) { tsMonth = +m; renderTimesheetView(); }
function tsChangeYear(d) { tsYear += d; renderTimesheetView(); }
function tsKey(eid, y, m) { return `${eid}_${y}_${m}`; }

// ─── PAYSLIPS VIEW ────────────────────────────────
let psYear = new Date().getFullYear();
let psMonth = new Date().getMonth();

function renderPayslipsView() {
  const view = document.getElementById('view-payslips');
  if (!view) return;

  if (state.employees.length === 0) {
    view.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No employees yet</div></div>`;
    return;
  }

  view.innerHTML = `
    <div class="month-selector">
      <span class="month-icon">📅</span>
      <select onchange="psChangeMonth(this.value)">
        ${MONTHS.map((m, i) => `<option value="${i}" ${i === psMonth ? 'selected' : ''}>${m} ${psYear}</option>`).join('')}
      </select>
      <button class="btn btn-ghost" onclick="psChangeYear(-1)">◀</button>
      <button class="btn btn-ghost" onclick="psChangeYear(1)">▶</button>
    </div>

    <div class="section-header">
      <span class="section-title">Generate Payslips</span>
    </div>

    ${state.employees.map(emp => {
      const key = tsKey(emp.id, psYear, psMonth);
      const ts = state.timesheets[key] || {};
      let hrs = 0;
      [1,2,3,4].forEach(w => DAYS.forEach(d => { hrs += +(ts[`w${w}`]?.[d] || 0); }));
      const gross = hrs * +emp.rate;
      const net = gross * 0.99;
      return `
        <div class="payslip-item">
          <div class="payslip-meta">
            <div class="payslip-name">${emp.name}</div>
            <div class="payslip-period">${MONTHS[psMonth]} ${psYear} · ${hrs.toFixed(1)} hrs</div>
          </div>
          <div>
            <div class="payslip-net">R${net.toFixed(2)}</div>
            <div class="payslip-net-label">Net</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px;margin-top:-4px;">
          <button class="btn btn-outline btn-sm" onclick="printPayslip('${emp.id}')">🖨 Payslip</button>
          <button class="btn btn-outline btn-sm" onclick="printUI19('${emp.id}')">📋 UI-19</button>
        </div>
      `;
    }).join('')}
  `;
}

function psChangeMonth(m) { psMonth = +m; renderPayslipsView(); }
function psChangeYear(d) { psYear += d; renderPayslipsView(); }

// ─── PRINT PAYSLIP ────────────────────────────────
function printPayslip(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  const key = tsKey(empId, psYear, psMonth);
  const ts = state.timesheets[key] || {};
  let totalHrs = 0;
  const weekData = [1,2,3,4].map(w => {
    let wHrs = 0;
    DAYS.forEach(d => { wHrs += +(ts[`w${w}`]?.[d] || 0); });
    totalHrs += wHrs;
    return { w, hrs: wHrs };
  });
  const rate = +emp.rate;
  const gross = totalHrs * rate;
  const empUif = gross * 0.01;
  const emplUif = gross * 0.01;
  const net = gross - empUif;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Payslip</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; padding: 20mm; max-width: 210mm; margin: 0 auto; }
    h1 { font-size: 16pt; margin: 0 0 4px; }
    .sub { font-size: 10pt; color: #555; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
    .section { margin-bottom: 12px; }
    .sec-title { font-weight: bold; font-size: 11pt; border-bottom: 1px solid #aaa; padding-bottom: 3px; margin-bottom: 8px; }
    .field { margin-bottom: 6px; font-size: 10pt; }
    .field label { font-weight: bold; display: block; font-size: 9pt; color: #555; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #f0f0f0; border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 9pt; }
    td { border: 1px solid #ccc; padding: 6px 8px; font-size: 10pt; }
    .right { text-align: right; }
    .total-row td { font-weight: bold; background: #f9f9f9; }
    .net-row td { font-weight: bold; font-size: 12pt; background: #e8f5e9; }
    .sign { margin-top: 40px; }
    .sign-line { display: inline-block; border-bottom: 1px solid #000; width: 180px; margin-top: 30px; }
    .compliance { font-size: 8pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { @page { margin: 15mm; } }
  </style></head><body>
  <div class="header">
    <h1>PAYSLIP</h1>
    <div class="sub">${MONTHS[psMonth]} ${psYear}</div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="sec-title">Employer</div>
      <div class="field"><label>Name</label>${EMPLOYER.name}</div>
      <div class="field"><label>Address</label>${EMPLOYER.address}, ${EMPLOYER.city}, ${EMPLOYER.postalCode}</div>
      <div class="field"><label>Contact</label>${EMPLOYER.cell}</div>
      <div class="field"><label>UIF Ref No</label>${EMPLOYER.uif}</div>
    </div>
    <div class="section">
      <div class="sec-title">Employee</div>
      <div class="field"><label>Name</label>${emp.name}</div>
      <div class="field"><label>ID Number</label>${emp.idNum || '—'}</div>
      <div class="field"><label>Job Title</label>${emp.role || 'Domestic Worker'}</div>
      <div class="field"><label>Start Date</label>${emp.startDate ? formatDate(emp.startDate) : '—'}</div>
      <div class="field"><label>UIF Number</label>${emp.uif || '—'}</div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Hours Worked — ${MONTHS[psMonth]} ${psYear}</div>
    <table>
      <tr><th>Week</th><th class="right">Hours</th><th class="right">Rate</th><th class="right">Amount</th></tr>
      ${weekData.map(w => `<tr><td>Week ${w.w}</td><td class="right">${w.hrs.toFixed(1)}</td><td class="right">R${rate.toFixed(2)}</td><td class="right">R${(w.hrs * rate).toFixed(2)}</td></tr>`).join('')}
      <tr class="total-row"><td><strong>Total</strong></td><td class="right">${totalHrs.toFixed(1)}</td><td></td><td class="right">R${gross.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="sec-title">Earnings & Deductions</div>
    <table>
      <tr><th>Description</th><th class="right">Amount</th></tr>
      <tr><td>Gross Pay (${totalHrs.toFixed(1)} hrs × R${rate.toFixed(2)})</td><td class="right">R${gross.toFixed(2)}</td></tr>
      <tr><td>UIF Contribution (Employee 1%)</td><td class="right" style="color:red;">-R${empUif.toFixed(2)}</td></tr>
      <tr class="net-row"><td><strong>NET PAY</strong></td><td class="right"><strong>R${net.toFixed(2)}</strong></td></tr>
    </table>
    <div style="font-size:9pt;color:#555;margin-top:4px;">Employer UIF Contribution (not deducted from employee): R${emplUif.toFixed(2)}<br>Total UIF payable to SARS: R${(empUif + emplUif).toFixed(2)}</div>
  </div>

  <div class="sign">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:24px;">
      <div>
        <div style="font-size:9pt;color:#555;margin-bottom:4px;">Employer Signature</div>
        <div class="sign-line"></div>
        <div style="font-size:9pt;margin-top:4px;">${EMPLOYER.name}</div>
      </div>
      <div>
        <div style="font-size:9pt;color:#555;margin-bottom:4px;">Employee Signature</div>
        <div class="sign-line"></div>
        <div style="font-size:9pt;margin-top:4px;">${emp.name}</div>
      </div>
    </div>
  </div>

  <div class="compliance">
    This payslip is issued in accordance with the Basic Conditions of Employment Act (BCEA) and the Unemployment Insurance Act.
    UIF deductions are calculated at 1% of gross remuneration. Employer contributes a further 1%.
    Both parties must retain a copy of this payslip.
  </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── PRINT UI-19 ──────────────────────────────────
function printUI19(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  const key = tsKey(empId, psYear, psMonth);
  const ts = state.timesheets[key] || {};
  let totalHrs = 0;
  [1,2,3,4].forEach(w => DAYS.forEach(d => { totalHrs += +(ts[`w${w}`]?.[d] || 0); }));
  const gross = totalHrs * +emp.rate;
  const empUif = gross * 0.01;
  const emplUif = gross * 0.01;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>UI-19</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; padding: 15mm; max-width: 210mm; margin: 0 auto; }
    h2 { font-size: 13pt; }
    .main-title { text-align: center; font-size: 14pt; font-weight: bold; border: 2px solid #000; padding: 8px; margin-bottom: 16px; background: #f5f5f5; }
    .doc-ref { text-align: right; font-size: 9pt; margin-bottom: 8px; }
    .dept { text-align: center; font-size: 9pt; margin-bottom: 12px; border-bottom: 1px solid #aaa; padding-bottom: 8px; }
    .section { margin-bottom: 14px; }
    .sec-title { font-weight: bold; background: #e0e0e0; padding: 4px 8px; font-size: 10pt; border: 1px solid #ccc; margin-bottom: 6px; }
    .field-row { display: grid; margin-bottom: 6px; }
    .field-row.two { grid-template-columns: 1fr 1fr; gap: 12px; }
    .field-row.three { grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .field { }
    .field label { font-size: 8pt; color: #444; display: block; margin-bottom: 2px; font-weight: bold; }
    .field .val { border-bottom: 1px solid #555; padding: 3px 4px; min-height: 20px; font-size: 10pt; }
    .field .box { border: 1px solid #555; padding: 3px 6px; min-height: 22px; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th { background: #e0e0e0; border: 1px solid #aaa; padding: 4px 6px; font-size: 9pt; }
    td { border: 1px solid #aaa; padding: 5px 6px; font-size: 10pt; }
    .right { text-align: right; }
    .note { font-size: 8pt; color: #555; margin-top: 4px; }
    .sign-section { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .sign-block label { font-size: 8pt; color: #555; }
    .sign-line { border-bottom: 1px solid #000; margin-top: 28px; margin-bottom: 4px; }
    .declaration { font-size: 8pt; border: 1px solid #aaa; padding: 8px; margin: 14px 0; background: #fafafa; }
    @media print { @page { margin: 12mm; } }
  </style></head><body>

  <div class="doc-ref">Form UI-19 | Department of Employment & Labour</div>
  <div class="main-title">EMPLOYER'S DECLARATION TO THE UNEMPLOYMENT INSURANCE FUND<br>
    <span style="font-size:10pt;font-weight:normal;">UI-19 — In terms of Section 56(1) of the Unemployment Insurance Contributions Act, 2002 (Act 4 of 2002)</span>
  </div>
  <div class="dept">Department of Employment and Labour — Republic of South Africa</div>

  <div class="section">
    <div class="sec-title">SECTION A — EMPLOYER DETAILS</div>
    <div class="field-row two">
      <div class="field"><label>Employer / Trading Name</label><div class="box">${EMPLOYER.name}</div></div>
      <div class="field"><label>UIF Reference Number</label><div class="box">${EMPLOYER.uif}</div></div>
    </div>
    <div class="field-row two">
      <div class="field"><label>Employer ID / Registration No</label><div class="box">${EMPLOYER.id}</div></div>
      <div class="field"><label>Nature of Business</label><div class="box">Private Household Employer</div></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Physical Address</label><div class="box">${EMPLOYER.address}, ${EMPLOYER.city}, ${EMPLOYER.postalCode}</div></div>
    </div>
    <div class="field-row two">
      <div class="field"><label>Telephone Number</label><div class="box">${EMPLOYER.cell}</div></div>
      <div class="field"><label>Declaration Period</label><div class="box">${MONTHS[psMonth]} ${psYear}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">SECTION B — EMPLOYEE DETAILS</div>
    <div class="field-row two">
      <div class="field"><label>Surname and First Names</label><div class="box">${emp.name}</div></div>
      <div class="field"><label>SA Identity Number</label><div class="box">${emp.idNum || ''}</div></div>
    </div>
    <div class="field-row two">
      <div class="field"><label>UIF Reference Number</label><div class="box">${emp.uif || ''}</div></div>
      <div class="field"><label>Occupation / Job Title</label><div class="box">${emp.role || 'Domestic Worker'}</div></div>
    </div>
    <div class="field-row three">
      <div class="field"><label>Date Employed</label><div class="box">${emp.startDate ? formatDate(emp.startDate) : ''}</div></div>
      <div class="field"><label>Remuneration Frequency</label><div class="box">Monthly</div></div>
      <div class="field"><label>Sector / Industry</label><div class="box">Private Households</div></div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">SECTION C — REMUNERATION & UIF CONTRIBUTIONS (${MONTHS[psMonth]} ${psYear})</div>
    <table>
      <tr>
        <th>Month</th>
        <th>Total Hours Worked</th>
        <th class="right">Gross Remuneration (R)</th>
        <th class="right">Employee UIF (1%) (R)</th>
        <th class="right">Employer UIF (1%) (R)</th>
        <th class="right">Total UIF (R)</th>
      </tr>
      <tr>
        <td>${MONTHS[psMonth]} ${psYear}</td>
        <td>${totalHrs.toFixed(1)}</td>
        <td class="right">${gross.toFixed(2)}</td>
        <td class="right">${empUif.toFixed(2)}</td>
        <td class="right">${emplUif.toFixed(2)}</td>
        <td class="right">${(empUif + emplUif).toFixed(2)}</td>
      </tr>
    </table>
    <div class="note">* UIF contributions are calculated at 1% of gross remuneration each for employer and employee, capped at R17 712 per month remuneration.</div>
  </div>

  <div class="section">
    <div class="sec-title">SECTION D — REASON FOR DECLARATION</div>
    <div class="field-row two">
      <div class="field"><label>Type of Declaration</label><div class="box">Monthly Contribution Declaration</div></div>
      <div class="field"><label>Applicable Month</label><div class="box">${MONTHS[psMonth]} ${psYear}</div></div>
    </div>
  </div>

  <div class="declaration">
    <strong>DECLARATION:</strong> I, the undersigned, hereby declare that the information furnished above is true and correct and that all employees have been registered with the Unemployment Insurance Fund. I understand that failure to register employees and pay contributions is an offence in terms of the Unemployment Insurance Contributions Act, 4 of 2002.
  </div>

  <div class="sign-section">
    <div class="sign-block">
      <label>Signature of Employer / Authorised Representative</label>
      <div class="sign-line"></div>
      <label>${EMPLOYER.name}</label><br>
      <label style="margin-top:4px;display:block;">Date: _________________________</label>
    </div>
    <div class="sign-block">
      <label>Official Stamp (if applicable)</label>
      <div style="border: 1px dashed #aaa; height: 60px; margin-top: 10px; display:flex;align-items:center;justify-content:center;color:#bbb;font-size:9pt;">Stamp here</div>
    </div>
  </div>

  <div class="note" style="margin-top:20px;">Submit this form together with proof of payment to your nearest Department of Employment and Labour office or via uFiling at www.ufiling.co.za</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── SETTINGS VIEW ────────────────────────────────
function renderSettingsView() {
  const view = document.getElementById('view-settings');
  if (!view) return;
  view.innerHTML = `
    <div class="card employer-card">
      <div class="card-header"><span class="card-title">Employer Profile</span><span class="badge badge-gold">Pre-loaded</span></div>
      <div class="employer-name">${EMPLOYER.name}</div>
      <div class="employer-detail">
        ID: <span>${EMPLOYER.id}</span><br>
        Address: <span>${EMPLOYER.address}, ${EMPLOYER.city} ${EMPLOYER.postalCode}</span><br>
        Cell: <span>${EMPLOYER.cell}</span><br>
        UIF Ref: <span>${EMPLOYER.uif}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">GitHub Sync</span></div>
      <div class="settings-section">
        <div class="settings-title">Repository</div>
        <div class="info-row"><span class="info-key">Account</span><span class="info-val">${GITHUB_USER}</span></div>
        <div class="info-row"><span class="info-key">Repo</span><span class="info-val">${GITHUB_REPO}</span></div>
        <div class="info-row"><span class="info-key">Data file</span><span class="info-val">data/app-data.json</span></div>
      </div>
      <div class="settings-section">
        <div class="settings-title">Personal Access Token</div>
        <div class="form-group">
          <input type="password" class="form-control" id="gitTokenInput" placeholder="ghp_xxxxxxxxxxxx" value="${state.gitToken}">
          <div class="git-token-note">Generate at: GitHub → Settings → Developer Settings → Personal Access Tokens (Classic). Select scope: <strong>repo</strong>. Token is stored only on this device.</div>
        </div>
        <button class="btn btn-primary btn-full" onclick="saveGitToken()">Save Token</button>
      </div>
      <hr class="divider">
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline" style="flex:1" onclick="syncFromGitHub()">⬇ Pull from GitHub</button>
        <button class="btn btn-outline" style="flex:1" onclick="syncToGitHub()">⬆ Push to GitHub</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Data</span></div>
      <div class="info-row"><span class="info-key">Employees</span><span class="info-val">${state.employees.length}</span></div>
      <div class="info-row"><span class="info-key">Timesheets</span><span class="info-val">${Object.keys(state.timesheets).length}</span></div>
      <div class="info-row"><span class="info-key">Payslips generated</span><span class="info-val">${state.payslips.length}</span></div>
      <hr class="divider">
      <button class="btn btn-danger btn-sm" onclick="clearAllData()">🗑 Clear all local data</button>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Install on Phone</span></div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.7;">
        <strong style="color:var(--text)">Android (Chrome):</strong><br>
        Tap ⋮ menu → "Add to Home screen"<br><br>
        <strong style="color:var(--text)">iPhone (Safari):</strong><br>
        Tap Share icon → "Add to Home Screen"<br><br>
        <strong style="color:var(--text)">App URL:</strong><br>
        <span style="color:var(--gold)">https://pirot79.github.io/payslip-manager</span>
      </div>
    </div>
  `;
}

function saveGitToken() {
  const t = document.getElementById('gitTokenInput').value.trim();
  state.gitToken = t;
  localStorage.setItem('pm_git_token', t);
  showToast('Token saved', 'success');
}

function clearAllData() {
  if (!confirm('Clear ALL local data? This cannot be undone (GitHub backup remains if synced).')) return;
  state.employees = [];
  state.timesheets = {};
  state.payslips = [];
  saveLocal();
  renderAll();
  showToast('Local data cleared');
}

// ─── UTILS ────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function initials(name) {
  const parts = (name || '').trim().split(' ');
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '') + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}
