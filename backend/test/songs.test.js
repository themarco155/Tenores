import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, attemptPayload } from './helpers/app.js';
import { slugify } from '../src/songs.js';

const ORDER = ['fum', 'campanas', 'adeste', 'dona', 'fuentecilla', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];

test('la migración deja las 12 canciones en el orden de la portada', async () => {
  const t = setup();
  const { results } = await t.db.prepare('SELECT id, title, position, active, legacy_reference, reference, lyrics FROM songs ORDER BY position').all();
  assert.deepEqual(results.map(r => r.id), ORDER);
  assert.deepEqual(results.map(r => r.position), ORDER.map((_, i) => i + 1));
  assert.ok(results.every(r => r.active === 1 && r.legacy_reference === 1 && r.reference === null));
  assert.equal(results.find(r => r.id === 'kling').title, 'Kling Glöckchen, klingelingeling');
  assert.match(results.find(r => r.id === 'adeste').lyrics, /;/);
});

test('slugify: tildes, signos, longitud y vacío', () => {
  assert.equal(slugify('Canto de las campanas'), 'canto-de-las-campanas');
  assert.equal(slugify('Kling Glöckchen, klingelingeling'), 'kling-glockchen-klingelingeling');
  assert.equal(slugify('  ¡Noche de Paz!  '), 'noche-de-paz');
  assert.equal(slugify("O'Holy Night"), 'o-holy-night');
  assert.equal(slugify('Ñandú & Co.'), 'nandu-co');
  assert.equal(slugify('???'), 'cancion');
  assert.equal(slugify(`${'a'.repeat(39)} b`), 'a'.repeat(39));
  assert.ok(slugify('x'.repeat(100)).length <= 40);
});

test('GET /api/songs es público y lista las canciones en orden', async () => {
  const t = setup();
  const r = await t.call('GET', '/api/songs');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.songs.map(s => s.id), ORDER);
  const fum = r.body.songs[0];
  assert.deepEqual(Object.keys(fum).sort(), ['active', 'hasReference', 'id', 'legacyReference', 'lyrics', 'position', 'title', 'track']);
  assert.deepEqual([fum.title, fum.position, fum.active, fum.hasReference, fum.legacyReference], ['Fum Fum Fum', 1, true, false, true]);
});

test('GET /api/songs/:id/reference: 404 sin referencia guardada o canción inexistente', async () => {
  const t = setup();
  assert.deepEqual((await t.call('GET', '/api/songs/fum/reference')).body, { error: 'not_found' });
  assert.equal((await t.call('GET', '/api/songs/nada/reference')).status, 404);
  await t.db.prepare('UPDATE songs SET reference = ? WHERE id = ?').bind('{"version":1,"songId":"fum"}', 'fum').run();
  const r = await t.call('GET', '/api/songs/fum/reference');
  assert.deepEqual([r.status, r.body], [200, { version: 1, songId: 'fum' }]);
  assert.match(r.headers.get('Content-Type'), /application\/json/);
});

test('intentos: solo canciones activas con audio; listado acepta cualquier canción de la tabla', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  await t.db.prepare("INSERT INTO songs (id, title, track, lyrics, position, created_at, updated_at) VALUES ('solo-letra', 'Solo letra', NULL, '', 13, 'x', 'x')").run();
  await t.db.prepare("UPDATE songs SET active = 0 WHERE id = 'dona'").run();
  for (const songId of ['solo-letra', 'dona', 'nada']) {
    const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload({ songId }) });
    assert.deepEqual([r.status, r.body], [400, { error: 'invalid', field: 'songId' }], songId);
  }
  assert.equal((await t.call('POST', '/api/attempts', { token, body: attemptPayload({ songId: 'campanas' }) })).status, 201);
  assert.equal((await t.call('GET', '/api/me/attempts?song=dona', { token })).status, 200);
  assert.equal((await t.call('GET', '/api/me/attempts?song=solo-letra', { token })).status, 200);
  assert.deepEqual((await t.call('GET', '/api/me/attempts?song=nada', { token })).body, { error: 'invalid', field: 'song' });
});

test('ranking acepta canciones de la tabla, también inactivas', async () => {
  const t = setup();
  await t.seedUser({ username: 'jefe', role: 'admin' });
  const admin = await t.loginAs('jefe');
  await t.db.prepare("UPDATE songs SET active = 0 WHERE id = 'dona'").run();
  assert.equal((await t.call('GET', '/api/admin/ranking?song=dona', { token: admin })).status, 200);
  assert.deepEqual((await t.call('GET', '/api/admin/ranking?song=nada', { token: admin })).body, { error: 'invalid', field: 'song' });
});
