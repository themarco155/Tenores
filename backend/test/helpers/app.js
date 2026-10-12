import { createApp } from '../../src/app.js';
import { createTestDb } from './d1.js';

export const ORIGIN = 'http://127.0.0.1:8000';
const SALT = 'c2FsdHNhbHRzYWx0c2FsdA=='; // 16 bytes
const TEST_ITERATIONS = 1000;

export function setup() {
  const clock = { now: new Date('2026-10-01T10:00:00.000Z') };
  const db = createTestDb();
  const env = { DB: db, ALLOWED_ORIGINS: 'http://127.0.0.1:8000,http://localhost:*', PIN_ITERATIONS: String(TEST_ITERATIONS) };
  const app = createApp({ now: () => new Date(clock.now) });

  async function call(method, path, { body, token, origin, headers = {} } = {}) {
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = `Bearer ${token}`;
    if (origin) h.Origin = origin;
    const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const res = await app.fetch(new Request(`http://api.test${path}`, { method, headers: h, body: payload }), env);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  const advance = ms => { clock.now = new Date(clock.now.getTime() + ms); };

  async function seedUser({ username = 'ana', displayName = 'Ana', role = 'tenor', pin = '123456', active = 1, mustChangePin = 0 } = {}) {
    // Import dinámico: src/crypto.js llega en la Task 2 y en la Task 1 no se usa seedUser.
    const { hashPin } = await import('../../src/crypto.js');
    const ts = clock.now.toISOString();
    const r = await db.prepare(`INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, active, must_change_pin, created_at, updated_at, deactivated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(username, displayName, await hashPin(pin, SALT, TEST_ITERATIONS), SALT, TEST_ITERATIONS, role, active, mustChangePin, ts, ts, active ? null : ts)
      .run();
    return r.meta.last_row_id;
  }

  async function loginAs(username = 'ana', pin = '123456') {
    const r = await call('POST', '/api/auth/login', { body: { username, pin } });
    return r.body.token;
  }

  return { db, env, app, clock, call, advance, seedUser, loginAs };
}
