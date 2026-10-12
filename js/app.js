// LedgerOne for iPad — screens and interaction.
import * as Store from './store.js';
import * as Sync from './sync.js';
import * as Crypto from './crypto.js';
import * as Lock from './lock.js';
import {
  Ledger, p, pounds, num, isCategory, isLiability, RealTypes, TypeLabel, TypeGroupLabel, Frequencies,
  today, dOf, toDocDate, fmtDate, addMonths, addDays, Ranges, Filters, PastMonthAndFuture, NewOnly, UnclearedOnly, rangeFor, newId, MAX,
} from './ledger.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const { pref, setPref } = Store;
/** Stored status names are kept for compatibility; show Moneydance's words (its green "Cleared" is stored as Reconciled). */
const StatusLabel = { Uncleared: 'Uncleared', Cleared: 'Reconciling', Reconciled: 'Cleared' };

// ---------- icons (inline SVG, currentColor) ----------
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const I = {
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  home: svg('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  Bank: svg('<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>'),
  CreditCard: svg('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  Investment: svg('<path d="M4 19V5M4 19h16M7 15l4-5 3 3 5-7"/>'),
  Asset: svg('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  Liability: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
  Loan: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h8"/>'),
  Expense: svg('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
  Income: svg('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  pie: svg('<path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'),
  budget: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 10h18"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  chev: svg('<path d="M6 9l6 6 6-6"/>', 'class="chev"'),
  left: svg('<path d="M15 6l-6 6 6 6"/>'), right: svg('<path d="M9 6l6 6-6 6"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: svg('<path d="M21 5H9l-6 7 6 7h12z"/><path d="M17 9l-5 6M12 9l5 6"/>'),
  face: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M9 9v1M15 9v1M12 9v4h-1M9 16c1.5 1 4.5 1 6 0"/>'),
};
const iconFor = (type) => I[type] || I.Bank;
const tint = { acct: 'var(--acct)', Expense: 'var(--exp)', Income: 'var(--inc)', rem: 'var(--rem)', home: 'var(--home)', budget: 'var(--acct)', report: '#f4a536' };

// ---------- state ----------
let state = { doc: null, baseText: null, rev: null, dirty: false };
let L = null;
let lastSync = 0;
let syncing = null;
const ui = {
  range: 1,                                   // register filter: "This month"
  query: '',
  collapsed: new Set(pref('collapsed', ['Asset', 'Income'])),
  homeCollapsed: new Set(pref('homeCollapsed', [])),
  calMonth: null,
  upcomingDays: pref('upcomingDays', 14),
  catRange: 1,
  budgetMonth: null,
};

// ---------- persistence ----------
let persistTimer = null;
function persist() { clearTimeout(persistTimer); persistTimer = setTimeout(persistNow, 400); }
async function persistNow() {
  clearTimeout(persistTimer);
  if (!state.doc) return;
  await Store.set('doc', JSON.stringify(state.doc));
  await Store.set('meta', { rev: state.rev, dirty: state.dirty, lastSync, enc: state.enc || null });
}

/** Call after any local edit. */
function changed() {
  state.dirty = true;
  L.invalidate();
  persist();
  render();
  scheduleSync(8000);   // batch quick edits: each sync uploads the whole book
}

// ---------- sync ----------
let syncTimer = null;
function scheduleSync(ms) { clearTimeout(syncTimer); if (Sync.connected()) syncTimer = setTimeout(() => syncNow(), ms); }

function setStatus(kind, text) {
  const b = $('#syncBtn');
  b.querySelector('.sync-dot').className = 'sync-dot ' + kind;
  b.querySelector('.label').textContent = text;
}

function syncNow(opts = {}) {
  if (lockShown) return Promise.resolve();          // wait until unlocked: no prompts over the lock screen
  if (!Sync.connected()) { setStatus('off', 'Sync not set up'); return Promise.resolve(); }
  if (syncing) return syncing;
  if (!navigator.onLine) { setStatus('off', state.dirty ? 'Offline · changes kept on iPad' : 'Offline'); return Promise.resolve(); }
  setStatus('busy', 'Syncing…');
  syncing = (async () => {
    try {
      const res = await Sync.syncDropbox(state, opts);
      if (res.message === 'missing') { setStatus('err', 'No ledger.json in Dropbox yet'); return res; }
      state = res.state;
      lastSync = Date.now();
      if (res.changed) { L = new Ledger(state.doc); render(); }
      await Store.set('base', state.baseText);
      await persistNow();
      setStatus('ok', 'Synced ' + new Date(lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      if (res.message !== 'Up to date') toast(res.message);
      return res;
    } catch (e) {
      console.error(e);
      if (e instanceof Crypto.NeedPassphrase) {
        setStatus('err', 'Locked · tap to unlock');
        locked = e;
        setTimeout(() => promptUnlock(e, () => syncNow(opts)), 0);
      } else {
        setStatus('err', 'Sync failed');
        toast(e.message || String(e));
      }
    } finally { syncing = null; }
  })();
  return syncing;
}

// ---------- encrypted books ----------
let locked = null;     // the NeedPassphrase error while the book in Dropbox can't be opened here

function promptUnlock(err, retry) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog">
    <div class="dlg-head"><h2>Unlock your book</h2></div>
    <div class="dlg-body">
      <p>Your LedgerOne book is encrypted. Enter its passphrase to open it on this iPad. LedgerOne remembers it here, so you only need to do this once.</p>
      <div class="form"><label class="w4">Passphrase<input type="password" name="pass" autocomplete="current-password" autocapitalize="off" spellcheck="false"></label></div>
      <div class="err">${err.wrong ? 'The saved passphrase no longer opens the book. It may have been changed on your PC.' : ''}</div>
    </div>
    <div class="dlg-foot"><span class="spacer"></span><button class="btn" value="cancel">Not now</button><button type="button" class="btn primary" data-unlock>Unlock</button></div>
  </form>`;
  const f = dlg.querySelector('form'), msg = dlg.querySelector('.err'), btn = dlg.querySelector('[data-unlock]');
  btn.addEventListener('click', async () => {
    msg.textContent = 'Checking…';
    btn.disabled = true;
    try {
      await Crypto.unlock(f.pass.value, err.fileText);
      locked = null;
      dlg.close();
      toast('Unlocked');
      retry();
    } catch {
      msg.textContent = "That passphrase didn't open the book. Try again.";
    } finally { btn.disabled = false; }
  });
  f.pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
  dlg.showModal();
  setTimeout(() => f.pass.focus(), 50);
}

// ---------- app lock (PIN, Face ID / Touch ID) ----------
let lockShown = false, hiddenAt = 0;

async function showLock(after) {
  if (lockShown) return;
  lockShown = true;
  const l = await Lock.get();
  const bio = !!l?.bio && await Lock.bioAvailable();
  const len = l?.length || 4;
  document.querySelector('#dlg')?.open && document.querySelector('#dlg').close();
  const el = document.createElement('div');
  el.id = 'lock';
  el.innerHTML = `<div class="lock-box">
      <img src="icons/icon-192.png" alt="">
      <h1>LedgerOne</h1>
      <p class="lock-msg">Enter your PIN</p>
      <div class="lock-dots">${'<i></i>'.repeat(len)}</div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
        ${bio ? `<button data-bio aria-label="Use Face ID or Touch ID">${I.face}</button>` : '<span></span>'}
        <button data-k="0">0</button>
        <button data-del aria-label="Delete">${I.back}</button>
      </div>
      ${bio ? '<button class="lock-link" data-bio>Use Face ID / Touch ID</button>' : ''}
      <button class="lock-link" data-forgot>Forgot PIN?</button>
    </div>`;
  document.body.appendChild(el);
  const msg = el.querySelector('.lock-msg'), dots = [...el.querySelectorAll('.lock-dots i')];
  let pin = '', busy = false;
  const show = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const done = () => {
    el.remove(); lockShown = false;
    document.removeEventListener('keydown', onKey, true);
    after && after();
  };
  async function tryPin() {
    busy = true;
    const r = await Lock.checkPin(pin);
    busy = false;
    if (r.ok) return done();
    pin = ''; show();
    el.querySelector('.lock-dots').classList.remove('shake'); void el.offsetWidth; el.querySelector('.lock-dots').classList.add('shake');
    msg.textContent = r.wait ? `Too many tries. Try again in ${r.wait < 60 ? r.wait + ' seconds' : Math.ceil(r.wait / 60) + ' minutes'}.` : 'Wrong PIN. Try again.';
  }
  function press(k) {                               // instant: the lockout is checked when the PIN is submitted
    if (busy) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 8) pin += k;
    show();
    if (pin.length >= len) tryPin();
  }
  function onKey(e) {
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
  }
  document.addEventListener('keydown', onKey, true);
  Lock.waitSeconds().then(w => { if (w) msg.textContent = `Too many tries. Try again in ${w < 60 ? w + ' seconds' : Math.ceil(w / 60) + ' minutes'}.`; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) press(b.dataset.k);
    else if (b.hasAttribute('data-del')) press('del');
    else if (b.hasAttribute('data-bio')) {
      try { if (await Lock.unlockWithBio()) done(); else msg.textContent = "Face ID / Touch ID didn't match. Use your PIN."; }
      catch { msg.textContent = 'Face ID / Touch ID was cancelled. Use your PIN.'; }
    } else if (b.hasAttribute('data-forgot')) {
      if (!confirm('Forgot your PIN? This erases LedgerOne on this iPad and disconnects Dropbox. Your book stays safe in Dropbox and on your PC: reconnect Dropbox afterwards to get it back.')) return;
      await Store.del('doc'); await Store.del('base'); await Store.del('meta'); await Crypto.forgetKey(); await Lock.remove();
      Sync.disconnect();
      location.reload();
    }
  });
  show();
}

/** Lock again when the app comes back after being away longer than the chosen time. */
async function relockIfDue() {
  const l = await Lock.get();
  if (!l?.hash || lockShown || !hiddenAt) return;
  if ((Date.now() - hiddenAt) / 1000 >= (l.timeout ?? 60)) showLock(() => { render(); syncNow(); });
}

// ---------- theme ----------
function effectiveDark() {
  const t = pref('theme', 'system');
  return t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
}
function applyTheme() {
  const t = pref('theme', 'system');
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = effectiveDark();
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#232323' : '#f6f6f7');
  const b = $('#themeBtn');
  b.innerHTML = (dark ? I.sun : I.moon) + `<span class="label-wide">${dark ? 'Light mode' : 'Dark mode'}</span>`;
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ---------- routing ----------
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  return { name: name || 'home', arg: arg ? decodeURIComponent(arg) : null };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

let lastRoute = '', searching = false;
function render() {
  if (lockShown) return;
  const r = parseRoute();
  const key = `${r.name}/${r.arg || ''}`;
  if (key !== lastRoute) {
    // a freshly opened register starts on "This month" with no filter text, like Windows
    if (!searching) { ui.query = ''; ui.range = 1; }
    searching = false; lastRoute = key;
  }
  document.body.classList.remove('nav-open');
  renderSidebar(r);
  const main = $('#main');
  if (!L && r.name !== 'settings') { main.innerHTML = pageWelcome(); bindWelcome(main); return; }
  switch (r.name) {
    case 'acct': return pageRegister(main, r.arg);
    case 'all': return pageRegister(main, null);
    case 'reminders': return pageReminders(main);
    case 'categories': return pageCategories(main);
    case 'budget': return pageBudget(main);
    case 'settings': return pageSettings(main);
    default: return pageHome(main);
  }
}

// ---------- sidebar ----------
function renderSidebar(r) {
  const sb = $('#sidebar');
  if (!L) { sb.innerHTML = sbRow('#/settings', I.gear, 'var(--fg2)', 'Settings', '', r.name === 'settings'); return; }
  const sel = (n, a) => r.name === n && (a === undefined || r.arg === a);
  const due = L.upcoming(today()).length;
  let h = sbRow('#/home', I.home, tint.home, 'Summary', '', sel('home'))
        + sbRow('#/reminders', I.bell, tint.rem, 'Reminders', due ? `<span class="badge">${due}</span>` : '', sel('reminders'));
  const showClosed = pref('showClosed', false);
  const withNew = L.accountsWithNew();
  for (const type of RealTypes) {
    const accts = L.realAccounts.filter(a => a.Type === type && a.ShowInSidebar !== false && (showClosed || !a.Closed))
      .sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' }));
    if (!accts.length) continue;
    const c = ui.collapsed.has(type);
    h += sbHead(TypeLabel[type].toUpperCase(), type, c);
    if (!c) for (const a of accts)
      h += sbRow(`#/acct/${encodeURIComponent(a.Id)}`, iconFor(type), tint.acct, a.Name, esc(L.format(L.sidebarBalance(a), a)) + (withNew.has(a.Id) ? ' <i class="newdot" title="New downloads to confirm"></i>' : ''), sel('acct', a.Id), a.Closed);
  }
  for (const [type, label] of [['Expense', 'EXPENSE'], ['Income', 'INCOME']]) {
    const cats = L.categories.filter(c => c.Type === type && c.ShowInSidebar && !c.Closed)
      .sort((a, b) => L.fullName(a).localeCompare(L.fullName(b)));
    if (!cats.length) continue;
    const c = ui.collapsed.has(type);
    h += sbHead(label, type, c);
    if (!c) for (const cat of cats) {
      let total = L.categoryRollup(cat); if (type === 'Income') total = -total;
      h += sbRow(`#/acct/${encodeURIComponent(cat.Id)}`, iconFor(type), tint[type], cat.Name, esc(L.format(total)), sel('acct', cat.Id));
    }
  }
  const vc = ui.collapsed.has('Views');
  h += sbHead('VIEWS', 'Views', vc);
  if (!vc) h += sbRow('#/all', I.list, tint.acct, 'All Transactions', '', sel('all'))
             + sbRow('#/categories', I.pie, tint.Expense, 'Categories', '', sel('categories'))
             + sbRow('#/budget', I.budget, tint.budget, 'Budget', '', sel('budget'));
  h += `<div style="height:10px"></div>` + sbRow('#/settings', I.gear, 'var(--fg2)', 'Settings', '', sel('settings'));
  sb.innerHTML = h;
  sb.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
const sbRow = (href, icon, color, name, val, selected, closed) =>
  `<a class="sb-row${selected ? ' sel' : ''}${closed ? ' closed' : ''}" href="${href}"><span class="ico" style="color:${selected ? '#fff' : color}">${icon}</span><span class="nm">${esc(name)}</span><span class="val">${val}</span></a>`;
const sbHead = (label, key, collapsed) => `<button class="sb-head${collapsed ? ' collapsed' : ''}" data-toggle="${key}">${I.chev}${label}</button>`;

// ---------- welcome ----------
function pageWelcome() {
  return `<div class="page"><div class="welcome">
    <img src="icons/icon-192.png" alt="">
    <h1>LedgerOne for iPad</h1>
    <p class="muted">Your LedgerOne book from Windows, on the iPad. Connect Dropbox to keep both in sync, or open a copy of your <code>ledger.json</code> from the Files app.</p>
    <div class="row-gap"><a class="btn primary" href="#/settings">Set up Dropbox sync</a><button class="btn" data-act="open">Open a file…</button></div>
  </div></div>`;
}
function bindWelcome(el) { el.querySelector('[data-act="open"]')?.addEventListener('click', openFile); }

// ---------- summary ----------
function pageHome(main) {
  const [mFrom, mTo] = rangeFor(1);
  const { inc, exp } = L.incomeExpense(mFrom, mTo);
  let bExp = 0, bInc = 0;
  for (const it of L.doc.Budget.Items) { const c = L.find(it.CategoryId); if (!c) continue; if (c.Type === 'Income') bInc += p(it.Monthly); else bExp += p(it.Monthly); }
  const bar = (label, actual, budget, cls) => {
    const scale = Math.max(actual, budget, 1);
    return `<div>${label}</div><div class="track"><div class="hatch ${cls}" style="width:${(budget / scale * 100).toFixed(2)}%"></div><div class="solid ${cls}" style="width:${(Math.max(actual, 0) / scale * 100).toFixed(2)}%"></div></div><div class="num">${esc(L.format(actual))}${budget ? ` <span class="muted">/ ${esc(L.format(budget))}</span>` : ''}</div>`;
  };
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  let left = '';
  for (const type of RealTypes) {
    const accts = L.realAccounts.filter(a => a.Type === type && !a.Closed && !(a.ParentId && L.find(a.ParentId) && !isCategory(L.find(a.ParentId))))
      .sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' }));
    if (!accts.length) continue;
    const key = type, c = ui.homeCollapsed.has(key);
    let total = 0, rows = '';
    for (const a of accts) {
      const v = L.sidebarBalance(a); total += v;
      rows += `<a class="lead" href="#/acct/${encodeURIComponent(a.Id)}"><span class="nm">${esc(a.Name)}</span><span class="dots"></span><span class="v${v < 0 ? ' neg' : ''}">${esc(L.format(v, a))}</span></a>`;
    }
    left += widget(TypeGroupLabel[type], key, c, 'Current Balance', rows + `<div class="total${total < 0 ? ' neg' : ''}">${esc(L.format(total))}</div>`);
  }
  const nw = L.netWorth();
  left += widget('Net Worth', 'networth', ui.homeCollapsed.has('networth'), '',
    `<div class="lead"><span class="nm">Net worth (open accounts)</span><span class="dots"></span><span class="v${nw < 0 ? ' neg' : ''}">${esc(L.format(nw))}</span></div>`);

  // reminders
  const until = addDays(today(), ui.upcomingDays);
  const up = upcomingItems(until).slice(0, 40);
  const daysLabel = { 7: 'One Week', 14: 'Two Weeks', 31: 'One Month' }[ui.upcomingDays] || `${ui.upcomingDays} days`;
  let rem = up.map(u => {
    const href = u.txn ? `#/acct/${encodeURIComponent(u.accountId)}` : '#/reminders';
    return `<a class="lead" href="${href}"><span class="d${u.date < today() ? ' overdue' : ''}">${fmtDate(u.date).slice(0, 5)}</span><span class="nm">${esc(u.desc)}</span><span class="dots"></span><span class="v${u.amount < 0 ? ' neg' : ''}">${esc(L.format(u.amount))}</span></a>`;
  }).join('') || '<div class="muted" style="padding:6px 0">Nothing due.</div>';
  const right = `<div class="widget"><div class="w-title"><span class="t"><a class="rem-title" href="#/reminders">Reminders</a></span>
      <button class="iconbtn" data-act="days" style="height:28px;color:var(--title)">UPCOMING · ${daysLabel}</button></div><div class="remlist">${rem}</div></div>`
    + calendar();
  main.innerHTML = `<div class="page">
    <div class="budgetbar" data-act="budget"><div class="muted" style="grid-column:1/-1">Monthly Budget · ${esc(monthName)}</div>${bar('Expenses', exp, bExp, 'exp')}${bar('Income', inc, bInc, 'inc')}</div>
    <div class="home"><div>${left}</div><div>${right}</div></div></div>`;
  main.querySelectorAll('[data-hc]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.hc; ui.homeCollapsed.has(k) ? ui.homeCollapsed.delete(k) : ui.homeCollapsed.add(k);
    setPref('homeCollapsed', [...ui.homeCollapsed]); render();
  }));
  main.querySelector('[data-act="budget"]').addEventListener('click', () => go('#/budget'));
  main.querySelector('[data-act="days"]').addEventListener('click', () => {
    ui.upcomingDays = ui.upcomingDays === 7 ? 14 : ui.upcomingDays === 14 ? 31 : 7; setPref('upcomingDays', ui.upcomingDays); render();
  });
  main.querySelectorAll('[data-cal]').forEach(b => b.addEventListener('click', () => {
    ui.calMonth = addMonths(ui.calMonth, Number(b.dataset.cal), 1); render();
  }));
}
const widget = (title, key, collapsed, right, body) =>
  `<div class="widget"><div class="w-title"><button class="tg" data-hc="${key}">${collapsed ? '+' : '–'}</button><span class="t">${esc(title)}</span><span>${esc(right)}</span></div>${collapsed ? '' : body}</div>`;

/** Reminders due plus post-dated transactions already entered (as LedgerOne for Windows shows them). */
function upcomingItems(until, from) {
  const start = from || today(), t = today();
  const items = L.upcoming(until).filter(u => !from || u.date >= start).map(({ r, date }) => ({
    date, desc: r.Description || r.Payee, accountId: r.AccountId, amount: (r.Splits || []).reduce((s, x) => s + p(x.Amount), 0), reminder: r,
  }));
  for (const x of L.doc.Transactions) {
    const d = dOf(x.Date);
    if (d <= t || d < start || d > until) continue;
    const a = L.find(x.AccountId);
    if (!a || isCategory(a)) continue;
    items.push({ date: d, desc: x.Payee, accountId: x.AccountId, amount: (x.Splits || []).reduce((s, y) => s + p(y.Amount), 0), txn: x });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function calendar() {
  ui.calMonth ??= today().slice(0, 8) + '01';
  const first = ui.calMonth, [y, m] = first.split('-').map(Number);
  const last = addDays(addMonths(first, 1), -1);
  const events = new Map();
  for (const u of upcomingItems(last, first)) { if (!events.has(u.date)) events.set(u.date, []); events.get(u.date).push(u.desc); }
  const startDow = new Date(y, m - 1, 1).getDay();
  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('');
  let d = addDays(first, -startDow);
  const t = today();
  for (let i = 0; i < 42; i++) {
    const ev = events.get(d) || [];
    const cls = [d.slice(0, 7) !== first.slice(0, 7) ? 'other' : '', ev.length ? 'ev' : '', d < t ? 'past' : '', d === t ? 'today' : ''].join(' ');
    cells += `<div class="${cls}"><div class="dn">${Number(d.slice(8))}</div>${ev.length === 1 ? `<div class="it">${esc(ev[0])}</div>` : ev.length ? `<div class="it">${ev.length} items</div>` : ''}</div>`;
    d = addDays(d, 1);
    if (i === 34 && d > last) break;
  }
  const title = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `<div class="widget"><div class="cal-head"><span class="m">${title}</span><button class="iconbtn" data-cal="-1" aria-label="Previous month">${I.left}</button><button class="iconbtn" data-cal="1" aria-label="Next month">${I.right}</button></div><div class="cal">${cells}</div></div>`;
}

// ---------- register ----------
const ROW = 52;
let reg = null;   // { acct, all, rows, body, sel }

function pageRegister(main, acctId) {
  // re-rendering the same register (after an edit or sync) keeps its scroll position and selection
  const keepTop = reg && reg.key === (acctId || '*') && reg.body.isConnected ? reg.body.scrollTop : null;
  const keepSel = keepTop != null ? reg.sel?.t.Id : null;
  const acct = acctId ? L.find(acctId) : null;
  if (acctId && !acct) return go('#/home');
  const all = !acct;
  let title, sub, balLabel, bal;
  if (all) { title = ui.query ? 'Search results' : 'All transactions'; sub = 'Every transaction across all accounts'; balLabel = 'Net worth'; bal = L.money(L.netWorth()); }
  else {
    title = acct.Name;
    const bits = [TypeLabel[acct.Type] + (isCategory(acct) ? ' category' : ' account')];
    if (acct.Institution) bits.push(acct.Institution);
    if (acct.AccountNumber) bits.push('No. ' + acct.AccountNumber);
    if (acct.InterestRate) bits.push(`${acct.InterestRate}% interest`);
    sub = bits.join('  ·  ');
    const b = isCategory(acct) ? L.categoryRollup(acct) : L.sidebarBalance(acct);
    balLabel = isLiability(acct) ? 'Amount owed' : isCategory(acct) ? 'Total' : 'Current balance';
    bal = L.format(isLiability(acct) ? -b : b, acct);
  }
  const [payH, depH] = all ? ['Payment', 'Deposit'] : ({ CreditCard: ['Charge', 'Payment'], Loan: ['Increase', 'Decrease'], Liability: ['Increase', 'Decrease'], Expense: ['Refund', 'Spent'], Income: ['Reversal', 'Received'] }[acct.Type] || ['Payment', 'Deposit']);
  const head = all
    ? `<div class="c-date">Date</div><div class="c-desc">Description<br>Memo</div><div class="c-acct">Account</div><div class="c-cat">Category<br>Tags</div><div class="c-st">✓</div><div class="c-pay">${payH}</div><div class="c-dep">${depH}</div>`
    : `<div class="c-date">Date</div><div class="c-num">Chq#</div><div class="c-desc">Description<br>Memo</div><div class="c-cat">Category<br>Tags</div><div class="c-st">✓</div><div class="c-pay">${payH}</div><div class="c-dep">${depH}</div><div class="c-bal">Balance</div>`;
  main.innerHTML = `<div class="register">
    <div class="pg-title"><h1><span style="color:var(--acct);width:28px;display:inline-flex">${all ? I.list : iconFor(acct.Type)}</span>${esc(title)}</h1>
      <div class="bigbal"><div class="lbl">${balLabel}</div><div class="amt">${esc(bal)}</div></div>
      <div class="sub" style="flex-basis:100%;margin-top:-10px">${esc(sub)}</div></div>
    <div class="filterbar">
      <button class="btn" data-act="new">${I.plus}New</button>
      <select data-act="range" aria-label="Filter">${Filters.map(([label, code]) => `<option value="${code}"${code === ui.range ? ' selected' : ''}>${label}</option>`).join('')}</select>
      <button class="btn hidden" data-act="confirmall" title="Confirm every new (downloaded) transaction shown">Confirm all</button>
      <input type="search" data-act="filter" placeholder="Filter payee, memo, category, amount" value="${esc(ui.query)}" enterkeyhint="search">
    </div>
    <div class="reg${all ? ' all' : ''}"><div class="reg-head">${head}</div><div class="reg-body"></div></div>
    <div class="reg-foot"><span data-k="count"></span><span data-k="totals"></span></div>
  </div>`;
  reg = { key: acctId || '*', acct, all, rows: [], body: main.querySelector('.reg-body'), sel: null };
  main.querySelector('[data-act="new"]').addEventListener('click', () => openTxn(null));
  main.querySelector('[data-act="range"]').addEventListener('change', (e) => { ui.range = Number(e.target.value); loadRows(true); });
  main.querySelector('[data-act="confirmall"]').addEventListener('click', async () => {
    if (syncing) await syncing;
    if (L.confirm(reg.rows.map(r => r.t))) { toast('Confirmed'); changed(); }
  });
  let ft;
  main.querySelector('[data-act="filter"]').addEventListener('input', (e) => { clearTimeout(ft); ft = setTimeout(() => { ui.query = e.target.value; loadRows(true); }, 200); });
  reg.body.addEventListener('scroll', () => requestAnimationFrame(drawRows), { passive: true });
  reg.body.addEventListener('click', onRegClick);
  loadRows(keepTop == null);
  if (keepTop != null) {
    reg.sel = reg.rows.find(r => r.t.Id === keepSel) || null;
    reg.body.scrollTop = keepTop; reg.drawn = ''; drawRows();
  }
}

function loadRows(scroll) {
  const { acct, all } = reg;
  const entries = all ? L.allRows() : L.register(acct);
  const code = ui.range;
  const [from, to] = code === NewOnly || code === UnclearedOnly ? ['0001-01-01', MAX] : rangeFor(code);
  const t = today(), showFuture = pref('showFuture', true) || code === PastMonthAndFuture || code === NewOnly || code === UnclearedOnly;
  const q = ui.query.trim().toLowerCase();
  const qAmt = q && /^[£$€]?-?[\d,]*\.?\d+$/.test(q) ? Math.abs(p(Number(q.replace(/[£$€,]/g, '')))) : 0;
  reg.rows = entries.filter(e => {
    const d = dOf(e.t.Date);
    if (d < from || d > to || (!showFuture && d > t)) return false;
    if (code === NewOnly && !e.t.Unconfirmed) return false;
    if (code === UnclearedOnly && (e.t.Status || 'Uncleared') !== 'Uncleared') return false;
    if (!q) return true;
    return (e.t.Payee || '').toLowerCase().includes(q) || (e.memo || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      || (e.t.Number || '').toLowerCase().includes(q) || (qAmt && Math.abs(e.amount) === qAmt)
      || (e.t.Splits || []).some(s => L.fullName(s.TargetId).toLowerCase().includes(q));
  });
  const n = reg.rows.length;
  reg.body.innerHTML = `<div class="spacer" style="position:relative;height:${n * ROW}px"></div>` + (n ? '' : `<div class="empty" style="position:absolute;inset:0">${!entries.length ? 'No transactions yet — tap New' : code === NewOnly ? 'No new transactions: everything downloaded has been confirmed' : 'No transactions match the filter'}</div>`);
  document.querySelector('[data-act="confirmall"]')?.classList.toggle('hidden', !reg.rows.some(r => r.t.Unconfirmed));
  reg.spacer = reg.body.firstChild;
  reg.drawn = '';
  const inSum = reg.rows.reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0), outSum = reg.rows.reduce((s, r) => s + (r.amount < 0 ? -r.amount : 0), 0);
  const foot = document.querySelector('.reg-foot');
  foot.querySelector('[data-k="count"]').textContent = `${n.toLocaleString('en-GB')} transactions  ·  in ${L.money(inSum)}  ·  out ${L.money(outSum)}`;
  foot.querySelector('[data-k="totals"]').textContent = all ? '' :
    `Cleared: ${L.money(L.balance(acct, t, true))}   Today: ${L.money(L.balance(acct, t))}   Projected: ${L.money(L.balance(acct, MAX))}`;
  if (scroll) {
    // like Moneydance: show the latest non-future transaction at the bottom
    let idx = n - 1; while (idx > 0 && dOf(reg.rows[idx].t.Date) > t) idx--;
    reg.body.scrollTop = Math.max(0, (idx + 1) * ROW - reg.body.clientHeight + 8);
  }
  drawRows();
}

function drawRows() {
  if (!reg || !reg.spacer?.isConnected) return;
  const top = reg.body.scrollTop, h = reg.body.clientHeight || 800;
  const start = Math.max(0, Math.floor(top / ROW) - 8), end = Math.min(reg.rows.length, Math.ceil((top + h) / ROW) + 8);
  const key = `${start}:${end}:${reg.sel?.t.Id || ''}`;
  if (key === reg.drawn) return;
  reg.drawn = key;
  const t = today();
  let html = '';
  for (let i = start; i < end; i++) {
    const r = reg.rows[i], d = dOf(r.t.Date), st = { Cleared: 'Cleared', Reconciled: 'Reconciled' }[r.t.Status] || 'Uncleared';
    const cls = `reg-row${d > t ? ' future' : ''}${reg.sel === r ? ' sel' : ''}`;
    const pay = r.amount < 0 ? num(-r.amount) : '', dep = r.amount > 0 ? num(r.amount) : '';
    const tags = (r.t.Tags || []).join(', ');
    html += `<div class="${cls}" style="top:${i * ROW}px" data-i="${i}">`
      + `<div class="l1 c-date">${fmtDate(d)}</div>`
      + (reg.all ? `<div class="l1 c-acct">${esc(r.account)}</div>` : `<div class="l1 c-num">${esc(r.t.Number || '')}</div>`)
      + `<div class="l1 c-desc">${r.t.Unconfirmed ? `<span class="nd on" data-confirm="${i}" title="New from the bank: tap to confirm"></span>` : r.t.ImportId ? '<span class="nd" title="Downloaded from the bank"></span>' : ''}${esc(r.t.Payee)}</div><div class="l1 c-cat">${esc(r.category.replace(/^\[(.*)\]$/, '$1'))}</div>`
      + `<div class="c-st" data-st="${i}" title="${StatusLabel[st]}"><i class="${st}"></i></div>`
      + `<div class="l1 c-pay num">${pay}</div><div class="l1 c-dep num">${dep}</div>`
      + (reg.all ? '' : `<div class="l1 c-bal num bal ${r.balance < 0 ? 'neg' : 'pos'}">${num(r.balance)}</div>`)
      + `<div class="l2 c-date"></div>` + (reg.all ? `<div class="l2 c-acct"></div>` : `<div class="l2 c-num"></div>`)
      + `<div class="l2 c-desc">${esc(r.memo)}</div><div class="l2 c-cat">${esc(tags)}</div><div class="l2 c-pay"></div><div class="l2 c-dep"></div>`
      + (reg.all ? '' : `<div class="l2 c-bal"></div>`)
      + `</div>`;
  }
  reg.spacer.innerHTML = html;
}

function onRegClick(e) {
  const nd = e.target.closest('[data-confirm]');
  if (nd) {
    // tap the cyan dot to confirm a downloaded transaction, like Moneydance
    const r = reg.rows[Number(nd.dataset.confirm)];
    if (L.confirm([r.t])) { reg.drawn = ''; changed(); }
    return;
  }
  const stEl = e.target.closest('[data-st]');
  if (stEl) {
    // tap the status mark: uncleared → cleared (green, Moneydance's X) → uncleared; reconciling also goes to cleared
    const r = reg.rows[Number(stEl.dataset.st)];
    const next = (r.t.Status || 'Uncleared') === 'Reconciled' ? 'Uncleared' : 'Reconciled';
    r.t.Status = next; reg.drawn = ''; changed(); return;
  }
  const row = e.target.closest('.reg-row');
  if (!row) return;
  const r = reg.rows[Number(row.dataset.i)];
  reg.sel = r; reg.drawn = ''; drawRows();
  openTxn(r.t);
}

// ---------- transaction editor ----------
function targetOptions() {
  const map = new Map(), labels = [];
  for (const c of L.categories.filter(c => !c.Closed)) { const n = L.fullName(c); map.set(n.toLowerCase(), c.Id); labels.push(n); }
  for (const a of L.realAccounts.filter(a => !a.Closed)) { const n = `[${a.Name}]`; map.set(n.toLowerCase(), a.Id); labels.push(n); }
  labels.sort((a, b) => a.localeCompare(b));
  return { map, labels };
}

function openTxn(t) {
  const isNew = !t;
  const ctxAcct = reg?.acct && !isCategory(reg.acct) ? reg.acct : null;
  const draft = t ? structuredClone(t) : {
    Id: newId(), Date: toDocDate(today()), AccountId: ctxAcct?.Id || L.realAccounts.find(a => a.Type === 'Bank' && !a.Closed)?.Id || '',
    Payee: '', Status: 'Uncleared', Splits: [{ TargetId: '', Amount: 0 }], Tags: [], Entered: Date.now(),
  };
  if (!draft.Splits?.length) draft.Splits = [{ TargetId: '', Amount: 0 }];
  const { map, labels } = targetOptions();
  const accts = L.realAccounts.filter(a => !a.Closed || a.Id === draft.AccountId)
    .sort((a, b) => RealTypes.indexOf(a.Type) - RealTypes.indexOf(b.Type) || a.Name.localeCompare(b.Name));
  const dlg = $('#dlg');
  const splitRow = (s) => {
    const v = p(s.Amount);
    return `<tr><td><input list="tgtList" class="tgt" value="${esc(s.TargetId ? L.targetLabel(s.TargetId) : '')}" placeholder="Category or [Account]" autocomplete="off"></td>
      <td><input class="amt pay" inputmode="decimal" value="${v < 0 ? pounds(-v).toFixed(2) : ''}" placeholder="0.00"></td>
      <td><input class="amt dep" inputmode="decimal" value="${v > 0 ? pounds(v).toFixed(2) : ''}" placeholder="0.00"></td>
      <td><input class="smemo" value="${esc(s.Memo || '')}" placeholder="Memo"></td>
      <td class="x"><button class="iconbtn" data-del aria-label="Remove split">${I.x}</button></td></tr>`;
  };
  dlg.innerHTML = `<form method="dialog">
    <div class="dlg-head"><h2>${isNew ? 'New transaction' : 'Edit transaction'}</h2><button class="iconbtn" value="cancel" aria-label="Close">${I.x}</button></div>
    <div class="dlg-body">
      <div class="form">
        <label class="w2">Account<select name="acct">${accts.map(a => `<option value="${esc(a.Id)}"${a.Id === draft.AccountId ? ' selected' : ''}>${esc(a.Name)}</option>`).join('')}</select></label>
        <label>Date<input type="date" name="date" value="${esc(dOf(draft.Date))}" required></label>
        <label>Cheque #<input name="num" value="${esc(draft.Number || '')}"></label>
        <label class="w4">Description<input name="payee" list="payeeList" value="${esc(draft.Payee)}" autocomplete="off" required></label>
      </div>
      <table class="splits"><thead><tr><th>Category</th><th class="amt">Payment</th><th class="amt">Deposit</th><th>Memo</th><th></th></tr></thead>
        <tbody>${draft.Splits.map(splitRow).join('')}</tbody></table>
      <button type="button" class="btn" data-add style="margin-top:6px">${I.plus}Add split</button>
      <div class="form" style="margin-top:14px">
        <label class="w2">Memo<input name="memo" value="${esc(draft.Memo || '')}"></label>
        <label class="w2">Tags<input name="tags" value="${esc((draft.Tags || []).join(', '))}" placeholder="comma separated"></label>
        <label class="w4">Status<span class="seg" data-status>${['Uncleared', 'Cleared', 'Reconciled'].map(s => `<button type="button" data-s="${s}" class="${(draft.Status || 'Uncleared') === s ? 'on' : ''}">${StatusLabel[s]}</button>`).join('')}</span></label>
      </div>
      <div class="err"></div>
    </div>
    <div class="dlg-foot">${isNew ? '' : `<button type="button" class="btn danger" data-delete>Delete</button>`}<span class="spacer"></span>
      <button class="btn" value="cancel">Cancel</button><button type="button" class="btn primary" data-save>Save</button></div>
    <datalist id="tgtList">${labels.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
    <datalist id="payeeList">${L.payees().slice(0, 3000).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
  </form>`;
  const f = dlg.querySelector('form'), tbody = dlg.querySelector('tbody'), err = dlg.querySelector('.err');
  let status = draft.Status || 'Uncleared';
  dlg.querySelector('[data-status]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    status = b.dataset.s; dlg.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b));
  });
  dlg.querySelector('[data-add]').addEventListener('click', () => tbody.insertAdjacentHTML('beforeend', splitRow({ TargetId: '', Amount: 0 })));
  tbody.addEventListener('click', (e) => { if (e.target.closest('[data-del]')) { e.preventDefault(); if (tbody.rows.length > 1) e.target.closest('tr').remove(); } });
  tbody.addEventListener('input', (e) => {   // typing a payment clears the deposit and vice versa
    if (!e.target.classList.contains('amt') || !e.target.value) return;
    const other = e.target.closest('tr').querySelector(e.target.classList.contains('pay') ? '.dep' : '.pay'); other.value = '';
  });
  f.payee.addEventListener('change', () => {
    // Moneydance-style autofill from the last transaction with this payee
    if (!isNew) return;
    const empty = [...tbody.rows].every(r => !r.querySelector('.tgt').value && !r.querySelector('.pay').value && !r.querySelector('.dep').value);
    const last = empty && L.lastForPayee(f.payee.value, f.acct.value);
    if (!last) return;
    tbody.innerHTML = (last.Splits || []).map(splitRow).join('') || splitRow({ TargetId: '', Amount: 0 });
    if (!f.memo.value && last.Memo) f.memo.value = last.Memo;
  });
  dlg.querySelector('[data-save]').addEventListener('click', async () => {
    const splits = [];
    for (const r of tbody.rows) {
      const label = r.querySelector('.tgt').value.trim();
      const pay = Number((r.querySelector('.pay').value || '0').replace(/[£,\s]/g, '')), dep = Number((r.querySelector('.dep').value || '0').replace(/[£,\s]/g, ''));
      if (!label && !pay && !dep) continue;
      if (Number.isNaN(pay) || Number.isNaN(dep)) { err.textContent = 'Amounts must be numbers.'; return; }
      const id = map.get(label.toLowerCase());
      if (!id) { err.textContent = `“${label || '(blank)'}” isn't a category or [account]. Pick one from the list.`; return; }
      if (id === f.acct.value) { err.textContent = 'A transaction cannot transfer to its own account.'; return; }
      splits.push({ TargetId: id, Amount: Math.round((dep - pay) * 100) / 100, ...(r.querySelector('.smemo').value.trim() ? { Memo: r.querySelector('.smemo').value.trim() } : {}) });
    }
    if (!f.payee.value.trim()) { err.textContent = 'Enter a description.'; return; }
    if (!f.date.value) { err.textContent = 'Enter a date.'; return; }
    if (!splits.length) { err.textContent = 'Enter a category and an amount.'; return; }
    if (syncing) await syncing;                       // don't edit a book that is being swapped out
    let target = isNew ? null : L.doc.Transactions.find(x => x.Id === t.Id);
    if (!target) { target = { Id: draft.Id, Entered: draft.Entered, Tags: [] }; }
    Object.assign(target, {
      Unconfirmed: false,          // editing a downloaded transaction confirms it, as in Moneydance
      Date: toDocDate(f.date.value), AccountId: f.acct.value, Payee: f.payee.value.trim(), Status: status, Splits: splits,
      Tags: f.tags.value.split(',').map(x => x.trim()).filter(Boolean),
    });
    for (const [k, v] of [['Memo', f.memo.value.trim()], ['Number', f.num.value.trim()]]) { if (v) target[k] = v; else delete target[k]; }
    L.saveTxn(target);
    dlg.close();
    changed();
    toast(isNew ? 'Transaction added' : 'Transaction saved');
  });
  dlg.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`Delete “${draft.Payee}” on ${fmtDate(draft.Date)}?`)) return;
    if (syncing) await syncing;
    const target = L.doc.Transactions.find(x => x.Id === t.Id);
    if (target) L.deleteTxn(target);
    dlg.close(); changed(); toast('Transaction deleted');
  });
  dlg.showModal();
  if (isNew) setTimeout(() => f.payee.focus(), 50);
}

// ---------- reminders ----------
function pageReminders(main) {
  const rs = L.doc.Reminders.filter(r => r.Enabled !== false).sort((a, b) => (a.NextDate < b.NextDate ? -1 : 1));
  const t = today();
  const rows = rs.map(r => {
    const amt = (r.Splits || []).reduce((s, x) => s + p(x.Amount), 0), d = dOf(r.NextDate);
    return `<tr><td class="${d <= t ? 'overdue' : ''}">${fmtDate(d)}</td><td>${esc(r.Description || r.Payee)}<div class="muted" style="font-size:12.5px">${esc(Ledger.frequencyText(r))}</div></td>
      <td>${esc(L.find(r.AccountId)?.Name || '')}</td><td class="num ${amt < 0 ? 'neg' : ''}">${esc(L.money(amt))}</td>
      <td style="white-space:nowrap;text-align:right"><button class="btn" data-rec="${esc(r.Id)}">Record</button> <button class="btn" data-skip="${esc(r.Id)}">Skip</button></td></tr>`;
  }).join('');
  main.innerHTML = `<div class="page"><div class="pg-title"><h1><span style="color:var(--rem);width:28px;display:inline-flex">${I.bell}</span>Reminders</h1></div>
    <div class="card" style="padding:0;overflow:hidden">${rs.length ? `<table class="list"><thead><tr><th>Next</th><th>Description</th><th>Account</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No reminders.</div>'}</div>
    <p class="muted">Record enters the transaction on its due date and moves the reminder on; Skip just moves it on. Reminders are set up in LedgerOne on Windows.</p></div>`;
  main.querySelectorAll('[data-rec],[data-skip]').forEach(b => b.addEventListener('click', async () => {
    if (syncing) await syncing;
    const r = L.doc.Reminders.find(x => x.Id === (b.dataset.rec || b.dataset.skip));
    if (!r) return;
    if (b.dataset.rec) { L.recordReminder(r); toast(`Recorded “${r.Description || r.Payee}”`); }
    else { L.skipReminder(r); toast(`Skipped to ${fmtDate(r.NextDate)}`); }
    changed();
  }));
}

// ---------- categories ----------
function pageCategories(main) {
  const [from, to] = rangeFor(ui.catRange);
  const totals = L.categoryTotals(from, to);
  const tree = (type) => {
    let out = '', sum = 0;
    const walk = (parentId, depth) => {
      const kids = L.categories.filter(c => c.Type === type && (c.ParentId || null) === parentId && !(c.ParentId && !L.find(c.ParentId)))
        .sort((a, b) => a.Name.localeCompare(b.Name));
      for (const c of kids) {
        const v = L.rollUp(totals, c.Id);
        if (v === 0) continue;
        if (depth === 0) sum += v;
        out += `<tr class="click" data-go="${esc(c.Id)}"><td class="indent${Math.min(depth, 3)}">${esc(c.Name)}</td><td class="num">${esc(L.money(v))}</td></tr>`;
        walk(c.Id, depth + 1);
      }
    };
    walk(null, 0);
    return { out, sum };
  };
  const ex = tree('Expense'), inc = tree('Income');
  const opts = Ranges.slice(0, 7).map((r, i) => `<option value="${i}"${i === ui.catRange ? ' selected' : ''}>${r}</option>`).join('');
  main.innerHTML = `<div class="page"><div class="pg-title"><h1><span style="color:var(--exp);width:28px;display:inline-flex">${I.pie}</span>Categories</h1>
      <div class="filterbar" style="margin:0"><select data-act="crange">${opts}</select></div></div>
    <div class="home">
      <div class="card" style="padding:0;overflow:hidden"><table class="list"><thead><tr><th>Expenses</th><th style="text-align:right">${esc(L.money(ex.sum))}</th></tr></thead><tbody>${ex.out || '<tr><td class="muted">No spending in this period</td><td></td></tr>'}</tbody></table></div>
      <div class="card" style="padding:0;overflow:hidden"><table class="list"><thead><tr><th>Income</th><th style="text-align:right">${esc(L.money(inc.sum))}</th></tr></thead><tbody>${inc.out || '<tr><td class="muted">No income in this period</td><td></td></tr>'}</tbody></table></div>
    </div></div>`;
  main.querySelector('[data-act="crange"]').addEventListener('change', (e) => { ui.catRange = Number(e.target.value); render(); });
  main.querySelectorAll('[data-go]').forEach(r => r.addEventListener('click', () => go(`#/acct/${encodeURIComponent(r.dataset.go)}`)));
}

// ---------- budget ----------
function pageBudget(main) {
  ui.budgetMonth ??= today().slice(0, 8) + '01';
  const from = ui.budgetMonth, to = addDays(addMonths(from, 1), -1);
  const totals = L.categoryTotals(from, to);
  const items = L.doc.Budget.Items.map(it => ({ it, c: L.find(it.CategoryId) })).filter(x => x.c);
  const section = (type) => {
    const list = items.filter(x => x.c.Type === type).sort((a, b) => L.fullName(a.c).localeCompare(L.fullName(b.c)));
    let sa = 0, sb = 0;
    const rows = list.map(({ it, c }) => {
      const actual = L.rollUp(totals, c.Id), budget = p(it.Monthly); sa += actual; sb += budget;
      const pct = budget > 0 ? Math.min(100, actual / budget * 100) : actual > 0 ? 100 : 0;
      const over = type === 'Expense' && actual > budget;
      return `<tr class="click" data-go="${esc(c.Id)}"><td>${esc(L.fullName(c))}</td><td class="num">${esc(L.money(actual))}</td><td class="num muted">${esc(L.money(budget))}</td>
        <td style="width:30%"><div class="bar${over ? ' over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div></td><td class="num ${budget - actual < 0 ? 'neg' : ''}">${esc(L.money(budget - actual))}</td></tr>`;
    }).join('');
    return list.length ? `<div class="card" style="padding:0;overflow:hidden"><table class="list"><thead><tr><th>${type === 'Expense' ? 'Expenses' : 'Income'}</th><th style="text-align:right">Actual</th><th style="text-align:right">Budget</th><th></th><th style="text-align:right">Left</th></tr></thead>
      <tbody>${rows}<tr><td><b>Total</b></td><td class="num"><b>${esc(L.money(sa))}</b></td><td class="num"><b>${esc(L.money(sb))}</b></td><td></td><td class="num"><b>${esc(L.money(sb - sa))}</b></td></tr></tbody></table></div>` : '';
  };
  const title = new Date(from + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  main.innerHTML = `<div class="page"><div class="pg-title"><h1><span style="color:var(--acct);width:28px;display:inline-flex">${I.budget}</span>${esc(L.doc.Budget.Name || 'Budget')}</h1>
      <div class="row-gap"><button class="iconbtn" data-m="-1" aria-label="Previous month">${I.left}</button><b>${title}</b><button class="iconbtn" data-m="1" aria-label="Next month">${I.right}</button></div></div>
    ${section('Expense')}${section('Income')}${items.length ? '' : '<div class="card empty">No budget yet — set one up in LedgerOne on Windows.</div>'}</div>`;
  main.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { ui.budgetMonth = addMonths(ui.budgetMonth, Number(b.dataset.m), 1); render(); }));
  main.querySelectorAll('[data-go]').forEach(r => r.addEventListener('click', () => go(`#/acct/${encodeURIComponent(r.dataset.go)}`)));
}

// ---------- settings ----------
function pageSettings(main) {
  const conn = Sync.connected();
  const stats = L ? `${L.realAccounts.length} accounts · ${L.categories.length} categories · ${L.doc.Transactions.length.toLocaleString('en-GB')} transactions · ${L.doc.Reminders.length} reminders` : 'No data on this iPad yet';
  const theme = pref('theme', 'system');
  main.innerHTML = `<div class="page settings" style="max-width:860px">
    <div class="pg-title"><h1><span style="color:var(--fg2);width:28px;display:inline-flex">${I.gear}</span>Settings</h1></div>
    <h3>Sync with LedgerOne on Windows (Dropbox)</h3>
    <div class="card">
      ${conn ? `<p>Connected to Dropbox. File: <code>${esc(Sync.cfg.path)}</code> in the app's Dropbox folder.</p>
        <p class="muted">${lastSync ? 'Last synced ' + new Date(lastSync).toLocaleString('en-GB') : 'Not synced yet'}${state.dirty ? ' · this iPad has changes waiting to upload' : ''}</p>
        <div class="row-gap"><button class="btn primary" data-act="sync">Sync now</button><button class="btn" data-act="upload">Upload this iPad's book</button><button class="btn danger" data-act="disconnect">Disconnect</button></div>`
      : `<p>1. Enter the <b>App key</b> of your Dropbox app (see the setup guide in <code>LedgerOne\\web\\README.md</code>).</p>
        <div class="form"><label class="w2">App key<input name="key" value="${esc(Sync.cfg.appKey)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <label class="w2">File path in the app folder<input name="path" value="${esc(Sync.cfg.path)}" autocapitalize="off"></label></div>
        <p>2. Tap <b>Open Dropbox</b>, allow access, then copy the code Dropbox shows.</p>
        <div class="row-gap"><a class="btn" data-act="auth" href="#" target="_blank" rel="noopener">Open Dropbox</a>
          <button class="btn" data-act="copyauth">Copy link</button></div>
        <p class="muted" style="font-size:13px">If Dropbox doesn't open, tap Copy link, paste it into Safari, and come back here afterwards.</p>
        <p>3. Paste the code here.</p>
        <div class="row-gap"><input class="field" name="code" placeholder="Paste the access code" style="max-width:360px" autocomplete="off" autocapitalize="off"><button class="btn primary" data-act="connect">Connect</button></div>`}
      <div class="err" data-k="err"></div>
    </div>
    <h3>Files (manual sync, e.g. through iCloud Drive)</h3>
    <div class="card"><p class="muted">Open a <code>ledger.json</code> saved by LedgerOne on Windows; changes are merged with this iPad's. Save a copy to send your changes back.</p>
      <div class="row-gap"><button class="btn" data-act="open">Open a file…</button><button class="btn" data-act="save"${L ? '' : ' disabled'}>Save a copy…</button></div></div>
    <h3>App lock</h3>
    <div class="card" data-k="lockcard"><p class="muted">Loading…</p></div>
    <h3>Book encryption</h3>
    <div class="card">${state.enc
      ? `<p><b>On.</b> The book is encrypted in Dropbox, and this iPad has its passphrase.</p>
         <button class="btn" data-act="forgetkey">Forget the passphrase on this iPad</button>`
      : `<p><b>Off.</b> Turn it on in LedgerOne on your PC (Settings ▸ Book encryption); this iPad then asks for the passphrase once.</p>`}</div>
    <h3>Appearance</h3>
    <div class="card"><div class="row-gap">Theme <span class="seg" data-act="theme">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-v="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}</span></div>
      <p><label><input type="checkbox" data-act="future"${pref('showFuture', true) ? ' checked' : ''}> Show future-dated transactions in registers</label></p>
      <p><label><input type="checkbox" data-act="closed"${pref('showClosed', false) ? ' checked' : ''}> Show closed accounts in the sidebar</label></p></div>
    <h3>Data on this iPad</h3>
    <div class="card"><p>${esc(stats)}</p><p class="muted">Your book is stored only on this iPad and in your own Dropbox — never on any other server.</p>
      <button class="btn danger" data-act="erase"${L ? '' : ' disabled'}>Erase data on this iPad</button></div>
    <p class="muted">LedgerOne for iPad · works offline · made to match LedgerOne for Windows</p>
  </div>`;
  const err = main.querySelector('[data-k="err"]');
  const on = (act, fn) => main.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn);
  // Safari only opens a new page straight from a tap, so the Dropbox link is prepared before the tap
  const authLink = main.querySelector('[data-act="auth"]');
  const keyInput = main.querySelector('[name="key"]');
  let authUrl = '';
  async function prepareAuthLink() {
    if (!authLink) return;
    const key = keyInput.value.trim();
    if (!key) { authUrl = ''; authLink.href = '#'; return; }
    Sync.cfg.appKey = key;
    Sync.cfg.path = main.querySelector('[name="path"]').value || '/ledger.json';
    authUrl = await Sync.authUrl();
    authLink.href = authUrl;
  }
  if (authLink) {
    let kt;
    keyInput.addEventListener('input', () => { clearTimeout(kt); kt = setTimeout(prepareAuthLink, 250); });
    authLink.addEventListener('click', (e) => {
      if (!authUrl || keyInput.value.trim() !== Sync.cfg.appKey) { e.preventDefault(); err.textContent = 'Enter the App key first (wait a moment after typing it).'; prepareAuthLink(); }
    });
    prepareAuthLink();
  }
  on('copyauth', async () => {
    if (!authUrl || keyInput.value.trim() !== Sync.cfg.appKey) await prepareAuthLink();
    if (!authUrl) { err.textContent = 'Enter the App key first.'; return; }
    try { await navigator.clipboard.writeText(authUrl); toast('Link copied — paste it into Safari'); }
    catch { prompt('Copy this link and open it in Safari:', authUrl); }
  });
  on('connect', async () => {
    try {
      err.textContent = '';
      Sync.cfg.path = main.querySelector('[name="path"]').value || '/ledger.json';
      await Sync.finishAuth(main.querySelector('[name="code"]').value);
      render();
      const res = await syncNow();
      if (res?.message === 'missing') toast(L ? 'Connected. No file in Dropbox yet — move your data there from LedgerOne on Windows, or tap Upload.' : 'Connected. Now move your data to Dropbox from LedgerOne on Windows.');
    } catch (e) { err.textContent = e.message; }
  });
  on('sync', () => syncNow());
  on('upload', async () => {
    if (!L) return;
    if (!confirm('Upload this iPad\'s book to Dropbox? If a file is already there, the two are merged.')) return;
    state.dirty = true; await syncNow({ uploadIfMissing: true });
  });
  on('disconnect', () => { if (confirm('Disconnect Dropbox? Your data stays on this iPad.')) { Sync.disconnect(); setStatus('off', 'Sync not set up'); render(); } });
  fillLockCard(main.querySelector('[data-k="lockcard"]'));
  on('forgetkey', async () => {
    if (!confirm('Forget the passphrase on this iPad? You will need to enter it again to sync.')) return;
    await Crypto.forgetKey(); toast('Passphrase forgotten on this iPad');
  });
  on('open', openFile);
  on('save', saveCopy);
  main.querySelector('[data-act="theme"]').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; setPref('theme', b.dataset.v); applyTheme(); render(); });
  main.querySelector('[data-act="future"]').addEventListener('change', (e) => setPref('showFuture', e.target.checked));
  main.querySelector('[data-act="closed"]').addEventListener('change', (e) => { setPref('showClosed', e.target.checked); renderSidebar(parseRoute()); });
  on('erase', async () => {
    if (!confirm('Erase the book stored on this iPad? Your Dropbox copy and your PC are not touched.')) return;
    await Store.del('doc'); await Store.del('base'); await Store.del('meta'); await Crypto.forgetKey(); await Lock.remove();
    state = { doc: null, baseText: null, rev: null, dirty: false, enc: null }; L = null; render();
  });
}

// ---------- app lock settings ----------
async function fillLockCard(card) {
  if (!card) return;
  const l = await Lock.get();
  const bioOk = await Lock.bioAvailable();
  if (!l?.hash) {
    card.innerHTML = `<p><b>Off.</b> Ask for a PIN${bioOk ? ' or Face ID / Touch ID' : ''} whenever LedgerOne opens.</p>
      <button class="btn primary" data-lk="setpin">Set a PIN…</button>`;
  } else {
    const t = l.timeout ?? 60;
    card.innerHTML = `<p><b>On.</b> LedgerOne asks for your PIN${l.bio ? ' or Face ID / Touch ID' : ''} when it opens.</p>
      <div class="row-gap" style="margin:10px 0">
        <label>Lock again after <select class="field" data-lk="timeout" style="width:auto">
          ${[[0, 'Immediately'], [60, '1 minute'], [300, '5 minutes'], [900, '15 minutes']].map(([v, n]) => `<option value="${v}"${v === t ? ' selected' : ''}>${n}</option>`).join('')}
        </select> away</label>
      </div>
      <div class="row-gap">
        ${bioOk ? (l.bio ? '<button class="btn" data-lk="biooff">Turn off Face ID / Touch ID</button>' : '<button class="btn primary" data-lk="bioon">Use Face ID / Touch ID</button>') : ''}
        <button class="btn" data-lk="change">Change PIN…</button>
        <button class="btn danger" data-lk="off">Turn off app lock…</button>
      </div>
      ${bioOk ? '' : '<p class="muted" style="font-size:13px">Face ID / Touch ID isn\'t available here. Open LedgerOne from the Home Screen on an iPad with Face ID or Touch ID set up.</p>'}`;
  }
  const act = (k, fn) => card.querySelector(`[data-lk="${k}"]`)?.addEventListener('click', fn);
  const refresh = () => fillLockCard(card);
  act('setpin', () => pinDialog('Set a PIN', async (pin) => { await Lock.setPin(pin); toast('App lock is on'); refresh(); }));
  act('change', () => confirmPin('Enter your current PIN', () => pinDialog('Choose a new PIN', async (pin) => { await Lock.setPin(pin); toast('PIN changed'); refresh(); })));
  act('off', () => confirmPin('Enter your PIN to turn off the app lock', async () => { await Lock.remove(); toast('App lock is off'); refresh(); }));
  act('bioon', async () => {
    try { await Lock.enrollBio(); toast('Face ID / Touch ID is on'); }
    catch (e) { toast("Couldn't set up Face ID / Touch ID: " + (e.message || e.name)); }
    refresh();
  });
  act('biooff', async () => { await Lock.disableBio(); toast('Face ID / Touch ID is off'); refresh(); });
  card.querySelector('[data-lk="timeout"]')?.addEventListener('change', async (e) => { await Lock.setTimeoutSeconds(Number(e.target.value)); toast('Saved'); });
}

/** Choose a new PIN (typed twice). */
function pinDialog(title, onDone) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog">
    <div class="dlg-head"><h2>${esc(title)}</h2></div>
    <div class="dlg-body"><div class="form">
      <label class="w2">PIN (4 to 8 digits)<input type="password" name="p1" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></label>
      <label class="w2">Type it again<input type="password" name="p2" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password"></label>
    </div><div class="err"></div></div>
    <div class="dlg-foot"><span class="spacer"></span><button class="btn" value="cancel">Cancel</button><button type="button" class="btn primary" data-ok>Save</button></div>
  </form>`;
  const f = dlg.querySelector('form'), err = dlg.querySelector('.err');
  dlg.querySelector('[data-ok]').addEventListener('click', async () => {
    const a = f.p1.value, b = f.p2.value;
    if (!/^[0-9]{4,8}$/.test(a)) { err.textContent = 'Use 4 to 8 digits.'; return; }
    if (a !== b) { err.textContent = "The two PINs don't match."; return; }
    dlg.close();
    await onDone(a);
  });
  dlg.showModal();
  setTimeout(() => f.p1.focus(), 50);
}

