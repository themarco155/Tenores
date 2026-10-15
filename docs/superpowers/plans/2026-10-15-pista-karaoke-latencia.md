# Pista karaoke y latencia de auriculares · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la barra con aguja por una pista estilo karaoke alineada con el retraso real de los auriculares, y añadir la calibración de ese retraso.

**Architecture:** `practice/latency.js` (retraso guardado/navegador/por defecto, detección de inicios de voz y cálculo del retraso) y `practice/live-track.js` (cálculos de la pista y dibujo en `<canvas>`) son módulos nuevos con su lógica probada en Node. `practice/practice-ui.js` usa ambos: dibuja la pista en cada fotograma de la grabación con guía y añade el flujo "Calibrar auriculares" a la pantalla de preparación. `practice/tones.js` gana `playClickAt` para programar clics exactos.

**Tech Stack:** JavaScript ES2022 sin dependencias, Web Audio, Canvas 2D, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-15-pista-karaoke-latencia-design.md`

**Rama:** `feature/pista-karaoke` desde `main`; al final `git merge --no-ff`.

## Global Constraints

- Retraso efectivo: guardado (`localStorage` `tenores.latency.v1` = `{ms, at}`) > navegador (`(outputLatency + baseLatency) × 1000 + 20` si `outputLatency > 0`) > 100 ms; siempre 0–500 ms.
- Calibración: 6 clics cada 600 ms; desde el 2.º clic, primer inicio de voz en [clic − 100, clic + 600] ms; retraso = mediana; válida con ≥ 3 desfases y dispersión (mediana de desviaciones absolutas) ≤ 60 ms; si no: "No te escuché bien. Inténtalo de nuevo, más cerca del micrófono." y no se guarda.
- Pista: 1,5 s antes y 3 s después de "ahora" (a un tercio); ~120 px; `aria-hidden`; tiempo efectivo `te = audio.currentTime − lagMs/1000`; nota actual en verde; voz plegada a la octava de la nota del instante, coloreada por estado, cortada en silencios; escala ≥ 7 semitonos con margen 1 y suavizado 20 %/fotograma.
- Se mantiene la línea Objetivo · Tú · cents · estado; desaparece la barra con aguja.
- `GUIDE_WARNING` = "Usa auriculares, mejor con cable: si el micrófono capta la guía, la puntuación no será fiable. Con Bluetooth, pulsa «Calibrar auriculares» antes."
- `LIVE_PITCH = false` apaga la pista. Puntuación, guardado y backend no cambian.
- Estilos al final de `practice/practice.css`; `app.js`, `index.html`, `styles.css` no se tocan. Textos en español con tildes. Commits sin `Co-Authored-By`.

## Review Focus

1. **Almacenamiento bloqueado o valor corrupto** → se usa el retraso del navegador o 100 ms, sin romper la práctica → test en Task 1.
2. **Calibración con ruido, silencio o "ta" irregulares** → mensaje de error y nada guardado → tests de `measureLatency` en Task 1.
3. **Nota que sigue más allá del fragmento** → la pista no la dibuja → test de `visibleNotes` en Task 2.
4. **Tenor una octava abajo** → su línea cae sobre la barra → test de `foldToTarget` en Task 2.
5. **Pantalla de alta densidad o cambio de tamaño** → el canvas se redimensiona y no se ve borroso → comprobación en Chrome en Task 3.

---

### Task 1: Retraso y calibración (lógica)

**Files:**
- Create: `practice/latency.js`, `test/latency.test.js`
- Modify: `practice/tones.js`

**Interfaces:**
- Produces: `LATENCY`, `configureLatencyStorage(store)`, `savedLatency() → number|null`, `saveLatency(ms)`, `browserLatency(context) → number|null`, `effectiveLatency(context) → {ms, source: 'calibrated'|'browser'|'default'}`, `detectOnsets(samples, sampleRate) → number[]` (ms), `measureLatency(onsetsMs, clicksMs) → {ok: true, ms} | {ok: false, reason: 'few'|'spread'|'range'}`; en `tones.js`: `playClickAt(ctx, time, accent)`.

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feature/pista-karaoke
```

