// App lock for the iPad app: a PIN (hashed with PBKDF2, never stored) and optionally Face ID / Touch ID
// through WebAuthn's platform authenticator (a passkey only this app's site can use). Wrong PINs back off.
import * as Store from './store.js';

const PIN_ITER = 150000;
const enc = new TextEncoder();
const b64u = {
  enc(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
};
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', data));

/** { salt, hash, length, fails, until, timeout, bio: { id, pub, alg } | null } or undefined */
export const get = () => Store.get('lock');
const put = (v) => Store.set('lock', v);
export const remove = () => Store.del('lock');
export async function enabled() { return !!(await get())?.hash; }

async function hashPin(pin, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64u.dec(saltB64), iterations: PIN_ITER, hash: 'SHA-256' }, base, 256);
  return b64u.enc(bits);
}

export async function setPin(pin) {
  const old = (await get()) || {};
  const salt = b64u.enc(rnd(16));
  await put({ ...old, salt, hash: await hashPin(pin, salt), length: pin.length, fails: 0, until: 0, timeout: old.timeout ?? 60 });
}

/** Returns { ok } or { ok:false, wait } (seconds until another try is allowed). */
export async function checkPin(pin) {
  const l = await get();
  if (!l?.hash) return { ok: true };
  const now = Date.now();
  if (l.until > now) return { ok: false, wait: Math.ceil((l.until - now) / 1000) };
  const h = await hashPin(pin, l.salt);
  let same = h.length === l.hash.length;                       // compare without an early exit
  for (let i = 0; i < h.length; i++) same = same && h.charCodeAt(i) === l.hash.charCodeAt(i);
  if (same) { await put({ ...l, fails: 0, until: 0 }); return { ok: true }; }
  const fails = (l.fails || 0) + 1;
  // 5 tries free, then 30 s, 1 min, 2 min … up to an hour
  const wait = fails < 5 ? 0 : Math.min(3600, 30 * 2 ** (fails - 5));
  await put({ ...l, fails, until: wait ? now + wait * 1000 : 0 });
  return { ok: false, wait, fails };
}

export async function waitSeconds() {
  const l = await get();
  return l?.until > Date.now() ? Math.ceil((l.until - Date.now()) / 1000) : 0;
}

export async function setTimeoutSeconds(seconds) { const l = await get(); if (l) await put({ ...l, timeout: seconds }); }

// ---------- Face ID / Touch ID ----------
export async function bioAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

/** Register Face ID / Touch ID (must be called from a tap). */
export async function enrollBio() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rnd(32),
      rp: { name: 'LedgerOne' },
      user: { id: rnd(16), name: 'LedgerOne app lock', displayName: 'LedgerOne app lock' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],          // ES256 (what Apple devices use)
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
      timeout: 60000,
    },
  });
  const r = cred.response;
  const pub = typeof r.getPublicKey === 'function' ? r.getPublicKey() : null;
  const l = await get();
  await put({ ...l, bio: { id: b64u.enc(cred.rawId), pub: pub ? b64u.enc(pub) : null, alg: typeof r.getPublicKeyAlgorithm === 'function' ? r.getPublicKeyAlgorithm() : -7 } });
}

export async function disableBio() { const l = await get(); if (l) await put({ ...l, bio: null }); }

/** Ask for Face ID / Touch ID (must be called from a tap). Resolves true when the owner was recognised. */
export async function unlockWithBio() {
  const l = await get();
  if (!l?.bio) return false;
  const challenge = rnd(32);
  const cred = await navigator.credentials.get({
    publicKey: { challenge, allowCredentials: [{ type: 'public-key', id: b64u.dec(l.bio.id) }], userVerification: 'required', timeout: 60000 },
  });
  const ok = await verifyAssertion(cred.response, challenge, l.bio.pub, location.origin, location.hostname);
  if (ok) await put({ ...l, fails: 0, until: 0 });
  return ok;
}

/** Check a WebAuthn assertion: our challenge, this site, user verified, and (when we have the key) the signature. */
export async function verifyAssertion(resp, challenge, pubB64, origin, rpId) {
  const clientJSON = new Uint8Array(resp.clientDataJSON);
  const client = JSON.parse(new TextDecoder().decode(clientJSON));
  if (client.type !== 'webauthn.get' || client.challenge !== b64u.enc(challenge) || client.origin !== origin) return false;
  const auth = new Uint8Array(resp.authenticatorData);
  const rpHash = await sha256(enc.encode(rpId));
  if (auth.length < 37 || !rpHash.every((b, i) => auth[i] === b)) return false;
  const flags = auth[32];
  if (!(flags & 0x01) || !(flags & 0x04)) return false;            // user present + user verified (Face ID / Touch ID)
  if (!pubB64) return true;
  const key = await crypto.subtle.importKey('spki', b64u.dec(pubB64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const signed = new Uint8Array(auth.length + 32);
  signed.set(auth, 0);
  signed.set(await sha256(clientJSON), auth.length);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(new Uint8Array(resp.signature)), signed);
}

/** WebAuthn signs ECDSA in DER; WebCrypto wants r||s. */
export function derToRaw(der) {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const part = () => {
    if (der[i++] !== 0x02) throw new Error('bad signature');
    let len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = part(), s = part();
  const raw = new Uint8Array(64);
  raw.set(r, 0); raw.set(s, 32);
  return raw;
}
