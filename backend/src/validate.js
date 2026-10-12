import { HttpError } from './http.js';

const bad = field => { throw new HttpError(400, 'invalid', { field }); };

export const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function validateUsername(v, field = 'username') {
  if (typeof v !== 'string') bad(field);
  const u = v.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(u)) bad(field);
  return u;
}

export function validateDisplayName(v, field = 'displayName') {
  if (typeof v !== 'string') bad(field);
  const d = v.trim().replace(/\s+/g, ' ');
  if (d.length < 1 || d.length > 40) bad(field);
  return d;
}

export function validatePin(v, field = 'pin') {
  if (typeof v !== 'string' || !/^\d{6}$/.test(v)) bad(field);
  return v;
}

export function validateRole(v, field = 'role') {
  if (v !== 'tenor' && v !== 'admin') bad(field);
  return v;
}

export function validateId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'not_found');
  return n;
}