- [ ] **Step 2: Tests que fallan** — `test/latency.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureLatencyStorage, savedLatency, saveLatency, browserLatency, effectiveLatency, detectOnsets, measureLatency } from '../practice/latency.js';
import { sine } from './helpers/synth.js';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test('retraso del navegador: salida + base + 20 ms de entrada, o null si no lo informa', () => {
  assert.equal(browserLatency({ outputLatency: 0.15, baseLatency: 0.01 }), 180);
  assert.equal(browserLatency({ outputLatency: 0 }), null);
  assert.equal(browserLatency({}), null);
  assert.equal(browserLatency(null), null);
  assert.equal(browserLatency({ outputLatency: 2 }), 500, 'se limita a 500 ms');
});

test('retraso efectivo: calibrado > navegador > 100 ms', () => {
  configureLatencyStorage(memoryStorage());
  assert.deepEqual(effectiveLatency(null), { ms: 100, source: 'default' });
  assert.deepEqual(effectiveLatency({ outputLatency: 0.2 }), { ms: 220, source: 'browser' });
  saveLatency(234.6);
  assert.equal(savedLatency(), 235);
  assert.deepEqual(effectiveLatency({ outputLatency: 0.2 }), { ms: 235, source: 'calibrated' });
});

test('almacenamiento corrupto o bloqueado no rompe nada', () => {
  configureLatencyStorage(memoryStorage({ 'tenores.latency.v1': '{roto' }));
  assert.equal(savedLatency(), null);
  configureLatencyStorage({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } });
  saveLatency(200);
  assert.deepEqual(effectiveLatency(null), { ms: 100, source: 'default' });
});

test('detectOnsets encuentra los inicios de voz en su sitio', () => {
  const sr = 48000;
  const audio = new Float32Array(sr * 3);
  for (const ms of [1000, 1600, 2200]) audio.set(sine(220, 0.15, sr, 0.4), Math.round((ms / 1000) * sr));
  const onsets = detectOnsets(audio, sr);
  assert.equal(onsets.length, 3, JSON.stringify(onsets));
  [1000, 1600, 2200].forEach((ms, i) => assert.ok(Math.abs(onsets[i] - ms) <= 10, `${onsets[i]} ≈ ${ms}`));
  assert.deepEqual(detectOnsets(new Float32Array(sr), sr), [], 'silencio');
});

const CLICKS = [500, 1100, 1700, 2300, 2900, 3500];

test('measureLatency: mediana desde el 2.º clic', () => {
  const onsets = [520, ...CLICKS.slice(1).map((c, i) => c + [240, 250, 260, 250, 255][i])];
  assert.deepEqual(measureLatency(onsets, CLICKS), { ok: true, ms: 250 });
});

test('measureLatency: pocos datos, dispersión alta o fuera de rango → no vale', () => {
  assert.deepEqual(measureLatency([1350, 1950], CLICKS), { ok: false, reason: 'few' });
  const irregular = CLICKS.slice(1).map((c, i) => c + [100, 400, 120, 380, 250][i]);
  assert.deepEqual(measureLatency(irregular, CLICKS), { ok: false, reason: 'spread' });
  const early = CLICKS.slice(1).map(c => c - 80);
  assert.deepEqual(measureLatency(early, CLICKS), { ok: false, reason: 'range' });
});
```

- [ ] **Step 3: Verlos fallar**

Run: `node --test test/latency.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: `practice/latency.js`**

```js
import { median } from './util.js';

// Retraso total de auriculares/altavoz + micrófono: calibración guardada, valor del navegador y valor efectivo.
const KEY = 'tenores.latency.v1';
export const LATENCY = { defaultMs: 100, inputMs: 20, maxMs: 500, clickCount: 6, clickIntervalMs: 600,
  windowBeforeMs: 100, windowAfterMs: 600, minOffsets: 3, maxSpreadMs: 60 };