/** Ask for the current PIN before a sensitive change. */
function confirmPin(title, onOk) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog">
    <div class="dlg-head"><h2>${esc(title)}</h2></div>
    <div class="dlg-body"><div class="form"><label class="w4">PIN<input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password"></label></div><div class="err"></div></div>
    <div class="dlg-foot"><span class="spacer"></span><button class="btn" value="cancel">Cancel</button><button type="button" class="btn primary" data-ok>Continue</button></div>
  </form>`;
  const f = dlg.querySelector('form'), err = dlg.querySelector('.err');
  dlg.querySelector('[data-ok]').addEventListener('click', async () => {
    const r = await Lock.checkPin(f.pin.value);
    if (!r.ok) { err.textContent = r.wait ? `Too many tries. Try again in ${r.wait} seconds.` : 'Wrong PIN.'; return; }
    dlg.close();
    await onOk();
  });
  dlg.showModal();
  setTimeout(() => f.pin.focus(), 50);
}

// ---------- files ----------
function openFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    openText(await file.text(), file.name);
  };
  inp.click();
}

async function openText(text, name) {
  try {
    if (syncing) await syncing;
    const res = await Sync.mergeOpenedFile(state, text);
    const hadData = !!state.doc;
    state.doc = res.doc;
    if (!Sync.connected()) state.enc = res.enc;
    if (!hadData || !Sync.connected()) { state.baseText = res.json; await Store.set('base', res.json); }
    state.dirty = hadData ? true : Sync.connected();
    L = new Ledger(state.doc);
    await persistNow();
    toast(hadData ? `Merged ${name}${res.conflicts ? ` (${res.conflicts} edited in both — kept this iPad's)` : ''}` : `Opened ${name}`);
    go('#/home');
    scheduleSync(500);
  } catch (e) {
    if (e instanceof Crypto.NeedPassphrase) promptUnlock(e, () => openText(text, name));
    else toast("Couldn't open that file: " + e.message);
  }
}

async function saveCopy() {
  let text;
  try { text = await Crypto.seal(JSON.stringify(state.doc, null, 2), state.enc); }      // stays encrypted if the book is
  catch { toast('Unlock the book first'); return; }
  const file = new File([text], 'ledger.json', { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'ledger.json' }); } catch { /* cancelled */ }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = 'ledger.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- wiring ----------
function wire() {
  window.addEventListener('hashchange', render);
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  $('#sidebar').addEventListener('click', (e) => {
    const h = e.target.closest('[data-toggle]');
    if (!h) return;
    const k = h.dataset.toggle; ui.collapsed.has(k) ? ui.collapsed.delete(k) : ui.collapsed.add(k);
    setPref('collapsed', [...ui.collapsed]); renderSidebar(parseRoute());
  });
  $('#themeBtn').addEventListener('click', () => { setPref('theme', effectiveDark() ? 'light' : 'dark'); applyTheme(); render(); });
  $('#syncBtn').addEventListener('click', () => (locked ? promptUnlock(locked, () => syncNow()) : Sync.connected() ? syncNow() : go('#/settings')));
  $('#search').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !L) return;
    ui.query = e.target.value.trim(); ui.range = 0; searching = true; e.target.blur();
    if (location.hash === '#/all') { searching = false; render(); } else location.hash = '#/all';
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') { await relockIfDue(); if (!lockShown) syncNow(); }
    else { hiddenAt = Date.now(); persistNow(); }
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) relockIfDue(); });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => setStatus('off', 'Offline'));
  window.addEventListener('resize', () => { if (reg) { reg.drawn = ''; drawRows(); } });
}

async function boot() {
  applyTheme();
  wire();
  try {
    const text = await Store.get('doc');
    const meta = (await Store.get('meta')) || {};
    if (text) {
      state = { doc: JSON.parse(text), baseText: (await Store.get('base')) ?? null, rev: meta.rev ?? null, dirty: !!meta.dirty, enc: meta.enc || null };
      lastSync = meta.lastSync || 0;
      L = new Ledger(state.doc);
    }
  } catch (e) { console.error(e); toast('Couldn\'t read the saved book: ' + e.message); }
  // default register filter is "This month" (like Windows); range resets per session
  const start = () => { render(); if (Sync.connected()) syncNow(); else setStatus('off', 'Sync not set up'); };
  if (await Lock.enabled()) showLock(start); else start();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
