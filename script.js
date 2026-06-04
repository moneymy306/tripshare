/* ===========================
   TRIPSHARE — script.js
   =========================== */

// ── MEMBER COLOR PALETTE ──
const PALETTES = [
  { bg:'#1E1840', fg:'#A99EFF' },
  { bg:'#0E2E22', fg:'#34D9A0' },
  { bg:'#2E1218', fg:'#FF8099' },
  { bg:'#0D1E35', fg:'#5BB8FF' },
  { bg:'#2E2110', fg:'#FFC166' },
  { bg:'#1C1030', fg:'#CC88FF' },
  { bg:'#102E2B', fg:'#2DDFD5' },
  { bg:'#2A2E10', fg:'#C8E04A' },
];

const CAT_MAP = {
  '🍜 อาหาร':    { bg:'rgba(255,107,157,0.14)', color:'#FF6B9D' },
  '🏨 ที่พัก':   { bg:'rgba(123,104,238,0.14)', color:'#9B8FFF' },
  '🚗 เดินทาง':  { bg:'rgba(245,166,35,0.14)',  color:'#F5A623' },
  '🎡 ท่องเที่ยว':{ bg:'rgba(16,201,138,0.14)',  color:'#10C98A' },
  '🛒 ซื้อของ':  { bg:'rgba(74,158,255,0.14)',   color:'#4A9EFF' },
  '🍺 เครื่องดื่ม':{ bg:'rgba(249,115,22,0.14)', color:'#f97316' },
  '💊 ยา/สุขภาพ':{ bg:'rgba(74,222,128,0.14)',   color:'#4ade80' },
  '📦 อื่นๆ':    { bg:'rgba(148,148,170,0.14)',  color:'#9494AA' },
};

// ── STATE ──
let state = loadState() || {
  currentTrip: null,
  trips: [],
};

let selectedCat = '🍜 อาหาร';
let selectedParticipants = [];
let splitMode = 'equal';

// ── PERSIST ──
function saveState() {
  try { localStorage.setItem('tripshare_v3', JSON.stringify(state)); } catch(e) {}
}
function loadState() {
  try { const d = localStorage.getItem('tripshare_v3'); return d ? JSON.parse(d) : null; } catch(e) { return null; }
}

