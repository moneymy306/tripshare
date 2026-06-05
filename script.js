/* ===========================
   TRIPSHARE — script.js (CRUD + Image Upload)
   =========================== */

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
  '🍜 อาหาร':      { bg:'rgba(255,107,157,0.14)', color:'#FF6B9D' },
  '🏨 ที่พัก':     { bg:'rgba(123,104,238,0.14)', color:'#9B8FFF' },
  '🚗 เดินทาง':    { bg:'rgba(245,166,35,0.14)',  color:'#F5A623' },
  '🎡 ท่องเที่ยว': { bg:'rgba(16,201,138,0.14)',  color:'#10C98A' },
  '🛒 ซื้อของ':    { bg:'rgba(74,158,255,0.14)',   color:'#4A9EFF' },
  '🍺 เครื่องดื่ม':{ bg:'rgba(249,115,22,0.14)',  color:'#f97316' },
  '💊 ยา/สุขภาพ':  { bg:'rgba(74,222,128,0.14)',   color:'#4ade80' },
  '📦 อื่นๆ':      { bg:'rgba(148,148,170,0.14)',  color:'#9494AA' },
};

// ── STATE ──
let state = { currentTrip: null, trips: [] };

// Editing state
let selectedCat        = '🍜 อาหาร';
let selectedParticipants = [];
let splitMode          = 'equal';   // 'self' | 'equal' | 'custom'
let currentImageData   = null;
let editingExpenseId   = null;
let viewingExpenseId   = null;
let editingTripId      = null;
let editingMemberName  = null;
let _saveTimer         = null;
let _lastSaveAt        = 0;   // timestamp ล่าสุดที่เรา save ลง Firestore

// ── PERSIST (Firebase) ──
function saveState() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    try {
      if (window._setDoc && window._DOC) {
        const savedAt = Date.now();
        _lastSaveAt = savedAt;
        // เก็บ timestamp ไว้ใน document ด้วย เพื่อเปรียบเทียบตอนรับกลับ
        await window._setDoc(window._DOC, {
          state: JSON.stringify(state),
          savedAt,
        });
      }
    } catch(e) {
      console.error('saveState error', e);
    }
  }, 600);
}

// callback ที่ Firebase listener จะเรียกเมื่อมีข้อมูลใหม่จาก cloud
window._onRemoteState = function(remote, remoteSavedAt) {
  // ถ้า remote เก่ากว่า (หรือเท่ากับ) สิ่งที่เรา save ไปล่าสุด → ignore
  // ยกเว้นตอน init (_lastSaveAt === 0) ให้รับข้อมูลจาก cloud เสมอ
  if (_lastSaveAt > 0 && remoteSavedAt <= _lastSaveAt) return;
  state = remote;
  renderOnly();
  if (!_initDone) {
    _initDone = true;
    showLoadingOverlay(false);
    if (state.trips.length === 0) setTimeout(() => openTripModal(), 400);
  }
};

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

