const enc = new TextEncoder();

export function toBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(str) {
  const s = atob(str);
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

export const toBase64Url = bytes => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
export const newSalt = () => toBase64(randomBytes(16));
export const newToken = () => toBase64Url(randomBytes(32));

export async function hashPin(pin, saltB64, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltB64), iterations }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin, user) {
  return timingSafeEqual(await hashPin(pin, user.pin_salt, user.pin_iterations), user.pin_hash);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 6 dígitos sin sesgo de módulo.
export function randomPin() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1e6) * 1e6;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(buf[0] % 1e6).padStart(6, '0');
}

export function pinIterations(env) {
  const n = Number(env.PIN_ITERATIONS);
  return Number.isInteger(n) && n >= 1000 && n <= 100000 ? n : 20000;
}
