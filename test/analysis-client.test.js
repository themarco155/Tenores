import { test } from 'node:test';
import assert from 'node:assert/strict';

const instances = [];
class FakeWorker {
  constructor() { this.sent = []; this.listeners = {}; this.terminated = false; instances.push(this); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x !== f); }
  postMessage(msg) { this.sent.push(msg); }
  terminate() { this.terminated = true; }
  emit(t, data) { for (const f of this.listeners[t] || []) f(t === 'message' ? { data } : data); }
}
globalThis.Worker = FakeWorker;
const { runAnalysis } = await import('../practice/analysis-client.js');
const mk = () => ({ samples: new Float32Array(4), sampleRate: 48000 });

test('dos análisis solapados resuelven cada uno con su resultado (respuestas desordenadas)', async () => {
  const p1 = runAnalysis(mk());
  const p2 = runAnalysis(mk());
  const w = instances.at(-1);
  assert.equal(w.sent.length, 2);
  const [a, b] = w.sent;
  assert.notEqual(a.id, b.id);
  w.emit('message', { id: b.id, ok: true, result: 'B' });
  w.emit('message', { id: a.id, ok: true, result: 'A' });
  assert.equal(await p1, 'A');
  assert.equal(await p2, 'B');
});

test('una respuesta con error rechaza solo su llamada', async () => {
  const p1 = runAnalysis(mk());
  const p2 = runAnalysis(mk());
  const w = instances.at(-1);
  const [a, b] = w.sent.slice(-2);
  w.emit('message', { id: a.id, ok: false, error: 'boom' });
  w.emit('message', { id: b.id, ok: true, result: 'B' });
  await assert.rejects(p1, /boom/);
  assert.equal(await p2, 'B');
});

test('un evento error rechaza todas las pendientes y reinicia el worker', async () => {
  const p1 = runAnalysis(mk());
  const p2 = runAnalysis(mk());
  const w = instances.at(-1);
  w.emit('error', { message: 'fallo' });
  await assert.rejects(p1, /fallo/);
  await assert.rejects(p2, /fallo/);
  assert.equal(w.terminated, true);
  const p3 = runAnalysis(mk());
  const w2 = instances.at(-1);
  assert.notEqual(w2, w);
  w2.emit('message', { id: w2.sent[0].id, ok: true, result: 'C' });
  assert.equal(await p3, 'C');
});

test('si postMessage lanza, rechaza y no deja pendiente', async () => {
  const p0 = runAnalysis(mk());
  const w = instances.at(-1);
  w.emit('message', { id: w.sent.at(-1).id, ok: true, result: 'x' });
  await p0;
  w.postMessage = () => { throw new Error('clon'); };
  await assert.rejects(runAnalysis(mk()), /clon/);
});