function formatTripDateRange(startDate, endDate) {
  const fmtDate = d => {
    if (!d) return null;
    const [y, m, day] = d.split('-');
    const thYear = parseInt(y) + 543;
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${parseInt(day)} ${months[parseInt(m)-1]} ${thYear}`;
  };
  const s = fmtDate(startDate), e = fmtDate(endDate);
  if (s && e) return `${s} – ${e}`;
  if (s) return `เริ่ม ${s}`;
  if (e) return `ถึง ${e}`;
  return null;
}

// ── TOAST ──
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' toast-' + type : '');
  setTimeout(() => el.classList.remove('show'), 2400);
}

// ── RENDER ──
// render() = เรียกเมื่อ user กระทำ (save + render)
function render() {
  saveState();
  renderOnly();
}

// renderOnly() = เรียกเมื่อรับข้อมูลจาก Firestore (render เฉยๆ ไม่ save)
function renderOnly() {
  const trip = currentTrip();
  renderTopbar(trip);
  renderHome(trip);
  renderBalance(trip);
  renderStats(trip);
  renderBalanceDot(trip);
}

function renderTopbar(trip) {
  const el = document.getElementById('trip-switcher-name');
  const em = document.getElementById('trip-switcher-emoji');
  if (trip) { el.textContent = trip.name; em.textContent = trip.emoji; }
  else { el.textContent = 'เลือกทริป'; em.textContent = '✈️'; }
}

// ── HOME ──
function renderHome(trip) {
  if (!trip) {
    document.getElementById('summary-total').textContent = '0';
    document.getElementById('sg-count').textContent = '0';
    document.getElementById('sg-per').textContent = '฿0';
    document.getElementById('sg-members').textContent = '0';
    document.getElementById('members-row').innerHTML = buildAddMemberBtn();
    document.getElementById('exp-list').innerHTML = emptyState('🧳','ยังไม่มีทริป','กดปุ่มเลือกทริปด้านบน หรือสร้างทริปใหม่ก่อนเลย!');
    return;
  }
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const perP  = trip.members.length > 0 ? total / trip.members.length : 0;
  document.getElementById('summary-total').textContent = fmt(total);
  document.getElementById('sg-count').textContent = trip.expenses.length;
  document.getElementById('sg-per').textContent = '฿' + fmt(perP);
  document.getElementById('sg-members').textContent = trip.members.length;
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  const pillEl = document.getElementById('trip-pill-label');
  pillEl.textContent = trip.emoji + ' ' + trip.name;
  let dateEl = document.getElementById('trip-date-range');
  if (!dateEl) {
    dateEl = document.createElement('div');
    dateEl.id = 'trip-date-range';
    dateEl.className = 'trip-date-range';
    pillEl.parentNode.insertBefore(dateEl, pillEl.nextSibling);
  }
  dateEl.textContent = dateRange || '';
  dateEl.style.display = dateRange ? 'block' : 'none';
  renderMembers(trip);
  renderExpenses(trip);
}

function renderMembers(trip) {
  const row = document.getElementById('members-row');
  let html = '';
  trip.members.forEach((m, i) => {
    const p = pal(i);
    html += `
      <div class="m-chip" title="${m}" onclick="openEditMember('${m.replace(/'/g,"\\'")}')">
        <div class="m-avatar" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
        <div class="m-name">${m}</div>
      </div>`;
  });
  html += buildAddMemberBtn();
  row.innerHTML = html;
}

function buildAddMemberBtn() {
  return `<div class="m-chip m-add" onclick="openAddMember()">
    <div class="m-avatar">+</div>
    <div class="m-name">เพิ่ม</div>
  </div>`;
}

function renderExpenses(trip) {
  const list = document.getElementById('exp-list');
  if (!trip || trip.expenses.length === 0) {
    list.innerHTML = emptyState('🧾','ยังไม่มีรายการ','กดปุ่ม + ด้านล่างเพื่อเพิ่มค่าใช้จ่ายแรก');
    return;
  }
  list.innerHTML = [...trip.expenses].reverse().map(exp => {
    const cat  = CAT_MAP[exp.cat] || CAT_MAP['📦 อื่นๆ'];
    const pIdx = trip.members.indexOf(exp.paidBy);
    const pp   = pal(pIdx >= 0 ? pIdx : 0);
    const emoji = exp.cat.split(' ')[0];
    const isSelf = exp.splitMode === 'self';
    const perP   = isSelf ? exp.amount : (exp.participants && exp.participants.length > 0 ? exp.amount / exp.participants.length : exp.amount);
    const hasImg = exp.image ? `<div class="exp-img-badge">📎</div>` : '';
    const selfTag = isSelf ? `<span class="exp-self-tag">จ่ายเอง</span>` : '';
    return `
      <div class="exp-card" style="--cat-color:${cat.color};--cat-bg:${cat.bg}" onclick="openExpenseDetail(${exp.id})">
        <div class="exp-icon-wrap">${emoji}</div>
        <div class="exp-body">
          <div class="exp-name">${exp.name} ${hasImg}</div>
          <div class="exp-meta">
            <div class="exp-meta-avatar" style="background:${pp.bg};color:${pp.fg}">${initials(exp.paidBy)}</div>
            <span>${exp.paidBy} จ่าย</span>
            <div class="exp-meta-sep"></div>
            <span>${exp.date}</span>
          </div>
        </div>
        <div class="exp-right">
          <div class="exp-total">฿${fmt(exp.amount)}</div>
          <div class="exp-per">${isSelf ? selfTag : `฿${fmt(perP)}/คน`}</div>
        </div>
      </div>`;
  }).join('');
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}

// ── BALANCE ──
function calcBalances(trip) {
  const paid = {}, owed = {}, selfTotal = {};
  const expSettled = trip.expSettled || [];
  trip.members.forEach(m => { paid[m] = 0; owed[m] = 0; selfTotal[m] = 0; });
  trip.expenses.forEach(exp => {
    paid[exp.paidBy] = (paid[exp.paidBy] || 0) + exp.amount;
    if (exp.splitMode === 'self') {
      owed[exp.paidBy] = (owed[exp.paidBy] || 0) + exp.amount;
      selfTotal[exp.paidBy] = (selfTotal[exp.paidBy] || 0) + exp.amount;
    } else if (exp.splitMode === 'custom' && exp.customSplit) {
      const parts = exp.participants && exp.participants.length > 0 ? exp.participants : [exp.paidBy];
      parts.forEach(p => {
        const share = exp.customSplit[p] || 0;
        owed[p] = (owed[p] || 0) + share;
      });
    } else {
      const parts = exp.participants && exp.participants.length > 0 ? exp.participants : [exp.paidBy];
      const share = exp.amount / parts.length;
      parts.forEach(p => { owed[p] = (owed[p] || 0) + share; });
    }
  });
  // Adjust for per-expense-share settlements: when debtor marks share as paid,
  // their owed balance decreases (debt cleared) and payer receives the cash.
  trip.expenses.forEach(exp => {
    if (exp.splitMode === 'self') return;
    const parts = exp.participants && exp.participants.length > 0 ? exp.participants : [exp.paidBy];
    parts.forEach(p => {
      if (p === exp.paidBy) return;
      const shareKey = `${exp.id}|${p}`;
      if (!expSettled.includes(shareKey)) return;
      let share;
      if (exp.splitMode === 'custom' && exp.customSplit) {
        share = exp.customSplit[p] || 0;
      } else {
        share = exp.amount / parts.length;
      }
      // Debtor paid back: reduce their owed, add to payer's received (paid)
      owed[p] = (owed[p] || 0) - share;
      // payer received the cash → increase their "paid" (acts as income received)
      paid[exp.paidBy] = (paid[exp.paidBy] || 0) + share;
      // Also reduce payer's owed by same amount (net stays correct):
      // Actually: net[payer] = paid[payer] - owed[payer]
      // When debtor pays, payer's net should NOT change (the debt just transfers to cash received)
      // So we add to paid[payer] AND add to owed[payer] equally → net unchanged for payer ✓
      owed[exp.paidBy] = (owed[exp.paidBy] || 0) + share;
    });
  });
  const net = {};
  trip.members.forEach(m => { net[m] = (paid[m] || 0) - (owed[m] || 0); });
  return { paid, owed, net, selfTotal };
}

function calcSettlements(net) {
  const debtors = [], creditors = [];
  Object.entries(net).forEach(([m, v]) => {
    if (v < -0.5) debtors.push({ m, v: Math.abs(v) });
    else if (v > 0.5) creditors.push({ m, v });
  });
  debtors.sort((a,b) => b.v - a.v);
  creditors.sort((a,b) => b.v - a.v);
  const txns = [];
  const d = debtors.map(x => ({...x}));
  const c = creditors.map(x => ({...x}));
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
  const netGrid    = document.getElementById('net-grid');
  const settleWrap = document.getElementById('settle-wrap');
  if (!trip || trip.members.length === 0) {
    netGrid.innerHTML    = `<div style="grid-column:1/-1">${emptyState('👤','ยังไม่มีสมาชิก','เพิ่มสมาชิกก่อนนะ')}</div>`;
    settleWrap.innerHTML = '';
    renderTripSummary(trip);
    return;
  }
  const { paid, owed, net } = calcBalances(trip);

  // ── net-card: แสดง จ่าย / รับ / คงเหลือ ──
  netGrid.innerHTML = trip.members.map((m, i) => {
    const p   = pal(i);
    const n   = net[m] || 0;
    const cls = n > 0.5 ? 'is-pos' : n < -0.5 ? 'is-neg' : '';
    const netLabel = n > 0.5
      ? `<span class="fin-net-val clr-pos">+฿${fmt(n)}</span><span class="fin-net-tag tag-pos">รับคืน</span>`
      : n < -0.5
      ? `<span class="fin-net-val clr-neg">-฿${fmt(Math.abs(n))}</span><span class="fin-net-tag tag-neg">ต้องจ่าย</span>`
      : `<span class="fin-net-val clr-zero">฿0</span><span class="fin-net-tag tag-zero">เท่ากัน</span>`;
    return `
      <div class="net-card ${cls}">
        <div class="net-top">
          <div class="net-av" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
          <div class="net-name">${m}</div>
        </div>
        <div class="fin-row">
          <span class="fin-lbl">จ่าย</span>
          <span class="fin-val">฿${fmt(paid[m] || 0)}</span>
        </div>
        <div class="fin-row">
          <span class="fin-lbl">รับ</span>
          <span class="fin-val clr-pos">฿${fmt(Math.max(0, n))}</span>
        </div>
        <div class="fin-divider"></div>
        <div class="fin-net-row">${netLabel}</div>
      </div>`;
  }).join('');

  // ── settle cards ──
  const settlements = calcSettlements(net);
  const settled = trip.settled || [];
  if (settlements.length === 0) {
    settleWrap.innerHTML = emptyState('🎉','ไม่มียอดค้างชำระ','ทุกคนเท่ากันหมดแล้ว!');
  } else {
    settleWrap.innerHTML = settlements.map((s) => {
      const key = `${s.from}|${s.to}`;
      const fi = trip.members.indexOf(s.from);
      const ti = trip.members.indexOf(s.to);
      const fp = pal(fi >= 0 ? fi : 0);
      const tp = pal(ti >= 0 ? ti : 0);
      const done = settled.includes(key);
      return `
        <div class="settle-card ${done ? 'done' : ''}">
          <div class="settle-avatars">
            <div class="settle-av" style="background:${fp.bg};color:${fp.fg}">${initials(s.from)}</div>
            <div class="settle-av" style="background:${tp.bg};color:${tp.fg}">${initials(s.to)}</div>
          </div>
          <div class="settle-info">
            <div class="settle-names">${s.from}<span class="arr"> → </span>${s.to}</div>
            <div class="settle-note">${done ? '✓ โอนแล้ว' : 'รอโอน'}</div>
          </div>
          <div class="settle-right">
            <div class="settle-amt">฿${fmt(s.amount)}</div>
            ${done
              ? `<button class="btn-settle btn-settle-undo" onclick="unmarkSettled('${key}')">รอโอน</button>`
              : `<button class="btn-settle" onclick="markSettled('${key}')">โอนแล้ว ✓</button>`}
          </div>
        </div>`;
    }).join('');
  }

  renderTripSummary(trip);
}

function renderTripSummary(trip) {
  let el = document.getElementById('trip-summary-section');
  if (!el) return;
  if (!trip || trip.expenses.length === 0) { el.innerHTML = ''; return; }

  const { paid, net, selfTotal } = calcBalances(trip);

  // Build per-member per-expense breakdown:
  // For each expense paid by M (not self), list who owes M how much
  // Also list what M owes others
  function getShare(exp, member) {
    if (exp.splitMode === 'self') return 0;
    if (exp.participants && !exp.participants.includes(member)) return 0;
    if (exp.splitMode === 'custom' && exp.customSplit) return exp.customSplit[member] || 0;
    const parts = exp.participants && exp.participants.length > 0 ? exp.participants : [exp.paidBy];
    return exp.amount / parts.length;
  }

  let html = `
    <div class="s-divider" style="margin-top:20px"></div>
    <div class="s-head"><div class="s-title">สรุปทริป — ใครจ่ายอะไรบ้าง</div></div>
    <div class="trip-summary-wrap">`;

  trip.members.forEach((m, i) => {
    const p        = pal(i);
    const totalPaid = paid[m] || 0;
    const selfAmt   = selfTotal[m] || 0;
    const netVal    = net[m] || 0;
    const waitCollect = netVal > 0.5 ? netVal : 0;
    const needPay     = netVal < -0.5 ? Math.abs(netVal) : 0;

    // expenses that M paid for others (not self)
    const paidExpenses = trip.expenses.filter(e => e.paidBy === m && e.splitMode !== 'self');
    // expenses that M is a participant but didn't pay
    const owedExpenses = trip.expenses.filter(e =>
      e.paidBy !== m &&
      e.splitMode !== 'self' &&
      e.participants && e.participants.includes(m) &&
      getShare(e, m) > 0.5
    );

    if (totalPaid === 0 && selfAmt === 0 && owedExpenses.length === 0) return;

    html += `
      <div class="tsummary-card">
        <div class="tsummary-header">
          <div class="net-av" style="background:${p.bg};color:${p.fg};width:38px;height:38px;font-size:12px">${initials(m)}</div>
          <div style="flex:1">
            <div class="tsummary-name">${m}</div>
            <div class="tsummary-sub">จ่ายรวม ฿${fmt(totalPaid)}${selfAmt > 0 ? ` (จ่ายเอง ฿${fmt(selfAmt)})` : ''}</div>
          </div>
          ${waitCollect > 0.5 ? `<div class="tsummary-badge badge-collect">รอเก็บ ฿${fmt(waitCollect)}</div>` : ''}
          ${needPay > 0.5   ? `<div class="tsummary-badge badge-owe">ต้องจ่าย ฿${fmt(needPay)}</div>` : ''}
          ${waitCollect <= 0.5 && needPay <= 0.5 ? `<div class="tsummary-badge badge-ok">เท่ากัน ✓</div>` : ''}
        </div>`;

    // Section: expenses M paid → show who owes M per item
    if (paidExpenses.length > 0) {
      html += `<div class="tsummary-items">
        <div class="tsummary-section-lbl">🧾 ${m} จ่ายให้</div>`;
      paidExpenses.forEach(e => {
        const parts = (e.participants || []).filter(p2 => p2 !== m);
        // per-person share of others
        const myShare = getShare(e, m);
        const otherLines = parts.map(p2 => {
          const s = getShare(e, p2);
          return s > 0.5 ? `${p2} ฿${fmt(s)}` : null;
        }).filter(Boolean);

        html += `<div class="tsummary-row">
          <span class="tsummary-cat">${e.cat.split(' ')[0]}</span>
          <div class="tsummary-row-body">
            <span class="tsummary-iname">${e.name}</span>
            <span class="tsummary-iamt">฿${fmt(e.amount)}</span>
          </div>
        </div>`;

        if (otherLines.length > 0) {
          html += `<div class="tsummary-owe-detail">
            <span class="tsummary-owe-icon">↳</span>
            <span class="tsummary-owe-txt">คนอื่นค้างกับ ${m}: ${otherLines.join(', ')}</span>
          </div>`;
        }
        if (myShare > 0.5) {
          html += `<div class="tsummary-owe-detail tsummary-self-share">
            <span class="tsummary-owe-icon">↳</span>
            <span class="tsummary-owe-txt">${m} รับผิดชอบ ฿${fmt(myShare)}</span>
          </div>`;
        }
      });
      html += `</div>`;
    }

    // Section: expenses M owes to others
    if (owedExpenses.length > 0) {
      const expSettled = trip.expSettled || [];
      html += `<div class="tsummary-items tsummary-items-owe">
        <div class="tsummary-section-lbl tsummary-lbl-owe">💸 ${m} ค้างจ่าย</div>`;
      owedExpenses.forEach(e => {
        const share = getShare(e, m);
        const shareKey = `${e.id}|${m}`;
        const isPaid = expSettled.includes(shareKey);
        const mSafe = m.replace(/'/g, "\\'");
        html += `<div class="tsummary-row tsummary-row-payable ${isPaid ? 'share-paid' : ''}">
          <span class="tsummary-cat">${e.cat.split(' ')[0]}</span>
          <div class="tsummary-row-body">
            <span class="tsummary-iname">${e.name} <span class="tsummary-paidby">(${e.paidBy} จ่าย)</span></span>
            <span class="tsummary-iamt tsummary-iamt-owe ${isPaid ? 'amt-paid' : ''}">-฿${fmt(share)}</span>
          </div>
          <button class="share-toggle-btn ${isPaid ? 'share-toggle-done' : 'share-toggle-unpaid'}"
            onclick="toggleExpenseShare(${e.id}, '${mSafe}')"
            title="${isPaid ? 'จ่ายแล้ว (คลิกเพื่อยกเลิก)' : 'ยังไม่จ่าย (คลิกเพื่อบันทึกการจ่าย)'}">
            ${isPaid
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
            }
          </button>
        </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `</div>`;
  el.innerHTML = html;
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
    container.innerHTML = emptyState('📊','ยังไม่มีข้อมูล','เพิ่มรายการค่าใช้จ่ายก่อนนะ');
    return;
  }
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const catTotals = {};
  trip.expenses.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + e.amount; });
  const sorted = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);

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
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) o.classList.remove('show');
  });
});