// ── HELPERS ──
function pal(idx) { return PALETTES[idx % PALETTES.length]; }
function initials(name) { return (name || '?').substring(0, 2).toUpperCase(); }
function fmt(n) { return Math.round(n).toLocaleString('th-TH'); }
function now() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`;
}
function tripById(id) { return state.trips.find(t => t.id === id); }
function currentTrip() { return tripById(state.currentTrip) || state.trips[0] || null; }

// ── TOAST ──
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ── RENDER ENTRY ──
function render() {
  saveState();
  const trip = currentTrip();
  renderTopbar(trip);
  renderHome(trip);
  renderBalance(trip);
  renderStats(trip);
  renderBalanceDot(trip);
}

// ── TOPBAR ──
function renderTopbar(trip) {
  const el = document.getElementById('trip-switcher-name');
  const em = document.getElementById('trip-switcher-emoji');
  if (trip) {
    el.textContent = trip.name;
    em.textContent = trip.emoji;
  } else {
    el.textContent = 'เลือกทริป';
    em.textContent = '✈️';
  }
}

// ── HOME ──
function renderHome(trip) {
  if (!trip) {
    document.getElementById('summary-total').textContent = '0';
    document.getElementById('sg-count').textContent = '0';
    document.getElementById('sg-per').textContent = '฿0';
    document.getElementById('sg-members').textContent = '0';
    document.getElementById('members-row').innerHTML = buildAddMemberBtn();
    document.getElementById('exp-list').innerHTML = emptyState('🧳', 'ยังไม่มีทริป', 'กดปุ่มเลือกทริปด้านบน หรือสร้างทริปใหม่ก่อนเลย!');
    return;
  }

  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const perP  = trip.members.length > 0 ? total / trip.members.length : 0;

  document.getElementById('summary-total').textContent = fmt(total);
  document.getElementById('sg-count').textContent = trip.expenses.length;
  document.getElementById('sg-per').textContent = '฿' + fmt(perP);
  document.getElementById('sg-members').textContent = trip.members.length;
  document.getElementById('trip-pill-label').textContent = trip.emoji + ' ' + trip.name;

  renderMembers(trip);
  renderExpenses(trip);
}

function renderMembers(trip) {
  const row = document.getElementById('members-row');
  let html = '';
  trip.members.forEach((m, i) => {
    const p = pal(i);
    html += `
      <div class="m-chip" title="${m}">
        <div class="m-avatar" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
        <div class="m-name">${m}</div>
      </div>`;
  });
  html += buildAddMemberBtn();
  row.innerHTML = html;
}

function buildAddMemberBtn() {
  return `<div class="m-chip m-add" onclick="openModal('modal-member')">
    <div class="m-avatar">+</div>
    <div class="m-name">เพิ่ม</div>
  </div>`;
}

function renderExpenses(trip) {
  const list = document.getElementById('exp-list');
  if (!trip || trip.expenses.length === 0) {
    list.innerHTML = emptyState('🧾', 'ยังไม่มีรายการ', 'กดปุ่ม + ด้านล่างเพื่อเพิ่มค่าใช้จ่ายแรก');
    return;
  }
  list.innerHTML = [...trip.expenses].reverse().map(exp => {
    const cat  = CAT_MAP[exp.cat] || CAT_MAP['📦 อื่นๆ'];
    const pIdx = trip.members.indexOf(exp.paidBy);
    const pp   = pal(pIdx >= 0 ? pIdx : 0);
    const emoji = exp.cat.split(' ')[0];
    const perP  = exp.participants.length > 0 ? exp.amount / exp.participants.length : exp.amount;
    return `
      <div class="exp-card" style="--cat-color:${cat.color};--cat-bg:${cat.bg}">
        <div class="exp-icon-wrap">${emoji}</div>
        <div class="exp-body">
          <div class="exp-name">${exp.name}</div>
          <div class="exp-meta">
            <div class="exp-meta-avatar" style="background:${pp.bg};color:${pp.fg}">${initials(exp.paidBy)}</div>
            <span>${exp.paidBy} จ่าย</span>
            <div class="exp-meta-sep"></div>
            <span>${exp.date}</span>
          </div>
        </div>
        <div class="exp-right">
          <div class="exp-total">฿${fmt(exp.amount)}</div>
          <div class="exp-per">฿${fmt(perP)}/คน</div>
        </div>
      </div>`;
  }).join('');
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state">
    <span class="empty-icon">${icon}</span>
    <div class="empty-title">${title}</div>
    <div class="empty-sub">${sub}</div>
  </div>`;
}

// ── BALANCE ──
function calcBalances(trip) {
  const paid = {}, owed = {};
  trip.members.forEach(m => { paid[m] = 0; owed[m] = 0; });
  trip.expenses.forEach(exp => {
    paid[exp.paidBy] = (paid[exp.paidBy] || 0) + exp.amount;
    const share = exp.amount / exp.participants.length;
    exp.participants.forEach(p => { owed[p] = (owed[p] || 0) + share; });
  });
  const net = {};
  trip.members.forEach(m => { net[m] = (paid[m] || 0) - (owed[m] || 0); });
  return { paid, owed, net };
}

function calcSettlements(net) {
  const debtors = [], creditors = [];
  Object.entries(net).forEach(([m, v]) => {
    if (v < -0.5) debtors.push({ m, v: Math.abs(v) });
    else if (v > 0.5) creditors.push({ m, v });
  });
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  const txns = [];
  const d = debtors.map(x => ({ ...x }));
  const c = creditors.map(x => ({ ...x }));
  let i = 0, j = 0;
  while (i < d.length && j < c.length) {
    const amt = Math.min(d[i].v, c[j].v);
    if (amt > 0.5) txns.push({ from: d[i].m, to: c[j].m, amount: Math.round(amt) });
    d[i].v -= amt; c[j].v -= amt;
    if (d[i].v < 0.5) i++;
    if (c[j].v < 0.5) j++;
  }
  return txns;
}