let storage = () => globalThis.localStorage;
export function configureLatencyStorage(store) { storage = () => store; }

const clamp = ms => Math.max(0, Math.min(LATENCY.maxMs, Math.round(ms)));

export function savedLatency() {
  try {
    const v = JSON.parse(storage()?.getItem(KEY) ?? 'null');
    return v && Number.isFinite(v.ms) ? clamp(v.ms) : null;
  } catch { return null; }
}

export function saveLatency(ms, now = new Date()) {
  try { storage()?.setItem(KEY, JSON.stringify({ ms: clamp(ms), at: now.toISOString() })); } catch { /* sin almacenamiento */ }
}

export function browserLatency(context) {
  const out = context?.outputLatency;
  if (!(out > 0)) return null;
  return clamp((out + (context.baseLatency || 0)) * 1000 + LATENCY.inputMs);
}

export function effectiveLatency(context) {
  const saved = savedLatency();
  if (saved != null) return { ms: saved, source: 'calibrated' };
  const auto = browserLatency(context);
  if (auto != null) return { ms: auto, source: 'browser' };
  return { ms: LATENCY.defaultMs, source: 'default' };
}

// Inicios de voz (ms): tramos de 10 ms cuya energía sube con fuerza respecto a los 30 ms anteriores.
export function detectOnsets(samples, sampleRate, { frameMs = 10, minLevel = 0.02, ratio = 4, refractoryMs = 250 } = {}) {
  const n = Math.round((sampleRate * frameMs) / 1000);
  const frames = Math.floor(samples.length / n);
  const rms = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    let sum = 0;
    for (let i = k * n; i < (k + 1) * n; i++) sum += samples[i] * samples[i];
    rms[k] = Math.sqrt(sum / n);
  }
  const onsets = [];
  let last = -Infinity;
  for (let k = 3; k < frames; k++) {
    const before = (rms[k - 1] + rms[k - 2] + rms[k - 3]) / 3;
    const t = k * frameMs;
    if (rms[k] >= minLevel && rms[k] >= ratio * Math.max(before, 1e-4) && t - last >= refractoryMs) {
      onsets.push(t);
      last = t;
    }
  }
  return onsets;
}

// Retraso medido a partir de los inicios de voz y los clics (ambos en ms desde el inicio de la grabación).
export function measureLatency(onsetsMs, clicksMs) {
  const offsets = [];
  for (const c of clicksMs.slice(1)) {
    const o = onsetsMs.find(t => t >= c - LATENCY.windowBeforeMs && t <= c + LATENCY.windowAfterMs);
    if (o !== undefined) offsets.push(o - c);
  }
  if (offsets.length < LATENCY.minOffsets) return { ok: false, reason: 'few' };
  const med = median(offsets);
  const spread = median(offsets.map(x => Math.abs(x - med)));
  if (spread > LATENCY.maxSpreadMs) return { ok: false, reason: 'spread' };
  if (med < 0 || med > LATENCY.maxMs) return { ok: false, reason: 'range' };
  return { ok: true, ms: Math.round(med) };
}
```

- [ ] **Step 5: `practice/tones.js`** — sustituir `playClick` por:

```js
export function playClickAt(ctx, time, accent = false) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1500 : 1000;
  gain.gain.setValueAtTime(0.15, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.05);
}

export const playClick = (ctx, accent = false) => playClickAt(ctx, ctx.currentTime, accent);
```

- [ ] **Step 6: Tests en verde**

Run: `npm test`
Expected: suite raíz en verde.

- [ ] **Step 7: Commit**

```bash
git add practice/latency.js practice/tones.js test/latency.test.js
git commit -m "feat(practica): cálculo y calibración del retraso de auriculares"
```

---

### Task 2: Pista karaoke (cálculos y dibujo)

**Files:**
- Create: `practice/live-track.js`, `test/live-track.test.js`

**Interfaces:**
- Consumes: `noteName`, `deviationCents` (`live-pitch.js`).
- Produces: `TRACK`, `visibleNotes(ref, te, endFrame?) → [{start, end, midi, current}]` (s), `foldToTarget(user, target) → number|null`, `targetScale(notes, prev) → {center, span}`, `stepScale(current, target, ease?) → {center, span}`, `timeToX(t, te, width)`, `midiToY(midi, scale, height)`, `drawTrack(g, view)` con `view = {width, height, te, notes, points: [{te, midi, state}], scale}`.

- [ ] **Step 1: Tests que fallan** — `test/live-track.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleNotes, foldToTarget, targetScale, stepScale, timeToX, midiToY } from '../practice/live-track.js';