// ── IMAGE HANDLING ──
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('รูปภาพใหญ่เกิน 5MB', 'error'); return; }

  const reader = new FileReader();
  reader.onload = ev => {
    currentImageData = ev.target.result;
    showImagePreview(currentImageData);
  };
  reader.readAsDataURL(file);
}

function showImagePreview(src) {
  document.getElementById('img-placeholder').style.display  = 'none';
  document.getElementById('img-preview-wrap').style.display = 'flex';
  document.getElementById('img-preview').src = src;
}

function removeImage(e) {
  e.stopPropagation();
  currentImageData = null;
  document.getElementById('fi-image').value = '';
  document.getElementById('img-placeholder').style.display  = 'flex';
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-preview').src = '';
}

function resetImageUI() {
  currentImageData = null;
  document.getElementById('fi-image').value = '';
  document.getElementById('img-placeholder').style.display  = 'flex';
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-preview').src = '';
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  openModal('modal-lightbox');
}

// ── ADD EXPENSE (Create) ──
function openAddExpense() {
  const trip = currentTrip();
  if (!trip) { toast('กรุณาสร้างทริปก่อนนะ'); openModal('modal-trip'); return; }
  if (trip.members.length === 0) { toast('กรุณาเพิ่มสมาชิกก่อนนะ'); openModal('modal-member'); return; }

  editingExpenseId = null;
  document.getElementById('modal-expense-title').textContent = 'เพิ่มค่าใช้จ่าย';
  document.getElementById('modal-expense-sub').textContent   = 'บันทึกรายจ่ายใหม่ในทริปนี้';
  document.getElementById('btn-submit-expense').innerHTML    =
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> บันทึกรายการ`;

  document.getElementById('fi-name').value   = '';
  document.getElementById('fi-amount').value = '';
  document.getElementById('fi-name').classList.remove('error');
  document.getElementById('fi-amount').classList.remove('error');

  selectedParticipants = [...trip.members];
  splitMode  = 'equal';
  selectedCat = '🍜 อาหาร';
  customAmounts = {};
  resetImageUI();

  document.querySelectorAll('.split-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('st-equal').classList.add('active');

  buildCatGrid();
  buildPaidBySelect(trip);
  renderParticipantList();
  openModal('modal-expense');
  setTimeout(() => document.getElementById('fi-name').focus(), 380);
}

// ── EDIT EXPENSE ──
function openEditExpense() {
  closeModal('modal-detail');
  const trip = currentTrip();
  const exp  = trip.expenses.find(e => e.id === viewingExpenseId);
  if (!exp) return;

  editingExpenseId = exp.id;
  document.getElementById('modal-expense-title').textContent = 'แก้ไขรายการ';
  document.getElementById('modal-expense-sub').textContent   = 'แก้ไขข้อมูลค่าใช้จ่ายนี้';
  document.getElementById('btn-submit-expense').innerHTML    =
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> บันทึกการเปลี่ยนแปลง`;

  document.getElementById('fi-name').value   = exp.name;
  document.getElementById('fi-amount').value = exp.amount;
  selectedCat          = exp.cat;
  selectedParticipants = [...(exp.participants || [])];
  splitMode            = exp.splitMode || 'equal';
  customAmounts        = exp.customSplit ? { ...exp.customSplit } : {};

  document.querySelectorAll('.split-tab').forEach(t => t.classList.remove('active'));
  const activeTab = splitMode === 'self' ? 'st-self' : splitMode === 'custom' ? 'st-custom' : 'st-equal';
  document.getElementById(activeTab).classList.add('active');

  if (exp.image) {
    currentImageData = exp.image;
    showImagePreview(exp.image);
  } else {
    resetImageUI();
  }

  buildCatGrid();
  buildPaidBySelect(trip, exp.paidBy);
  renderParticipantList();
  openModal('modal-expense');
}

