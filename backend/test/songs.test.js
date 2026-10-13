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

async function adminSetup() {
  const t = setup();
  await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  await t.seedUser({ username: 'ana', displayName: 'Ana' });
  const admin = await t.loginAs('jefe');
  return { ...t, admin };
}

const REF = id => ({ version: 1, songId: id, source: 'https://x.test/a.m4a', hopMs: 10, frameCount: 3, midi: [57, 57, 57],
  notes: [{ start: 0, end: 3, midi: 57 }], phrases: [{ index: 1, start: 0, end: 3, noteFrom: 0, noteTo: 0 }] });

test('las rutas de administración de canciones rechazan a un tenor (403) y sin sesión (401)', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const routes = [['GET', '/api/admin/songs'], ['POST', '/api/admin/songs'], ['PATCH', '/api/admin/songs/fum'],
    ['PUT', '/api/admin/songs/fum/reference'], ['PUT', '/api/admin/songs/order']];
  for (const [method, path] of routes) {
    const body = method === 'GET' ? undefined : {};
    assert.deepEqual((await t.call(method, path, { token: tenor, body })).body, { error: 'forbidden' }, `${method} ${path}`);
    assert.equal((await t.call(method, path, { body })).status, 401, `${method} ${path} sin sesión`);
  }
});

test('CORS permite PUT', async () => {
  const t = setup();
  const r = await t.call('OPTIONS', '/api/admin/songs/order', { origin: 'http://127.0.0.1:8000' });
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /PUT/);
});

test('crear: slug, al final, sin audio, duplicados y sufijo', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: '  Noche de Paz ', lyrics: 'Noche de paz,\r\nnoche de amor' } });
  assert.equal(r.status, 201);
  const s = r.body.song;
  assert.deepEqual([s.id, s.title, s.track, s.lyrics, s.position, s.active, s.hasReference, s.legacyReference, s.createdAt, s.updatedAt],
    ['noche-de-paz', 'Noche de Paz', null, 'Noche de paz,\nnoche de amor', 13, true, false, false, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z']);
  assert.deepEqual((await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'NOCHE DE PAZ' } })).body, { error: 'title_taken' });
  const other = await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Noche de paz!', track: 'https://x.test/n.m4a' } });
  assert.deepEqual([other.body.song.id, other.body.song.position, other.body.song.track], ['noche-de-paz-2', 14, 'https://x.test/n.m4a']);
  const cases = [[{ title: '' }, 'title'], [{ title: 'x'.repeat(81) }, 'title'], [{ title: 5 }, 'title'],
    [{ title: 'A', track: 'http://x.test/a.m4a' }, 'track'], [{ title: 'A', track: `https://x.test/${'a'.repeat(500)}` }, 'track'],
    [{ title: 'A', track: 'https:// con espacios' }, 'track'], [{ title: 'A', lyrics: 'x'.repeat(20001) }, 'lyrics'], [{ title: 'A', lyrics: 7 }, 'lyrics']];
  for (const [body, field] of cases) {
    assert.deepEqual((await t.call('POST', '/api/admin/songs', { token: t.admin, body })).body, { error: 'invalid', field }, JSON.stringify(body).slice(0, 60));
  }
});

test('el slug no choca con las rutas del sitio (#recuerdos)', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Recuerdos' } });
  assert.equal(r.body.song.id, 'recuerdos-2');
});

test('editar: título, letra y audio; cambiar o quitar el audio invalida la referencia', async () => {
  const t = await adminSetup();
  const r1 = await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { title: 'Fum, fum, fum', lyrics: 'Nueva\r\nletra' } });
  assert.equal(r1.status, 200);
  assert.deepEqual([r1.body.song.id, r1.body.song.title, r1.body.song.lyrics, r1.body.song.legacyReference], ['fum', 'Fum, fum, fum', 'Nueva\nletra', true]);
  const r2 = await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { track: 'https://x.test/nuevo.m4a' } });
  assert.deepEqual([r2.body.song.track, r2.body.song.hasReference, r2.body.song.legacyReference], ['https://x.test/nuevo.m4a', false, false]);
  assert.equal((await t.call('PUT', '/api/admin/songs/fum/reference', { token: t.admin, body: REF('fum') })).status, 204);
  assert.equal((await t.call('GET', '/api/songs')).body.songs[0].hasReference, true);
  const r3 = await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { track: null } });
  assert.deepEqual([r3.body.song.track, r3.body.song.hasReference], [null, false]);
  assert.deepEqual((await t.call('PUT', '/api/admin/songs/fum/reference', { token: t.admin, body: REF('fum') })).body, { error: 'invalid', field: 'track' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: {} })).body, { error: 'invalid', field: 'body' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/nada', { token: t.admin, body: { title: 'X' } })).body, { error: 'not_found' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { title: 'adeste fideles' } })).body, { error: 'title_taken' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { active: 'no' } })).body, { error: 'invalid', field: 'active' });
  assert.equal((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { title: 'Fum, fum, fum' } })).status, 200, 'su propio título no cuenta como duplicado');
});