function renderBalance(trip) {
  const netGrid   = document.getElementById('net-grid');
  const settleWrap = document.getElementById('settle-wrap');

  if (!trip || trip.members.length === 0) {
    netGrid.innerHTML   = `<div style="grid-column:1/-1">${emptyState('👤', 'ยังไม่มีสมาชิก', 'เพิ่มสมาชิกก่อนนะ')}</div>`;
    settleWrap.innerHTML = '';
    return;
  }

  const { paid, net } = calcBalances(trip);
  const maxAbs = Math.max(...Object.values(net).map(Math.abs), 1);

  netGrid.innerHTML = trip.members.map((m, i) => {
    const p   = pal(i);
    const n   = net[m] || 0;
    const cls = n > 0.5 ? 'is-pos' : n < -0.5 ? 'is-neg' : '';
    const clr = n > 0.5 ? 'clr-pos' : n < -0.5 ? 'clr-neg' : 'clr-zero';
    const barColor = n > 0.5 ? 'var(--green)' : n < -0.5 ? 'var(--red)' : 'var(--t4)';
    const barPct = Math.round(Math.abs(n) / maxAbs * 100);
    const sign = n > 0.5 ? '+' : '';
    return `
      <div class="net-card ${cls}">
        <div class="net-top">
          <div class="net-av" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
          <div>
            <div class="net-name">${m}</div>
            <div class="net-paid-lbl">จ่าย ฿${fmt(paid[m] || 0)}</div>
          </div>
        </div>
        <div class="net-amt ${clr}">${sign}฿${fmt(Math.abs(n))}</div>
        <div style="margin-top:8px">
          <div class="net-bar"><div class="net-bar-fill" style="width:${barPct}%;background:${barColor}"></div></div>
        </div>
      </div>`;
  }).join('');

  const settlements = calcSettlements(net);
  const settled = trip.settled || [];

  if (settlements.length === 0) {
    settleWrap.innerHTML = emptyState('🎉', 'ไม่มียอดค้างชำระ', 'ทุกคนเท่ากันหมดแล้ว!');
    return;
  }

  settleWrap.innerHTML = settlements.map((s, idx) => {
    const fi = trip.members.indexOf(s.from);
    const ti = trip.members.indexOf(s.to);
    const fp = pal(fi >= 0 ? fi : 0);
    const tp = pal(ti >= 0 ? ti : 0);
    const done = settled.includes(idx);
    return `
      <div class="settle-card ${done ? 'done' : ''}">
        <div class="settle-avatars">
          <div class="settle-av" style="background:${fp.bg};color:${fp.fg}">${initials(s.from)}</div>
          <div class="settle-av" style="background:${tp.bg};color:${tp.fg}">${initials(s.to)}</div>
        </div>
        <div class="settle-info">
          <div class="settle-names">${s.from}<span class="arr"> → </span>${s.to}</div>
          <div class="settle-note">${done ? '✓ โอนแล้ว' : 'รอการโอนเงิน'}</div>
        </div>
        <div class="settle-right">
          <div class="settle-amt">฿${fmt(s.amount)}</div>
          ${done
            ? `<div class="tag-done">โอนแล้ว</div>`
            : `<button class="btn-settle" onclick="markSettled(${idx})">โอนแล้ว ✓</button>`
          }
        </div>
      </div>`;
  }).join('');
}

function renderBalanceDot(trip) {
  const dot = document.getElementById('balance-dot');
  if (!trip || !dot) return;
  const { net } = calcBalances(trip);
  const hasDebt = Object.values(net).some(v => Math.abs(v) > 0.5);
  dot.classList.toggle('show', hasDebt);
}