// ── SUBMIT EXPENSE (Create / Update) ──
function submitExpense() {
  const name   = document.getElementById('fi-name').value.trim();
  const amount = parseFloat(document.getElementById('fi-amount').value);
  const paidBy = document.getElementById('fi-paidby').value;
  let valid = true;
  if (!name)              { document.getElementById('fi-name').classList.add('error');   valid = false; }
  if (!amount || amount<=0){ document.getElementById('fi-amount').classList.add('error'); valid = false; }
  if (!valid) return;

  const trip = currentTrip();
  const participants = splitMode === 'self' ? [] : [...selectedParticipants];
  // for custom mode, save per-person amounts
  const customSplit = splitMode === 'custom' ? { ...customAmounts } : null;

  // validate custom: total must match amount
  if (splitMode === 'custom') {
    const total = participants.reduce((s, m) => s + (customAmounts[m] || 0), 0);
    if (Math.abs(total - amount) >= 1) {
      toast(`ยอดรวมไม่ตรง (ขาดอีก ฿${fmt(amount - total)})`, 'error');
      return;
    }
  }

  if (editingExpenseId !== null) {
    const idx = trip.expenses.findIndex(e => e.id === editingExpenseId);
    if (idx !== -1) {
      trip.expenses[idx] = {
        ...trip.expenses[idx],
        name, amount, cat: selectedCat,
        paidBy, participants,
        splitMode,
        customSplit,
        image: currentImageData,
      };
    }
    toast('แก้ไขรายการแล้ว ✓');
  } else {
    trip.expenses.push({
      id: Date.now(), name, amount, cat: selectedCat,
      paidBy, participants,
      splitMode,
      customSplit,
      settled: [], date: now(),
      image: currentImageData,
    });
    if (trip.settled) trip.settled = [];
    toast('เพิ่มรายการแล้ว ✓');
  }
  closeModal('modal-expense');
  render();
}

