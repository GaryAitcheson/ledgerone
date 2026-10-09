// Dropbox sync. LedgerOne for Windows keeps ledger.json in the Dropbox app folder; the iPad reads and
// writes the same file through the Dropbox API, merging changes with merge3() so neither side loses edits.
// Uses OAuth PKCE with a pasted code (no redirect), which works inside a Home Screen web app.
import { merge3, canon } from './merge.js';
import { pref, setPref } from './store.js';

const API = 'https://api.dropboxapi.com', CONTENT = 'https://content.dropboxapi.com';

export const cfg = {
  get appKey() { return pref('dbx.appKey', ''); }, set appKey(v) { setPref('dbx.appKey', v.trim()); },
  get path() { return pref('dbx.path', '/ledger.json'); }, set path(v) { setPref('dbx.path', v.trim().startsWith('/') ? v.trim() : '/' + v.trim()); },
  get tokens() { return pref('dbx.tokens', null); }, set tokens(v) { setPref('dbx.tokens', v); },
};
export const connected = () => !!cfg.tokens?.refresh;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Step 1: returns the Dropbox page to open; the user approves and copies the code shown. */
export async function authUrl() {
  // keep the same secret until connected: the app may reload while you're away approving in Safari
  let verifier = pref('dbx.verifier', '');
  if (!verifier || pref('dbx.verifierKey', '') !== cfg.appKey) {
    verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    setPref('dbx.verifier', verifier);
    setPref('dbx.verifierKey', cfg.appKey);
  }
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({ client_id: cfg.appKey, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', token_access_type: 'offline' });
  return `https://www.dropbox.com/oauth2/authorize?${q}`;
}

/** Step 2: exchange the pasted code for tokens. */
export async function finishAuth(code) {
  const body = new URLSearchParams({ code: code.trim(), grant_type: 'authorization_code', code_verifier: pref('dbx.verifier', ''), client_id: cfg.appKey });
  const r = await fetch(`${API}/oauth2/token`, { method: 'POST', body });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'Dropbox refused the code');
  cfg.tokens = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  setPref('dbx.verifier', '');      // used up
}

export function disconnect() { cfg.tokens = null; }

async function token() {
  const t = cfg.tokens;
  if (!t) throw new Error('Not connected to Dropbox');
  if (t.access && Date.now() < t.expires) return t.access;
  const r = await fetch(`${API}/oauth2/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: cfg.appKey }) });
  const j = await r.json();
  if (!r.ok) { if (r.status === 400) cfg.tokens = null; throw new Error(j.error_description || 'Dropbox sign-in expired — connect again'); }
  cfg.tokens = { ...t, access: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

async function call(url, opts) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${await token()}`, ...opts.headers } });
  if (r.status === 401) { cfg.tokens = { ...cfg.tokens, expires: 0 }; }
  return r;
}

async function metadata() {
  const r = await call(`${API}/2/files/get_metadata`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: cfg.path }) });
  if (r.status === 409) return null;                       // not found
  if (!r.ok) throw new Error(`Dropbox: ${r.status} ${await r.text()}`);
  return r.json();
}

async function download() {
  const r = await call(`${CONTENT}/2/files/download`, { method: 'POST', headers: { 'Dropbox-API-Arg': JSON.stringify({ path: cfg.path }) } });
  if (!r.ok) throw new Error(`Dropbox download failed (${r.status})`);
  const meta = JSON.parse(r.headers.get('Dropbox-API-Result'));
  return { text: await r.text(), rev: meta.rev };
}

/** Upload; returns the new rev, or null when someone else changed the file first. */
async function upload(text, rev) {
  const mode = rev ? { '.tag': 'update', update: rev } : { '.tag': 'add' };
  const r = await call(`${CONTENT}/2/files/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': asciiJson({ path: cfg.path, mode, mute: true, autorename: false }) },
    body: new Blob([text], { type: 'application/octet-stream' }),
  });
  if (r.status === 409) return null;
  if (!r.ok) throw new Error(`Dropbox upload failed (${r.status})`);
  return (await r.json()).rev;
}
// HTTP headers must be ASCII
const asciiJson = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

/**
 * Bring local state and Dropbox together.
 * state: { doc (object), baseText (string|null), rev (string|null), dirty (bool) }
 * Returns { state, changed (doc replaced from remote), message }.
 */
export async function syncDropbox(state, { uploadIfMissing = false } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const meta = await metadata();
    if (!meta) {
      if (!uploadIfMissing) return { state, changed: false, message: 'missing' };
      const rev = await upload(JSON.stringify(state.doc), null);
      if (!rev) continue;
      return { state: { ...state, baseText: JSON.stringify(state.doc), rev, dirty: false }, changed: false, message: 'Uploaded to Dropbox' };
    }
    if (meta.rev === state.rev) {
      if (!state.dirty) return { state, changed: false, message: 'Up to date' };
      const text = JSON.stringify(state.doc);
      const rev = await upload(text, state.rev);
      if (!rev) continue;                                     // changed meanwhile: go round again
      return { state: { ...state, baseText: text, rev, dirty: false }, changed: false, message: 'Changes uploaded' };
    }
    // Dropbox has a newer version
    const remote = await download();
    const remoteDoc = JSON.parse(remote.text);
    if (!state.dirty || !state.doc) {
      return { state: { doc: remoteDoc, baseText: remote.text, rev: remote.rev, dirty: false }, changed: true, message: 'Updated from Dropbox' };
    }
    const base = state.baseText ? JSON.parse(state.baseText) : {};
    const m = merge3(base, state.doc, remoteDoc);
    if (m.localWins === 0) {
      return { state: { doc: m.doc, baseText: remote.text, rev: remote.rev, dirty: false }, changed: true, message: 'Updated from Dropbox' };
    }
    const text = JSON.stringify(m.doc);
    const rev = await upload(text, remote.rev);
    if (!rev) { state = { doc: m.doc, baseText: remote.text, rev: remote.rev, dirty: true }; continue; }
    return {
      state: { doc: m.doc, baseText: text, rev, dirty: false }, changed: true,
      message: m.conflicts ? `Merged (${m.conflicts} edited on both devices — kept this iPad's version)` : 'Merged and uploaded',
    };
  }
  throw new Error('Dropbox kept changing during sync — try again');
}

/** Merge a file the user opened manually (e.g. from iCloud Drive) into the local book. */
export function mergeOpenedFile(state, text) {
  const opened = JSON.parse(text);
  if (!Array.isArray(opened.Accounts) || !Array.isArray(opened.Transactions)) throw new Error('That is not a LedgerOne file');
  if (!state.doc || !state.baseText) return { doc: opened, conflicts: 0 };
  const m = merge3(JSON.parse(state.baseText), state.doc, opened);
  return { doc: m.doc, conflicts: m.conflicts, same: canon(m.doc) === canon(opened) };
}
