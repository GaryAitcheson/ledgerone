// Tiny IndexedDB key/value store. The book and its last-synced copy are kept as JSON text.
const DB = 'ledgerone', STORE = 'kv';
let dbp;
function db() {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
    const req = fn(s);
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export const get = (k) => tx('readonly', s => s.get(k));
export const set = (k, v) => tx('readwrite', s => s.put(v, k));
export const del = (k) => tx('readwrite', s => s.delete(k));

// small settings live in localStorage (wrapped: private mode can throw)
export function pref(k, fallback) { try { const v = localStorage.getItem('l1.' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } }
export function setPref(k, v) { try { localStorage.setItem('l1.' + k, JSON.stringify(v)); } catch { /* ignore */ } }