// ── EXPENSE DETAIL (Read) ──
function openExpenseDetail(id) {
  const trip = currentTrip();
  const exp  = trip.expenses.find(e => e.id === id);
  if (!exp) return;
  viewingExpenseId = id;

  const cat = CAT_MAP[exp.cat] || CAT_MAP['📦 อื่นๆ'];
  const emoji = exp.cat.split(' ')[0];
  document.getElementById('det-cat-icon').textContent    = emoji;
  document.getElementById('det-cat-icon').style.background = cat.bg;
  document.getElementById('det-name').textContent        = exp.name;
  document.getElementById('det-date').textContent        = exp.date;
  document.getElementById('det-amount').textContent      = fmt(exp.amount);
  document.getElementById('det-cat').textContent         = exp.cat;
  document.getElementById('det-paidby').textContent      = exp.paidBy;
  const perP = exp.participants && exp.participants.length > 0 ? exp.amount / exp.participants.length : exp.amount;
  if (exp.splitMode === 'self') {
    document.getElementById('det-participants').textContent = 'จ่ายเอง (ไม่หารกับใคร)';
  } else if (exp.splitMode === 'custom' && exp.customSplit) {
    const parts = (exp.participants || []).map(p => `${p} ฿${fmt(exp.customSplit[p] || 0)}`);
    document.getElementById('det-participants').textContent = parts.join(', ');
  } else {
    document.getElementById('det-participants').textContent =
      (exp.participants || []).join(', ') + ` (฿${fmt(perP)}/คน)`;
  }

  const imgWrap = document.getElementById('det-img-wrap');
  if (exp.image) {
    document.getElementById('det-img').src = exp.image;
    imgWrap.style.display = 'block';
  } else {
    imgWrap.style.display = 'none';
  }

  openModal('modal-detail');
}