const REF = { hopMs: 10, notes: [{ start: 60, end: 79, midi: 60.1 }, { start: 79, end: 111, midi: 59.36 }, { start: 120, end: 150, midi: 57 }, { start: 600, end: 650, midi: 62 }] };

test('notas visibles: 1,5 s antes y 3 s después, marcando la actual', () => {
  const v = visibleNotes(REF, 0.9);
  assert.deepEqual(v.map(n => n.midi), [60.1, 59.36, 57]);
  assert.deepEqual(v.map(n => n.current), [false, true, false]);
  assert.deepEqual([v[1].start, v[1].end], [0.79, 1.11]);
  assert.equal(visibleNotes(REF, 4.0).length, 1, 'a 4 s solo queda la nota de 6 s');
});

test('las notas fuera del fragmento no se dibujan y la última se recorta', () => {
  const v = visibleNotes(REF, 0.9, 100);
  assert.deepEqual(v.map(n => n.midi), [60.1, 59.36]);
  assert.equal(v[1].end, 1.0);
});

test('plegado a la octava de la nota objetivo', () => {
  assert.equal(foldToTarget(45, 57), 57);
  assert.equal(foldToTarget(57.3, 57), 57.3);
  assert.equal(foldToTarget(56.8, null), 56.8, 'sin objetivo, tal cual');
  assert.equal(foldToTarget(null, 57), null);
});

test('escala: margen de 1, mínimo 7 semitonos, sin notas conserva la anterior y suaviza', () => {
  assert.deepEqual(targetScale([{ midi: 60 }, { midi: 62 }], null), { center: 61, span: 7 });
  assert.deepEqual(targetScale([{ midi: 50 }, { midi: 62 }], null), { center: 56, span: 14 });
  const prev = { center: 60, span: 7 };
  assert.equal(targetScale([], prev), prev);
  assert.deepEqual(stepScale(prev, { center: 70, span: 9 }, 0.2), { center: 62, span: 7.4 });
  assert.deepEqual(stepScale(null, prev), prev);
});

test('posiciones: "ahora" a un tercio y el centro de la escala a media altura', () => {
  assert.equal(timeToX(5, 5, 300), 100);
  assert.equal(timeToX(3.5, 5, 300), 0);
  assert.equal(timeToX(8, 5, 300), 300);
  assert.equal(midiToY(60, { center: 60, span: 7 }, 120), 60);
  assert.ok(midiToY(62, { center: 60, span: 7 }, 120) < 60, 'más agudo, más arriba');
});
```

- [ ] **Step 2: Verlos fallar**

Run: `node --test test/live-track.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: `practice/live-track.js`**

