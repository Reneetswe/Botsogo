/* ══════════════════════════════════════
   Botsogo — Application Logic
   Ministry of Health, Botswana
══════════════════════════════════════ */

/* ── DATA STORES ── */
const USERS = JSON.parse(localStorage.getItem('clq_users') || '[]');

const STAFF_DB = {
  'CLQ-0042': { pin: '1234', name: 'Sr. Moagi',  post: 'Consultation Nurse', role: 'nurse',  late: true  },
  'CLQ-0010': { pin: '5678', name: 'Dr. Molefe', post: 'Consulting Doctor',  role: 'doctor', late: false }
};

const ROLE_NAV = {
  nurse: [
    { id: 'overview', icon: 'ti-layout-dashboard', label: 'Overview'      },
    { id: 'queue',    icon: 'ti-list-numbers',      label: 'Patient Queue' },
    { id: 'triage',   icon: 'ti-stethoscope',       label: 'Triage'        },
    { id: 'clockin',  icon: 'ti-clock-check',       label: 'Clock-In'      }
  ],
  doctor: [
    { id: 'overview', icon: 'ti-layout-dashboard', label: 'Overview'       },
    { id: 'patients', icon: 'ti-users',            label: 'My Patients'    },
    { id: 'consults', icon: 'ti-notes-medical',    label: 'Consultations'  },
    { id: 'clockin',  icon: 'ti-clock-check',      label: 'Clock-In'       }
  ]
};

let currentStaff = null;

/* ── HELPERS ── */
function v(id) { return document.getElementById(id)?.value.trim() || ''; }
function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

/* ── SCREEN ROUTING ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

/* ── PATIENT SESSION ── */
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('clq_user')); } catch (e) { return null; }
}

function initNav() {
  const user = getUser();
  document.getElementById('nav-auth-btns').style.display = user ? 'none' : 'flex';
  document.getElementById('nav-user-btns').style.display = user ? 'flex' : 'none';
  if (user) document.getElementById('nav-greeting').textContent = user.fname + ' ' + user.lname;
}

/* ── PATIENT REGISTER ── */
function doRegister() {
  const fname = v('reg-fname'), lname = v('reg-lname'), id = v('reg-id'),
        phone = v('reg-phone'), clinic = v('reg-clinic'), pw = v('reg-pw'), pw2 = v('reg-pw2');
  const err = document.getElementById('reg-err');
  if (!fname || !lname || !id || !phone || !clinic || !pw) return showErr(err, 'Please fill in all fields.');
  if (pw !== pw2) return showErr(err, 'Passwords do not match.');
  if (pw.length < 6) return showErr(err, 'Password must be at least 6 characters.');
  if (USERS.find(u => u.id === id)) return showErr(err, 'An account with this ID number already exists.');
  const user = { fname, lname, id, phone, clinic, pw };
  USERS.push(user);
  localStorage.setItem('clq_users', JSON.stringify(USERS));
  err.style.display = 'none';
  sessionStorage.setItem('clq_user', JSON.stringify(user));
  loadDash(user);
}

/* ── PATIENT LOGIN ── */
function doLoginPublic() {
  const id = v('login-id'), pw = v('login-pw');
  const err = document.getElementById('login-err-pub');
  const user = USERS.find(u => u.id === id && u.pw === pw);
  if (!user) return showErr(err, 'Incorrect ID number or password.');
  err.style.display = 'none';
  sessionStorage.setItem('clq_user', JSON.stringify(user));
  loadDash(user);
}

function loadDash(user) {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = greeting + ', ' + user.fname;
  showScreen('dash');
  initNav();
}

function doLogoutPublic() {
  sessionStorage.removeItem('clq_user');
  initNav();
  showScreen('landing');
}

function scrollToSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }

/* ── PATIENT DASHBOARD TABS ── */
function showDash(id, btn) {
  ['home', 'myqueue'].forEach(k => { document.getElementById('dv-' + k).style.display = 'none'; });
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.getElementById('dv-' + id).style.display = 'block';
  btn.classList.add('active');
}

/* ── STAFF LOGIN ── */
function staffLogin() {
  const id = v('sl-id'), pin = v('sl-pin');
  const err = document.getElementById('sl-err');
  if (!STAFF_DB[id] || STAFF_DB[id].pin !== pin) return showErr(err, 'Incorrect Staff ID or PIN. Please try again.');
  err.style.display = 'none';
  currentStaff = { id, ...STAFF_DB[id] };
  loadStaffDash(currentStaff);
}

function loadStaffDash(s) {
  document.getElementById('sd-name').textContent = s.name;
  document.getElementById('sd-post').textContent = s.post + ' · Gaborone West';
  document.getElementById('stb-role-label').textContent = s.role === 'nurse' ? 'Nurse View' : 'Doctor View';

  const nav = document.getElementById('sb-nav');
  nav.innerHTML = '<div class="sb-sect">Navigation</div>' +
    ROLE_NAV[s.role].map(n =>
      `<button class="sb-it${n.id === 'overview' ? ' active' : ''}" onclick="showSV('${n.id}',this)">` +
      `<i class="ti ${n.icon}"></i>${n.label}</button>`
    ).join('');

  document.getElementById('ov-nurse').style.display  = s.role === 'nurse'  ? 'block' : 'none';
  document.getElementById('ov-doctor').style.display = s.role === 'doctor' ? 'block' : 'none';

  const al = document.getElementById('sd-ci-alert'), msg = document.getElementById('sd-ci-msg');
  if (!s.late) {
    al.className = 'alert al-g';
    al.querySelector('i').className = 'ti ti-check';
    msg.textContent = '14:00 shift — you are on time';
    al.querySelector('.al-b').textContent = 'Tap below to record your clock-in for this shift.';
  }

  showScreen('staff-dash');
  showSV('overview');
  updateSdClock();
}

