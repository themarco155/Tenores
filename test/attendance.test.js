import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countEntries, countsLabel, localToday, seasonOfDate, seasonLabel, createSaveQueue, singleFlight } from '../practice/attendance.js';

test('recuentos y texto con singular y plural', () => {
  const c = countEntries([{ status: 'present' }, { status: 'present' }, { status: 'late' }, { status: 'excused' }]);
  assert.deepEqual(c, { present: 2, late: 1, absent: 0, excused: 1 });
  assert.equal(countsLabel(c), '2 presentes · 1 tarde · 0 ausentes · 1 justificado');
  assert.equal(countsLabel({ present: 1, late: 2, absent: 1, excused: 0 }), '1 presente · 2 tardes · 1 ausente · 0 justificados');
});

test('localToday usa la fecha local, no la UTC', () => {
  assert.equal(localToday(new Date(2026, 9, 14, 23, 30)), '2026-10-14');
  assert.equal(localToday(new Date(2027, 0, 5, 0, 5)), '2027-01-05');
});

test('temporada de una fecha y su etiqueta', () => {
  assert.equal(seasonOfDate('2026-09-01'), 2026);
  assert.equal(seasonOfDate('2027-08-31'), 2026);
  assert.equal(seasonLabel(2026), '2026–2027');
});

function fakeTimers() {
  const calls = [];
  return { calls, set: (fn, ms) => { calls.push(fn); return calls.length; }, clear() {}, run() { const fn = calls.pop(); calls.length = 0; fn && fn(); } };
}

test('la cola agrupa cambios y envía el último estado de cada persona', async () => {
  const timers = fakeTimers();
  const sent = [];
  const states = [];
  const q = createSaveQueue({ send: async batch => { sent.push(batch); }, timers, onState: s => states.push(s) });
  q.set(1, 'present'); q.set(2, 'late'); q.set(1, 'excused');
  assert.equal(q.pendingCount, 2);
  timers.run();
  await q.flush();
  assert.deepEqual(sent, [[{ userId: 1, status: 'excused' }, { userId: 2, status: 'late' }]]);
  assert.equal(states.at(-1), 'saved');
  assert.equal(q.pendingCount, 0);
});

test('si falla, conserva los cambios; un cambio nuevo durante el fallo gana; Reintentar los envía', async () => {
  const timers = fakeTimers();
  let fail = true;
  const sent = [];
  const states = [];
  const q = createSaveQueue({ send: async batch => { if (fail) throw new Error('red'); sent.push(batch); }, timers, onState: s => states.push(s) });
  q.set(1, 'present'); q.set(2, 'late');
  await assert.rejects(q.flush());
  assert.equal(states.at(-1), 'error');
  q.set(2, 'absent');
  fail = false;
  await q.flush();
  assert.deepEqual(sent, [[{ userId: 1, status: 'present' }, { userId: 2, status: 'absent' }]]);
  assert.equal(states.at(-1), 'saved');
});

test('los cambios hechos mientras se envía se mandan después', async () => {
  const timers = fakeTimers();
  const sent = [];
  let release;
  const q = createSaveQueue({ send: batch => new Promise(r => { sent.push(batch); release = r; }), timers });
  q.set(1, 'present');
  const first = q.flush();
  q.set(2, 'late');
  release();
  await first;
  timers.run(); // el temporizador programado al terminar el primer envío lanza el segundo
  release();
  await q.flush();
  assert.deepEqual(sent, [[{ userId: 1, status: 'present' }], [{ userId: 2, status: 'late' }]]);
});

test('drain al cerrar: espera el envío en curso, manda lo que queda y avisa si algo no se guardó', async () => {
  const timers = fakeTimers();
  const sent = [];
  let release, failNext = false;
  const q = createSaveQueue({ send: batch => new Promise((res, rej) => { sent.push(batch); release = () => (failNext ? rej(new Error('red')) : res()); }), timers });
  q.set(1, 'present');
  q.flush();
  q.set(2, 'late');
  const done = q.drain();
  release();
  await new Promise(r => setTimeout(r));
  release();
  await done;
  assert.deepEqual(sent, [[{ userId: 1, status: 'present' }], [{ userId: 2, status: 'late' }]]);
  assert.equal(q.pendingCount, 0);
  q.set(3, 'absent');
  failNext = true;
  const failing = q.drain();
  release();
  await assert.rejects(failing);
  assert.equal(q.pendingCount, 1, 'el cambio que no se pudo guardar sigue pendiente');
});

test('singleFlight ignora dobles toques mientras la primera llamada sigue en curso', async () => {
  let calls = 0, release;
  const open = singleFlight(() => new Promise(r => { calls++; release = r; }));
  const a = open(); const b = open();
  assert.equal(calls, 1);
  release('hoja');
  assert.equal(await a, 'hoja');
  assert.equal(await b, undefined);
  open(); release();
  assert.equal(calls, 2, 'tras terminar se puede volver a abrir');
});

test('la cola usa los temporizadores del navegador sin "Illegal invocation"', async () => {
  // En el navegador, setTimeout/clearTimeout fallan si se llaman como método de otro objeto.
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const strict = real => function (...args) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); return real(...args); };
  globalThis.setTimeout = strict(realSet);
  globalThis.clearTimeout = strict(realClear);
  try {
    const sent = [];
    const q = createSaveQueue({ send: async batch => { sent.push(batch); }, delay: 1 });
    q.set(1, 'present');
    await new Promise(r => realSet(r, 20));
    assert.deepEqual(sent, [[{ userId: 1, status: 'present' }]]);
  } finally {
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
});