```js
import { noteName, deviationCents } from './live-pitch.js';

// Pista estilo karaoke del indicador en vivo: cálculos puros y dibujo en canvas.
export const TRACK = { pastSec: 1.5, futureSec: 3, minSpan: 7, margin: 1, ease: 0.2, gapSec: 0.25 };
const COLORS = { ok: '#0ffc7e', warn: '#ffc400', bad: '#ff5c5c', none: '#9ba3b1', bar: '#2a3a30', label: '#7f8b86',
  current: '#1f6b45', now: 'rgba(255,255,255,.7)' };

// Notas de la referencia (en segundos) que caen en la ventana alrededor de `te`, recortadas al fragmento.
export function visibleNotes(ref, te, endFrame = Infinity) {
  const hop = ref.hopMs / 1000;
  const from = te - TRACK.pastSec, to = te + TRACK.futureSec;
  return ref.notes
    .filter(n => n.start < endFrame)
    .map(n => ({ start: n.start * hop, end: Math.min(n.end, endFrame) * hop, midi: n.midi }))
    .filter(n => n.end > from && n.start < to)
    .map(n => ({ ...n, current: n.start <= te && te < n.end }));
}

export function foldToTarget(user, target) {
  if (user == null) return null;
  if (target == null) return user;
  return target + deviationCents(user, target) / 100;
}

export function targetScale(notes, prev) {
  if (!notes.length) return prev;
  const lo = Math.min(...notes.map(n => n.midi)) - TRACK.margin;
  const hi = Math.max(...notes.map(n => n.midi)) + TRACK.margin;
  return { center: (lo + hi) / 2, span: Math.max(TRACK.minSpan, hi - lo) };
}

export function stepScale(current, target, ease = TRACK.ease) {
  if (!current) return target;
  if (!target) return current;
  const r = x => Math.round(x * 1000) / 1000;
  return { center: r(current.center + (target.center - current.center) * ease), span: r(current.span + (target.span - current.span) * ease) };
}

export const timeToX = (t, te, width) => (width * (TRACK.pastSec + (t - te))) / (TRACK.pastSec + TRACK.futureSec);
export const midiToY = (midi, scale, height) => height * (0.5 - (midi - scale.center) / scale.span);

export function drawTrack(g, { width, height, te, notes, points, scale }) {
  g.clearRect(0, 0, width, height);
  const nowX = timeToX(te, te, width);
  g.font = '11px system-ui, sans-serif';
  for (const n of notes) {
    const x0 = Math.max(0, timeToX(n.start, te, width)), x1 = Math.min(width, timeToX(n.end, te, width));
    const y = midiToY(n.midi, scale, height);
    g.fillStyle = n.current ? COLORS.current : COLORS.bar;
    g.beginPath();
    g.roundRect(x0, y - 5, Math.max(4, x1 - x0), 10, 5);
    g.fill();
    if (n.current) { g.strokeStyle = COLORS.ok; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = n.current ? COLORS.ok : COLORS.label;
    g.fillText(noteName(n.midi), x0 + 2, y - 8);
  }
  g.strokeStyle = COLORS.now;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(nowX, 0); g.lineTo(nowX, height); g.stroke();
  g.setLineDash([]);
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.midi == null || b.midi == null || b.te - a.te > TRACK.gapSec) continue;
    g.strokeStyle = COLORS[b.state] || COLORS.none;
    g.beginPath();
    g.moveTo(timeToX(a.te, te, width), midiToY(a.midi, scale, height));
    g.lineTo(timeToX(b.te, te, width), midiToY(b.midi, scale, height));
    g.stroke();
  }
  const last = points.at(-1);
  if (last && last.midi != null && te - last.te < TRACK.gapSec) {
    g.fillStyle = COLORS[last.state] || COLORS.none;
    g.beginPath(); g.arc(timeToX(last.te, te, width), midiToY(last.midi, scale, height), 5, 0, Math.PI * 2); g.fill();
  }
}
```

- [ ] **Step 4: Tests en verde**

Run: `npm test`
Expected: suite raíz en verde.

- [ ] **Step 5: Commit**

```bash
git add practice/live-track.js test/live-track.test.js
git commit -m "feat(practica): cálculos y dibujo de la pista estilo karaoke"
```

---

### Task 3: Pista y calibración en el panel de práctica

**Files:**
- Modify: `practice/practice-ui.js`, `practice/practice.css`

**Interfaces:**
- Consumes: Tasks 1–2; `targetFor(ref, seconds, user, {lagMs, endFrame})`, `livePitch`, `deviationCents`, `tuningState`, `noteName` (`live-pitch.js`).

- [ ] **Step 1: Imports y aviso** — en `practice/practice-ui.js`:

Sustituir `import { playTone, playClick } from './tones.js';` por `import { playTone, playClick, playClickAt } from './tones.js';` y añadir:

```js
import { LATENCY, effectiveLatency, saveLatency, detectOnsets, measureLatency } from './latency.js';
import { visibleNotes, foldToTarget, targetScale, stepScale, drawTrack, TRACK } from './live-track.js';
```

Sustituir la constante `GUIDE_WARNING` por:

```js
const GUIDE_WARNING = 'Usa auriculares, mejor con cable: si el micrófono capta la guía, la puntuación no será fiable. Con Bluetooth, pulsa «Calibrar auriculares» antes.';
const LATENCY_SOURCE = { calibrated: 'calibrado', browser: 'automático', default: 'estimado' };
```

- [ ] **Step 2: Botón en la preparación** — en `renderSetup`, justo después de la línea `<p class="practice-warning" data-guide-warning…>${GUIDE_WARNING}</p>`, añadir:

```js
    <p class="practice-latency"><span data-latency></span>
      <button type="button" class="btn small quiet" data-calibrate>Calibrar auriculares</button></p>
```

y antes de `form.addEventListener('submit', …)`:

```js
  const lat = effectiveLatency(s.recorder?.context ?? null);
  form.querySelector('[data-latency]').textContent = `Retraso: ${lat.ms} ms (${LATENCY_SOURCE[lat.source]})`;
  form.querySelector('[data-calibrate]').addEventListener('click', () => calibrate());
```

- [ ] **Step 3: Flujo de calibración** — añadir tras `renderSetup`:

```js
async function ensureRecorder(token, retry) {
  if (s.recorder) return true;
  let rec;
  try { rec = await createRecorder(); }
  catch (err) { if (!stale(token)) renderError(micErrorMessage(err), retry); return false; }
  if (stale(token)) { rec.dispose(); return false; }
  s.recorder = rec;
  return true;
}

// Calibrar auriculares: suenan clics, el tenor canta «ta» con cada uno y se mide cuánto llega tarde su voz.
async function calibrate() {
  cancelFlow();
  const token = s.token;
  if (!(await ensureRecorder(token, calibrate))) return;
  const ctx = s.recorder.context;
  await ctx.resume();
  if (stale(token)) return;
  renderCountdown('Calibrar', 'Ponte los auriculares que vas a usar. Canta «ta» a la vez que cada clic.');
  await wait(2500);
  if (stale(token)) return;
  renderCountdown('♪', 'Canta «ta» con cada clic…');
  s.recorder.start();
  // La grabación llega en bloques de 2048 muestras: el origen puede desviarse unos 20–40 ms; se acepta.
  const origin = ctx.currentTime;
  const first = origin + 0.5;
  const clicksMs = [];
  for (let k = 0; k < LATENCY.clickCount; k++) {
    const t = first + (k * LATENCY.clickIntervalMs) / 1000;
    playClickAt(ctx, t, k === 0);
    clicksMs.push(Math.round((t - origin) * 1000));
  }
  await wait(500 + LATENCY.clickCount * LATENCY.clickIntervalMs + 700);
  const { samples, sampleRate } = s.recorder.stop();
  if (stale(token)) return;
  const r = measureLatency(detectOnsets(samples, sampleRate), clicksMs);
  if (!r.ok) {
    body.innerHTML = `<div class="practice-error" role="alert"><p>No te escuché bien. Inténtalo de nuevo, más cerca del micrófono.</p>
      <div class="practice-actions"><button type="button" class="btn small" data-retry>Reintentar</button>
      <button type="button" class="btn small quiet" data-back>Volver</button></div></div>`;
    body.querySelector('[data-retry]').addEventListener('click', calibrate);
    body.querySelector('[data-back]').addEventListener('click', renderSetup);
    focusBody();
    return;
  }
  saveLatency(r.ms);
  body.innerHTML = `<div class="practice-message"><p>Retraso calibrado: ${r.ms} ms.</p>
    <button type="button" class="btn small" data-back>Volver</button></div>`;
  body.querySelector('[data-back]').addEventListener('click', renderSetup);
  focusBody();
}
```