// ── DELETE EXPENSE ──
function confirmDeleteExpense() {
  closeModal('modal-detail');
  openConfirm(
    'ลบรายการนี้?',
    'รายการนี้จะถูกลบและไม่สามารถกู้คืนได้',
    () => {
      const trip = currentTrip();
      trip.expenses = trip.expenses.filter(e => e.id !== viewingExpenseId);
      if (trip.settled) trip.settled = [];
      render();
      toast('ลบรายการแล้ว', 'error');
    }
  );
}

// ── ADD / EDIT MEMBER ──
function openAddMember() {
  editingMemberName = null;
  document.getElementById('modal-member-title').textContent   = 'เพิ่มสมาชิก';
  document.getElementById('btn-submit-member').textContent    = 'เพิ่มสมาชิก';
  document.getElementById('fi-member').value = '';
  openModal('modal-member');
  setTimeout(() => document.getElementById('fi-member').focus(), 380);
}

function openEditMember(name) {
  editingMemberName = name;
  document.getElementById('modal-member-title').textContent   = 'แก้ไขชื่อสมาชิก';
  document.getElementById('btn-submit-member').textContent    = 'บันทึก';
  document.getElementById('fi-member').value = name;
  openModal('modal-member');
  setTimeout(() => document.getElementById('fi-member').focus(), 380);
}

function submitMember() {
  const name = document.getElementById('fi-member').value.trim();
  if (!name) return;
  const trip = currentTrip();
  if (!trip) { toast('กรุณาสร้างทริปก่อนนะ'); return; }

  if (editingMemberName !== null) {
    if (trip.members.includes(name) && name !== editingMemberName) {
      toast('ชื่อนี้มีอยู่แล้ว', 'error'); return;
    }
    const idx = trip.members.indexOf(editingMemberName);
    if (idx !== -1) {
      trip.members[idx] = name;
      trip.expenses.forEach(exp => {
        if (exp.paidBy === editingMemberName) exp.paidBy = name;
        exp.participants = exp.participants.map(p => p === editingMemberName ? name : p);
      });
    }
    toast(`เปลี่ยนชื่อเป็น "${name}" แล้ว ✓`);
  } else {
    if (trip.members.includes(name)) { toast('ชื่อนี้มีอยู่แล้ว', 'error'); return; }
    trip.members.push(name);
    toast(`เพิ่ม ${name} แล้ว ✓`);
  }
  document.getElementById('fi-member').value = '';
  closeModal('modal-member');
  render();
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
    const dateStr = formatTripDateRange(trip.startDate, trip.endDate);
    return `
      <div class="trip-card ${isCurr ? 'curr' : ''}">
        <div class="tc-emoji" onclick="selectTrip(${trip.id})">${trip.emoji}</div>
        <div class="tc-info" onclick="selectTrip(${trip.id})">
          <h4>${trip.name}</h4>
          ${dateStr ? `<div class="tc-dates">${dateStr}</div>` : ''}
          <p>${trip.members.length} คน • ${trip.expenses.length} รายการ • ฿${fmt(total)}</p>
        </div>
        <button class="tc-edit-btn" onclick="openEditTrip(${trip.id})" title="แก้ไข">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
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
  const name      = document.getElementById('fi-trip-name').value.trim();
  const emoji     = document.getElementById('fi-trip-emoji').value.trim() || '✈️';
  const startDate = document.getElementById('fi-trip-start').value;
  const endDate   = document.getElementById('fi-trip-end').value;
  if (!name) return;
  const id = Date.now();
  state.trips.push({ id, name, emoji, startDate, endDate, members: [], expenses: [], settled: [] });
  state.currentTrip = id;
  document.getElementById('fi-trip-name').value  = '';
  document.getElementById('fi-trip-emoji').value = '';
  document.getElementById('fi-trip-start').value = '';
  document.getElementById('fi-trip-end').value   = '';
  closeModal('modal-trip');
  render();
  openAddMember();
  toast(`สร้างทริป "${name}" แล้ว ✓`);
}

// ── EDIT TRIP ──
function openEditTrip(id) {
  editingTripId = id;
  const trip = tripById(id);
  if (!trip) return;
  document.getElementById('fi-edit-trip-name').value  = trip.name;
  document.getElementById('fi-edit-trip-emoji').value = trip.emoji;
  document.getElementById('fi-edit-trip-start').value = trip.startDate || '';
  document.getElementById('fi-edit-trip-end').value   = trip.endDate   || '';
  renderMemberManageList(trip);
  closeModal('modal-trip');
  openModal('modal-edit-trip');
}

function renderMemberManageList(trip) {
  const list = document.getElementById('member-manage-list');
  if (trip.members.length === 0) {
    list.innerHTML = `<div class="empty-sub" style="padding:12px 0">ยังไม่มีสมาชิก</div>`;
    return;
  }
  list.innerHTML = trip.members.map((m, i) => {
    const p = pal(i);
    return `
      <div class="member-manage-row">
        <div class="m-avatar" style="background:${p.bg};color:${p.fg};width:32px;height:32px;font-size:11px">${initials(m)}</div>
        <div class="member-manage-name">${m}</div>
        <button class="member-manage-del" onclick="removeMember('${m.replace(/'/g,"\\'")}',${trip.id})" title="ลบสมาชิก">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>`;
  }).join('');
}

