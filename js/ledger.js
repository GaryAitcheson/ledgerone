// LedgerOne book logic — a port of Services/Ledger.cs so the iPad shows exactly the same numbers.
// Amounts are kept in the document as pounds (as LedgerOne for Windows writes them) but all
// arithmetic is done in integer pennies to avoid floating-point drift.

export const p = (x) => Math.round((x || 0) * 100);          // pounds -> pennies
export const pounds = (n) => Math.round(n) / 100;            // pennies -> pounds

export const RealTypes = ['Bank', 'CreditCard', 'Investment', 'Asset', 'Liability', 'Loan'];
export const TypeLabel = { Bank: 'Bank', CreditCard: 'Credit Card', Investment: 'Investment', Asset: 'Asset', Liability: 'Liability', Loan: 'Loan', Income: 'Income', Expense: 'Expense' };
export const TypeGroupLabel = { Bank: 'Bank Accounts', CreditCard: 'Credit Cards', Investment: 'Investments', Asset: 'Assets', Liability: 'Liabilities', Loan: 'Loans', Income: 'Income', Expense: 'Expense' };
export const Frequencies = ['Once', 'Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'HalfYearly', 'Yearly'];
const StatusRank = { Reconciled: 2, Cleared: 1, Uncleared: 0 };

export const isCategory = (a) => a && (a.Type === 'Income' || a.Type === 'Expense');
export const isLiability = (a) => a && (a.Type === 'CreditCard' || a.Type === 'Liability' || a.Type === 'Loan');

// ---------- dates (yyyy-mm-dd strings compare correctly as text) ----------
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const dOf = (s) => (s || '').slice(0, 10);
export const toDocDate = (s) => `${s}T00:00:00`;
export const MAX = '9999-12-31', MIN = '0001-01-01';
const parts = (s) => s.split('-').map(Number);
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();               // m is 1-based
export function addDays(s, n) { const [y, m, d] = parts(s); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
export function addMonths(s, n, day) {
  const [y, m, d] = parts(s);
  const idx = (y * 12 + (m - 1)) + n, ny = Math.floor(idx / 12), nm = idx % 12 + 1;
  const want = day ?? d, dim = daysIn(ny, nm);
  return `${ny}-${pad(nm)}-${pad(want >= 32 ? dim : Math.min(want, dim))}`;
}
export const fmtDate = (s) => { const [y, m, d] = parts(dOf(s)); return `${pad(d)}/${pad(m)}/${y}`; };

// ---------- money formatting ----------
const nf = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (pennies) => nf.format(pennies / 100);
const Symbols = { USD: '$', EUR: '€', JPY: '¥', CHF: 'CHF', AUD: 'A$', CAD: 'C$' };

export function newId() {
  return (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))).replace(/-/g, '');
}

export class Ledger {
  constructor(doc) {
    this.doc = doc;
    doc.Accounts ??= []; doc.Transactions ??= []; doc.Reminders ??= [];
    doc.Budget ??= { Name: 'Monthly budget', Items: [] }; doc.Budget.Items ??= [];
    doc.MemorizedPayees ??= [];
    this.invalidate();
  }

  get sym() { return this.doc.CurrencySymbol || '£'; }

  invalidate() { this._acc = null; this._series = null; this._kids = null; this._payees = null; }

  get accounts() { return this.doc.Accounts; }
  get realAccounts() { return this.doc.Accounts.filter(a => !isCategory(a)); }
  get categories() { return this.doc.Accounts.filter(isCategory); }

  find(id) {
    if (!id) return null;
    if (!this._acc) { this._acc = new Map(); for (const a of this.doc.Accounts) if (!this._acc.has(a.Id)) this._acc.set(a.Id, a); }
    return this._acc.get(id) || null;
  }

  childrenMap() {
    if (!this._kids) {
      this._kids = new Map();
      for (const a of this.doc.Accounts) if (a.ParentId) {
        if (!this._kids.has(a.ParentId)) this._kids.set(a.ParentId, []);
        this._kids.get(a.ParentId).push(a);
      }
    }
    return this._kids;
  }

  fullName(a) {
    if (typeof a === 'string') a = this.find(a);
    if (!a) return '';
    const names = [a.Name]; let q = this.find(a.ParentId), guard = 0;
    while (q && guard++ < 20) { names.unshift(q.Name); q = this.find(q.ParentId); }
    return names.join(':');
  }