// ── STATS ──
function renderStats(trip) {
  const container = document.getElementById('stats-content');
  if (!trip || trip.expenses.length === 0) {
    container.innerHTML = emptyState('📊', 'ยังไม่มีข้อมูล', 'เพิ่มรายการค่าใช้จ่ายก่อนนะ');
    return;
  }
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const catTotals = {};
  trip.expenses.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + e.amount; });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  let html = `<div class="s-head"><div class="s-title">หมวดหมู่</div></div><div class="stats-pad">`;
  sorted.forEach(([cat, amt]) => {
    const pct   = Math.round(amt / total * 100);
    const color = (CAT_MAP[cat] || CAT_MAP['📦 อื่นๆ']).color;
    html += `
      <div class="stat-bar-item">
        <div class="sbi-top">
          <span class="sbi-cat">${cat}</span>
          <span><span class="sbi-amt">฿${fmt(amt)}</span><span class="sbi-pct">(${pct}%)</span></span>
        </div>
        <div class="sbi-track"><div class="sbi-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  });
  html += `</div>`;

  const { paid } = calcBalances(trip);
  html += `<div class="s-head mt-20"><div class="s-title">ใครจ่ายไปเท่าไหร่</div></div><div class="stats-pad">`;
  trip.members.forEach((m, i) => {
    const p   = pal(i);
    const amt = paid[m] || 0;
    const pct = total > 0 ? Math.round(amt / total * 100) : 0;
    html += `
      <div class="pspend-row">
        <div class="pspend-av" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
        <div class="pspend-info">
          <div class="pspend-top"><span class="pspend-name">${m}</span><span class="pspend-amt">฿${fmt(amt)}</span></div>
          <div class="pspend-track"><div class="pspend-fill" style="width:${pct}%;background:${p.fg}"></div></div>
        </div>
      </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// ── NAVIGATION ──
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${name}"]`);
  if (nav) nav.classList.add('active');
}

// ── MODALS ──
function openModal(id) {
  document.getElementById(id).classList.add('show');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); });
});