function removeMember(name, tripId) {
  openConfirm(
    `ลบสมาชิก "${name}"?`,
    'รายการที่สมาชิกนี้เกี่ยวข้องจะยังคงอยู่',
    () => {
      const trip = tripById(tripId);
      if (!trip) return;
      trip.members = trip.members.filter(m => m !== name);
      renderMemberManageList(trip);
      render();
      toast(`ลบ ${name} แล้ว`);
    }
  );
}

function submitEditTrip() {
  const name      = document.getElementById('fi-edit-trip-name').value.trim();
  const emoji     = document.getElementById('fi-edit-trip-emoji').value.trim() || '✈️';
  const startDate = document.getElementById('fi-edit-trip-start').value;
  const endDate   = document.getElementById('fi-edit-trip-end').value;
  if (!name) return;
  const trip = tripById(editingTripId);
  if (!trip) return;
  trip.name      = name;
  trip.emoji     = emoji;
  trip.startDate = startDate;
  trip.endDate   = endDate;
  closeModal('modal-edit-trip');
  render();
  toast(`อัพเดททริป "${name}" แล้ว ✓`);
}

// ── DELETE TRIP ──
function confirmDeleteTrip() {
  const trip = tripById(editingTripId);
  if (!trip) return;
  openConfirm(
    `ลบทริป "${trip.name}"?`,
    'ทริปและรายการทั้งหมดจะถูกลบถาวร',
    () => {
      state.trips = state.trips.filter(t => t.id !== editingTripId);
      if (state.currentTrip === editingTripId) {
        state.currentTrip = state.trips.length > 0 ? state.trips[0].id : null;
      }
      closeModal('modal-edit-trip');
      render();
      toast('ลบทริปแล้ว', 'error');
    }
  );
}

// ── CONFIRM DIALOG ──
function openConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  const btn = document.getElementById('confirm-ok-btn');
  btn.onclick = () => { closeModal('modal-confirm'); onOk(); };
  openModal('modal-confirm');
}

// ── MARK SETTLED ──
function markSettled(key) {
  const trip = currentTrip();
  if (!trip.settled) trip.settled = [];
  if (!trip.settled.includes(key)) trip.settled.push(key);
  render();
  toast('บันทึกการโอนแล้ว ✓');
}

function unmarkSettled(key) {
  const trip = currentTrip();
  if (!trip.settled) return;
  trip.settled = trip.settled.filter(k => k !== key);
  render();
  toast('เปลี่ยนเป็นรอโอนแล้ว');
}

// ── PER-EXPENSE-SHARE SETTLED ──
// key format: "expId|debtor"  (debtor already paid payer for this expense share)
function toggleExpenseShare(expId, debtor) {
  const trip = currentTrip();
  if (!trip.expSettled) trip.expSettled = [];
  const key = `${expId}|${debtor}`;
  if (trip.expSettled.includes(key)) {
    trip.expSettled = trip.expSettled.filter(k => k !== key);
    toast('ยกเลิกการจ่ายแล้ว');
  } else {
    trip.expSettled.push(key);
    toast('บันทึกการจ่ายแล้ว ✓');
  }
  render();
}

// ── FORM BUILDERS ──
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

function buildPaidBySelect(trip, selected = null) {
  const sel = selected || (trip.members[0] || '');
  document.getElementById('fi-paidby').innerHTML =
    trip.members.map(m => `<option value="${m}" ${m===sel?'selected':''}>${m}</option>`).join('');
}

function selectCat(el) {
  document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selectedCat = el.dataset.cat;
}

function setSplitMode(mode) {
  splitMode = mode;
  document.getElementById('st-self').classList.toggle('active', mode === 'self');
  document.getElementById('st-equal').classList.toggle('active', mode === 'equal');
  document.getElementById('st-custom').classList.toggle('active', mode === 'custom');
  if (mode === 'custom') {
    // pre-fill equal amounts as starting point
    const amount = parseFloat(document.getElementById('fi-amount').value) || 0;
    const perP = selectedParticipants.length > 0 ? Math.round(amount / selectedParticipants.length) : 0;
    customAmounts = {};
    selectedParticipants.forEach(m => { customAmounts[m] = perP; });
  }
  renderParticipantList();
}