  targetLabel(id) {
    const a = this.find(id);
    if (!a) return '(unassigned)';
    return isCategory(a) ? this.fullName(a) : `[${a.Name}]`;
  }

  descendantIds(id) {
    const out = [id];
    for (const c of this.childrenMap().get(id) || []) if (isCategory(c)) out.push(...this.descendantIds(c.Id));
    return out;
  }

  // ---------- balances ----------
  series() {
    if (this._series) return this._series;
    const deltas = new Map();
    const add = (id, d, v) => { let l = deltas.get(id); if (!l) deltas.set(id, l = []); l.push([d, v]); };
    for (const t of this.doc.Transactions) {
      const d = dOf(t.Date);
      for (const s of t.Splits || []) { const v = p(s.Amount); add(t.AccountId, d, v); add(s.TargetId, d, -v); }
    }
    const res = new Map();
    for (const [id, l] of deltas) {
      l.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
      const dates = new Array(l.length), cum = new Array(l.length); let run = 0;
      for (let i = 0; i < l.length; i++) { run += l[i][1]; dates[i] = l[i][0]; cum[i] = run; }
      res.set(id, { dates, cum });
    }
    return (this._series = res);
  }

  /**
   * Balance in pennies as of a date (default today, like Moneydance's current balance).
   * clearedOnly counts only cleared (green, Moneydance "X") transactions; pass asOf = null for Moneydance's
   * cleared balance, whatever the dates.
   */
  balance(a, asOf = today(), clearedOnly = false) {
    const open = isCategory(a) ? 0 : p(a.OpeningBalance);
    if (clearedOnly) {
      let bal = open;
      for (const t of this.doc.Transactions) {
        if ((asOf && dOf(t.Date) > asOf) || t.Status !== 'Reconciled') continue;
        for (const s of t.Splits || []) { if (t.AccountId === a.Id) bal += p(s.Amount); if (s.TargetId === a.Id) bal -= p(s.Amount); }
      }
      return bal;
    }
    const sr = this.series().get(a.Id);
    if (!sr) return open;
    let lo = 0, hi = sr.dates.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (sr.dates[mid] <= asOf) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    return open + (idx >= 0 ? sr.cum[idx] : 0);
  }

  /** Cleared balance change per account id, in one pass (for the sidebar). */
  clearedTotals() {
    const m = new Map(), add = (id, v) => m.set(id, (m.get(id) || 0) + v);
    for (const t of this.doc.Transactions) {
      if (t.Status !== 'Reconciled') continue;
      for (const s of t.Splits || []) { add(t.AccountId, p(s.Amount)); add(s.TargetId, -p(s.Amount)); }
    }
    return m;
  }

  /** Sidebar balance: the account plus real sub-accounts (investment holdings). With `cleared` (from clearedTotals), the cleared balance. */
  sidebarBalance(a, cleared = null) {
    const one = (x) => cleared ? (isCategory(x) ? 0 : p(x.OpeningBalance)) + (cleared.get(x.Id) || 0) : this.balance(x);
    let v = one(a);
    for (const c of this.childrenMap().get(a.Id) || []) if (!isCategory(c)) v += one(c);
    return v;
  }

  categoryRollup(c) { return this.descendantIds(c.Id).map(id => this.find(id)).filter(Boolean).reduce((s, x) => s + this.balance(x), 0); }

  netWorth(asOf) {
    return this.realAccounts.filter(a => !a.ExcludeFromNetWorth && !a.Closed).reduce((s, a) => s + this.balance(a, asOf), 0);
  }

  /** Moneydance format "£ 2,012.35"; foreign accounts in their own currency. */
  format(v, a) {
    let sym = this.sym;
    if (a && a.Currency && a.CurrencyRate > 0) {
      v = a.NativeBalance != null && a.NativeAsOf
        ? p(a.NativeBalance) + (v - this.balance(a, dOf(a.NativeAsOf))) * a.CurrencyRate
        : v * a.CurrencyRate;
      sym = Symbols[a.Currency] || a.Currency;
    }
    return `${sym} ${num(Math.round(v))}`;
  }
  money(v) { return (v < 0 ? '-' : '') + this.sym + num(Math.abs(v)); }

