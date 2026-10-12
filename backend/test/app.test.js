import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, ORIGIN } from './helpers/app.js';
import { readJson } from '../src/http.js';
import { allowedOrigin } from '../src/cors.js';

test('GET /api/health responde ok', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
});

test('ruta desconocida → 404 not_found; método equivocado → 405', async () => {
  const { call } = setup();
  assert.deepEqual((await call('GET', '/api/nada')).body, { error: 'not_found' });
  const r = await call('POST', '/api/health');
  assert.equal(r.status, 405);
  assert.deepEqual(r.body, { error: 'method_not_allowed' });
});

test('CORS: origen permitido recibe Access-Control-Allow-Origin', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/health', { origin: ORIGIN });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});

test('CORS: http://localhost:* acepta cualquier puerto', () => {
  const env = { ALLOWED_ORIGINS: 'http://127.0.0.1:8000,http://localhost:*' };
  assert.equal(allowedOrigin('http://localhost:5173', env), 'http://localhost:5173');
  assert.equal(allowedOrigin('http://localhost:abc', env), null);
  assert.equal(allowedOrigin('http://evil.test', env), null);
  assert.equal(allowedOrigin(null, env), null);
});

test('CORS: origen no permitido → 403 forbidden_origin sin cabecera de origen', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/health', { origin: 'https://evil.test' });
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: 'forbidden_origin' });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

test('CORS: preflight OPTIONS → 204 con métodos y cabeceras', async () => {
  const { call } = setup();
  const r = await call('OPTIONS', '/api/auth/login', { origin: ORIGIN });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /PATCH/);
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

test('readJson: rechaza cuerpo > 32 KB, JSON inválido y arrays', async () => {
  const req = body => new Request('http://api.test/x', { method: 'POST', body });
  await assert.rejects(readJson(req('x'.repeat(33 * 1024))), e => e.status === 400 && e.extra.field === 'body');
  await assert.rejects(readJson(req('{no')), e => e.status === 400 && e.code === 'invalid');
  await assert.rejects(readJson(req('[1,2]')), e => e.status === 400);
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
});

test('la base de test aplica las migraciones y borra en cascada', async () => {
  const { db } = setup();
  const ts = '2026-10-01T10:00:00.000Z';
  const u = await db.prepare(`INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, created_at, updated_at)
    VALUES ('x', 'X', 'h', 's', 1000, 'tenor', ?, ?)`).bind(ts, ts).run();
  await db.prepare(`INSERT INTO attempts (user_id, song_id, mode, phrase_from, phrase_to, is_full, score_total, score_pitch, score_rhythm, score_stability, coverage, phrase_scores, tips, engine_version, created_at)
    VALUES (?, 'fum', 'test', 1, 1, 1, 80, 80, 80, NULL, 1, '[]', '[]', '1.0.0', ?)`).bind(u.meta.last_row_id, ts).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(u.meta.last_row_id).run();
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM attempts').first('n'), 0);
});
