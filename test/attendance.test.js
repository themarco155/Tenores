import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countEntries, countsLabel, localToday, seasonOfDate, seasonLabel, createSaveQueue } from '../practice/attendance.js';

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
