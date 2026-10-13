import { HttpError, json, noContent, readJson } from './http.js';
import { hashPin, newToken, sha256Hex, verifyPin, pinIterations } from './crypto.js';

export const SESSION_DAYS = 30;
export const RENEW_BELOW_DAYS = 15;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

const DAY = 86_400_000;
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';

export function publicUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, mustChangePin: !!row.must_change_pin };
}

function lockedError(until, now) {
  return new HttpError(429, 'locked', { retryAfter: Math.max(1, Math.ceil((new Date(until) - now) / 1000)) });
}

// Cuenta el intento ANTES de comprobar el PIN y de forma atómica, para que las
// peticiones simultáneas no puedan saltarse el bloqueo. Mientras dure un bloqueo
// el contador no avanza.
async function countAttempt(db, username, now) {
  return db.prepare(`INSERT INTO login_failures (username, failed_count, locked_until) VALUES (?1, 1, NULL)
    ON CONFLICT(username) DO UPDATE SET failed_count = CASE WHEN locked_until > ?2 THEN failed_count ELSE failed_count + 1 END
    RETURNING failed_count, locked_until`)
    .bind(username, now.toISOString()).first();
}

async function lock(db, username, now) {
  const until = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
  await db.prepare('UPDATE login_failures SET failed_count = 0, locked_until = ? WHERE username = ?').bind(until, username).run();
  return lockedError(until, now);
}

export async function createSession(db, userId, now) {
  const token = newToken();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * DAY).toISOString())
    .run();
  return token;
}

export async function login(ctx) {
  const { db, now, env } = ctx;
  const body = await readJson(ctx.request);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!username) throw new HttpError(400, 'invalid', { field: 'username' });
  if (!pin) throw new HttpError(400, 'invalid', { field: 'pin' });

  const failure = await countAttempt(db, username, now);
  if (failure.locked_until && new Date(failure.locked_until) > now) throw lockedError(failure.locked_until, now);
  if (failure.failed_count > MAX_FAILURES) throw await lock(db, username, now);

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  let ok = false;
  if (user) ok = await verifyPin(pin, user);
  else await hashPin(pin, DUMMY_SALT, pinIterations(env)); // tiempo de respuesta similar

  if (!ok || !user.active) {
    if (failure.failed_count >= MAX_FAILURES) throw await lock(db, username, now);
    throw new HttpError(401, 'invalid_credentials');
  }

  await db.prepare('DELETE FROM login_failures WHERE username = ?').bind(username).run();
  const token = await createSession(db, user.id, now);
  return json(200, { token, user: publicUser(user) });
}

export async function requireSession(ctx, { allowPendingPin = false } = {}) {
  const { db, now } = ctx;
  const header = ctx.request.headers.get('Authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(header);
  if (!m) throw new HttpError(401, 'unauthorized');
  const tokenHash = await sha256Hex(m[1]);
  const row = await db.prepare(`SELECT s.token_hash, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .bind(tokenHash).first();
  if (!row) throw new HttpError(401, 'unauthorized');
  if (new Date(row.expires_at) <= now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    throw new HttpError(401, 'unauthorized');
  }
  if (!row.active) throw new HttpError(401, 'unauthorized');
  if (new Date(row.expires_at) - now < RENEW_BELOW_DAYS * DAY) {
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(new Date(now.getTime() + SESSION_DAYS * DAY).toISOString(), tokenHash).run();
  }
  if (row.must_change_pin && !allowPendingPin) throw new HttpError(403, 'pin_change_required');
  ctx.user = row;
  ctx.tokenHash = tokenHash;
  return row;
}

export async function requireAdmin(ctx) {
  const user = await requireSession(ctx);
  if (user.role !== 'admin') throw new HttpError(403, 'forbidden');
  return user;
}

export async function logout(ctx) {
  await requireSession(ctx, { allowPendingPin: true });
  await ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(ctx.tokenHash).run();
  return noContent();
}
