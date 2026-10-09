// Passphrase encryption of the synced book — the same envelope as LedgerOne for Windows
// (Services/LedgerCrypto.cs): AES-256-GCM over gzip(JSON), key = PBKDF2-SHA256(passphrase, salt, iter).
// The derived key is kept in IndexedDB as a non-extractable CryptoKey, so the passphrase itself is never stored.
import * as Store from './store.js';

const b64 = {
  enc(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  dec(str) {
    const bin = atob(str), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

/** Thrown when the book is encrypted and this device has no (matching) key. */
export class NeedPassphrase extends Error {
  constructor(params, wrong = false) {
    super(wrong ? 'That passphrase does not open the book' : 'The book is encrypted');
    this.params = params;      // { salt, iter } of the file
    this.wrong = wrong;
  }
}

export const isEncrypted = (text) => text.slice(0, 200).includes('"LedgerOneEncrypted"');

export function params(text) {
  const o = JSON.parse(text);
  return { salt: o.salt, iter: o.iter };
}

async function gzip(text) {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function gunzip(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(s).text();
}

export async function deriveKey(passphrase, saltB64, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64.dec(saltB64), iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encrypt(text, key, saltB64, iter) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await gzip(text)));
  return JSON.stringify({ LedgerOneEncrypted: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter, salt: saltB64, iv: b64.enc(iv), zip: 'gzip', data: b64.enc(data) });
}

export async function decrypt(text, key) {
  const o = JSON.parse(text);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(o.iv) }, key, b64.dec(o.data));
  return gunzip(new Uint8Array(plain));
}

// ---------- the key kept on this iPad ----------
export const savedKey = () => Store.get('bookkey');                      // { salt, iter, key: CryptoKey }
export const saveKey = (salt, iter, key) => Store.set('bookkey', { salt, iter, key });
export const forgetKey = () => Store.del('bookkey');

/**
 * File text -> ledger JSON. Returns { json, enc } where enc = { salt, iter } when the file was encrypted.
 * Throws NeedPassphrase when this iPad can't open it.
 */
export async function open(text) {
  if (!isEncrypted(text)) return { json: text, enc: null };
  const p = params(text);
  const k = await savedKey();
  if (!k || k.salt !== p.salt || k.iter !== p.iter) throw new NeedPassphrase(p);
  try { return { json: await decrypt(text, k.key), enc: p }; }
  catch { throw new NeedPassphrase(p, true); }
}

/** Ledger JSON -> file text, encrypted when the book is (enc = { salt, iter }). */
export async function seal(json, enc) {
  if (!enc) return json;
  const k = await savedKey();
  if (!k || k.salt !== enc.salt || k.iter !== enc.iter) throw new NeedPassphrase(enc);
  return encrypt(json, k.key, enc.salt, enc.iter);
}

/** Try a passphrase against an encrypted file and keep the key if it works. */
export async function unlock(passphrase, text) {
  const p = params(text);
  const key = await deriveKey(passphrase, p.salt, p.iter);
  await decrypt(text, key);                 // throws if wrong
  await saveKey(p.salt, p.iter, key);
  return p;
}