En `startTake`, sustituir el bloque `if (!s.recorder) { … }` (las seis líneas que crean el grabador) por:

```js
  if (!(await ensureRecorder(token, startTake))) return;
```

- [ ] **Step 4: Pista en la grabación** — en `renderRecording`, sustituir la línea
`<div class="practice-live__scale"><span class="practice-live__ok"></span><span class="practice-live__needle" data-live-needle hidden></span></div>` por:

```js
      <canvas class="practice-live__track"></canvas>
```

Sustituir desde `const updateLive = () => {` hasta el cierre `};` de esa función por:

```js
  const lag = effectiveLatency(s.recorder.context).ms;
  const points = [];
  let scale = { center: 60, span: TRACK.minSpan };
  const canvas = liveEl?.querySelector('.practice-live__track');
  const updateLive = () => {
    const { samples, sampleRate } = s.recorder.recent(LIVE.windowMs);
    const user = livePitch(samples, sampleRate, s.recorder.level);
    const target = targetFor(s.ref, s.audio.currentTime, user, { lagMs: lag, endFrame });
    const cents = deviationCents(user, target);
    const st = tuningState(cents);
    const te = s.audio.currentTime - lag / 1000;
    points.push({ te, midi: foldToTarget(user, target), state: st.key });
    while (points.length && points[0].te < te - TRACK.pastSec - 0.5) points.shift();
    liveEl.dataset.state = st.key;
    liveEl.querySelector('[data-live-target]').textContent = target == null ? '—' : noteName(target);
    liveEl.querySelector('[data-live-user]').textContent = user == null ? '—' : noteName(user);
    liveEl.querySelector('[data-live-cents]').textContent = cents == null ? '' : `${cents > 0 ? '+' : ''}${cents} cents`;
    liveEl.querySelector('[data-live-state]').textContent = st.text;
  };
  const drawLive = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const te = s.audio.currentTime - lag / 1000;
    const notes = visibleNotes(s.ref, te, endFrame);
    scale = stepScale(scale, targetScale(notes, scale));
    drawTrack(g, { width: w, height: h, te, notes, points, scale });
  };
```

Y en `tick`, cambiar `if (liveEl && now - lastLive >= 100) { lastLive = now; updateLive(); }` por:

```js
    if (liveEl) {
      if (now - lastLive >= 100) { lastLive = now; updateLive(); }
      drawLive();
    }
```

- [ ] **Step 5: Estilos** — en `practice/practice.css`, borrar las reglas `.practice-live__scale`, `.practice-live__ok`, `.practice-live__needle` y `.practice-live__needle[hidden]`, y añadir al final:

```css
/* Pista estilo karaoke y calibración del retraso */
.practice-live__track { display: block; width: 100%; height: 120px; background: #000; border: 1px solid var(--card-border, #1b1d1f); border-radius: 12px; }
.practice-latency { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 13px; color: var(--fg-muted, #dfe4ea); }
```

- [ ] **Step 6: Comprobaciones**

Run: `node --check practice/practice-ui.js && node --check practice/tones.js && npm test`
Expected: sin errores; suite raíz en verde.

- [ ] **Step 7: Commit**

```bash
git add practice/practice-ui.js practice/practice.css
git commit -m "feat(practica): pista estilo karaoke y calibración de auriculares en la práctica"
```

- [ ] **Step 8: Prueba en Chrome (controlador)** — con la web local:
  - toma con guía con la pista de referencia como micrófono → la línea cae sobre las barras;
  - misma toma con 250 ms de retraso simulado (el micrófono falso empieza 0,25 s tarde) → desalineada; calibrar con clics simulados (el micrófono falso responde a cada clic 250 ms después) → "Retraso calibrado: ~250 ms" → la línea vuelve a caer sobre las barras;
  - calibración en silencio → mensaje de error y no se guarda;
  - "a prueba" sin pista; vista de móvil (390 px).
  Después: `git merge --no-ff feature/pista-karaoke`.
