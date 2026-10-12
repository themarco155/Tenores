import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSegments, renderChart } from '../practice/chart.js';

const count = (s, needle) => s.split(needle).length - 1;

test('toSegments corta en null', () => {
  assert.deepEqual(toSegments([60, null, 62, 63]), [[[0, 60]], [[2, 62], [3, 63]]]);
  assert.deepEqual(toSegments([null, null]), []);
});

test('renderChart dibuja referencia, usuario y una banda por frase', () => {
  const svg = renderChart(
    { ref: [60, 60, null, 62, 62], user: [60.2, 60.1, null, 61.8, null], hopMs: 10, startSec: 0 },
    [{ index: 1, start: 0, end: 0.02, pitch: 90 }, { index: 2, start: 0.03, end: 0.05, pitch: 40 }],
  );
  assert.ok(svg.startsWith('<svg class="practice-chart"'));
  assert.equal(count(svg, 'class="chart-phrase"'), 2);
  assert.ok(svg.includes('var(--chart-good)') && svg.includes('var(--chart-bad)'));
  assert.ok(count(svg, 'class="chart-ref"') >= 1);
  assert.ok(count(svg, 'class="chart-user"') >= 1);
});

test('sin curva de usuario no dibuja chart-user y referencia vacía devuelve cadena vacía', () => {
  const svg = renderChart({ ref: [60, 61, 62], user: null, hopMs: 10, startSec: 0 }, []);
  assert.equal(count(svg, 'chart-user'), 0);
  assert.equal(renderChart({ ref: [], user: null, hopMs: 10, startSec: 0 }, []), '');
});