// ── ADD EXPENSE ──
function openAddExpense() {
  const trip = currentTrip();
  if (!trip) { toast('กรุณาสร้างทริปก่อนนะ'); openModal('modal-trip'); return; }
  if (trip.members.length === 0) { toast('กรุณาเพิ่มสมาชิกก่อนนะ'); openModal('modal-member'); return; }

  document.getElementById('fi-name').value = '';
  document.getElementById('fi-amount').value = '';
  document.getElementById('fi-name').classList.remove('error');
  document.getElementById('fi-amount').classList.remove('error');

  selectedParticipants = [...trip.members];
  splitMode = 'equal';
  selectedCat = '🍜 อาหาร';

  document.querySelectorAll('.split-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('st-equal').classList.add('active');

  buildCatGrid();
  buildPaidBySelect(trip);
  renderParticipantList();
  openModal('modal-expense');
  setTimeout(() => document.getElementById('fi-name').focus(), 380);
}

function buildCatGrid() {
  const grid = document.getElementById('cat-grid-wrap');
  grid.innerHTML = Object.keys(CAT_MAP).map(cat => {
    const emoji = cat.split(' ')[0];
    const label = cat.split(' ').slice(1).join(' ');
    const sel   = cat === selectedCat ? 'sel' : '';
    return `<div class="cat-item ${sel}" data-cat="${cat}" onclick="selectCat(this)">
      <span class="ci-emoji">${emoji}</span>
      <span class="ci-label">${label}</span>
    </div>`;
  }).join('');
}

function buildPaidBySelect(trip) {
  document.getElementById('fi-paidby').innerHTML =
    trip.members.map(m => `<option value="${m}">${m}</option>`).join('');
}

function selectCat(el) {
  document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selectedCat = el.dataset.cat;
}

function setSplitMode(mode) {
  splitMode = mode;
  document.getElementById('st-equal').classList.toggle('active', mode === 'equal');
  document.getElementById('st-custom').classList.toggle('active', mode === 'custom');
  renderParticipantList();
}

function renderParticipantList() {
  const trip   = currentTrip();
  const list   = document.getElementById('p-list-wrap');
  const amount = parseFloat(document.getElementById('fi-amount').value) || 0;
  const perP   = selectedParticipants.length > 0 ? Math.round(amount / selectedParticipants.length) : 0;
  list.innerHTML = trip.members.map((m, i) => {
    const p   = pal(i);
    const sel = selectedParticipants.includes(m);
    return `
      <div class="p-row ${sel ? 'sel' : ''}" onclick="toggleP('${m}')">
        <div class="p-av" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
        <div class="p-name-txt">${m}</div>
        ${sel && amount > 0 ? `<div class="p-share-lbl">฿${fmt(perP)}</div>` : ''}
        <div class="p-check">${sel ? '✓' : ''}</div>
      </div>`;
  }).join('');
}

function toggleP(member) {
  const idx = selectedParticipants.indexOf(member);
  if (idx >= 0) { if (selectedParticipants.length > 1) selectedParticipants.splice(idx, 1); }
  else selectedParticipants.push(member);
  renderParticipantList();
}

document.getElementById('fi-amount').addEventListener('input', () => {
  if (document.getElementById('modal-expense').classList.contains('show')) renderParticipantList();
});

function submitExpense() {
  const name   = document.getElementById('fi-name').value.trim();
  const amount = parseFloat(document.getElementById('fi-amount').value);
  const paidBy = document.getElementById('fi-paidby').value;
  let valid = true;
  if (!name)              { document.getElementById('fi-name').classList.add('error');   valid = false; }
  if (!amount || amount <= 0) { document.getElementById('fi-amount').classList.add('error'); valid = false; }
  if (!valid) return;

  const trip = currentTrip();
  trip.expenses.push({
    id: Date.now(), name, amount, cat: selectedCat,
    paidBy, participants: [...selectedParticipants],
    settled: [], date: now(),
  });
  if (trip.settled) trip.settled = [];
  closeModal('modal-expense');
  render();
  toast('เพิ่มรายการแล้ว ✓');
}

// ── ADD MEMBER ──
function submitMember() {
  const name = document.getElementById('fi-member').value.trim();
  if (!name) return;
  let trip = currentTrip();
  if (!trip) { toast('กรุณาสร้างทริปก่อนนะ'); return; }
  if (!trip.members.includes(name)) {
    trip.members.push(name);
    render();
    toast(`เพิ่ม ${name} แล้ว ✓`);
  }
  document.getElementById('fi-member').value = '';
  closeModal('modal-member');
}

// ── TRIPS ──
function openTripModal() {
  renderTripList();
  openModal('modal-trip');
}
function renderTripList() {
  const container = document.getElementById('trip-list');
  if (state.trips.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:24px 0"><span class="empty-icon">🗺️</span><div class="empty-title">ยังไม่มีทริป</div><div class="empty-sub">สร้างทริปแรกของคุณด้านล่างเลย!</div></div>`;
    return;
  }
  container.innerHTML = state.trips.map(trip => {
    const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
    const isCurr = trip.id === state.currentTrip;
    return `
      <div class="trip-card ${isCurr ? 'curr' : ''}" onclick="selectTrip(${trip.id})">
        <div class="tc-emoji">${trip.emoji}</div>
        <div class="tc-info">
          <h4>${trip.name}</h4>
          <p>${trip.members.length} คน • ${trip.expenses.length} รายการ • ฿${fmt(total)}</p>
        </div>
        ${isCurr ? '<div class="tc-check">✓</div>' : ''}
      </div>`;
  }).join('');
}
function selectTrip(id) {
  state.currentTrip = id;
  closeModal('modal-trip');
  render();
}
function submitTrip() {
  const name  = document.getElementById('fi-trip-name').value.trim();
  const emoji = document.getElementById('fi-trip-emoji').value.trim() || '✈️';
  if (!name) return;
  const id = Date.now();
  state.trips.push({ id, name, emoji, members: [], expenses: [], settled: [] });
  state.currentTrip = id;
  document.getElementById('fi-trip-name').value = '';
  document.getElementById('fi-trip-emoji').value = '';
  closeModal('modal-trip');
  render();
  openModal('modal-member');
  toast(`สร้างทริป "${name}" แล้ว ✓`);
}

// ── MARK SETTLED ──
function markSettled(idx) {
  const trip = currentTrip();
  if (!trip.settled) trip.settled = [];
  if (!trip.settled.includes(idx)) trip.settled.push(idx);
  render();
  toast('บันทึกการโอนแล้ว ✓');
}

// ── ENTER KEYS ──
document.getElementById('fi-name').addEventListener('keydown',    e => { if (e.key==='Enter') document.getElementById('fi-amount').focus(); });
document.getElementById('fi-amount').addEventListener('keydown',  e => { if (e.key==='Enter') submitExpense(); });
document.getElementById('fi-member').addEventListener('keydown',  e => { if (e.key==='Enter') submitMember(); });
document.getElementById('fi-trip-name').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('fi-trip-emoji').focus(); });

// ── INIT ──
render();

// Auto open trip modal if no trips
if (state.trips.length === 0) {
  setTimeout(() => openTripModal(), 400);
}
