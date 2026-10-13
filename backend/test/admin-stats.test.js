import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, insertAttempt } from './helpers/app.js';

const DAY = 86_400_000;
const ago = (t, days) => new Date(t.clock.now.getTime() - days * DAY).toISOString();

async function stats() {
  const t = setup();
  await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  const ana = await t.seedUser({ username: 'ana', displayName: 'Ana' });
  const luis = await t.seedUser({ username: 'luis', displayName: 'Luis' });
  const baja = await t.seedUser({ username: 'baja', displayName: 'Baja', active: 0 });
  const admin = await t.loginAs('jefe');
  return { t, admin, ana, luis, baja };
}

test('equipo: actividad, medias y tendencia', async () => {
  const { t, admin, ana, luis } = await stats();
  await insertAttempt(t.db, { userId: ana, total: 60, createdAt: ago(t, 20) });
  await insertAttempt(t.db, { userId: ana, total: 70, createdAt: ago(t, 16) });
  await insertAttempt(t.db, { userId: ana, total: 80, createdAt: ago(t, 5) });
  await insertAttempt(t.db, { userId: ana, total: 90, createdAt: ago(t, 1) });
  await insertAttempt(t.db, { userId: luis, total: 50, createdAt: ago(t, 40) });
  const r = await t.call('GET', '/api/admin/team', { token: admin });
  const byName = Object.fromEntries(r.body.team.map(row => [row.user.username, row]));
  assert.deepEqual(Object.keys(byName), ['ana', 'jefe', 'luis']);
  assert.deepEqual(byName.ana, {
    user: { id: ana, username: 'ana', displayName: 'Ana', role: 'tenor' },
    lastAttemptAt: ago(t, 1), attempts7d: 2, attempts30d: 4, avg30d: 75, trend: 20,
  });
  assert.deepEqual([byName.luis.attempts30d, byName.luis.avg30d, byName.luis.trend, byName.luis.lastAttemptAt], [0, null, null, ago(t, 40)]);
  assert.deepEqual([byName.jefe.lastAttemptAt, byName.jefe.trend], [null, null]);
});

test('ranking por canción: solo completas en modo prueba, activos, periodo y desempates', async () => {
  const { t, admin, ana, luis, baja } = await stats();
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 80, pitch: 81, rhythm: 79, stability: 70, createdAt: ago(t, 3) });
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 80, pitch: 99, rhythm: 99, stability: 99, createdAt: ago(t, 2) }); // empate: gana el más antiguo
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 90, createdAt: ago(t, 2) });
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 99, mode: 'guide', createdAt: ago(t, 2) }); // no cuenta: guía
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 99, isFull: 0, createdAt: ago(t, 2) }); // no cuenta: fragmento
  await insertAttempt(t.db, { userId: baja, songId: 'fum', total: 100, createdAt: ago(t, 2) }); // no cuenta: inactivo
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 95, createdAt: ago(t, 40) }); // fuera del periodo
  const r = await t.call('GET', `/api/admin/ranking?song=fum&since=${encodeURIComponent(ago(t, 30))}`, { token: admin });
  assert.deepEqual(r.body.rows, [
    { position: 1, user: { id: luis, username: 'luis', displayName: 'Luis' }, best: 90, pitch: 80, rhythm: 80, stability: 80, attempts: 1 },
    { position: 2, user: { id: ana, username: 'ana', displayName: 'Ana' }, best: 80, pitch: 81, rhythm: 79, stability: 70, attempts: 2 },
  ]);
});

test('ranking general: media de mejores por canción, desempate por número de canciones', async () => {
  const { t, admin, ana, luis } = await stats();
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 80, createdAt: ago(t, 2) });
  await insertAttempt(t.db, { userId: ana, songId: 'dona', total: 60, createdAt: ago(t, 2) });
  await insertAttempt(t.db, { userId: ana, songId: 'dona', total: 70, createdAt: ago(t, 1) });
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 75, createdAt: ago(t, 2) });
  const r = await t.call('GET', '/api/admin/ranking?song=all', { token: admin });
  assert.deepEqual(r.body.rows, [
    { position: 1, user: { id: ana, username: 'ana', displayName: 'Ana' }, average: 75, songs: 2, attempts: 3 },
    { position: 2, user: { id: luis, username: 'luis', displayName: 'Luis' }, average: 75, songs: 1, attempts: 1 },
  ]);
});

test('ranking valida parámetros', async () => {
  const { t, admin } = await stats();
  assert.deepEqual((await t.call('GET', '/api/admin/ranking', { token: admin })).body, { error: 'invalid', field: 'song' });
  assert.deepEqual((await t.call('GET', '/api/admin/ranking?song=xx', { token: admin })).body, { error: 'invalid', field: 'song' });
  assert.deepEqual((await t.call('GET', '/api/admin/ranking?song=fum&since=ayer', { token: admin })).body, { error: 'invalid', field: 'since' });
});