/* ── STAFF SIDEBAR NAV ── */
function showSV(id, btn) {
  document.querySelectorAll('.sv-v').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-it').forEach(b => b.classList.remove('active'));
  document.getElementById('sv-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  else document.querySelector(`.sb-it[onclick*="'${id}'"]`)?.classList.add('active');
  const titles = { overview: 'Overview', queue: 'Patient Queue', triage: 'Triage', patients: 'My Patients', consults: 'Consultations', clockin: 'Clock-In' };
  document.getElementById('stb-title').textContent = titles[id] || id;
  if (id === 'clockin') updateSdClock();
}

/* ── STAFF LOGOUT ── */
function staffLogout() {
  currentStaff = null;
  document.getElementById('sl-id').value = '';
  document.getElementById('sl-pin').value = '';
  document.getElementById('sd-ci-pre').style.display = 'block';
  document.getElementById('sd-ci-done').style.display = 'none';
  showScreen('staff-login');
}

/* ── STAFF CLOCK-IN ── */
function sdClockin() {
  const t = new Date(), ts = t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0');
  document.getElementById('sd-ci-pre').style.display = 'none';
  document.getElementById('sd-ci-done').style.display = 'block';
  document.getElementById('sd-ci-confirm').textContent = 'Clocked in at ' + ts + ' — recorded in punctuality log';
  document.getElementById('sd-aft-done').textContent = 'Clocked in ' + ts;

  const da = document.getElementById('dash-alert');
  if (da) { da.className = 'alert al-g'; da.innerHTML = '<i class="ti ti-check" style="color:var(--green);font-size:18px;flex-shrink:0;margin-top:1px;"></i><div><div class="al-t" style="color:var(--green);">All staff on post — nurse queue active</div><div class="al-b">Consultation nurse clocked in. Patient-facing status updated.</div></div>'; }
  const ha = document.getElementById('dash-home-alert');
  if (ha) { ha.className = 'alert al-g'; ha.innerHTML = '<i class="ti ti-check" style="color:var(--green);font-size:18px;flex-shrink:0;margin-top:1px;"></i><div><div class="al-t" style="color:var(--green);">Gaborone West — all posts now staffed</div><div class="al-b">Normal service resumed.</div></div>'; }
  const gp = document.getElementById('gwc-p1');
  if (gp) gp.innerHTML = '<span class="dot don"></span><span style="color:var(--green);font-size:11px;">Consultation nurse — on post</span>';
}

/* ── TRIAGE ── */
function toggleChip(el) { el.classList.toggle('on'); }

function runTriage() {
  const s = [...document.querySelectorAll('.chip.on')].map(c => c.textContent.toLowerCase());
  const r = document.getElementById('tri-result');
  if (s.includes('chest pain') || s.includes('shortness of breath')) {
    r.className = 'tri-res tr-c';
    r.innerHTML = '<div class="tri-ic icc"><i class="ti ti-urgent"></i></div><div><div style="font-size:15px;font-weight:500;color:var(--red);">Critical — see doctor immediately</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Severe symptom combination. Elderly auto-priority override applied.</div></div>';
  } else if (s.includes('fever') || s.includes('headache')) {
    r.className = 'tri-res tr-m';
    r.innerHTML = '<div class="tri-ic icm"><i class="ti ti-alert-circle"></i></div><div><div style="font-size:15px;font-weight:500;color:var(--amber);">Moderate — schedule with doctor</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Non-urgent. Added to doctor queue.</div></div>';
  } else if (s.length > 0) {
    r.className = 'tri-res tr-ml';
    r.innerHTML = '<div class="tri-ic icml"><i class="ti ti-check"></i></div><div><div style="font-size:15px;font-weight:500;color:var(--green);">Mild — nurse can handle</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Routed to nurse queue. Estimated wait 10 minutes.</div></div>';
  } else {
    r.className = 'tri-res tr-i';
    r.innerHTML = '<div class="tri-ic ici"><i class="ti ti-info-circle"></i></div><div><div style="font-size:15px;font-weight:500;color:var(--teal-dk);">Select symptoms first</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Tap at least one symptom above.</div></div>';
  }
}

function resetTriage() {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  const r = document.getElementById('tri-result');
  r.className = 'tri-res tr-i';
  r.innerHTML = '<div class="tri-ic ici"><i class="ti ti-info-circle"></i></div><div><div style="font-size:15px;font-weight:500;color:var(--teal-dk);">Select symptoms to run triage</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Choose presenting symptoms above then tap Run triage.</div></div>';
}

/* ── LIVE CLOCK ── */
function updateSdClock() {
  const t = new Date(), ts = t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0');
  const a = document.getElementById('sd-clk'), b = document.getElementById('sd-live-clk');
  if (a) a.textContent = ts;
  if (b) b.textContent = ts;
}
setInterval(updateSdClock, 10000);
updateSdClock();

/* ── INIT ── */
initNav();
const savedUser = getUser();
if (savedUser) loadDash(savedUser);
