import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, modeLabel, rangeLabel, trendSymbol, seasonStart, sinceFor, daysSince, songTitle, METRIC_LABELS } from '../practice/format.js';

test('escape y etiquetas', () => {
  assert.equal(esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(modeLabel('test'), 'A prueba');
  assert.equal(modeLabel('guide'), 'Con guía');
  assert.equal(rangeLabel({ isFull: true }), 'Completa');
  assert.equal(rangeLabel({ isFull: false, phraseFrom: 3, phraseTo: 3 }), 'Frase 3');
  assert.equal(rangeLabel({ isFull: false, phraseFrom: 2, phraseTo: 5 }), 'Frases 2–5');
  assert.equal(METRIC_LABELS.rhythm, 'Ritmo y entradas');
});

test('tendencia', () => {
  assert.equal(trendSymbol(null), '–');
  assert.equal(trendSymbol(4), '↑ 4');
  assert.equal(trendSymbol(-3), '↓ 3');
  assert.equal(trendSymbol(0), '= 0');
});

test('periodos: temporada desde el 1 de septiembre más reciente', () => {
  assert.equal(seasonStart(new Date('2026-10-12T00:00:00Z')).toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(seasonStart(new Date('2027-03-01T00:00:00Z')).toISOString(), '2026-09-01T00:00:00.000Z');
  const now = new Date('2026-10-12T00:00:00Z');
  assert.equal(sinceFor('7d', now), '2026-10-05T00:00:00.000Z');
  assert.equal(sinceFor('30d', now), '2026-09-12T00:00:00.000Z');
  assert.equal(sinceFor('season', now), '2026-09-01T00:00:00.000Z');
  assert.equal(daysSince('2026-10-01T00:00:00Z', now), 11);
  assert.equal(daysSince(null, now), null);
});

test('songTitle usa SONGS si existe y si no el id', () => {
  assert.equal(songTitle('fum'), 'fum');
  globalThis.SONGS = { fum: { title: 'Fum Fum Fum' } };
  assert.equal(songTitle('fum'), 'Fum Fum Fum');
  delete globalThis.SONGS;
});
