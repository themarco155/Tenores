import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, insertAttempt } from './helpers/app.js';

async function adminSetup() {
  const t = setup();
  const adminId = await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  const tenorId = await t.seedUser({ username: 'ana', displayName: 'Ana' });
  const admin = await t.loginAs('jefe');
  return { ...t, adminId, tenorId, admin };
}

test('todas las rutas de administración rechazan a un tenor (403) y sin sesión (401)', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const routes = [['GET', '/api/admin/users'], ['POST', '/api/admin/users'], ['PATCH', '/api/admin/users/1'], ['POST', '/api/admin/users/1/reset-pin'],
    ['DELETE', '/api/admin/users/1'], ['GET', '/api/admin/users/1/attempts'], ['GET', '/api/admin/users/1/summary'],
    ['GET', '/api/admin/team'], ['GET', '/api/admin/ranking?song=all']];
  for (const [method, path] of routes) {
    const body = method === 'GET' ? undefined : {}; // Request no admite cuerpo en GET
    assert.deepEqual((await t.call(method, path, { token: tenor, body })).body, { error: 'forbidden' }, `${method} ${path}`);
    assert.equal((await t.call(method, path, { body })).status, 401, `${method} ${path} sin sesión`);
  }
});

test('listar con filtro de activos y último intento', async () => {
  const t = await adminSetup();
  await t.seedUser({ username: 'baja', displayName: 'Baja', active: 0 });
  await insertAttempt(t.db, { userId: t.tenorId, createdAt: '2026-09-20T10:00:00.000Z' });
  const all = await t.call('GET', '/api/admin/users', { token: t.admin });
  assert.deepEqual(all.body.users.map(u => u.username), ['ana', 'jefe', 'baja']);
  assert.equal(all.body.users[0].lastAttemptAt, '2026-09-20T10:00:00.000Z');
  assert.deepEqual(Object.keys(all.body.users[0]).sort(), ['active', 'createdAt', 'deactivatedAt', 'displayName', 'id', 'lastAttemptAt', 'mustChangePin', 'role', 'username'].sort());
  assert.deepEqual((await t.call('GET', '/api/admin/users?active=0', { token: t.admin })).body.users.map(u => u.username), ['baja']);
  assert.deepEqual((await t.call('GET', '/api/admin/users?active=1', { token: t.admin })).body.users.length, 2);
  assert.deepEqual((await t.call('GET', '/api/admin/users?active=x', { token: t.admin })).body, { error: 'invalid', field: 'active' });
});

test('crear usuario: PIN temporal de 6 cifras, must_change_pin y duplicados', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/users', { token: t.admin, body: { username: 'Luis.G', displayName: 'Luis', role: 'tenor' } });
  assert.equal(r.status, 201);
  assert.match(r.body.temporaryPin, /^\d{6}$/);
  assert.equal(r.body.user.username, 'luis.g');
  assert.equal(r.body.user.mustChangePin, true);
  const login = await t.call('POST', '/api/auth/login', { body: { username: 'luis.g', pin: r.body.temporaryPin } });
  assert.equal(login.body.user.mustChangePin, true);
  const dup = await t.call('POST', '/api/admin/users', { token: t.admin, body: { username: 'LUIS.G', displayName: 'Otro', role: 'tenor' } });
  assert.deepEqual([dup.status, dup.body], [409, { error: 'username_taken' }]);
  const bad = await t.call('POST', '/api/admin/users', { token: t.admin, body: { username: 'x', displayName: 'X', role: 'tenor' } });
  assert.deepEqual(bad.body, { error: 'invalid', field: 'username' });
});

test('editar nombre, usuario y rol', async () => {
  const t = await adminSetup();
  const r = await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { displayName: 'Ana María', username: 'anamaria', role: 'admin' } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.user.displayName, r.body.user.username, r.body.user.role], ['Ana María', 'anamaria', 'admin']);
  assert.deepEqual((await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { username: 'jefe' } })).body, { error: 'username_taken' });
  assert.deepEqual((await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: {} })).body, { error: 'invalid', field: 'body' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/users/999', { token: t.admin, body: { displayName: 'X' } })).body, { error: 'not_found' });
});