  categoryTotals(from, to) {
    const d = new Map();
    for (const t of this.doc.Transactions) {
      const td = dOf(t.Date);
      if (td < from || td > to) continue;
      for (const s of t.Splits || []) {
        const c = this.find(s.TargetId);
        if (!c || !isCategory(c) || c.ExcludeFromNetWorth) continue;
        const v = c.Type === 'Expense' ? -p(s.Amount) : p(s.Amount);
        d.set(c.Id, (d.get(c.Id) || 0) + v);
      }
    }
    return d;
  }
  rollUp(totals, id) { return this.descendantIds(id).reduce((s, x) => s + (totals.get(x) || 0), 0); }
  incomeExpense(from, to) {
    let inc = 0, exp = 0;
    for (const [id, v] of this.categoryTotals(from, to)) { if (this.find(id).Type === 'Income') inc += v; else exp += v; }
    return { inc, exp };
  }

  // ---------- register ----------
  register(acct) {
    const rows = [];
    for (const t of this.doc.Transactions) {
      const sp = t.Splits || [];
      if (t.AccountId === acct.Id) {
        const amount = sp.reduce((s, x) => s + p(x.Amount), 0);
        rows.push({
          t, amount,
          category: sp.length === 0 ? '(unassigned)' : sp.length === 1 ? this.targetLabel(sp[0].TargetId) : `Split (${sp.length})`,
          memo: t.Memo ?? (sp.length === 1 ? sp[0].Memo ?? '' : ''),
        });
      }
      for (const s of sp) if (s.TargetId === acct.Id) {
        const src = this.find(t.AccountId);
        rows.push({ t, amount: -p(s.Amount), category: !src ? '' : isCategory(src) ? this.fullName(src) : `[${src.Name}]`, memo: s.Memo ?? t.Memo ?? '', transferIn: true });
      }
    }
    sortRows(rows);
    let bal = isCategory(acct) ? 0 : p(acct.OpeningBalance);
    for (const r of rows) { bal += r.amount; r.balance = bal; }
    return rows;
  }

  allRows() {
    const rows = this.doc.Transactions.map(t => {
      const sp = t.Splits || [];
      return { t, amount: sp.reduce((s, x) => s + p(x.Amount), 0), memo: t.Memo ?? '',
        category: sp.length === 1 ? this.targetLabel(sp[0].TargetId) : `Split (${sp.length})`, account: this.find(t.AccountId)?.Name ?? '' };
    });
    sortRows(rows);
    return rows;
  }

  payees() {
    if (!this._payees) {
      const seen = new Map();
      for (const x of this.doc.MemorizedPayees) if (x) seen.set(x.toLowerCase(), x);
      for (let i = this.doc.Transactions.length - 1; i >= 0; i--) { const x = this.doc.Transactions[i].Payee; if (x && !seen.has(x.toLowerCase())) seen.set(x.toLowerCase(), x); }
      this._payees = [...seen.values()].sort((a, b) => a.localeCompare(b));
    }
    return this._payees;
  }

  lastForPayee(payee, accountId) {
    const k = payee.toLowerCase(); let best = null;
    for (const t of this.doc.Transactions)
      if ((t.Payee || '').toLowerCase() === k && (!accountId || t.AccountId === accountId) && (!best || t.Date > best.Date)) best = t;
    return best;
  }

  // ---------- mutations ----------
  /** Mark downloaded transactions as reviewed (Moneydance's "confirm"). Returns how many changed. */
  confirm(txns) {
    let n = 0;
    for (const t of txns) if (t.Unconfirmed) { t.Unconfirmed = false; n++; }
    return n;
  }
  accountsWithNew() { return new Set(this.doc.Transactions.filter(t => t.Unconfirmed).map(t => t.AccountId)); }

  saveTxn(t) {
    if (!this.doc.Transactions.includes(t)) this.doc.Transactions.push(t);
    if (t.Payee && !this.doc.MemorizedPayees.some(x => x.toLowerCase() === t.Payee.toLowerCase())) this.doc.MemorizedPayees.push(t.Payee);
    this.invalidate();
  }
  deleteTxn(t) { this.doc.Transactions = this.doc.Transactions.filter(x => x !== t); this.invalidate(); }

  // ---------- reminders ----------
  static advance(r, d) {
    const n = Math.max(1, r.EveryN || 1);
    const months = { Monthly: 1, Quarterly: 3, HalfYearly: 6, Yearly: 12 }[r.Frequency] || 0;
    if (months) return addMonths(d, months * n, r.DayOfMonth ?? undefined);
    if (r.Frequency === 'Daily') return addDays(d, n);
    if (r.Frequency === 'Weekly') return addDays(d, 7 * n);
    if (r.Frequency === 'Fortnightly') return addDays(d, 14 * n);
    return MAX;
  }

