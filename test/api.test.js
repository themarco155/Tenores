import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, toAttemptPayload, query, messageFor, ApiError } from '../practice/api.js';
import { configureStorage, setSession, getSession, clearSession } from '../practice/session.js';
import { resolveApiBase, PRODUCTION_API } from '../practice/config.js';

const BASE = 'http://api.test';
configureStorage({ getItem: () => null, setItem() {}, removeItem() {} });

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  return calls;
}
const jsonResponse = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('envía el token y el cuerpo JSON', async () => {
  setSession({ token: 'tok', user: { id: 1 } });
  const calls = stubFetch(() => jsonResponse(201, { id: 9 }));
  const r = await request('POST', '/api/attempts', { a: 1 }, { base: BASE });
  assert.deepEqual(r, { id: 9 });
  assert.equal(calls[0].url, 'http://api.test/api/attempts');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(calls[0].init.body, '{"a":1}');
  clearSession();
});

test('mensaje de ensayo repetido', () => {
  assert.equal(messageFor('rehearsal_exists'), 'Ya hay un ensayo registrado ese día.');
});

test('mensaje de título duplicado', () => {
  assert.equal(messageFor('title_taken'), 'Ya existe una canción con ese título.');
});

test('204 devuelve null', async () => {
  stubFetch(() => new Response(null, { status: 204 }));
  assert.equal(await request('POST', '/api/auth/logout', undefined, { base: BASE }), null);
});

test('error del servidor → ApiError con mensaje en español y extras', async () => {
  stubFetch(() => jsonResponse(429, { error: 'too_fast', retryAfter: 6 }));
  await assert.rejects(request('POST', '/api/attempts', {}, { base: BASE }), e =>
    e instanceof ApiError && e.status === 429 && e.code === 'too_fast' && e.retryAfter === 6 && e.message === 'Espera unos segundos antes de guardar otro intento.');
});

test('401 con sesión abierta borra la sesión', async () => {
  setSession({ token: 'tok', user: { id: 1 } });
  stubFetch(() => jsonResponse(401, { error: 'unauthorized' }));
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE }), e => e.code === 'unauthorized');
  assert.equal(getSession(), null);
});

test('un 401 tardío de un token antiguo no borra la sesión nueva', async () => {
  setSession({ token: 'viejo', user: { id: 1 } });
  stubFetch(async () => {
    setSession({ token: 'nuevo', user: { id: 1 } }); // otro login mientras la petición estaba en vuelo
    return jsonResponse(401, { error: 'unauthorized' });
  });
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE }), e => e.code === 'unauthorized');
  assert.equal(getSession()?.token, 'nuevo');
  clearSession();
});

test('sin conexión → network; tiempo agotado → timeout', async () => {
  stubFetch(() => { throw new TypeError('fetch failed'); });
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE }), e => e.code === 'network' && e.status === 0 && e.message === 'No se pudo conectar con el servidor.');
  stubFetch((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortError' })))));
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE, timeoutMs: 20 }), e => e.code === 'timeout');
});

test('bloqueo con minutos restantes', () => {
  assert.equal(messageFor('locked', { retryAfter: 600 }), 'Demasiados intentos. Vuelve a intentarlo en 10 min.');
  assert.equal(messageFor('desconocido'), 'Error del servidor. Inténtalo de nuevo.');
});

test('toAttemptPayload quita las curvas y query omite vacíos', () => {
  const p = toAttemptPayload({ songId: 'fum', curves: { ref: [] }, scores: { total: 1 } });
  assert.deepEqual(p, { songId: 'fum', scores: { total: 1 } });
  assert.equal(query({ song: 'fum', before: null, x: '' }), '?song=fum');
  assert.equal(query({}), '');
});

test('resolveApiBase: local usa wrangler dev; fuera de local, la API de producción', () => {
  assert.equal(resolveApiBase('127.0.0.1'), 'http://127.0.0.1:8787');
  assert.equal(resolveApiBase('localhost'), 'http://127.0.0.1:8787');
  assert.equal(resolveApiBase('themarco155.github.io'), PRODUCTION_API);
  assert.match(PRODUCTION_API, /^https:\/\//);
});