function renderParticipantList() {
  const trip   = currentTrip();
  const list   = document.getElementById('p-list-wrap');
  const amount = parseFloat(document.getElementById('fi-amount').value) || 0;

  if (splitMode === 'self') {
    list.innerHTML = `<div class="self-paid-note">
      <span>💰</span>
      <span>รายการนี้ถือว่า <strong>จ่ายเองทั้งหมด</strong> — ไม่หารกับใครในกลุ่ม</span>
    </div>`;
    return;
  }

  if (splitMode === 'custom') {
    // custom mode: show all members, toggle select + editable amount
    const totalAssigned = selectedParticipants.reduce((s, m) => s + (customAmounts[m] || 0), 0);
    const remaining     = Math.round((amount - totalAssigned) * 100) / 100;
    const rows = trip.members.map((m, i) => {
      const p   = pal(i);
      const sel = selectedParticipants.includes(m);
      const val = sel ? (customAmounts[m] !== undefined ? customAmounts[m] : '') : '';
      return `
        <div class="p-row ${sel ? 'sel' : ''}" style="align-items:center">
          <div class="p-av" style="background:${p.bg};color:${p.fg};cursor:pointer" onclick="toggleP('${m.replace(/'/g,"\\'")}')">
            ${initials(m)}
          </div>
          <div class="p-name-txt" style="cursor:pointer;flex:1" onclick="toggleP('${m.replace(/'/g,"\\'")}')">
            ${m}
          </div>
          ${sel
            ? `<div class="custom-amt-wrap">
                <span class="fi-cur" style="font-size:13px;padding:0 4px 0 0">฿</span>
                <input class="custom-amt-input" type="number" min="0" step="1"
                  value="${val}"
                  placeholder="0"
                  onclick="event.stopPropagation()"
                  oninput="setCustomAmt('${m.replace(/'/g,"\\'")}', this.value)">
              </div>`
            : `<div class="p-check"></div>`
          }
        </div>`;
    }).join('');
    const remClass = Math.abs(remaining) < 1 ? 'custom-remain-ok' : remaining < 0 ? 'custom-remain-over' : 'custom-remain-left';
    const remText  = Math.abs(remaining) < 1
      ? '✓ ยอดครบแล้ว'
      : remaining > 0 ? `ยังเหลือ ฿${fmt(remaining)}` : `เกินไป ฿${fmt(Math.abs(remaining))}`;
    list.innerHTML = rows + `
      <div class="custom-remain-bar ${remClass}">
        <span>${remText}</span>
        <span>รวมที่กำหนด ฿${fmt(totalAssigned)} / ฿${fmt(amount)}</span>
      </div>`;
    return;
  }

  // equal mode
  const perP   = selectedParticipants.length > 0 ? Math.round(amount / selectedParticipants.length) : 0;
  list.innerHTML = trip.members.map((m, i) => {
    const p   = pal(i);
    const sel = selectedParticipants.includes(m);
    return `
      <div class="p-row ${sel ? 'sel' : ''}" onclick="toggleP('${m.replace(/'/g,"\\'")}')">
        <div class="p-av" style="background:${p.bg};color:${p.fg}">${initials(m)}</div>
        <div class="p-name-txt">${m}</div>
        ${sel && amount > 0 ? `<div class="p-share-lbl">฿${fmt(perP)}</div>` : ''}
        <div class="p-check">${sel ? '✓' : ''}</div>
      </div>`;
  }).join('');
}

// custom amount per person
let customAmounts = {};

function setCustomAmt(member, val) {
  customAmounts[member] = parseFloat(val) || 0;
  // re-render just the summary bar without full re-render
  const amount = parseFloat(document.getElementById('fi-amount').value) || 0;
  const totalAssigned = selectedParticipants.reduce((s, m) => s + (customAmounts[m] || 0), 0);
  const remaining = Math.round((amount - totalAssigned) * 100) / 100;
  const bar = document.querySelector('.custom-remain-bar');
  if (!bar) return;
  const remClass = Math.abs(remaining) < 1 ? 'custom-remain-ok' : remaining < 0 ? 'custom-remain-over' : 'custom-remain-left';
  const remText  = Math.abs(remaining) < 1
    ? '✓ ยอดครบแล้ว'
    : remaining > 0 ? `ยังเหลือ ฿${fmt(remaining)}` : `เกินไป ฿${fmt(Math.abs(remaining))}`;
  bar.className = `custom-remain-bar ${remClass}`;
  bar.innerHTML = `<span>${remText}</span><span>รวมที่กำหนด ฿${fmt(totalAssigned)} / ฿${fmt(amount)}</span>`;
}

function toggleP(member) {
  const idx = selectedParticipants.indexOf(member);
  if (idx >= 0) {
    if (splitMode !== 'custom' && selectedParticipants.length <= 1) return;
    selectedParticipants.splice(idx, 1);
    if (splitMode === 'custom') delete customAmounts[member];
  } else {
    selectedParticipants.push(member);
  }
  renderParticipantList();
}

// ── EVENT LISTENERS ──
document.getElementById('fi-amount').addEventListener('input', () => {
  if (document.getElementById('modal-expense').classList.contains('show')) renderParticipantList();
});
document.getElementById('fi-name').addEventListener('keydown',      e => { if (e.key==='Enter') document.getElementById('fi-amount').focus(); });
document.getElementById('fi-amount').addEventListener('keydown',    e => { if (e.key==='Enter') submitExpense(); });
document.getElementById('fi-member').addEventListener('keydown',    e => { if (e.key==='Enter') submitMember(); });
document.getElementById('fi-trip-name').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('fi-trip-emoji').focus(); });
document.getElementById('fi-trip-emoji').addEventListener('keydown',e => { if (e.key==='Enter') submitTrip(); });

// drag-over highlight
const uploadArea = document.getElementById('img-upload-area');
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    if (file.size > 5 * 1024 * 1024) { toast('รูปภาพใหญ่เกิน 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => { currentImageData = ev.target.result; showImagePreview(currentImageData); };
    reader.readAsDataURL(file);
  }
});

// ── INIT ──
let _initDone = false;

function showLoadingOverlay(show) {
  let el = document.getElementById('loading-overlay');
  if (!el) return;
  el.style.display = show ? 'flex' : 'none';
}

showLoadingOverlay(true);
renderOnly(); // render ตัวเปล่าก่อน ไม่ให้หน้าว่างค้าง (ไม่ save)
setTimeout(() => {
  if (!_initDone) {
    _initDone = true;
    showLoadingOverlay(false);
    if (state.trips.length === 0) setTimeout(() => openTripModal(), 200);
  }
}, 8000);
