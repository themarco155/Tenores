import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, attemptPayload, insertAttempt } from './helpers/app.js';
import { weakestMetric } from '../src/attempts.js';

async function tenor(t, username = 'ana') {
  await t.seedUser({ username });
  return t.loginAs(username);
}

test('guardar un intento válido → 201 y se almacena saneado', async () => {
  const t = setup();
  const token = await tenor(t);
  const payload = { ...attemptPayload(), curves: { ref: [1, 2] }, extra: 'x' };
  const r = await t.call('POST', '/api/attempts', { token, body: payload });
  assert.deepEqual([r.status, r.body], [201, { id: 1 }]);
  const row = await t.db.prepare('SELECT * FROM attempts').first();
  assert.equal(row.song_id, 'fum');
  assert.equal(row.is_full, 1);
  assert.equal(row.score_stability, 80);
  assert.equal(row.created_at, '2026-10-01T10:00:00.000Z');
  assert.deepEqual(JSON.parse(row.phrase_scores), payload.phrases);
  assert.deepEqual(JSON.parse(row.tips), payload.tips);
});

test('guardar exige sesión y PIN definitivo', async () => {
  const t = setup();
  assert.equal((await t.call('POST', '/api/attempts', { body: attemptPayload() })).status, 401);
  await t.seedUser({ username: 'nuevo', mustChangePin: 1 });
  const token = await t.loginAs('nuevo');
  const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload() });
  assert.deepEqual([r.status, r.body], [403, { error: 'pin_change_required' }]);
});

test('validación de cada campo', async () => {
  const t = setup();
  const token = await tenor(t);
  const cases = [
    [{ songId: 'otra' }, 'songId'],
    [{ mode: 'libre' }, 'mode'],
    [{ valid: false }, 'valid'],
    [{ phraseFrom: 0 }, 'phraseFrom'],
    [{ phraseFrom: 5, phraseTo: 4 }, 'phraseTo'],
    [{ isFull: 1 }, 'isFull'],
    [{ scores: { total: 101 } }, 'scores.total'],
    [{ scores: { pitch: 1.5 } }, 'scores.pitch'],
    [{ scores: { stability: 'x' } }, 'scores.stability'],
    [{ coverage: 1.2 }, 'coverage'],
    [{ phrases: Array.from({ length: 101 }, (_, i) => ({ index: 1, start: i, end: i + 1, pitch: 1, rhythm: 1, stability: null, coverage: 1 })) }, 'phrases'],
    [{ phrases: [{ index: 1, start: 'a' }] }, 'phrases'],
    [{ tips: Array.from({ length: 6 }, () => ({ kind: 'x', phrase: null, text: 't' })) }, 'tips'],
    [{ tips: [{ kind: 'x', phrase: null, text: 'y'.repeat(201) }] }, 'tips'],
    [{ engineVersion: 'v1' }, 'engineVersion'],
  ];
  for (const [override, field] of cases) {
    const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload(override) });
    assert.deepEqual([r.status, r.body], [400, { error: 'invalid', field }], `campo ${field}`);
  }
  const huge = await t.call('POST', '/api/attempts', { token, body: { ...attemptPayload(), pad: 'x'.repeat(33 * 1024) } });
  assert.deepEqual(huge.body, { error: 'invalid', field: 'body' });
});

test('stability null se acepta', async () => {
  const t = setup();
  const token = await tenor(t);
  const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload({ scores: { stability: null } }) });
  assert.equal(r.status, 201);
});

test('como máximo un intento cada 10 s', async () => {
  const t = setup();
  const token = await tenor(t);
  assert.equal((await t.call('POST', '/api/attempts', { token, body: attemptPayload() })).status, 201);
  t.advance(4000);
  const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload() });
  assert.deepEqual([r.status, r.body], [429, { error: 'too_fast', retryAfter: 6 }]);
  t.advance(6000);
  assert.equal((await t.call('POST', '/api/attempts', { token, body: attemptPayload() })).status, 201);
});

test('GET /api/me/attempts: orden, filtro, paginación y aislamiento', async () => {
  const t = setup();
  const token = await tenor(t);
  const otherId = await t.seedUser({ username: 'luis' });
  const anaId = 1;
  for (let i = 0; i < 5; i++) await insertAttempt(t.db, { userId: anaId, songId: i % 2 ? 'dona' : 'fum', total: 60 + i, createdAt: `2026-09-0${i + 1}T10:00:00.000Z` });
  await insertAttempt(t.db, { userId: otherId, createdAt: '2026-09-09T10:00:00.000Z' });

  const all = await t.call('GET', '/api/me/attempts', { token });
  assert.deepEqual(all.body.attempts.map(a => a.scores.total), [64, 63, 62, 61, 60]);
  assert.equal(all.body.next, null);
  assert.deepEqual(Object.keys(all.body.attempts[0]).sort(), ['coverage', 'createdAt', 'engineVersion', 'id', 'isFull', 'mode', 'phraseFrom', 'phraseTo', 'phrases', 'scores', 'songId', 'tips'].sort());

  const dona = await t.call('GET', '/api/me/attempts?song=dona', { token });
  assert.deepEqual(dona.body.attempts.map(a => a.songId), ['dona', 'dona']);

  const page1 = await t.call('GET', '/api/me/attempts?limit=2', { token });
  assert.equal(page1.body.attempts.length, 2);
  const page2 = await t.call('GET', `/api/me/attempts?limit=2&before=${page1.body.next}`, { token });
  assert.deepEqual(page2.body.attempts.map(a => a.scores.total), [62, 61]);

  assert.deepEqual((await t.call('GET', '/api/me/attempts?song=xx', { token })).body, { error: 'invalid', field: 'song' });
  assert.deepEqual((await t.call('GET', '/api/me/attempts?limit=0', { token })).body, { error: 'invalid', field: 'limit' });
});

test('GET /api/me/summary agrupa por canción', async () => {
  const t = setup();
  const token = await tenor(t);
  await insertAttempt(t.db, { userId: 1, songId: 'fum', total: 70, pitch: 60, rhythm: 90, stability: 80, createdAt: '2026-09-01T10:00:00.000Z' });
  await insertAttempt(t.db, { userId: 1, songId: 'fum', total: 85, pitch: 70, rhythm: 95, stability: null, createdAt: '2026-09-02T10:00:00.000Z' });
  await insertAttempt(t.db, { userId: 1, songId: 'dona', total: 50, pitch: 90, rhythm: 40, stability: 70, createdAt: '2026-09-03T10:00:00.000Z' });
  const r = await t.call('GET', '/api/me/summary', { token });
  assert.deepEqual(r.body, {
    songs: [
      { songId: 'dona', attempts: 1, best: 50, last: 50, lastAt: '2026-09-03T10:00:00.000Z', weakest: 'rhythm' },
      { songId: 'fum', attempts: 2, best: 85, last: 85, lastAt: '2026-09-02T10:00:00.000Z', weakest: 'pitch' },
    ],
  });
});

test('weakestMetric ignora stability null y usa los últimos 5', () => {
  const row = (p, r, s) => ({ score_pitch: p, score_rhythm: r, score_stability: s });
  assert.equal(weakestMetric([row(90, 80, null), row(90, 80, null)]), 'rhythm');
  assert.equal(weakestMetric([row(50, 80, 90)]), 'pitch');
  assert.equal(weakestMetric([]), null);
});