test('desactivar y reactivar conserva la posición; filtro de la lista', async () => {
  const t = await adminSetup();
  const off = await t.call('PATCH', '/api/admin/songs/dona', { token: t.admin, body: { active: false } });
  assert.deepEqual([off.body.song.active, off.body.song.position], [false, 4]);
  assert.equal((await t.call('GET', '/api/songs')).body.songs.find(s => s.id === 'dona').active, false);
  assert.deepEqual((await t.call('GET', '/api/admin/songs?active=0', { token: t.admin })).body.songs.map(s => s.id), ['dona']);
  assert.equal((await t.call('GET', '/api/admin/songs?active=1', { token: t.admin })).body.songs.length, 11);
  assert.deepEqual((await t.call('GET', '/api/admin/songs?active=x', { token: t.admin })).body, { error: 'invalid', field: 'active' });
  const all = (await t.call('GET', '/api/admin/songs', { token: t.admin })).body.songs;
  assert.equal(all.length, 12);
  assert.deepEqual(Object.keys(all[0]).sort(), ['active', 'createdAt', 'hasReference', 'id', 'legacyReference', 'lyrics', 'position', 'title', 'track', 'updatedAt']);
  const on = await t.call('PATCH', '/api/admin/songs/dona', { token: t.admin, body: { active: true } });
  assert.deepEqual([on.body.song.active, on.body.song.position], [true, 4]);
});

test('subir referencia: forma, songId y límite de 512 KB', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Canción nueva', track: 'https://x.test/a.m4a' } })).body.song.id;
  assert.equal(id, 'cancion-nueva');
  const bad = [{ ...REF(id), songId: 'otra' }, { ...REF(id), version: 2 }, { ...REF(id), phrases: [] }, { ...REF(id), frameCount: 9 }, { ...REF(id), hopMs: 20 }, { ...REF(id), notes: 'x' }];
  for (const body of bad) {
    assert.deepEqual((await t.call('PUT', `/api/admin/songs/${id}/reference`, { token: t.admin, body })).body, { error: 'invalid', field: 'reference' });
  }
  const big = n => ({ ...REF(id), frameCount: n, midi: Array(n).fill(57.12) });
  assert.equal((await t.call('PUT', `/api/admin/songs/${id}/reference`, { token: t.admin, body: big(60000) })).status, 204, '~360 KB se acepta');
  assert.deepEqual((await t.call('PUT', `/api/admin/songs/${id}/reference`, { token: t.admin, body: big(200000) })).body, { error: 'invalid', field: 'body' });
  assert.equal((await t.call('PUT', '/api/admin/songs/nada/reference', { token: t.admin, body: REF('nada') })).status, 404);
  const ref = await t.call('GET', `/api/songs/${id}/reference`);
  assert.equal(ref.body.midi.length, 60000);
});

test('reordenar: todos los ids una vez; la lista pública sigue el nuevo orden', async () => {
  const t = await adminSetup();
  const rev = [...ORDER].reverse();
  assert.equal((await t.call('PUT', '/api/admin/songs/order', { token: t.admin, body: { ids: rev } })).status, 204);
  assert.deepEqual((await t.call('GET', '/api/songs')).body.songs.map(s => s.id), rev);
  for (const ids of [ORDER.slice(1), [...ORDER, 'fum'], [...ORDER.slice(1), 'nada'], 'fum', [...ORDER.slice(1), 'dona']]) {
    assert.deepEqual((await t.call('PUT', '/api/admin/songs/order', { token: t.admin, body: { ids } })).body, { error: 'invalid', field: 'ids' });
  }
});

test('una canción nueva con audio se puede practicar y entra en el ranking', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Nueva', track: 'https://x.test/n.m4a' } })).body.song.id;
  const tenor = await t.loginAs('ana');
  assert.equal((await t.call('POST', '/api/attempts', { token: tenor, body: attemptPayload({ songId: id }) })).status, 201);
  const ranking = await t.call('GET', `/api/admin/ranking?song=${id}`, { token: t.admin });
  assert.deepEqual([ranking.status, ranking.body.rows[0].best], [200, 82]);
});
