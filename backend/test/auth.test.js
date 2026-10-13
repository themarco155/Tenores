import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/app.js';
import { sha256Hex } from '../src/crypto.js';
import { requireSession } from '../src/auth.js';

const MIN = 60_000, DAY = 86_400_000;

test('login correcto devuelve token y usuario; la sesión se guarda hasheada', async () => {
  const t = setup();
  await t.seedUser();
  const r = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } });
  assert.equal(r.status, 200);
  assert.match(r.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(r.body.user, { id: 1, username: 'ana', displayName: 'Ana', role: 'tenor', mustChangePin: false });
  const row = await t.db.prepare('SELECT * FROM sessions').first();
  assert.equal(row.token_hash, await sha256Hex(r.body.token));
  assert.equal(row.expires_at, '2026-10-31T10:00:00.000Z');
});

test('el usuario no distingue mayúsculas', async () => {
  const t = setup();
  await t.seedUser();
  const r = await t.call('POST', '/api/auth/login', { body: { username: '  ANA ', pin: '123456' } });
  assert.equal(r.status, 200);
});

test('PIN erróneo, usuario inexistente e inactivo dan la misma respuesta 401', async () => {
  const t = setup();
  await t.seedUser();
  await t.seedUser({ username: 'baja', active: 0 });
  for (const body of [{ username: 'ana', pin: '000000' }, { username: 'nadie', pin: '123456' }, { username: 'baja', pin: '123456' }]) {
    const r = await t.call('POST', '/api/auth/login', { body });
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { error: 'invalid_credentials' });
  }
});

test('faltan campos → 400 invalid', async () => {
  const t = setup();
  const r = await t.call('POST', '/api/auth/login', { body: { username: 'ana' } });
  assert.deepEqual([r.status, r.body], [400, { error: 'invalid', field: 'pin' }]);
});

test('5 fallos bloquean 15 minutos y el éxito limpia el contador', async () => {
  const t = setup();
  await t.seedUser();
  const bad = () => t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '999999' } });
  for (let i = 0; i < 4; i++) assert.equal((await bad()).status, 401);
  const fifth = await bad();
  assert.deepEqual([fifth.status, fifth.body], [429, { error: 'locked', retryAfter: 900 }]);
  const blocked = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } });
  assert.equal(blocked.status, 429);
  t.advance(15 * MIN + 1000);
  const ok = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } });
  assert.equal(ok.status, 200);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM login_failures').first('n'), 0);
});

test('GET /api/me con y sin token', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  const r = await t.call('GET', '/api/me', { token });
  assert.deepEqual(r.body.user.username, 'ana');
  assert.deepEqual((await t.call('GET', '/api/me')).body, { error: 'unauthorized' });
  assert.equal((await t.call('GET', '/api/me', { token: 'x'.repeat(43) })).status, 401);
});

test('la sesión caduca a los 30 días y se borra', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  t.advance(30 * DAY + 1000);
  assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM sessions').first('n'), 0);
});

test('la sesión se renueva si quedan menos de 15 días', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  t.advance(16 * DAY);
  assert.equal((await t.call('GET', '/api/me', { token })).status, 200);
  assert.equal(await t.db.prepare('SELECT expires_at FROM sessions').first('expires_at'), '2026-11-16T10:00:00.000Z');
});

test('logout invalida el token', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  assert.equal((await t.call('POST', '/api/auth/logout', { token })).status, 204);
  assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
});

test('usuario desactivado pierde el acceso con su sesión abierta', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  await t.db.prepare('UPDATE users SET active = 0').run();
  assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
});

test('must_change_pin: /me funciona pero requireSession sin permiso lanza 403', async () => {
  const t = setup();
  await t.seedUser({ mustChangePin: 1 });
  const token = await t.loginAs();
  const me = await t.call('GET', '/api/me', { token });
  assert.equal(me.body.user.mustChangePin, true);
  const ctx = { request: new Request('http://api.test/x', { headers: { Authorization: `Bearer ${token}` } }), db: t.db, now: new Date(t.clock.now) };
  await assert.rejects(requireSession(ctx), e => e.status === 403 && e.code === 'pin_change_required');
});

test('cambio de PIN: validaciones', async () => {
  const t = setup();
  await t.seedUser({ mustChangePin: 1 });
  const token = await t.loginAs();
  const change = body => t.call('POST', '/api/me/pin', { token, body });
  assert.deepEqual((await change({ currentPin: '000000', newPin: '654321' })).body, { error: 'invalid', field: 'currentPin' });
  assert.deepEqual((await change({ currentPin: '123456', newPin: '12' })).body, { error: 'invalid', field: 'newPin' });
  assert.deepEqual((await change({ currentPin: '123456', newPin: '123456' })).body, { error: 'invalid', field: 'newPin' });
});

test('cambio de PIN correcto: limpia must_change_pin, cierra otras sesiones y conserva la actual', async () => {
  const t = setup();
  await t.seedUser({ mustChangePin: 1 });
  const other = await t.loginAs();
  const token = await t.loginAs();
  const r = await t.call('POST', '/api/me/pin', { token, body: { currentPin: '123456', newPin: '654321' } });
  assert.equal(r.status, 204);
  assert.equal((await t.call('GET', '/api/me', { token })).body.user.mustChangePin, false);
  assert.equal((await t.call('GET', '/api/me', { token: other })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '654321' } })).status, 200);
});