test('desactivar borra sesiones, impide entrar y se puede reactivar', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const r = await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { active: false } });
  assert.deepEqual([r.body.user.active, r.body.user.deactivatedAt], [false, '2026-10-01T10:00:00.000Z']);
  assert.equal((await t.call('GET', '/api/me', { token: tenor })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } })).status, 401);
  const back = await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { active: true } });
  assert.deepEqual([back.body.user.active, back.body.user.deactivatedAt], [true, null]);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } })).status, 200);
});

test('active debe ser booleano', async () => {
  const t = await adminSetup();
  assert.deepEqual((await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { active: 0 } })).body, { error: 'invalid', field: 'active' });
});

test('restablecer PIN: nuevo PIN temporal, desbloquea y cierra sesiones', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  for (let i = 0; i < 5; i++) await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '000000' } });
  const r = await t.call('POST', `/api/admin/users/${t.tenorId}/reset-pin`, { token: t.admin });
  assert.match(r.body.temporaryPin, /^\d{6}$/);
  assert.equal((await t.call('GET', '/api/me', { token: tenor })).status, 401);
  const login = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: r.body.temporaryPin } });
  assert.deepEqual([login.status, login.body.user.mustChangePin], [200, true]);
});

test('protecciones: no actuar sobre uno mismo', async () => {
  const t = await adminSetup();
  const self = body => t.call('PATCH', `/api/admin/users/${t.adminId}`, { token: t.admin, body });
  assert.deepEqual((await self({ active: false })).body, { error: 'self_action' });
  assert.deepEqual((await self({ role: 'tenor' })).body, { error: 'self_action' });
  assert.deepEqual((await t.call('DELETE', `/api/admin/users/${t.adminId}`, { token: t.admin, body: { confirmUsername: 'jefe' } })).body, { error: 'self_action' });
  assert.equal((await self({ displayName: 'Jefe de cuerda' })).status, 200);
});

test('protecciones: con dos administradores uno puede degradar al otro', async () => {
  const t = await adminSetup();
  const subId = await t.seedUser({ username: 'sub', displayName: 'Sub', role: 'admin' });
  assert.equal((await t.call('PATCH', `/api/admin/users/${subId}`, { token: t.admin, body: { role: 'tenor' } })).status, 200);
});

test('wouldRemoveLastAdmin: solo bloquea quitar el último administrador activo', async () => {
  const t = await adminSetup();
  const { wouldRemoveLastAdmin } = await import('../src/admin.js');
  const inactiveAdmin = await t.seedUser({ username: 'viejo', displayName: 'Viejo', role: 'admin', active: 0 });
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: t.adminId, role: 'admin', active: 1 }), true);
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: inactiveAdmin, role: 'admin', active: 0 }), false);
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: t.tenorId, role: 'tenor', active: 1 }), false);
  await t.seedUser({ username: 'sub', displayName: 'Sub', role: 'admin' });
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: t.adminId, role: 'admin', active: 1 }), false);
});

test('eliminar exige confirmar el usuario y borra en cascada', async () => {
  const t = await adminSetup();
  await insertAttempt(t.db, { userId: t.tenorId, createdAt: '2026-09-20T10:00:00.000Z' });
  await t.loginAs('ana');
  await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '000000' } });
  const wrong = await t.call('DELETE', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { confirmUsername: 'otra' } });
  assert.deepEqual([wrong.status, wrong.body], [400, { error: 'invalid', field: 'confirmUsername' }]);
  const ok = await t.call('DELETE', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { confirmUsername: ' ANA ' } });
  assert.equal(ok.status, 204);
  for (const table of ['users WHERE id = 2', 'attempts', 'sessions WHERE user_id = 2', "login_failures WHERE username = 'ana'"]) {
    assert.equal(await t.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n'), 0, table);
  }
});

test('intentos y resumen de un usuario concreto', async () => {
  const t = await adminSetup();
  await insertAttempt(t.db, { userId: t.tenorId, total: 77, createdAt: '2026-09-20T10:00:00.000Z' });
  const attempts = await t.call('GET', `/api/admin/users/${t.tenorId}/attempts`, { token: t.admin });
  assert.deepEqual(attempts.body.attempts.map(a => a.scores.total), [77]);
  const summary = await t.call('GET', `/api/admin/users/${t.tenorId}/summary`, { token: t.admin });
  assert.equal(summary.body.songs[0].best, 77);
  assert.deepEqual((await t.call('GET', '/api/admin/users/999/summary', { token: t.admin })).body, { error: 'not_found' });
});