  upcoming(until) {
    const out = [];
    for (const r of this.doc.Reminders) {
      if (r.Enabled === false) continue;
      let d = dOf(r.NextDate), guard = 0;
      const end = r.EndDate ? dOf(r.EndDate) : MAX;
      while (d <= until && d <= end && guard++ < 400) {
        out.push({ r, date: d });
        if (r.Frequency === 'Once') break;
        d = Ledger.advance(r, d);
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  recordReminder(r) {
    const t = {
      Id: newId(), Date: toDocDate(dOf(r.NextDate)), AccountId: r.AccountId, Payee: r.Payee, Memo: r.Memo,
      Status: 'Uncleared', Splits: (r.Splits || []).map(s => ({ TargetId: s.TargetId, Amount: s.Amount, Memo: s.Memo })), Tags: [], Entered: Date.now(),
    };
    this.doc.Transactions.push(t);
    this.skipReminder(r);
    return t;
  }

  skipReminder(r) {
    if (r.Frequency === 'Once') r.Enabled = false;
    else {
      r.NextDate = toDocDate(Ledger.advance(r, dOf(r.NextDate)));
      if (r.EndDate && dOf(r.NextDate) > dOf(r.EndDate)) r.Enabled = false;
    }
    this.invalidate();
  }

  static frequencyText(r) {
    const n = Math.max(1, r.EveryN || 1), day = r.DayOfMonth === 32 ? ' (last day)' : '';
    switch (r.Frequency) {
      case 'Once': return 'Once';
      case 'Daily': return n === 1 ? 'Daily' : `Every ${n} days`;
      case 'Weekly': return n === 1 ? 'Weekly' : `Every ${n} weeks`;
      case 'Fortnightly': return n === 1 ? 'Fortnightly' : `Every ${2 * n} weeks`;
      case 'Monthly': return (n === 1 ? 'Monthly' : `Every ${n} months`) + day;
      case 'Quarterly': return 'Quarterly' + day;
      case 'HalfYearly': return '6-monthly' + day;
      default: return n === 1 ? 'Yearly' : `Every ${n} years`;
    }
  }
}

/** Moneydance order: date, then reconciled before cleared before uncleared, then order entered. */
function sortRows(rows) {
  rows.sort((a, b) => {
    const da = dOf(a.t.Date), db = dOf(b.t.Date);
    if (da !== db) return da < db ? -1 : 1;
    const sa = StatusRank[a.t.Status] || 0, sb = StatusRank[b.t.Status] || 0;
    if (sa !== sb) return sb - sa;
    return (a.t.Entered || 0) - (b.t.Entered || 0);
  });
}

/** Date ranges (by code) for the categories view. */
export const Ranges = ['All dates', 'This month', 'Last month', 'Last 3 months', 'Last 12 months', 'This year', 'Last year', 'Past 30 days + future'];
export const PastMonthAndFuture = 7, NewOnly = 100, UnclearedOnly = 101;
/** Register filters, in the same order and with the same meaning as LedgerOne for Windows (and Moneydance's views). */
export const Filters = [
  ['All dates', 0], ['New (unconfirmed)', NewOnly], ['Uncleared', UnclearedOnly],
  ['This month', 1], ['Last month', 2], ['30 days', 8], ['Past 30 days + future', PastMonthAndFuture],
  ['Last 3 months', 3], ['Last 12 months', 4], ['This year', 5], ['Tax year (since 6 April)', 9], ['Last year', 6],
];
export function rangeFor(idx) {
  const t = today(), [y, m] = parts(t), first = `${y}-${pad(m)}-01`;
  switch (idx) {
    case 1: return [first, addDays(addMonths(first, 1), -1)];
    case 2: return [addMonths(first, -1), addDays(first, -1)];
    case 3: return [addMonths(first, -2), t];
    case 4: return [addDays(addMonths(t, -12), 1), t];
    case 5: return [`${y}-01-01`, `${y}-12-31`];
    case 6: return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 7: return [addDays(t, -30), MAX];
    case 8: return [addDays(t, -30), t];
    case 9: { const sy = (m > 4 || (m === 4 && Number(t.slice(8)) >= 6)) ? y : y - 1; return [`${sy}-04-06`, `${sy + 1}-04-05`]; }
    default: return [MIN, MAX];
  }
}
