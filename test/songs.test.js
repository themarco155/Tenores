import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureSongsStorage, normalizeSongs, initSongs, refreshSongs, getSongs, getSong, onSongsChange, canPractice, referenceUrl, moveInOrder } from '../practice/songs.js';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}
const song = (id, extra = {}) => ({ id, title: id.toUpperCase(), track: `https://x.test/${id}.m4a`, lyrics: '', position: 1, active: true, hasReference: false, legacyReference: true, ...extra });
const BUILT_IN = [song('fum', { position: 1 }), song('dona', { position: 2 })];
const ok = body => async () => new Response(JSON.stringify(body), { status: 200 });
const OPTS = { base: 'http://api.test', enabled: true };

test('normalizeSongs: valida, completa valores y ordena por posición', () => {
  assert.equal(normalizeSongs(null), null);
  assert.equal(normalizeSongs([{ id: 'x' }]), null);
  assert.deepEqual(normalizeSongs([{ id: 'b', title: 'B', position: 2, track: '' }, { id: 'a', title: 'A', position: 1, active: false, hasReference: true }]), [
    { id: 'a', title: 'A', track: null, lyrics: '', position: 1, active: false, hasReference: true, legacyReference: false },
    { id: 'b', title: 'B', track: null, lyrics: '', position: 2, active: true, hasReference: false, legacyReference: false },
  ]);
});

test('sin copia guardada usa las incluidas y luego la lista del backend, que guarda', async () => {
  const store = memoryStorage();
  configureSongsStorage(store);
  let changes = 0;
  const off = onSongsChange(() => { changes++; });
  const fresh = [song('dona', { position: 1 }), song('nueva', { position: 2, legacyReference: false })];
  const calls = [];
  const done = initSongs({ builtIn: BUILT_IN, ...OPTS, fetchImpl: async (url, init) => { calls.push([url, init]); return ok({ songs: fresh })(); } });
  assert.deepEqual(getSongs().map(s => s.id), ['fum', 'dona'], 'primer pintado con las incluidas');
  await done;
  off();
  assert.deepEqual(getSongs().map(s => s.id), ['dona', 'nueva']);
  assert.equal(calls[0][0], 'http://api.test/api/songs');
  assert.equal(changes, 2);
  assert.deepEqual(JSON.parse(store.m.get('tenores.songs.v1')).map(s => s.id), ['dona', 'nueva']);
  assert.equal(getSong('nueva').title, 'NUEVA');
  assert.equal(getSong('nada'), null);
});

test('con copia guardada la usa al momento; si el backend falla se queda con ella', async () => {
  configureSongsStorage(memoryStorage({ 'tenores.songs.v1': JSON.stringify([song('copia')]) }));
  await initSongs({ builtIn: BUILT_IN, ...OPTS, fetchImpl: async () => { throw new TypeError('offline'); } });
  assert.deepEqual(getSongs().map(s => s.id), ['copia']);
  await refreshSongs({ ...OPTS, fetchImpl: async () => new Response('x', { status: 500 }) });
  assert.deepEqual(getSongs().map(s => s.id), ['copia']);
});

test('copia corrupta o almacenamiento que falla → incluidas; sin backend no se pide nada', async () => {
  configureSongsStorage(memoryStorage({ 'tenores.songs.v1': '{roto' }));
  let called = false;
  await initSongs({ builtIn: BUILT_IN, base: 'http://api.test', enabled: false, fetchImpl: async () => { called = true; } });
  assert.deepEqual(getSongs().map(s => s.id), ['fum', 'dona']);
  assert.equal(called, false);
  configureSongsStorage({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } });
  await initSongs({ builtIn: BUILT_IN, ...OPTS, fetchImpl: ok({ songs: [song('a')] }) });
  assert.deepEqual(getSongs().map(s => s.id), ['a'], 'sin almacenamiento sigue funcionando en memoria');
});

test('canPractice exige activa, audio y alguna referencia', () => {
  assert.equal(canPractice(song('a')), true);
  assert.equal(canPractice(song('a', { legacyReference: false })), false);
  assert.equal(canPractice(song('a', { legacyReference: false, hasReference: true })), true);
  assert.equal(canPractice(song('a', { track: null })), false);
  assert.equal(canPractice(song('a', { active: false })), false);
  assert.equal(canPractice(null), false);
});

test('referenceUrl: backend si hay referencia guardada, archivo si no', () => {
  assert.equal(referenceUrl(song('a b', { hasReference: true }), 'http://api.test'), 'http://api.test/api/songs/a%20b/reference');
  assert.match(referenceUrl(song('fum')), /\/assets\/pitch\/fum\.json$/);
});

test('moveInOrder mueve respecto a la vecina visible y respeta los extremos', () => {
  const all = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveInOrder(all, all, 'c', -1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveInOrder(all, all, 'a', 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(moveInOrder(all, ['a', 'c', 'd'], 'c', -1), ['c', 'a', 'b', 'd'], 'b está oculta');
  assert.deepEqual(moveInOrder(all, ['a', 'c', 'd'], 'c', 1), ['a', 'b', 'd', 'c']);
  assert.deepEqual(moveInOrder(all, all, 'a', -1), all);
  assert.deepEqual(moveInOrder(all, all, 'd', 1), all);
});
