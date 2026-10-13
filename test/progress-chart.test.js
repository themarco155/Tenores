import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProgressChart } from '../practice/progress-chart.js';

const count = (s, needle) => s.split(needle).length - 1;
const a = (createdAt, mode, total) => ({ createdAt, mode, scores: { total } });

test('sin intentos no hay gráfica', () => {
  assert.equal(renderProgressChart([]), '');
});

test('una línea por modo con al menos dos puntos y un punto por intento', () => {
  const svg = renderProgressChart([
    a('2026-09-01T10:00:00Z', 'guide', 60),
    a('2026-09-03T10:00:00Z', 'guide', 70),
    a('2026-09-02T10:00:00Z', 'test', 55),
  ]);
  assert.ok(svg.startsWith('<svg class="progress-chart"'));
  assert.equal(count(svg, 'class="progress-dot--guide"'), 2);
  assert.equal(count(svg, 'class="progress-dot--test"'), 1);
  assert.equal(count(svg, 'class="progress-line--guide"'), 1);
  assert.equal(count(svg, 'class="progress-line--test"'), 0);
  assert.match(svg, /<title>[^<]*70[^<]*<\/title>/);
});

test('un único intento se dibuja centrado sin dividir por cero', () => {
  const svg = renderProgressChart([a('2026-09-01T10:00:00Z', 'test', 80)]);
  assert.match(svg, /cx="300\.0"/);
});
