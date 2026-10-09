// Three-way merge of two LedgerOne files that both started from the same synced version ("base").
// Records are matched by Id (accounts, transactions, reminders) or CategoryId (budget lines).
// A record changed on only one side takes that side's version; deletions are honoured unless the
// other side edited the record; if both sides edited the same record, the local edit wins.
// Services/LedgerMerge.cs implements the same rules for LedgerOne on Windows.

/** Stable text form of a record: keys sorted, empty/default values dropped (C# and JS write those differently). */
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter(k => !isEmpty(v[k])).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
const isEmpty = (x) => x === null || x === undefined || x === false || x === 0 || x === '' || (Array.isArray(x) && x.length === 0);

function mergeList(base, local, remote, key, stats) {
  const B = new Map((base || []).map(x => [key(x), canon(x)]));
  const L = new Map((local || []).map(x => [key(x), x]));
  const R = new Map((remote || []).map(x => [key(x), x]));
  const out = [];
  const take = (x, fromLocal, rc) => { out.push(x); if (fromLocal && canon(x) !== rc) stats.localWins++; };
  for (const [id, r] of R) {
    const l = L.get(id), rc = canon(r), b = B.get(id);
    if (l === undefined) {
      // missing locally: deleted here (drop unless remote edited it), or new on the other side
      if (b !== undefined && rc === b) { stats.localWins++; continue; }
      out.push(r); continue;
    }
    const lc = canon(l);
    if (lc === rc) out.push(r);
    else if (lc === b) out.push(r);                      // only remote changed
    else { if (rc !== b && b !== undefined) stats.conflicts++; take(l, true, rc); }  // local changed (or both)
  }
  for (const [id, l] of L) {
    if (R.has(id)) continue;
    const b = B.get(id);
    if (b === undefined) take(l, true, undefined);       // new local record
    else if (canon(l) !== b) { stats.conflicts++; take(l, true, undefined); }  // edited here, deleted there: keep
    // else: unchanged here and deleted remotely -> drop
  }
  return out;
}

/**
 * Merge local and remote documents against their common base.
 * Returns { doc, localWins, conflicts }; localWins > 0 means the result differs from remote
 * (so it needs uploading).
 */
export function merge3(base, local, remote) {
  const stats = { localWins: 0, conflicts: 0 };
  base = base || {};
  const doc = { ...remote };
  for (const k of ['Version', 'CurrencySymbol', 'CurrencyCode']) {
    if (canon(local[k]) !== canon(base[k]) && canon(local[k]) !== canon(remote[k])) { doc[k] = local[k]; stats.localWins++; }
  }
  doc.Accounts = mergeList(base.Accounts, local.Accounts, remote.Accounts, x => x.Id, stats);
  doc.Transactions = mergeList(base.Transactions, local.Transactions, remote.Transactions, x => x.Id, stats);
  doc.Reminders = mergeList(base.Reminders, local.Reminders, remote.Reminders, x => x.Id, stats);
  const bb = base.Budget || {}, lb = local.Budget || {}, rb = remote.Budget || {};
  doc.Budget = {
    ...rb,
    Name: canon(lb.Name) !== canon(bb.Name) ? lb.Name : rb.Name,
    Items: mergeList(bb.Items, lb.Items, rb.Items, x => x.CategoryId, stats),
  };
  const payees = new Map();
  for (const x of [...(remote.MemorizedPayees || []), ...(local.MemorizedPayees || [])]) if (x && !payees.has(x.toLowerCase())) payees.set(x.toLowerCase(), x);
  if (payees.size !== (remote.MemorizedPayees || []).length) stats.localWins++;
  doc.MemorizedPayees = [...payees.values()];
  return { doc, ...stats };
}
