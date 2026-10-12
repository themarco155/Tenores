# Fase 1 — Motor de análisis y práctica · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier visitante grabe la parte de tenor de una canción y reciba una puntuación (afinación, ritmo/entradas, estabilidad) y hasta 3 consejos, sin backend.

**Architecture:** Módulos ES nativos en `practice/`, cargados con `<script type="module">` sin build. El motor (`pitch` → `segment` → `align` → `score`/`tips`) es puro y se prueba en Node con `node --test`. La interfaz es un panel overlay inyectado por `practice/main.js`, que lee `SONGS` de `app.js` sin modificarlo. Las curvas de referencia se precalculan en el navegador (`tools/build-pitch.html`) y se versionan en `assets/pitch/`.

**Tech Stack:** JavaScript (ES2022, módulos nativos), Web Audio API (AudioWorklet), Web Workers, SVG, Node ≥ 20 (`node:test`, sin dependencias npm), Python solo como servidor estático local.

**Spec:** `docs/superpowers/specs/2026-10-12-fase1-motor-practica-design.md` (contexto: `docs/superpowers/specs/2026-10-12-sistema-practica-overview.md`)

## Global Constraints

- Sin dependencias de ejecución ni paso de build: todo el código del navegador son módulos ES servidos tal cual.
- `app.js` y `styles.css` NO se modifican. `index.html` solo gana 2 líneas (link CSS + script módulo).
- Tests: `npm test` → `node --test "test/**/*.test.js"`; sin paquetes npm.
- El audio del usuario nunca sale del navegador.
- Todas las constantes de puntuación viven en `practice/scoring-config.js` (`SCORING`).
- Frames de 10 ms (`hopMs: 10`) en todas las curvas; tiempos de notas y frases en frames.
- Textos de interfaz en español, con tildes.
- Formato de referencia `version: 1` exactamente como en el spec.
- Commits con la línea final `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Dispositivos a 44,1 kHz** (iOS/macOS graban a 44100 Hz, no 48000): la afinación debe detectarse igual → test en Task 2.
2. **Toma muy corta o vacía** ("Detener" al instante): el análisis devuelve `valid: false` sin lanzar excepciones → tests en Task 6 (camino vacío) y Task 8 (0,3 s de silencio).
3. **Rangos de frases raros** (una sola frase, desde > hasta, fuera de límites): se acotan sin romper → test en Task 4.
4. **Fragmentos sin notas largas**: estabilidad `null` y pesos repartidos, sin `NaN` → test en Task 6.
5. **Cerrar el panel durante la cuenta atrás o el análisis**: no se pinta nada después, el micrófono se libera → paso de verificación manual en Task 12.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` | `"type": "module"` y script `test` |
| `practice/util.js` | Conversión Hz↔MIDI, mediana, medias, `lin`, `round2`, `formatTime`, `medianFilter` |
| `practice/pitch.js` | `resample`, `detectPitch` (YIN) |
| `practice/segment.js` | `segmentNotes`, `segmentPhrases` |
| `practice/reference.js` | `referenceFromCurve`, `buildReference`, `sliceReference` |
| `practice/align.js` | `downsample2`, `frameCost`, `firstVoicedRun`, `align` (DTW subsecuencia con banda) |
| `practice/scoring-config.js` | `SCORING`, `bandFor` |
| `practice/score.js` | `score` (métricas por nota, frase y global) |
| `practice/tips.js` | `buildTips` |
| `practice/analyze.js` | `ENGINE_VERSION`, `analyze` |
| `practice/analysis-worker.js` · `practice/analysis-client.js` | Worker y su cliente con promesa |
| `practice/recorder.js` · `practice/recorder-worklet.js` | Captura de micrófono |
| `practice/tones.js` | Nota de partida y clic |
| `practice/chart.js` | `toSegments`, `renderChart` (SVG) |
| `practice/practice-ui.js` | Panel de práctica (estados, eventos) |
| `practice/main.js` | Botón "Practicar" e integración con la app |
| `practice/practice.css` | Estilos del panel |
| `tools/songs-parser.js` | `parseSongs(source)` extrae canciones de `app.js` |
| `tools/build-pitch.html` · `tools/build-pitch.js` | Generador de curvas en el navegador |
| `tools/check-pitch.mjs` | Validador de `assets/pitch/*.json` |
| `tools/mic-check.html` · `tools/mic-check.js` | Diagnóstico de micrófono |
| `assets/pitch/*.json` | Curvas de referencia + `index.json` |
| `test/helpers/synth.js` · `test/helpers/wav.js` · `test/helpers/melody.js` | Señales sintéticas, lector WAV, melodía de prueba |

---

### Task 1: Base de tests y utilidades numéricas

**Files:**
- Create: `package.json`
- Create: `practice/util.js`
- Test: `test/util.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `hzToMidi(hz) → number`, `midiToHz(midi) → number`, `median(values) → number|null` (ignora `null`/`NaN`), `mean(values) → number|null`, `weightedMean(pairs: [value, weight][]) → number|null`, `lin(x, ok, bad) → 0..100`, `round2(x)`, `formatTime(sec) → "m:ss"`, `medianFilter(values, size) → (number|null)[]` (conserva `null`).

- [ ] **Step 1: Crear `package.json`**

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"test/**/*.test.js\""
  }
}
```

- [ ] **Step 2: Escribir el test que falla**

`test/util.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hzToMidi, midiToHz, median, mean, weightedMean, lin, round2, formatTime, medianFilter } from '../practice/util.js';

test('hzToMidi y midiToHz son inversas', () => {
  assert.equal(hzToMidi(440), 69);
  assert.equal(hzToMidi(220), 57);
  assert.ok(Math.abs(midiToHz(57) - 220) < 1e-9);
});

test('median ignora null y promedia los centrales', () => {
  assert.equal(median([3, null, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([null, NaN]), null);
});

test('mean y weightedMean', () => {
  assert.equal(mean([1, null, 3]), 2);
  assert.equal(mean([]), null);
  assert.equal(weightedMean([[100, 1], [0, 3]]), 25);
  assert.equal(weightedMean([[null, 1]]), null);
});

test('lin es 100 en ok, 0 en bad y lineal entre medias', () => {
  assert.equal(lin(10, 20, 100), 100);
  assert.equal(lin(60, 20, 100), 50);
  assert.equal(lin(120, 20, 100), 0);
});

test('round2 y formatTime', () => {
  assert.equal(round2(57.0349), 57.03);
  assert.equal(formatTime(84), '1:24');
  assert.equal(formatTime(5.4), '0:05');
});

test('medianFilter conserva null y elimina picos aislados', () => {
  assert.deepEqual(medianFilter([60, 60, 72, 60, 60, null, 62], 5), [60, 60, 60, 60, 61, null, 61]);
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/util.js`.

- [ ] **Step 4: Implementar `practice/util.js`**

```js
export const hzToMidi = hz => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);

const isNum = v => v != null && !Number.isNaN(v);

export function median(values) {
  const a = values.filter(isNum).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function mean(values) {
  const a = values.filter(isNum);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

export function weightedMean(pairs) {
  let sum = 0, weight = 0;
  for (const [v, w] of pairs) if (isNum(v)) { sum += v * w; weight += w; }
  return weight ? sum / weight : null;
}

export function lin(x, ok, bad) {
  if (x <= ok) return 100;
  if (x >= bad) return 0;
  return (100 * (bad - x)) / (bad - ok);
}

export const round2 = x => Math.round(x * 100) / 100;

export function formatTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function medianFilter(values, size) {
  const h = size >> 1;
  return values.map((v, k) => (v == null ? null : median(values.slice(Math.max(0, k - h), k + h + 1))));
}
```

Nota: en el último test, el frame 4 tiene ventana `[72, 60, 60, null, 62]` → mediana de `[60, 60, 62, 72]` = 61, y el frame 6 tiene `[60, null, 62]` → 61.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json practice/util.js test/util.test.js
git commit -m "feat(practica): utilidades numéricas y base de tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Detección de afinación (YIN)

**Files:**
- Create: `practice/pitch.js`
- Create: `test/helpers/synth.js`
- Test: `test/pitch.test.js`

**Interfaces:**
- Consumes: `hzToMidi`, `medianFilter` de `practice/util.js`.
- Produces:
  - `PITCH` (constantes), `resample(samples: Float32Array, fromRate, toRate) → Float32Array`
  - `detectPitch(samples: Float32Array, sampleRate: number) → { hopMs: 10, midi: (number|null)[], rms: number[] }` — un valor cada 10 ms.
  - Helpers de test: `sine(hz, seconds, sr?, amp?)`, `saw(hz, seconds, sr?, amp?)`, `noise(seconds, sr?, amp?)`, `silence(seconds, sr?)`, `concat(...parts)`, `synthFromCurve(curve, sr?, amp?)`, `resampleBy(samples, factor)`.

- [ ] **Step 1: Crear los helpers de señales `test/helpers/synth.js`**

```js
import { midiToHz } from '../../practice/util.js';

export function sine(hz, seconds, sr = 48000, amp = 0.5) {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return out;
}

export function saw(hz, seconds, sr = 48000, amp = 0.4) {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * (2 * ((hz * i) / sr % 1) - 1);
  return out;
}

export function noise(seconds, sr = 48000, amp = 0.3) {
  const out = new Float32Array(Math.round(seconds * sr));
  let seed = 12345;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out[i] = amp * (seed / 1073741824 - 1);
  }
  return out;
}

export const silence = (seconds, sr = 48000) => new Float32Array(Math.round(seconds * sr));

export function concat(...parts) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// Convierte una curva de frames de 10 ms (MIDI o null) en audio con fase continua.
export function synthFromCurve(curve, sr = 48000, amp = 0.4) {
  const per = Math.round(sr / 100);
  const out = new Float32Array(curve.length * per);
  let phase = 0;
  curve.forEach((m, k) => {
    if (m == null) { phase = 0; return; }
    const inc = (2 * Math.PI * midiToHz(m)) / sr;
    for (let i = 0; i < per; i++) { out[k * per + i] = amp * Math.sin(phase); phase += inc; }
  });
  return out;
}

// factor > 1 sube el tono (12·log2(factor) semitonos) y acorta la duración.
export function resampleBy(samples, factor) {
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    const p = i * factor, i0 = Math.floor(p), f = p - i0;
    const a = samples[i0], b = samples[Math.min(i0 + 1, samples.length - 1)];
    out[i] = a + (b - a) * f;
  }
  return out;
}
```

- [ ] **Step 2: Escribir el test que falla**

`test/pitch.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../practice/pitch.js';
import { hzToMidi, median } from '../practice/util.js';
import { sine, saw, noise, silence, concat } from './helpers/synth.js';

const voiced = midi => midi.filter(v => v != null);
const centsError = (midi, hz) => Math.abs(median(voiced(midi)) - hzToMidi(hz)) * 100;

for (const [hz, sr] of [[110, 48000], [220, 48000], [330, 48000], [440, 48000], [220, 44100], [330, 44100]]) {
  test(`seno de ${hz} Hz a ${sr} Hz → error < 5 cents`, () => {
    const { midi } = detectPitch(sine(hz, 1, sr), sr);
    assert.ok(voiced(midi).length > midi.length * 0.8, 'la mayoría de frames tienen voz');
    assert.ok(centsError(midi, hz) < 5, `error ${centsError(midi, hz).toFixed(2)} cents`);
  });
}

for (const hz of [110, 220]) {
  test(`diente de sierra de ${hz} Hz → error < 5 cents (sin errores de octava)`, () => {
    const { midi } = detectPitch(saw(hz, 1), 48000);
    assert.ok(centsError(midi, hz) < 5);
  });
}

test('produce un frame cada 10 ms', () => {
  const { hopMs, midi, rms } = detectPitch(sine(220, 1), 48000);
  assert.equal(hopMs, 10);
  assert.ok(midi.length >= 98 && midi.length <= 101, `frames: ${midi.length}`);
  assert.equal(rms.length, midi.length);
});

test('el silencio es null', () => {
  const { midi } = detectPitch(silence(1), 48000);
  assert.ok(midi.every(v => v === null));
});

test('el ruido blanco es mayoritariamente null', () => {
  const { midi } = detectPitch(noise(1), 48000);
  assert.ok(voiced(midi).length < midi.length * 0.2, `con voz: ${voiced(midi).length}`);
});

test('silencio seguido de tono: el silencio queda null', () => {
  const { midi } = detectPitch(concat(silence(0.5), sine(220, 0.5)), 48000);
  assert.ok(midi.slice(0, 40).every(v => v === null));
  assert.ok(voiced(midi.slice(55)).length > 35);
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/pitch.js`.

- [ ] **Step 4: Implementar `practice/pitch.js`**

```js
import { hzToMidi, medianFilter } from './util.js';

export const PITCH = {
  hopMs: 10,
  targetRate: 16000,
  windowSize: 512,
  hopSize: 160,
  threshold: 0.15,
  minHz: 80,
  maxHz: 700,
  silenceDb: -45,
  absoluteFloor: 1e-4,
  maxAperiodicity: 0.35,
  medianSize: 5,
};

// Media móvil como paso bajo + interpolación lineal.
export function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return Float32Array.from(samples);
  const k = Math.max(1, Math.round(fromRate / toRate));
  let src = samples;
  if (k > 1) {
    src = new Float32Array(samples.length);
    let acc = 0;
    for (let i = 0; i < samples.length; i++) {
      acc += samples[i];
      if (i >= k) acc -= samples[i - k];
      src[i] = acc / Math.min(i + 1, k);
    }
  }
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio, i0 = Math.floor(pos), f = pos - i0;
    const a = src[i0], b = i0 + 1 < src.length ? src[i0 + 1] : a;
    out[i] = a + (b - a) * f;
  }
  return out;
}

function yinFrame(x, start, cfg, d) {
  const { W, tauMin, tauMax, sr } = cfg;
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = x[start + j] - x[start + j + tau];
      sum += diff * diff;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < PITCH.threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (d[t] < d[best]) best = t;
    if (d[best] > PITCH.maxAperiodicity) return null;
    tau = best;
  }
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a - 2 * b + c;
    if (den !== 0) better = tau + (a - c) / (2 * den);
  }
  return sr / better;
}

export function detectPitch(samples, sampleRate) {
  const sr = PITCH.targetRate;
  const x0 = resample(samples, sampleRate, sr);
  const W = PITCH.windowSize, hop = PITCH.hopSize;
  const tauMin = Math.floor(sr / PITCH.maxHz), tauMax = Math.ceil(sr / PITCH.minHz);
  const frames = Math.floor(x0.length / hop);
  const x = new Float32Array(frames * hop + W + tauMax + 1);
  x.set(x0);

  const rms = new Array(frames);
  for (let k = 0; k < frames; k++) {
    let s = 0;
    const st = k * hop;
    for (let j = 0; j < W; j++) s += x[st + j] * x[st + j];
    rms[k] = Math.sqrt(s / W);
  }
  const peak = rms.reduce((m, v) => Math.max(m, v), 0);
  const floor = Math.max(peak * 10 ** (PITCH.silenceDb / 20), PITCH.absoluteFloor);

  const d = new Float32Array(tauMax + 1);
  const cfg = { W, tauMin, tauMax, sr };
  const raw = new Array(frames).fill(null);
  for (let k = 0; k < frames; k++) {
    if (rms[k] < floor) continue;
    const hz = yinFrame(x, k * hop, cfg, d);
    if (hz && hz >= PITCH.minHz && hz <= PITCH.maxHz) raw[k] = hzToMidi(hz);
  }
  return { hopMs: PITCH.hopMs, midi: medianFilter(raw, PITCH.medianSize), rms };
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS (todos los tests de `util` y `pitch`).

- [ ] **Step 6: Commit**

```bash
git add practice/pitch.js test/helpers/synth.js test/pitch.test.js
git commit -m "feat(practica): detección de afinación con YIN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Segmentación en notas y frases

**Files:**
- Create: `practice/segment.js`
- Create: `test/helpers/melody.js` (solo `MELODY` y `curve` en esta tarea)
- Test: `test/segment.test.js`

**Interfaces:**
- Consumes: `median`, `round2`, `medianFilter` de `util.js`.
- Produces:
  - `SEGMENT` (constantes).
  - `segmentNotes(midi: (number|null)[]) → { start, end, midi }[]` (frames, `end` exclusivo).
  - `segmentPhrases(notes) → { index, start, end, noteFrom, noteTo }[]` (`index` desde 1; `noteTo` inclusivo).
  - Helpers: `MELODY`, `curve(spec: [midi|null, frames][]) → (number|null)[]`.

- [ ] **Step 1: Crear `test/helpers/melody.js`**

```js
// Melodía de prueba: 3 frases separadas por silencios de 400 ms.
export const MELODY = [
  [57, 40], [59, 40], [60, 60], [62, 40], [null, 40],
  [64, 50], [62, 50], [60, 80], [null, 40],
  [59, 40], [57, 100], [null, 20],
];

export function curve(spec) {
  const out = [];
  for (const [m, n] of spec) for (let i = 0; i < n; i++) out.push(m);
  return out;
}
```

- [ ] **Step 2: Escribir el test que falla**

`test/segment.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentNotes, segmentPhrases } from '../practice/segment.js';
import { MELODY, curve } from './helpers/melody.js';

test('segmentNotes separa la melodía en sus 9 notas exactas', () => {
  assert.deepEqual(segmentNotes(curve(MELODY)), [
    { start: 0, end: 40, midi: 57 }, { start: 40, end: 80, midi: 59 },
    { start: 80, end: 140, midi: 60 }, { start: 140, end: 180, midi: 62 },
    { start: 220, end: 270, midi: 64 }, { start: 270, end: 320, midi: 62 },
    { start: 320, end: 400, midi: 60 },
    { start: 440, end: 480, midi: 59 }, { start: 480, end: 580, midi: 57 },
  ]);
});

test('un pico de 3 frames no crea una nota nueva', () => {
  assert.deepEqual(segmentNotes(curve([[60, 50], [65, 3], [60, 50]])), [{ start: 0, end: 103, midi: 60 }]);
});

test('el vibrato de ±0,2 semitonos es una sola nota', () => {
  const vib = Array.from({ length: 120 }, (_, k) => 60 + 0.2 * Math.sin(k / 3));
  const notes = segmentNotes(vib);
  assert.equal(notes.length, 1);
  assert.ok(Math.abs(notes[0].midi - 60) < 0.1);
});

test('los tramos con voz de menos de 60 ms aislados se descartan', () => {
  assert.deepEqual(segmentNotes(curve([[null, 10], [60, 4], [null, 10]])), []);
});

test('segmentPhrases agrupa por silencios ≥ 300 ms', () => {
  assert.deepEqual(segmentPhrases(segmentNotes(curve(MELODY))), [
    { index: 1, start: 0, end: 180, noteFrom: 0, noteTo: 3 },
    { index: 2, start: 220, end: 400, noteFrom: 4, noteTo: 6 },
    { index: 3, start: 440, end: 580, noteFrom: 7, noteTo: 8 },
  ]);
});

test('una frase de menos de 1 s se fusiona con la siguiente', () => {
  const phrases = segmentPhrases(segmentNotes(curve([[60, 50], [null, 40], [62, 150]])));
  assert.deepEqual(phrases, [{ index: 1, start: 0, end: 240, noteFrom: 0, noteTo: 1 }]);
});

test('una última frase corta se fusiona con la anterior', () => {
  const phrases = segmentPhrases(segmentNotes(curve([[60, 150], [null, 40], [62, 50]])));
  assert.deepEqual(phrases, [{ index: 1, start: 0, end: 240, noteFrom: 0, noteTo: 1 }]);
});

test('sin notas no hay frases', () => {
  assert.deepEqual(segmentPhrases([]), []);
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/segment.js`.

- [ ] **Step 4: Implementar `practice/segment.js`**

```js
import { median, round2, medianFilter } from './util.js';

export const SEGMENT = {
  jump: 0.5,          // semitonos para considerar cambio de nota
  persist: 3,         // frames que debe mantenerse el cambio
  refWindow: 10,      // frames recientes que definen la altura actual
  minNoteFrames: 6,   // 60 ms
  gapFrames: 30,      // silencio de 300 ms separa frases
  minPhraseFrames: 100, // frases de menos de 1 s se fusionan
};

export function segmentNotes(midi) {
  const s = medianFilter(midi, 5);
  const raw = [];
  let start = -1;
  const close = end => { if (start >= 0 && end > start) raw.push({ start, end }); start = -1; };

  for (let k = 0; k < s.length; k++) {
    if (s[k] == null) { close(k); continue; }
    if (start < 0) { start = k; continue; }
    const ref = median(s.slice(Math.max(start, k - SEGMENT.refWindow), k));
    let changed = true;
    for (let j = k; j < k + SEGMENT.persist; j++) {
      if (j >= s.length || s[j] == null || Math.abs(s[j] - ref) <= SEGMENT.jump) { changed = false; break; }
    }
    if (changed) { close(k); start = k; }
  }
  close(s.length);

  // Tramos cortos pegados a otro se absorben.
  const joined = [];
  for (const n of raw) {
    const prev = joined[joined.length - 1];
    const touching = prev && prev.end === n.start;
    if (touching && (n.end - n.start < SEGMENT.minNoteFrames || prev.end - prev.start < SEGMENT.minNoteFrames)) {
      prev.end = n.end;
      continue;
    }
    joined.push({ ...n });
  }

  // Se descartan los tramos cortos aislados y se fusionan notas contiguas de la misma altura.
  const out = [];
  for (const n of joined) {
    if (n.end - n.start < SEGMENT.minNoteFrames) continue;
    const pitch = median(midi.slice(n.start, n.end));
    const prev = out[out.length - 1];
    if (prev && prev.end === n.start && Math.abs(prev.midi - pitch) < SEGMENT.jump) {
      prev.end = n.end;
      prev.midi = median(midi.slice(prev.start, prev.end));
      continue;
    }
    out.push({ start: n.start, end: n.end, midi: pitch });
  }
  return out.map(n => ({ start: n.start, end: n.end, midi: round2(n.midi) }));
}

export function segmentPhrases(notes) {
  const groups = [];
  notes.forEach((n, i) => {
    const g = groups[groups.length - 1];
    if (g && n.start - notes[i - 1].end < SEGMENT.gapFrames) { g.end = n.end; g.noteTo = i; }
    else groups.push({ start: n.start, end: n.end, noteFrom: i, noteTo: i });
  });

  const merged = [];
  for (let i = 0; i < groups.length; i++) {
    const g = { ...groups[i] };
    while (g.end - g.start < SEGMENT.minPhraseFrames && i + 1 < groups.length) {
      const next = groups[++i];
      g.end = next.end;
      g.noteTo = next.noteTo;
    }
    if (g.end - g.start < SEGMENT.minPhraseFrames && merged.length) {
      const prev = merged[merged.length - 1];
      prev.end = g.end;
      prev.noteTo = g.noteTo;
      continue;
    }
    merged.push(g);
  }
  return merged.map((g, i) => ({ index: i + 1, start: g.start, end: g.end, noteFrom: g.noteFrom, noteTo: g.noteTo }));
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add practice/segment.js test/helpers/melody.js test/segment.test.js
git commit -m "feat(practica): segmentación en notas y frases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Referencias (construir y recortar)

**Files:**
- Create: `practice/reference.js`
- Test: `test/reference.test.js`

**Interfaces:**
- Consumes: `detectPitch`, `PITCH` (Task 2); `segmentNotes`, `segmentPhrases` (Task 3); `round2`.
- Produces:
  - `referenceFromCurve({ songId, source?, midi }) → RefData` con `{ version: 1, songId, source, hopMs: 10, frameCount, midi, notes, phrases }`.
  - `buildReference({ songId, source, samples, sampleRate }) → RefData`.
  - `sliceReference(ref, phraseFrom, phraseTo) → Slice` con `{ songId, hopMs, offsetFrames, startSec, endSec, phraseFrom, phraseTo, isFull, midi, notes, phrases }`; los tiempos de `notes`/`phrases` son relativos al recorte, `phrases[].index` conserva el número original y `noteFrom`/`noteTo` apuntan a `slice.notes`. Acota `phraseFrom`/`phraseTo` a `[1, n]` con `phraseTo ≥ phraseFrom`.

- [ ] **Step 1: Escribir el test que falla**

`test/reference.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceFromCurve, buildReference, sliceReference } from '../practice/reference.js';
import { MELODY, curve } from './helpers/melody.js';
import { sine, silence, concat } from './helpers/synth.js';

const ref = () => referenceFromCurve({ songId: 'test', midi: curve(MELODY) });

test('referenceFromCurve produce el formato versión 1', () => {
  const r = ref();
  assert.equal(r.version, 1);
  assert.equal(r.songId, 'test');
  assert.equal(r.source, '');
  assert.equal(r.hopMs, 10);
  assert.equal(r.frameCount, 600);
  assert.equal(r.midi.length, 600);
  assert.equal(r.notes.length, 9);
  assert.equal(r.phrases.length, 3);
});

test('referenceFromCurve redondea a 2 decimales', () => {
  const r = referenceFromCurve({ songId: 'x', midi: Array(120).fill(57.12345) });
  assert.equal(r.midi[0], 57.12);
});

test('buildReference detecta dos tonos separados como dos frases', () => {
  const audio = concat(sine(220, 1.5), silence(0.5), sine(246.94, 1.5));
  const r = buildReference({ songId: 'dos', source: 'x.wav', samples: audio, sampleRate: 48000 });
  assert.equal(r.notes.length, 2);
  assert.ok(Math.abs(r.notes[0].midi - 57) < 0.05);
  assert.ok(Math.abs(r.notes[1].midi - 59) < 0.05);
  assert.equal(r.phrases.length, 2);
});

test('sliceReference de una sola frase rebasa tiempos y notas', () => {
  const s = sliceReference(ref(), 2, 2);
  assert.equal(s.offsetFrames, 220);
  assert.equal(s.startSec, 2.2);
  assert.equal(s.endSec, 4);
  assert.equal(s.midi.length, 180);
  assert.equal(s.isFull, false);
  assert.deepEqual(s.notes[0], { start: 0, end: 50, midi: 64 });
  assert.equal(s.notes.length, 3);
  assert.deepEqual(s.phrases, [{ index: 2, start: 0, end: 180, noteFrom: 0, noteTo: 2 }]);
});

test('sliceReference completo marca isFull', () => {
  const s = sliceReference(ref(), 1, 3);
  assert.equal(s.isFull, true);
  assert.equal(s.midi.length, 580);
  assert.equal(s.phrases.length, 3);
});

test('sliceReference acota rangos inválidos', () => {
  const inverted = sliceReference(ref(), 3, 1);
  assert.equal(inverted.phraseFrom, 3);
  assert.equal(inverted.phraseTo, 3);
  const outOfRange = sliceReference(ref(), 0, 99);
  assert.equal(outOfRange.phraseFrom, 1);
  assert.equal(outOfRange.phraseTo, 3);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/reference.js`.

- [ ] **Step 3: Implementar `practice/reference.js`**

```js
import { detectPitch, PITCH } from './pitch.js';
import { segmentNotes, segmentPhrases } from './segment.js';
import { round2 } from './util.js';

export function referenceFromCurve({ songId, source = '', midi }) {
  const rounded = midi.map(v => (v == null ? null : round2(v)));
  const notes = segmentNotes(rounded);
  return {
    version: 1,
    songId,
    source,
    hopMs: PITCH.hopMs,
    frameCount: rounded.length,
    midi: rounded,
    notes,
    phrases: segmentPhrases(notes),
  };
}

export function buildReference({ songId, source, samples, sampleRate }) {
  return referenceFromCurve({ songId, source, midi: detectPitch(samples, sampleRate).midi });
}

export function sliceReference(ref, phraseFrom, phraseTo) {
  const count = ref.phrases.length;
  if (!count) throw new Error('La referencia no tiene frases');
  const from = Math.min(Math.max(1, Math.trunc(phraseFrom) || 1), count);
  const to = Math.min(Math.max(from, Math.trunc(phraseTo) || from), count);
  const first = ref.phrases[from - 1];
  const last = ref.phrases[to - 1];
  const offset = first.start;
  const notes = ref.notes
    .slice(first.noteFrom, last.noteTo + 1)
    .map(n => ({ start: n.start - offset, end: n.end - offset, midi: n.midi }));
  const phrases = ref.phrases.slice(from - 1, to).map(p => ({
    index: p.index,
    start: p.start - offset,
    end: p.end - offset,
    noteFrom: p.noteFrom - first.noteFrom,
    noteTo: p.noteTo - first.noteFrom,
  }));
  return {
    songId: ref.songId,
    hopMs: ref.hopMs,
    offsetFrames: offset,
    startSec: (offset * ref.hopMs) / 1000,
    endSec: (last.end * ref.hopMs) / 1000,
    phraseFrom: from,
    phraseTo: to,
    isFull: from === 1 && to === count,
    midi: ref.midi.slice(offset, last.end),
    notes,
    phrases,
  };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add practice/reference.js test/reference.test.js
git commit -m "feat(practica): construir y recortar curvas de referencia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Alineación DTW

**Files:**
- Create: `practice/align.js`
- Test: `test/align.test.js`

**Interfaces:**
- Consumes: nada (puro).
- Produces:
  - `ALIGN` (constantes), `downsample2(midi) → midi` (frames de 20 ms), `frameCost(a, b) → number`, `firstVoicedRun(midi, minRun?) → index`.
  - `align(user: midi[], ref: midi[], { bandFrames: number }) → [userIdx, refIdx][]` en frames de 10 ms, ordenado por el camino. `bandFrames` va en frames de 10 ms. Es DTW de **subsecuencia**: la referencia se recorre entera y el usuario puede tener silencio o ruido antes y después. Devuelve `[]` si no hay camino.

- [ ] **Step 1: Escribir el test que falla**

`test/align.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { align, frameCost, downsample2, firstVoicedRun } from '../practice/align.js';
import { segmentNotes } from '../practice/segment.js';
import { MELODY, curve } from './helpers/melody.js';

const userAtRef = (path, r) => path.find(([, rr]) => rr >= r)[0];

test('frameCost ignora la octava y limita a 3', () => {
  assert.equal(frameCost(null, null), 0);
  assert.equal(frameCost(60, null), 1);
  assert.equal(frameCost(60, 60.5), 0.5);
  assert.equal(frameCost(48, 60), 0);
  assert.equal(frameCost(60, 67), 3);
});

test('downsample2 promedia pares y respeta null', () => {
  assert.deepEqual(downsample2([60, 62, null, 64, null, null, 65]), [61, 64, null, 65]);
});

test('firstVoicedRun busca 5 frames seguidos con voz', () => {
  assert.equal(firstVoicedRun([60, null, 60, 60, 60, 60, 60]), 2);
  assert.equal(firstVoicedRun([null, null]), 0);
});

test('curvas idénticas: los inicios de nota coinciden', () => {
  const ref = curve(MELODY);
  const path = align(ref, ref, { bandFrames: 100 });
  for (const n of segmentNotes(ref)) assert.ok(Math.abs(userAtRef(path, n.start) - n.start) <= 2);
});

test('recupera un retraso de 300 ms y un estiramiento del 10 %', () => {
  const ref = curve(MELODY);
  const stretched = Array.from({ length: Math.round(ref.length * 1.1) }, (_, k) => ref[Math.min(ref.length - 1, Math.floor(k / 1.1))]);
  const user = [...Array(30).fill(null), ...stretched, ...Array(50).fill(null)];
  const path = align(user, ref, { bandFrames: Math.max(100, Math.round(ref.length * 0.15)) });
  for (const n of segmentNotes(ref)) {
    const expected = 30 + Math.round(n.start * 1.1);
    const got = userAtRef(path, n.start);
    assert.ok(Math.abs(got - expected) <= 4, `nota en ${n.start}: esperado ${expected}, obtenido ${got}`);
  }
});

test('el camino recorre la referencia de principio a fin', () => {
  const ref = curve(MELODY);
  const path = align([...Array(20).fill(null), ...ref], ref, { bandFrames: 100 });
  assert.equal(path[0][1], 0);
  assert.equal(path[path.length - 1][1], ref.length - 1);
});

test('entradas vacías devuelven camino vacío', () => {
  assert.deepEqual(align([], curve(MELODY), { bandFrames: 100 }), []);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/align.js`.

- [ ] **Step 3: Implementar `practice/align.js`**

```js
export const ALIGN = {
  nullCost: 1,       // un lado con voz y el otro no
  maxCost: 3,        // semitonos máximos por frame
  stepPenalty: 0.05, // penaliza deformar el tiempo para preferir la diagonal
  minRun: 5,         // frames seguidos con voz para detectar el inicio
};

export function downsample2(midi) {
  const out = new Array(Math.ceil(midi.length / 2));
  for (let i = 0; i < out.length; i++) {
    const a = midi[2 * i];
    const b = 2 * i + 1 < midi.length ? midi[2 * i + 1] : null;
    out[i] = a == null ? (b ?? null) : b == null ? a : (a + b) / 2;
  }
  return out;
}

export function frameCost(a, b) {
  if (a == null && b == null) return 0;
  if (a == null || b == null) return ALIGN.nullCost;
  const d = Math.abs(a - b);
  return Math.min(d, Math.abs(d - 12), ALIGN.maxCost);
}

export function firstVoicedRun(midi, minRun = ALIGN.minRun) {
  let run = 0;
  for (let i = 0; i < midi.length; i++) {
    run = midi[i] == null ? 0 : run + 1;
    if (run >= minRun) return i - minRun + 1;
  }
  return 0;
}

export function align(user, ref, { bandFrames }) {
  const u = downsample2(user), r = downsample2(ref);
  const N = u.length, M = r.length;
  if (!N || !M) return [];
  const band = Math.max(2, Math.ceil(bandFrames / 2));
  const lag = firstVoicedRun(u) - firstVoicedRun(r);
  const width = 2 * band + 1;
  const D = new Float32Array(N * width).fill(Infinity);
  const dir = new Uint8Array(N * width); // 0 inicio · 1 diagonal · 2 avanza usuario · 3 avanza referencia
  const at = (i, j) => {
    const k = j - (i - lag) + band;
    return k < 0 || k >= width ? -1 : i * width + k;
  };
  const P = ALIGN.stepPenalty;

  for (let i = 0; i < N; i++) {
    const lo = Math.max(0, i - lag - band), hi = Math.min(M - 1, i - lag + band);
    for (let j = lo; j <= hi; j++) {
      const idx = at(i, j);
      const c = frameCost(u[i], r[j]);
      if (j === 0) { D[idx] = c; dir[idx] = 0; continue; }
      let best = Infinity, d = 0, k;
      if (i > 0 && (k = at(i - 1, j - 1)) >= 0 && D[k] < best) { best = D[k]; d = 1; }
      if (i > 0 && (k = at(i - 1, j)) >= 0 && D[k] + P < best) { best = D[k] + P; d = 2; }
      if ((k = at(i, j - 1)) >= 0 && D[k] + P < best) { best = D[k] + P; d = 3; }
      D[idx] = best + c;
      dir[idx] = d;
    }
  }

  let endI = -1, endCost = Infinity;
  for (let i = 0; i < N; i++) {
    const k = at(i, M - 1);
    if (k >= 0 && D[k] < endCost) { endCost = D[k]; endI = i; }
  }
  if (endI < 0) return [];

  const cells = [];
  let i = endI, j = M - 1;
  for (;;) {
    cells.push([i, j]);
    const d = dir[at(i, j)];
    if (j === 0 || d === 0) break;
    if (d === 1) { i--; j--; } else if (d === 2) i--; else j--;
  }
  cells.reverse();

  const path = [];
  for (const [ci, cj] of cells) {
    for (let s = 0; s < 2; s++) {
      const uu = 2 * ci + s, rr = 2 * cj + s;
      if (uu < user.length && rr < ref.length) path.push([uu, rr]);
    }
  }
  return path;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add practice/align.js test/align.test.js
git commit -m "feat(practica): alineación DTW con banda y extremos libres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Puntuación (métricas por nota, frase y global)

**Files:**
- Create: `practice/scoring-config.js`
- Create: `practice/score.js`
- Modify: `test/helpers/melody.js` (añadir `shift`, `stretch`, `ramp`, `melodyRef`, `runScore`)
- Test: `test/score.test.js`

**Interfaces:**
- Consumes: `align` (Task 5), `referenceFromCurve`, `sliceReference` (Task 4), utilidades (Task 1).
- Produces:
  - `SCORING` y `bandFor(mode: 'guide'|'test', refFrames: number) → bandFrames` en `scoring-config.js`.
  - `score(user, slice, path, mode) → { valid, coverage, scores: { total, pitch, rhythm, stability|null }, phrases: [{ index, start, end, pitch, rhythm, stability|null, coverage }], tips: [], curves: { hopMs, startSec, ref, user } }`. Los `start`/`end` de las frases van en segundos absolutos de la canción. En esta tarea `tips` es siempre `[]`; la Task 7 lo conecta.
  - `score.js` reexporta `SCORING`.
  - Objeto interno por nota (lo usa `tips.js` en la Task 7): `{ note, duration, sung, dev, octave, pitch, onsetRefMs, onsetUserMs, offsetMs, rhythm, sd, drift, stability }`. Se pasa como `notes` a `buildTips`.

- [ ] **Step 1: Ampliar `test/helpers/melody.js`**

Añadir al final del archivo:
```js
import { referenceFromCurve, sliceReference } from '../../practice/reference.js';
import { align } from '../../practice/align.js';
import { score } from '../../practice/score.js';
import { bandFor } from '../../practice/scoring-config.js';

export const shift = (c, semis) => c.map(v => (v == null ? null : v + semis));

export function stretch(c, factor) {
  const n = Math.round(c.length * factor);
  return Array.from({ length: n }, (_, k) => c[Math.min(c.length - 1, Math.floor(k / factor))]);
}

export const ramp = (from, to, frames) => Array.from({ length: frames }, (_, k) => from + ((to - from) * k) / (frames - 1));

export const melodyRef = () => referenceFromCurve({ songId: 'test', midi: curve(MELODY) });

export function runScore(user, mode = 'test', phraseFrom = 1, phraseTo = 3, ref = melodyRef()) {
  const slice = sliceReference(ref, phraseFrom, phraseTo);
  const path = align(user, slice.midi, { bandFrames: bandFor(mode, slice.midi.length) });
  return score(user, slice, path, mode);
}
```

Los `import` deben quedar al principio del archivo (junto a los existentes). `MELODY` y `curve` siguen igual.

- [ ] **Step 2: Escribir el test que falla**

`test/score.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../practice/score.js';
import { sliceReference, referenceFromCurve } from '../practice/reference.js';
import { MELODY, curve, shift, stretch, runScore, melodyRef } from './helpers/melody.js';

test('curva idéntica → total ≥ 95, cobertura 1, válida', () => {
  const r = runScore(curve(MELODY));
  assert.equal(r.valid, true);
  assert.equal(r.coverage, 1);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
  assert.ok(r.scores.pitch >= 95 && r.scores.rhythm >= 95 && r.scores.stability >= 95);
});

test('+50 cents → afinación ~62 (< 70) y ritmo intacto', () => {
  const r = runScore(shift(curve(MELODY), 0.5));
  assert.ok(r.scores.pitch < 70 && r.scores.pitch > 55, `afinación ${r.scores.pitch}`);
  assert.ok(r.scores.rhythm >= 90);
});

test('octava abajo → afinación 0', () => {
  const r = runScore(shift(curve(MELODY), -12));
  assert.equal(r.scores.pitch, 0);
});

test('estirada un 10 % en modo prueba → afinación y ritmo > 90', () => {
  const r = runScore(stretch(curve(MELODY), 1.1), 'test');
  assert.ok(r.scores.pitch > 90, `afinación ${r.scores.pitch}`);
  assert.ok(r.scores.rhythm > 90, `ritmo ${r.scores.rhythm}`);
});

test('frase 2 con 300 ms de retraso en modo guía → ritmo de esa frase bajo', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 70], [64, 50], [62, 50], [60, 80], [null, 10], [59, 40], [57, 100], [null, 20]]);
  const r = runScore(user, 'guide');
  const [p1, p2, p3] = r.phrases;
  assert.ok(p1.rhythm >= 90 && p3.rhythm >= 90);
  assert.ok(p2.rhythm < 50, `ritmo frase 2: ${p2.rhythm}`);
});

test('frase 3 sin cantar → cobertura 0,72, sigue siendo válida', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 40], [64, 50], [62, 50], [60, 80], [null, 200]]);
  const r = runScore(user);
  assert.equal(r.valid, true);
  assert.equal(r.coverage, 0.72);
  assert.equal(r.phrases[2].coverage, 0);
});

test('silencio → no válida', () => {
  const r = runScore(Array(600).fill(null));
  assert.equal(r.valid, false);
  assert.equal(r.scores.total, 0);
});

test('camino vacío → no válida y sin excepciones', () => {
  const slice = sliceReference(melodyRef(), 1, 3);
  const r = score(curve(MELODY), slice, [], 'test');
  assert.equal(r.valid, false);
  assert.equal(r.coverage, 0);
});

test('sin notas largas → estabilidad null y total sin NaN', () => {
  const short = curve([[60, 30], [62, 30], [64, 30], [null, 40], [62, 30], [60, 30], [null, 10]]);
  const ref = referenceFromCurve({ songId: 'corta', midi: short });
  const r = runScore(short, 'test', 1, ref.phrases.length, ref);
  assert.equal(r.scores.stability, null);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
  assert.ok(r.phrases.every(p => p.stability === null));
});

test('frases en segundos absolutos y curvas para la gráfica', () => {
  // La grabación de un fragmento empieza en el inicio de ese fragmento (frame 220).
  const r = runScore(curve(MELODY).slice(220), 'test', 2, 3);
  assert.deepEqual(r.phrases.map(p => [p.index, p.start, p.end]), [[2, 2.2, 4], [3, 4.4, 5.8]]);
  assert.equal(r.curves.startSec, 2.2);
  assert.equal(r.curves.ref.length, r.curves.user.length);
  assert.equal(r.curves.hopMs, 10);
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/score.js` (o `scoring-config.js`).

- [ ] **Step 4: Implementar `practice/scoring-config.js`**

```js
// Único lugar con umbrales y pesos. Calibrar aquí con grabaciones reales.
export const SCORING = {
  weights: { pitch: 0.5, rhythm: 0.3, stability: 0.2 },
  pitchCents: [20, 100],     // lin(|desviación|): 100 pts → 0 pts
  rhythmMs: [80, 400],
  stabilityCents: [15, 60],
  octaveCents: 600,
  coreStartFrames: 5,        // 50 ms de ataque excluidos
  coreEndFrames: 3,          // 30 ms finales excluidos
  longNoteFrames: 40,        // núcleo ≥ 400 ms para estabilidad
  voicedRatio: 0.5,          // nota "cantada"
  minCoverage: 0.5,          // por debajo, intento no válido
  fullCoverage: 0.9,         // por debajo, el total se reduce en proporción
  guideLatencyMs: 150,       // latencia máxima compensada en modo guía
  guideBandFrames: 100,      // ±1 s
  testBandRatio: 0.15,       // ±15 % de la longitud
  testBandMinFrames: 100,
  tips: { max: 3, biasCents: 25, entryMs: 150, driftCents: 20, driftNotes: 2, missedCoverage: 0.6, praiseTotal: 90 },
};

export function bandFor(mode, refFrames) {
  return mode === 'guide'
    ? SCORING.guideBandFrames
    : Math.max(SCORING.testBandMinFrames, Math.round(refFrames * SCORING.testBandRatio));
}
```

- [ ] **Step 5: Implementar `practice/score.js`**

```js
import { SCORING } from './scoring-config.js';
import { lin, median, mean, weightedMean, round2 } from './util.js';

export { SCORING };

function analyzeNote(note, user, ref, byRef, hopMs) {
  let a = note.start + SCORING.coreStartFrames, b = note.end - SCORING.coreEndFrames;
  if (b <= a) { a = note.start; b = note.end; }
  let pairs = 0, voiced = 0;
  const diffs = [];
  for (let r = a; r < b; r++) {
    for (const u of byRef[r] || []) {
      pairs++;
      if (user[u] != null) {
        voiced++;
        if (ref[r] != null) diffs.push((user[u] - ref[r]) * 100);
      }
    }
  }
  const out = {
    note, duration: note.end - note.start, sung: pairs > 0 && voiced / pairs >= SCORING.voicedRatio && diffs.length > 0,
    dev: null, octave: false, pitch: null, onsetRefMs: null, onsetUserMs: null, offsetMs: null, rhythm: null,
    sd: null, drift: null, stability: null,
  };
  if (!out.sung) return out;

  out.dev = median(diffs);
  out.octave = Math.abs(out.dev) > SCORING.octaveCents;
  out.pitch = out.octave ? 0 : lin(Math.abs(out.dev), ...SCORING.pitchCents);

  let r0 = note.start;
  while (r0 < note.end && !(byRef[r0] && byRef[r0].length)) r0++;
  if (r0 < note.end) { out.onsetRefMs = r0 * hopMs; out.onsetUserMs = byRef[r0][0] * hopMs; }

  if (b - a >= SCORING.longNoteFrames && diffs.length >= 8) {
    const avg = mean(diffs);
    const sd = Math.sqrt(mean(diffs.map(d => (d - avg) ** 2)));
    const q = Math.max(1, Math.floor(diffs.length / 4));
    const drift = mean(diffs.slice(-q)) - mean(diffs.slice(0, q));
    out.sd = sd;
    out.drift = drift;
    out.stability = Math.min(lin(sd, ...SCORING.stabilityCents), lin(Math.abs(drift), ...SCORING.stabilityCents));
  }
  return out;
}

function rhythmOffsets(notes, mode) {
  const timed = notes.filter(n => n.sung && n.onsetRefMs != null);
  if (mode === 'guide') {
    const lim = SCORING.guideLatencyMs;
    const latency = Math.max(-lim, Math.min(lim, median(timed.map(n => n.onsetUserMs - n.onsetRefMs)) ?? 0));
    for (const n of timed) n.offsetMs = n.onsetUserMs - n.onsetRefMs - latency;
  } else if (timed.length < 2) {
    for (const n of timed) n.offsetMs = 0;
  } else {
    // Ajuste t_usuario = a·t_ref + b; el residuo es el error de ritmo.
    const xs = timed.map(n => n.onsetRefMs), ys = timed.map(n => n.onsetUserMs);
    const mx = mean(xs), my = mean(ys);
    let sxx = 0, sxy = 0;
    xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
    const slope = sxx ? sxy / sxx : 1, icpt = my - slope * mx;
    for (const n of timed) n.offsetMs = n.onsetUserMs - (slope * n.onsetRefMs + icpt);
  }
  for (const n of timed) n.rhythm = lin(Math.abs(n.offsetMs), ...SCORING.rhythmMs);
}

function aggregate(notes) {
  const total = notes.reduce((s, n) => s + n.duration, 0);
  const sung = notes.filter(n => n.sung);
  return {
    coverage: total ? sung.reduce((s, n) => s + n.duration, 0) / total : 0,
    pitch: weightedMean(sung.map(n => [n.pitch, n.duration])) ?? 0,
    rhythm: mean(sung.map(n => n.rhythm)) ?? 0,
    stability: mean(sung.map(n => n.stability)),
  };
}

function totalScore({ coverage, pitch, rhythm, stability }) {
  const w = SCORING.weights;
  const base = stability == null
    ? (w.pitch * pitch + w.rhythm * rhythm) / (w.pitch + w.rhythm)
    : w.pitch * pitch + w.rhythm * rhythm + w.stability * stability;
  return base * Math.min(1, coverage / SCORING.fullCoverage);
}

const roundOrNull = v => (v == null ? null : Math.round(v));

export function score(user, slice, path, mode) {
  const hopMs = slice.hopMs;
  const byRef = Array.from({ length: slice.midi.length }, () => []);
  for (const [u, r] of path) if (r < byRef.length) byRef[r].push(u);

  const notes = slice.notes.map(n => analyzeNote(n, user, slice.midi, byRef, hopMs));
  rhythmOffsets(notes, mode);
  const agg = aggregate(notes);

  const phrases = slice.phrases.map(p => {
    const a = aggregate(notes.slice(p.noteFrom, p.noteTo + 1));
    return {
      index: p.index,
      start: round2(slice.startSec + (p.start * hopMs) / 1000),
      end: round2(slice.startSec + (p.end * hopMs) / 1000),
      pitch: Math.round(a.pitch),
      rhythm: Math.round(a.rhythm),
      stability: roundOrNull(a.stability),
      coverage: round2(a.coverage),
    };
  });

  const scores = {
    total: Math.round(totalScore(agg)),
    pitch: Math.round(agg.pitch),
    rhythm: Math.round(agg.rhythm),
    stability: roundOrNull(agg.stability),
  };
  const valid = agg.coverage >= SCORING.minCoverage;
  const tips = [];
  const userCurve = byRef.map(us => {
    const m = median(us.map(u => user[u]));
    return m == null ? null : round2(m);
  });

  return {
    valid,
    coverage: round2(agg.coverage),
    scores,
    phrases,
    tips,
    curves: { hopMs, startSec: slice.startSec, ref: slice.midi, user: userCurve },
  };
}
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS. Si un umbral de un test falla por poco, **no cambies el test**: revisa el cálculo contra el spec (núcleo de nota, media ponderada, factor de cobertura).

- [ ] **Step 7: Commit**

```bash
git add practice/scoring-config.js practice/score.js test/helpers/melody.js test/score.test.js
git commit -m "feat(practica): puntuación de afinación, ritmo y estabilidad

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Consejos (áreas de mejora)

**Files:**
- Create: `practice/tips.js`
- Modify: `practice/score.js` (conectar `buildTips`)
- Test: `test/tips.test.js`

**Interfaces:**
- Consumes: el objeto interno por nota de la Task 6, `slice.phrases`, las frases resultantes, `scores`, `SCORING.tips`.
- Produces: `buildTips({ notes, phrases, phraseResults, scores, hopMs }) → { kind, phrase: number|null, text }[]` (máximo 3), con `kind` ∈ `pitch-bias | octave | entry | drift | missed | praise`.

- [ ] **Step 1: Escribir el test que falla**

`test/tips.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MELODY, curve, shift, ramp, runScore } from './helpers/melody.js';

const kinds = r => r.tips.map(t => t.kind);

test('curva idéntica → un único consejo de felicitación', () => {
  const r = runScore(curve(MELODY));
  assert.deepEqual(r.tips, [{ kind: 'praise', phrase: null, text: "¡Muy bien! Prueba el modo 'Ponerme a prueba'." }]);
});

test('+50 cents → consejos pitch-bias que dicen "alto"', () => {
  const r = runScore(shift(curve(MELODY), 0.5));
  assert.equal(r.tips.length, 3);
  assert.ok(r.tips.every(t => t.kind === 'pitch-bias'));
  assert.match(r.tips[0].text, /^Frase \d \(\d:\d\d–\d:\d\d\): tiendes a quedarte ~50 cents alto\.$/);
});

test('octava abajo → consejo octave "debajo"', () => {
  const r = runScore(shift(curve(MELODY), -12));
  const tip = r.tips.find(t => t.kind === 'octave');
  assert.ok(tip);
  assert.match(tip.text, /octava por debajo/);
  assert.ok(!kinds(r).includes('pitch-bias'));
});

test('frase 2 retrasada 300 ms en guía → consejo entry "tarde" en la frase 2', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 70], [64, 50], [62, 50], [60, 80], [null, 10], [59, 40], [57, 100], [null, 20]]);
  const tip = runScore(user, 'guide').tips.find(t => t.kind === 'entry');
  assert.ok(tip);
  assert.equal(tip.phrase, 2);
  assert.equal(tip.text, 'Entras 0,3 s tarde en la frase 2.');
});

test('dos notas largas que caen 40 cents → consejo drift "caes"', () => {
  const user = [
    ...curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 40], [64, 50], [62, 50]]),
    ...ramp(60, 59.6, 80),
    ...curve([[null, 40], [59, 40]]),
    ...ramp(57, 56.6, 100),
    ...curve([[null, 20]]),
  ];
  const tip = runScore(user).tips.find(t => t.kind === 'drift');
  assert.ok(tip);
  assert.match(tip.text, /^En las notas largas caes ~(25|30) cents al final\.$/);
});

test('frase 3 sin cantar → consejo missed en la frase 3', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 40], [64, 50], [62, 50], [60, 80], [null, 200]]);
  const tip = runScore(user).tips.find(t => t.kind === 'missed');
  assert.ok(tip);
  assert.equal(tip.phrase, 3);
  assert.equal(tip.text, 'Frase 3: faltan notas; repásala con la guía.');
});

test('intento no válido → sin consejos', () => {
  assert.deepEqual(runScore(Array(600).fill(null)).tips, []);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL (los `tips` están vacíos; p. ej. `assert.deepEqual` del primer test).

- [ ] **Step 3: Implementar `practice/tips.js`**

```js
import { SCORING } from './scoring-config.js';
import { lin, median, mean, formatTime } from './util.js';

const round5 = x => Math.round(x / 5) * 5;
const seconds = ms => (Math.abs(ms) / 1000).toFixed(1).replace('.', ',');

export function buildTips({ notes, phrases, phraseResults, scores, hopMs }) {
  const T = SCORING.tips;
  const sec = frames => (frames * hopMs) / 1000;
  const candidates = [];

  phrases.forEach((p, i) => {
    const pr = phraseResults[i];
    const pn = notes.slice(p.noteFrom, p.noteTo + 1);
    const sung = pn.filter(n => n.sung);
    const durSec = pr.end - pr.start;
    const label = `Frase ${pr.index} (${formatTime(pr.start)}–${formatTime(pr.end)})`;

    const octaveNotes = sung.filter(n => n.octave);
    if (octaveNotes.length) {
      const below = median(octaveNotes.map(n => n.dev)) < 0;
      candidates.push({
        kind: 'octave', phrase: pr.index,
        priority: 100 * sec(octaveNotes.reduce((s, n) => s + n.duration, 0)),
        text: `Frase ${pr.index}: estás cantando una octava por ${below ? 'debajo' : 'encima'}.`,
      });
    }

    const bias = median(sung.filter(n => !n.octave).map(n => n.dev));
    if (bias != null && Math.abs(bias) > T.biasCents) {
      candidates.push({
        kind: 'pitch-bias', phrase: pr.index,
        priority: (100 - lin(Math.abs(bias), ...SCORING.pitchCents)) * durSec,
        text: `${label}: tiendes a quedarte ~${round5(Math.abs(bias))} cents ${bias < 0 ? 'bajo' : 'alto'}.`,
      });
    }

    const first = pn[0];
    if (first && first.sung && first.offsetMs != null && Math.abs(first.offsetMs) > T.entryMs) {
      candidates.push({
        kind: 'entry', phrase: pr.index,
        priority: (100 - lin(Math.abs(first.offsetMs), ...SCORING.rhythmMs)) * durSec,
        text: `Entras ${seconds(first.offsetMs)} s ${first.offsetMs > 0 ? 'tarde' : 'antes de tiempo'} en la frase ${pr.index}.`,
      });
    }

    if (pr.coverage < T.missedCoverage) {
      candidates.push({
        kind: 'missed', phrase: pr.index,
        priority: (1 - pr.coverage) * 100 * durSec,
        text: `Frase ${pr.index}: faltan notas; repásala con la guía.`,
      });
    }
  });

  const drifting = notes.filter(n => n.drift != null && Math.abs(n.drift) > T.driftCents);
  const down = drifting.filter(n => n.drift < 0), up = drifting.filter(n => n.drift > 0);
  const group = down.length >= up.length ? down : up;
  if (group.length >= T.driftNotes) {
    const avg = mean(group.map(n => Math.abs(n.drift)));
    candidates.push({
      kind: 'drift', phrase: null,
      priority: (100 - lin(avg, ...SCORING.stabilityCents)) * sec(group.reduce((s, n) => s + n.duration, 0)),
      text: `En las notas largas ${group === down ? 'caes' : 'subes'} ~${round5(avg)} cents al final.`,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const tips = candidates.slice(0, T.max).map(({ kind, phrase, text }) => ({ kind, phrase, text }));
  if (!tips.length && scores.total >= T.praiseTotal) {
    tips.push({ kind: 'praise', phrase: null, text: "¡Muy bien! Prueba el modo 'Ponerme a prueba'." });
  }
  return tips;
}
```

- [ ] **Step 4: Conectar en `practice/score.js`**

Añadir el import arriba:
```js
import { buildTips } from './tips.js';
```
Y sustituir la línea `const tips = [];` por:
```js
  const tips = valid ? buildTips({ notes, phrases: slice.phrases, phraseResults: phrases, scores, hopMs }) : [];
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS (incluidos los tests de la Task 6).

- [ ] **Step 6: Commit**

```bash
git add practice/tips.js practice/score.js test/tips.test.js
git commit -m "feat(practica): consejos de mejora priorizados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Orquestador `analyze`, Web Worker e integración con audio real

**Files:**
- Create: `practice/analyze.js`
- Create: `practice/analysis-worker.js`
- Create: `practice/analysis-client.js`
- Create: `test/helpers/wav.js`
- Test: `test/analyze.test.js`

**Interfaces:**
- Consumes: `detectPitch`, `sliceReference`, `align`, `score`, `bandFor`.
- Produces:
  - `ENGINE_VERSION = '1.0.0'`.
  - `analyze({ samples, sampleRate, refData, mode, phraseFrom, phraseTo }) → AnalysisResult` = `{ engineVersion, songId, mode, phraseFrom, phraseTo, isFull, valid, coverage, scores, phrases, tips, curves }` (contrato del spec).
  - `runAnalysis(input) → Promise<AnalysisResult>` en `analysis-client.js` (transfiere `input.samples.buffer`; quien llama debe pasar una copia si quiere conservar la toma).
  - `readWav(path) → { samples: Float32Array, sampleRate }` (PCM de 16 bits, mezcla a mono).

- [ ] **Step 1: Crear `test/helpers/wav.js`**

```js
import { readFileSync } from 'node:fs';

export function readWav(path) {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('No es un WAV');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = { format: dv.getUint16(off + 8, true), channels: dv.getUint16(off + 10, true), sampleRate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
    }
    if (id === 'data') data = { start: off + 8, size: Math.min(size, buf.length - off - 8) };
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data || ![1, 0xfffe].includes(fmt.format) || fmt.bits !== 16) throw new Error('Solo se admite PCM de 16 bits');
  const frames = Math.floor(data.size / (2 * fmt.channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += dv.getInt16(data.start + 2 * (i * fmt.channels + c), true);
    samples[i] = s / fmt.channels / 32768;
  }
  return { samples, sampleRate: fmt.sampleRate };
}
```

- [ ] **Step 2: Escribir el test que falla**

`test/analyze.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { analyze, ENGINE_VERSION } from '../practice/analyze.js';
import { buildReference } from '../practice/reference.js';
import { MELODY, curve } from './helpers/melody.js';
import { synthFromCurve, resampleBy, silence } from './helpers/synth.js';
import { readWav } from './helpers/wav.js';

const UP_50_CENTS = 2 ** (50 / 1200);
const audio = synthFromCurve(curve(MELODY));
const refData = buildReference({ songId: 'sintetica', source: '', samples: audio, sampleRate: 48000 });

test('la referencia sintética tiene 3 frases', () => {
  assert.equal(refData.phrases.length, 3);
});

test('analizar la misma toma → total ≥ 95 y contrato completo', () => {
  const r = analyze({ samples: audio, sampleRate: 48000, refData, mode: 'test', phraseFrom: 1, phraseTo: 3 });
  assert.deepEqual(Object.keys(r).sort(), ['coverage', 'curves', 'engineVersion', 'isFull', 'mode', 'phraseFrom', 'phraseTo', 'phrases', 'scores', 'songId', 'tips', 'valid'].sort());
  assert.equal(r.engineVersion, ENGINE_VERSION);
  assert.equal(r.songId, 'sintetica');
  assert.equal(r.isFull, true);
  assert.equal(r.valid, true);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
});

test('toma +50 cents → afinación < 70 y consejo "alto"', () => {
  const r = analyze({ samples: resampleBy(audio, UP_50_CENTS), sampleRate: 48000, refData, mode: 'test', phraseFrom: 1, phraseTo: 3 });
  assert.ok(r.scores.pitch < 70, `afinación ${r.scores.pitch}`);
  assert.ok(r.tips.some(t => t.kind === 'pitch-bias' && t.text.includes('alto')));
});

test('toma de 0,3 s de silencio → no válida, sin excepción', () => {
  const r = analyze({ samples: silence(0.3), sampleRate: 48000, refData, mode: 'guide', phraseFrom: 1, phraseTo: 3 });
  assert.equal(r.valid, false);
});

test('rango de una frase (la toma empieza en el inicio de la frase)', () => {
  const start = refData.phrases[1].start * 480; // frames de 10 ms → muestras a 48 kHz
  const r = analyze({ samples: audio.subarray(start), sampleRate: 48000, refData, mode: 'test', phraseFrom: 2, phraseTo: 2 });
  assert.equal(r.valid, true);
  assert.equal(r.phraseFrom, 2);
  assert.equal(r.phraseTo, 2);
  assert.equal(r.isFull, false);
  assert.equal(r.phrases.length, 1);
});

const WAV = 'audios/Fum Fum Fum - cancion.wav';
test('Fum Fum Fum: contra sí misma ≥ 95 en < 3 s; +50 cents < 70', { skip: !existsSync(WAV) && 'falta el WAV' }, () => {
  const { samples, sampleRate } = readWav(WAV);
  const ref = buildReference({ songId: 'fum', source: WAV, samples, sampleRate });
  const t0 = performance.now();
  const same = analyze({ samples, sampleRate, refData: ref, mode: 'test', phraseFrom: 1, phraseTo: ref.phrases.length });
  const elapsed = performance.now() - t0;
  console.log(`Fum Fum Fum: ${ref.notes.length} notas, ${ref.phrases.length} frases, análisis en ${elapsed.toFixed(0)} ms`);
  assert.ok(same.scores.total >= 95, `total ${same.scores.total}`);
  assert.ok(elapsed < 3000, `análisis en ${elapsed.toFixed(0)} ms`);
  const shifted = analyze({ samples: resampleBy(samples, UP_50_CENTS), sampleRate, refData: ref, mode: 'test', phraseFrom: 1, phraseTo: ref.phrases.length });
  assert.ok(shifted.scores.pitch < 70, `afinación ${shifted.scores.pitch}`);
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/analyze.js`.

- [ ] **Step 4: Implementar `practice/analyze.js`**

```js
import { detectPitch } from './pitch.js';
import { sliceReference } from './reference.js';
import { align } from './align.js';
import { score } from './score.js';
import { bandFor } from './scoring-config.js';

export const ENGINE_VERSION = '1.0.0';

export function analyze({ samples, sampleRate, refData, mode, phraseFrom, phraseTo }) {
  const user = detectPitch(samples, sampleRate).midi;
  const slice = sliceReference(refData, phraseFrom, phraseTo);
  const path = align(user, slice.midi, { bandFrames: bandFor(mode, slice.midi.length) });
  const r = score(user, slice, path, mode);
  return {
    engineVersion: ENGINE_VERSION,
    songId: refData.songId,
    mode,
    phraseFrom: slice.phraseFrom,
    phraseTo: slice.phraseTo,
    isFull: slice.isFull,
    valid: r.valid,
    coverage: r.coverage,
    scores: r.scores,
    phrases: r.phrases,
    tips: r.tips,
    curves: r.curves,
  };
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS. La consola muestra la línea `Fum Fum Fum: … análisis en N ms`. Si el tiempo supera 3000 ms en escritorio, para y avisa: el spec prevé cambiar la función diferencia de YIN por FFT, y eso es un cambio de diseño que revisar.

- [ ] **Step 6: Crear el worker y su cliente**

`practice/analysis-worker.js`:
```js
import { analyze } from './analyze.js';

self.onmessage = e => {
  try {
    self.postMessage({ ok: true, result: analyze(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
```

`practice/analysis-client.js`:
```js
let worker = null;

export function runAnalysis(input) {
  if (!worker) worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    const cleanup = () => { w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); };
    const onMessage = e => { cleanup(); e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)); };
    const onError = e => { cleanup(); w.terminate(); if (worker === w) worker = null; reject(new Error(e.message || 'Error del analizador')); };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage(input, [input.samples.buffer]);
  });
}
```

(El worker y el cliente se verifican en el navegador en la Task 12.)

- [ ] **Step 7: Commit**

```bash
git add practice/analyze.js practice/analysis-worker.js practice/analysis-client.js test/helpers/wav.js test/analyze.test.js
git commit -m "feat(practica): orquestador de análisis y web worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gráfica SVG

**Files:**
- Create: `practice/chart.js`
- Test: `test/chart.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `toSegments(values, step = 1) → [index, value][][]` (corta en `null`).
  - `renderChart(curves: { ref, user|null, hopMs, startSec }, phrases: { index, start, end, pitch|null }[]) → string` (SVG; `''` si `ref` está vacío). Clases: `practice-chart`, `chart-phrase`, `chart-ref`, `chart-user`; colores por variables CSS `--chart-good|warn|bad|neutral`.

- [ ] **Step 1: Escribir el test que falla**

`test/chart.test.js`:
```js
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... practice/chart.js`.

- [ ] **Step 3: Implementar `practice/chart.js`**

```js
export function toSegments(values, step = 1) {
  const segments = [];
  let current = null;
  for (let i = 0; i < values.length; i += step) {
    const v = values[i];
    if (v == null) { current = null; continue; }
    if (!current) { current = []; segments.push(current); }
    current.push([i, v]);
  }
  return segments;
}

function fill(score) {
  if (score == null) return 'var(--chart-neutral)';
  if (score >= 80) return 'var(--chart-good)';
  if (score >= 60) return 'var(--chart-warn)';
  return 'var(--chart-bad)';
}

export function renderChart(curves, phrases = []) {
  const { ref, user, hopMs, startSec } = curves;
  const n = ref.length;
  if (!n) return '';
  let lo = Infinity, hi = -Infinity;
  for (const v of user ? ref.concat(user) : ref) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (lo === Infinity) { lo = 48; hi = 72; }
  lo = Math.floor(lo) - 1;
  hi = Math.ceil(hi) + 1;

  const W = 1000, H = 220;
  const x = i => (i / Math.max(1, n - 1)) * W;
  const y = v => H - ((v - lo) / (hi - lo)) * H;
  const lines = (values, cls) => toSegments(values, 2)
    .map(seg => `<polyline class="${cls}" points="${seg.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`)
    .join('');
  const bands = phrases.map(p => {
    const a = x(((p.start - startSec) * 1000) / hopMs);
    const b = x(((p.end - startSec) * 1000) / hopMs);
    return `<rect class="chart-phrase" x="${a.toFixed(1)}" y="0" width="${Math.max(0, b - a).toFixed(1)}" height="${H}" style="fill:${fill(p.pitch)}"/>`;
  }).join('');

  return `<svg class="practice-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Curva de afinación: referencia y tu voz">${bands}${lines(ref, 'chart-ref')}${user ? lines(user, 'chart-user') : ''}</svg>`;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add practice/chart.js test/chart.test.js
git commit -m "feat(practica): gráfica SVG de referencia frente a la voz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Generador de curvas y curvas de las 12 canciones

**Files:**
- Create: `tools/songs-parser.js`
- Create: `tools/build-pitch.html`
- Create: `tools/build-pitch.js`
- Create: `tools/check-pitch.mjs`
- Create: `assets/pitch/<id>.json` (12) y `assets/pitch/index.json`
- Test: `test/songs-parser.test.js`

**Interfaces:**
- Consumes: `buildReference` (Task 4), `renderChart` (Task 9).
- Produces: `parseSongs(source: string) → { id, title, track }[]`; los JSON de referencia que usa la UI: `assets/pitch/index.json` = `{ "songs": [ids] }`.

- [ ] **Step 1: Escribir el test que falla**

`test/songs-parser.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSongs } from '../tools/songs-parser.js';

test('extrae las 12 canciones de app.js en orden', () => {
  const songs = parseSongs(readFileSync('app.js', 'utf8'));
  assert.deepEqual(songs.map(s => s.id), ['fum', 'adeste', 'dona', 'fuentecilla', 'campanas', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle']);
  assert.equal(songs[0].title, 'Fum Fum Fum');
  assert.match(songs[0].track, /^https:\/\/res\.cloudinary\.com\/.+\.wav$/);
  assert.ok(songs.every(s => s.track.startsWith('https://')));
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module ... tools/songs-parser.js`.

- [ ] **Step 3: Implementar `tools/songs-parser.js`**

```js
// Extrae { id, title, track } del objeto SONGS de app.js sin ejecutarlo.
export function parseSongs(source) {
  const re = /(\w+):\{\s*title:'((?:[^'\\]|\\.)*)',\s*track:'([^']+)'/g;
  const songs = [];
  let m;
  while ((m = re.exec(source))) songs.push({ id: m[1], title: m[2].replace(/\\'/g, "'"), track: m[3] });
  return songs;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Crear `tools/build-pitch.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Curvas de referencia</title>
  <link rel="stylesheet" href="../practice/practice.css" />
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0c0d; color: #eee; margin: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #2a2d30; text-align: left; }
    button { cursor: pointer; }
    .ok { color: #0ffc7e; } .err { color: #ff6b6b; }
    #preview svg { width: 100%; height: 180px; background: #000; }
  </style>
</head>
<body>
  <h1>Curvas de referencia</h1>
  <p>Analiza cada pista de <code>app.js</code> y guarda <code>&lt;id&gt;.json</code> e <code>index.json</code> en <code>assets/pitch/</code>.</p>
  <p>
    <button id="all" type="button">Analizar todas</button>
    <button id="save" type="button" disabled>Guardar en carpeta…</button>
  </p>
  <table>
    <thead><tr><th>Id</th><th>Título</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <div id="preview"></div>
  <script type="module" src="build-pitch.js"></script>
</body>
</html>
```

- [ ] **Step 6: Crear `tools/build-pitch.js`**

```js
import { buildReference } from '../practice/reference.js';
import { renderChart } from '../practice/chart.js';
import { parseSongs } from './songs-parser.js';

const results = new Map();
const $rows = document.getElementById('rows');
const $all = document.getElementById('all');
const $save = document.getElementById('save');
const $preview = document.getElementById('preview');
let songs = [];

function mixDown(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

function download(name, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function preview(ref) {
  const hop = ref.hopMs / 1000;
  $preview.innerHTML = `<h2>${ref.songId}: ${ref.notes.length} notas, ${ref.phrases.length} frases</h2>` +
    renderChart({ ref: ref.midi, user: null, hopMs: ref.hopMs, startSec: 0 },
      ref.phrases.map(p => ({ index: p.index, start: p.start * hop, end: p.end * hop, pitch: p.index % 2 ? 90 : 70 })));
}

async function analyzeSong(song, row) {
  const status = row.querySelector('[data-status]');
  status.className = '';
  status.textContent = 'Descargando…';
  try {
    const res = await fetch(song.track);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    status.textContent = 'Analizando…';
    await new Promise(r => setTimeout(r));
    const ref = buildReference({ songId: song.id, source: song.track, samples: mixDown(buffer), sampleRate: buffer.sampleRate });
    if (!ref.phrases.length) throw new Error('no se detectaron frases');
    results.set(song.id, ref);
    status.className = 'ok';
    status.textContent = `${ref.notes.length} notas · ${ref.phrases.length} frases · ${(ref.frameCount / 100).toFixed(0)} s`;
    row.querySelectorAll('[data-view],[data-download]').forEach(b => { b.disabled = false; });
    $save.disabled = false;
  } catch (err) {
    status.className = 'err';
    status.textContent = `Error: ${err.message}`;
  }
}

function indexData() {
  return { songs: songs.map(s => s.id).filter(id => results.has(id)) };
}

async function saveAll() {
  if (!('showDirectoryPicker' in window)) {
    for (const [id, ref] of results) download(`${id}.json`, ref);
    download('index.json', indexData());
    return;
  }
  const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
  const write = async (name, data) => {
    const handle = await dir.getFileHandle(name, { create: true });
    const w = await handle.createWritable();
    await w.write(JSON.stringify(data));
    await w.close();
  };
  for (const [id, ref] of results) await write(`${id}.json`, ref);
  await write('index.json', indexData());
  $save.textContent = `Guardado (${results.size} canciones)`;
}

async function init() {
  songs = parseSongs(await (await fetch('../app.js')).text());
  for (const song of songs) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${song.id}</td><td>${song.title}</td><td data-status>Pendiente</td>
      <td><button type="button" data-run>Analizar</button> <button type="button" data-view disabled>Ver</button> <button type="button" data-download disabled>Descargar</button></td>`;
    row.querySelector('[data-run]').addEventListener('click', () => analyzeSong(song, row));
    row.querySelector('[data-view]').addEventListener('click', () => preview(results.get(song.id)));
    row.querySelector('[data-download]').addEventListener('click', () => download(`${song.id}.json`, results.get(song.id)));
    $rows.append(row);
  }
  $all.addEventListener('click', async () => {
    $all.disabled = true;
    for (const [i, song] of songs.entries()) await analyzeSong(song, $rows.children[i]);
    $all.disabled = false;
  });
  $save.addEventListener('click', () => saveAll().catch(err => alert(err.message)));
}

init();
```

- [ ] **Step 7: Crear `tools/check-pitch.mjs`**

```js
// Uso: node tools/check-pitch.mjs — valida assets/pitch/*.json
import { readFileSync } from 'node:fs';

const dir = new URL('../assets/pitch/', import.meta.url);
const { songs } = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
let failed = false;
for (const id of songs) {
  const ref = JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
  const problems = [];
  if (ref.version !== 1) problems.push('version ≠ 1');
  if (ref.songId !== id) problems.push(`songId ${ref.songId}`);
  if (ref.hopMs !== 10) problems.push('hopMs ≠ 10');
  if (ref.frameCount !== ref.midi.length) problems.push('frameCount ≠ midi.length');
  if (!ref.notes.length) problems.push('sin notas');
  if (!ref.phrases.length) problems.push('sin frases');
  ref.phrases.forEach((p, i) => { if (p.index !== i + 1) problems.push(`frase ${i} con index ${p.index}`); });
  const last = ref.phrases.at(-1);
  if (last && last.noteTo !== ref.notes.length - 1) problems.push('las frases no cubren todas las notas');
  const warn = ref.phrases.length < 2 || ref.phrases.length > 40 ? ' ⚠ revisar número de frases' : '';
  console.log(`${problems.length ? '✗' : '✓'} ${id.padEnd(12)} ${String(ref.notes.length).padStart(4)} notas ${String(ref.phrases.length).padStart(3)} frases ${(ref.frameCount / 100).toFixed(0).padStart(4)} s${warn}${problems.length ? ' — ' + problems.join(', ') : ''}`);
  if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 8: Generar las curvas en el navegador**

Run (en segundo plano, desde la raíz del repo): `python -m http.server 8000`
1. Abre `http://localhost:8000/tools/build-pitch.html` en Chrome.
2. Pulsa **Analizar todas** y espera a que las 12 filas digan `N notas · M frases`. Si alguna dice `Error`, anota el mensaje; si es CORS o red, repite esa fila.
3. Pulsa **Ver** en 2–3 canciones y comprueba que la curva sigue la melodía y que las bandas de frases caen en las respiraciones.
4. Pulsa **Guardar en carpeta…** y elige `assets/pitch/` (créala si no existe). Sin `showDirectoryPicker`, mueve las descargas a esa carpeta.

- [ ] **Step 9: Validar**

Run: `node tools/check-pitch.mjs`
Expected: 12 líneas con `✓` y código de salida 0. Las líneas con `⚠` (menos de 2 o más de 40 frases) se mencionan en el informe de la tarea; no bloquean.

- [ ] **Step 10: Commit**

```bash
git add tools/songs-parser.js tools/build-pitch.html tools/build-pitch.js tools/check-pitch.mjs test/songs-parser.test.js assets/pitch
git commit -m "feat(practica): generador y curvas de referencia de las 12 canciones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Grabación, tonos y diagnóstico de micrófono

**Files:**
- Create: `practice/recorder-worklet.js`
- Create: `practice/recorder.js`
- Create: `practice/tones.js`
- Create: `tools/mic-check.html`
- Create: `tools/mic-check.js`

**Interfaces:**
- Consumes: `midiToHz` (Task 1), `detectPitch` (Task 2, solo en mic-check).
- Produces:
  - `isRecordingSupported() → boolean`.
  - `createRecorder() → Promise<Recorder>`; **crea el `AudioContext` de forma síncrona al llamarla** (hay que invocarla dentro del gesto del usuario). `Recorder = { context, sampleRate, level, start(), stop() → { samples: Float32Array, sampleRate }, dispose() }`. Rechaza con el error de `getUserMedia` (`NotAllowedError`, `NotFoundError`, …).
  - `playTone(ctx, midi, seconds = 1) → Promise<void>`, `playClick(ctx, accent = false)`.

- [ ] **Step 1: Crear `practice/recorder-worklet.js`**

```js
const BLOCK = 2048;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(BLOCK);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === BLOCK) {
          this.port.postMessage(this.buf);
          this.buf = new Float32Array(BLOCK);
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
```

- [ ] **Step 2: Crear `practice/recorder.js`**

```js
export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
    typeof AudioWorkletNode !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
}

// Llamar dentro del gesto del usuario: el AudioContext se crea antes del primer await.
export async function createRecorder() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const context = new Ctx();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    await context.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
  } catch (err) {
    if (stream) stream.getTracks().forEach(t => t.stop());
    context.close();
    throw err;
  }

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'capture-processor');
  const sink = context.createGain();
  sink.gain.value = 0; // mantiene el nodo activo sin devolver el micrófono a los altavoces
  source.connect(node);
  node.connect(sink);
  sink.connect(context.destination);

  let chunks = [], recording = false, level = 0;
  node.port.onmessage = e => {
    const data = e.data;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    level = Math.sqrt(sum / data.length);
    if (recording) chunks.push(data);
  };

  return {
    context,
    get sampleRate() { return context.sampleRate; },
    get level() { return level; },
    start() { chunks = []; recording = true; },
    stop() {
      recording = false;
      const samples = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
      let off = 0;
      for (const c of chunks) { samples.set(c, off); off += c.length; }
      chunks = [];
      return { samples, sampleRate: context.sampleRate };
    },
    dispose() {
      recording = false;
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      sink.disconnect();
      stream.getTracks().forEach(t => t.stop());
      context.close();
    },
  };
}
```

- [ ] **Step 3: Crear `practice/tones.js`**

```js
import { midiToHz } from './util.js';

export function playTone(ctx, midi, seconds = 1) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = midiToHz(midi);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
  gain.gain.setValueAtTime(0.25, t + seconds - 0.1);
  gain.gain.linearRampToValueAtTime(0, t + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + seconds);
  return new Promise(resolve => { osc.onended = () => resolve(); });
}

export function playClick(ctx, accent = false) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1500 : 1000;
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}
```

- [ ] **Step 4: Crear la página de diagnóstico**

`tools/mic-check.html`:
```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prueba de micrófono</title>
  <style>body{font-family:system-ui,sans-serif;background:#0b0c0d;color:#eee;margin:24px}button{font-size:18px;padding:10px 18px}#out{font-size:20px;margin-top:16px}</style>
</head>
<body>
  <h1>Prueba de micrófono</h1>
  <p>Pulsa el botón y canta una nota sostenida durante 3 segundos.</p>
  <button id="go" type="button">Grabar 3 s</button>
  <p id="out" role="status"></p>
  <script type="module" src="mic-check.js"></script>
</body>
</html>
```

`tools/mic-check.js`:
```js
import { createRecorder, isRecordingSupported } from '../practice/recorder.js';
import { detectPitch } from '../practice/pitch.js';
import { median } from '../practice/util.js';

const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const out = document.getElementById('out');
const btn = document.getElementById('go');

if (!isRecordingSupported()) { out.textContent = 'Tu navegador no permite grabar.'; btn.disabled = true; }

btn.addEventListener('click', async () => {
  btn.disabled = true;
  let rec;
  try {
    rec = await createRecorder();
    await rec.context.resume();
    rec.start();
    out.textContent = 'Grabando…';
    await new Promise(r => setTimeout(r, 3000));
    const { samples, sampleRate } = rec.stop();
    const { midi } = detectPitch(samples, sampleRate);
    const m = median(midi);
    const voiced = midi.filter(v => v != null).length;
    out.textContent = m == null
      ? `No se detectó voz (${sampleRate} Hz).`
      : `${NAMES[Math.round(m) % 12]}${Math.floor(Math.round(m) / 12) - 1} (${((m - Math.round(m)) * 100).toFixed(0)} cents) · ${sampleRate} Hz · ${voiced}/${midi.length} frames con voz`;
  } catch (err) {
    out.textContent = `Error: ${err.name || ''} ${err.message}`;
  } finally {
    rec?.dispose();
    btn.disabled = false;
  }
});
```

- [ ] **Step 5: Verificar en el navegador**

Con el servidor de la Task 10 activo, abre `http://localhost:8000/tools/mic-check.html` en Chrome:
1. Pulsa **Grabar 3 s**, acepta el permiso y canta un La3 (220 Hz) o pon un afinador de referencia en el móvil cerca del micro. Expected: `La3 (±N cents) · 48000 Hz · …` con la mayoría de frames con voz.
2. Repite y bloquea el permiso en el diálogo. Expected: `Error: NotAllowedError …`, y el botón vuelve a estar activo.
3. Tras cada prueba, el indicador de micrófono del navegador se apaga (dispose).

Run además: `npm test`. Expected: PASS (sin cambios en tests).

- [ ] **Step 6: Commit**

```bash
git add practice/recorder-worklet.js practice/recorder.js practice/tones.js tools/mic-check.html tools/mic-check.js
git commit -m "feat(practica): grabación con AudioWorklet, tonos y diagnóstico de micrófono

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Panel de práctica e integración con la app

**Files:**
- Create: `practice/practice-ui.js`
- Create: `practice/main.js`
- Create: `practice/practice.css`
- Modify: `index.html` (2 líneas: tras `<link rel="stylesheet" href="styles.css" />` y tras `<script src="app.js" defer></script>`)

**Interfaces:**
- Consumes: `createRecorder`, `isRecordingSupported` (Task 11), `playTone`, `playClick` (Task 11), `runAnalysis` (Task 8), `renderChart` (Task 9), `formatTime` (Task 1), `assets/pitch/*.json` (Task 10), constante global `SONGS` de `app.js`.
- Produces: `openPractice({ id, title, track })`, `closePractice()`; botón `#practiceOpen` en `#song-view .audio-card-header`.

- [ ] **Step 1: Crear `practice/practice-ui.js`**

```js
import { createRecorder } from './recorder.js';
import { playTone, playClick } from './tones.js';
import { runAnalysis } from './analysis-client.js';
import { renderChart } from './chart.js';
import { formatTime } from './util.js';

const PITCH_DIR = new URL('../assets/pitch/', import.meta.url);
const GUIDE_WARNING = 'Usa auriculares: si el micrófono capta la guía, la puntuación no será fiable.';
const METRICS = [['pitch', 'Afinación'], ['rhythm', 'Ritmo y entradas'], ['stability', 'Estabilidad']];

let panel = null, sheet = null, body = null, titleEl = null, opener = null;
let s = null; // sesión de práctica abierta

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const band = v => (v == null ? 'none' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');
const stale = token => !s || s.token !== token;

function ensurePanel() {
  if (panel) return;
  const t = document.createElement('template');
  t.innerHTML = `<div id="practicePanel" class="practice-panel" hidden>
    <div class="practice-panel__backdrop" data-close></div>
    <section class="practice-panel__sheet" role="dialog" aria-modal="true" aria-labelledby="practiceTitle" tabindex="-1">
      <header class="practice-panel__header">
        <div><p class="practice-eyebrow">Práctica</p><h2 id="practiceTitle"></h2></div>
        <button class="practice-close" type="button" data-close aria-label="Cerrar práctica">&times;</button>
      </header>
      <div class="practice-body" aria-live="polite"></div>
    </section>
  </div>`;
  panel = t.content.firstElementChild;
  document.body.append(panel);
  sheet = panel.querySelector('.practice-panel__sheet');
  body = panel.querySelector('.practice-body');
  titleEl = panel.querySelector('#practiceTitle');
  panel.addEventListener('click', e => { if (e.target.closest('[data-close]')) closePractice(); });
  panel.addEventListener('keydown', onKeydown);
}

function onKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); closePractice(); return; }
  if (e.key !== 'Tab') return;
  const focusables = [...sheet.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled])')]
    .filter(el => el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export async function openPractice(song) {
  ensurePanel();
  if (s) closePractice();
  opener = document.activeElement;
  document.getElementById('audio-track')?.pause();
  const audio = new Audio(song.track);
  audio.preload = 'auto';
  s = {
    song, audio, token: 0, ref: null, recorder: null, timers: new Set(), raf: 0,
    take: null, takeSource: null, refStop: null, finished: -1,
    settings: { mode: 'guide', range: 'full', phraseFrom: 1, phraseTo: 1 },
  };
  titleEl.textContent = song.title;
  panel.hidden = false;
  document.body.classList.add('practice-panel-open');
  sheet.focus();
  await loadReference();
}

export function closePractice() {
  if (!s) return;
  cancelFlow();
  s.recorder?.dispose();
  s.audio.pause();
  s.audio.removeAttribute('src');
  s.audio.load();
  s = null;
  panel.hidden = true;
  body.innerHTML = '';
  document.body.classList.remove('practice-panel-open');
  if (opener && document.contains(opener)) opener.focus();
}

function cancelFlow() {
  s.token++;
  for (const t of s.timers) clearTimeout(t);
  s.timers.clear();
  cancelAnimationFrame(s.raf);
  stopTake();
  stopRefSegment();
  s.audio.pause();
}

function wait(ms) {
  return new Promise(resolve => {
    const t = setTimeout(() => { s?.timers.delete(t); resolve(); }, ms);
    s.timers.add(t);
  });
}

function seekAndPlay(audio, time) {
  const go = () => { audio.currentTime = time; audio.play().catch(() => {}); };
  if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
}

async function loadReference() {
  const token = s.token;
  renderMessage('Cargando referencia…');
  try {
    const res = await fetch(new URL(`${encodeURIComponent(s.song.id)}.json`, PITCH_DIR));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ref = await res.json();
    if (stale(token)) return;
    s.ref = ref;
    s.settings.phraseTo = ref.phrases.length;
    renderSetup();
  } catch {
    if (!stale(token)) renderError('No se pudo cargar la referencia.', loadReference);
  }
}

function renderMessage(text) {
  body.innerHTML = `<p class="practice-message">${esc(text)}</p>`;
}

function renderError(text, retry) {
  body.innerHTML = `<div class="practice-error" role="alert"><p>${esc(text)}</p>
    <button type="button" class="btn small" data-retry>Reintentar</button></div>`;
  body.querySelector('[data-retry]').addEventListener('click', retry);
}

function micErrorMessage(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permiso de micrófono denegado. Actívalo en los ajustes del sitio (icono junto a la dirección web) y pulsa Reintentar.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró ningún micrófono. Conecta uno y pulsa Reintentar.';
  return 'No se pudo acceder al micrófono.';
}

function currentRange() {
  const n = s.ref.phrases.length;
  return s.settings.range === 'full' ? { from: 1, to: n } : { from: s.settings.phraseFrom, to: s.settings.phraseTo };
}

function renderSetup() {
  cancelFlow();
  const { mode, range, phraseFrom, phraseTo } = s.settings;
  const hop = s.ref.hopMs / 1000;
  const options = selected => s.ref.phrases
    .map(p => `<option value="${p.index}"${p.index === selected ? ' selected' : ''}>Frase ${p.index} · ${formatTime(p.start * hop)}</option>`)
    .join('');
  body.innerHTML = `<form class="practice-setup">
    <fieldset><legend>Modo</legend>
      <label class="practice-choice"><input type="radio" name="mode" value="guide"${mode === 'guide' ? ' checked' : ''}>
        <span><strong>Practicar con guía</strong><small>La voz original suena mientras cantas.</small></span></label>
      <label class="practice-choice"><input type="radio" name="mode" value="test"${mode === 'test' ? ' checked' : ''}>
        <span><strong>Ponerme a prueba</strong><small>Escuchas la nota de partida y cantas solo.</small></span></label>
    </fieldset>
    <p class="practice-warning" data-guide-warning${mode === 'guide' ? '' : ' hidden'}>${GUIDE_WARNING}</p>
    <fieldset><legend>Qué cantar</legend>
      <label class="practice-choice"><input type="radio" name="range" value="full"${range === 'full' ? ' checked' : ''}>
        <span><strong>Canción completa</strong></span></label>
      <label class="practice-choice"><input type="radio" name="range" value="phrases"${range === 'phrases' ? ' checked' : ''}>
        <span><strong>Un fragmento</strong></span></label>
      <div class="practice-range" data-range${range === 'phrases' ? '' : ' hidden'}>
        <label>Desde <select name="from">${options(phraseFrom)}</select></label>
        <label>Hasta <select name="to">${options(phraseTo)}</select></label>
      </div>
    </fieldset>
    <button type="submit" class="btn practice-start">Empezar</button>
  </form>`;
  const form = body.querySelector('form');
  form.addEventListener('change', () => {
    const fd = new FormData(form);
    s.settings.mode = fd.get('mode');
    s.settings.range = fd.get('range');
    const from = Number(fd.get('from'));
    let to = Number(fd.get('to'));
    if (to < from) { to = from; form.elements.to.value = String(to); }
    s.settings.phraseFrom = from;
    s.settings.phraseTo = to;
    form.querySelector('[data-guide-warning]').hidden = s.settings.mode !== 'guide';
    form.querySelector('[data-range]').hidden = s.settings.range !== 'phrases';
  });
  form.addEventListener('submit', e => { e.preventDefault(); startTake(); });
}

function renderCountdown(big, hint) {
  body.innerHTML = `<div class="practice-countdown"><p class="practice-countdown__big">${esc(big)}</p><p>${esc(hint)}</p></div>`;
}

async function startTake() {
  cancelFlow();
  const token = s.token;
  const { mode } = s.settings;
  const { from, to } = currentRange();
  const hop = s.ref.hopMs / 1000;
  const first = s.ref.phrases[from - 1], last = s.ref.phrases[to - 1];
  const startSec = first.start * hop, durSec = (last.end - first.start) * hop;

  if (!s.recorder) {
    let rec;
    try { rec = await createRecorder(); }
    catch (err) { if (!stale(token)) renderError(micErrorMessage(err), startTake); return; }
    if (stale(token)) { rec.dispose(); return; }
    s.recorder = rec;
  }
  const ctx = s.recorder.context;
  await ctx.resume();
  if (stale(token)) return;

  if (mode === 'test') {
    renderCountdown('Nota de partida', 'Escucha tu primera nota');
    await playTone(ctx, s.ref.notes[first.noteFrom].midi, 1);
    if (stale(token)) return;
  }
  for (const n of [3, 2, 1]) {
    renderCountdown(String(n), mode === 'guide' ? 'La guía empieza al terminar la cuenta' : 'Canta cuando termine la cuenta');
    if (mode === 'test') playClick(ctx, n === 1);
    await wait(1000);
    if (stale(token)) return;
  }

  s.recorder.start();
  if (mode === 'guide') seekAndPlay(s.audio, startSec);
  const limitSec = mode === 'guide' ? durSec + 1 : durSec * 1.3 + 2;
  renderRecording(limitSec, token, { mode, from, to });
}

function renderRecording(limitSec, token, take) {
  body.innerHTML = `<div class="practice-recording">
    <p class="practice-rec"><span class="practice-rec__dot" aria-hidden="true"></span>Grabando…</p>
    <div class="practice-meter" aria-hidden="true"><div class="practice-meter__fill"></div></div>
    <div class="practice-progress" role="progressbar" aria-label="Progreso de la grabación" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="practice-progress__fill"></div></div>
    <p class="practice-time"><span data-elapsed>0:00</span> / ${formatTime(limitSec)}</p>
    <button type="button" class="btn practice-stop">Detener</button>
  </div>`;
  const meter = body.querySelector('.practice-meter__fill');
  const bar = body.querySelector('.practice-progress');
  const fill = body.querySelector('.practice-progress__fill');
  const elapsedEl = body.querySelector('[data-elapsed]');
  const stopBtn = body.querySelector('.practice-stop');
  const t0 = performance.now();
  const tick = () => {
    if (stale(token)) return;
    const elapsed = (performance.now() - t0) / 1000;
    meter.style.width = `${Math.min(100, s.recorder.level * 400)}%`;
    const pct = Math.min(100, (elapsed / limitSec) * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    elapsedEl.textContent = formatTime(elapsed);
    s.raf = requestAnimationFrame(tick);
  };
  s.raf = requestAnimationFrame(tick);
  const limit = setTimeout(() => finishTake(token, take), limitSec * 1000);
  s.timers.add(limit);
  stopBtn.addEventListener('click', () => finishTake(token, take));
  stopBtn.focus();
}

async function finishTake(token, take) {
  if (stale(token) || s.finished === token) return;
  s.finished = token;
  cancelAnimationFrame(s.raf);
  s.audio.pause();
  s.take = { ...s.recorder.stop(), ...take };
  await analyzeTake(token);
}

async function analyzeTake(token) {
  renderMessage('Analizando tu toma…');
  const { samples, sampleRate, mode, from, to } = s.take;
  try {
    const result = await runAnalysis({ samples: samples.slice(), sampleRate, refData: s.ref, mode, phraseFrom: from, phraseTo: to });
    if (stale(token)) return;
    renderResults(result);
  } catch {
    if (!stale(token)) renderError('No se pudo analizar la toma.', () => analyzeTake(s.token));
  }
}

function renderResults(r) {
  if (!r.valid) {
    body.innerHTML = `<div class="practice-error" role="alert">
      <p>No se detectó suficiente voz. Acércate al micrófono o canta más fuerte.</p>
      <div class="practice-actions">
        <button type="button" class="btn small" data-act="repeat">Repetir</button>
        <button type="button" class="btn small quiet" data-act="setup">Cambiar ajustes</button>
      </div></div>`;
  } else {
    body.innerHTML = `<div class="practice-results">
      <div class="practice-score score--${band(r.scores.total)}">
        <span class="practice-score__value">${r.scores.total}</span><span class="practice-score__label">Puntuación</span></div>
      <ul class="practice-metrics">${METRICS.map(([k, label]) =>
        `<li class="score--${band(r.scores[k])}"><span>${label}</span><strong>${r.scores[k] ?? '—'}</strong></li>`).join('')}</ul>
      ${r.tips.length ? `<h3 class="practice-subtitle">Qué mejorar</h3><ul class="practice-tips">${r.tips.map(t => `<li>${esc(t.text)}</li>`).join('')}</ul>` : ''}
      <div class="practice-chart-wrap">${renderChart(r.curves, r.phrases)}
        <p class="practice-legend"><span class="legend-ref">Referencia</span><span class="legend-user">Tu voz</span></p></div>
      <h3 class="practice-subtitle">Frases</h3>
      <div class="practice-phrases">${r.phrases.map(p =>
        `<button type="button" class="practice-phrase score--${band(p.pitch)}" data-phrase="${p.index}" aria-expanded="false">Frase ${p.index}<small>${formatTime(p.start)}–${formatTime(p.end)}</small></button>`).join('')}</div>
      <div class="practice-phrase-actions" hidden>
        <button type="button" class="btn small quiet" data-act="listen">Escuchar referencia</button>
        <button type="button" class="btn small" data-act="drill">Practicar esta frase</button>
      </div>
      <div class="practice-actions">
        <button type="button" class="btn small quiet" data-act="take">Escuchar mi toma</button>
        <button type="button" class="btn small" data-act="repeat">Repetir</button>
        <button type="button" class="btn small quiet" data-act="setup">Cambiar ajustes</button>
      </div></div>`;
  }
  let selected = null;
  body.firstElementChild.addEventListener('click', e => {
    const phrase = e.target.closest('[data-phrase]');
    if (phrase) {
      selected = Number(phrase.dataset.phrase);
      body.querySelectorAll('[data-phrase]').forEach(b => b.setAttribute('aria-expanded', String(b === phrase)));
      body.querySelector('.practice-phrase-actions').hidden = false;
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'repeat') startTake();
    else if (act === 'setup') renderSetup();
    else if (act === 'take') toggleTake(btn);
    else if (act === 'listen' && selected) playRefPhrase(selected);
    else if (act === 'drill' && selected) {
      Object.assign(s.settings, { range: 'phrases', phraseFrom: selected, phraseTo: selected });
      renderSetup();
    }
  });
}

function toggleTake(btn) {
  if (s.takeSource) { stopTake(); btn.textContent = 'Escuchar mi toma'; return; }
  stopRefSegment();
  const ctx = s.recorder.context;
  const { samples, sampleRate } = s.take;
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.onended = () => { if (s && s.takeSource === src) { s.takeSource = null; btn.textContent = 'Escuchar mi toma'; } };
  src.start();
  s.takeSource = src;
  btn.textContent = 'Detener mi toma';
}

function stopTake() {
  if (!s || !s.takeSource) return;
  const src = s.takeSource;
  s.takeSource = null;
  try { src.stop(); } catch { /* ya detenida */ }
}

function playRefPhrase(index) {
  stopRefSegment();
  stopTake();
  const p = s.ref.phrases[index - 1], hop = s.ref.hopMs / 1000;
  const end = p.end * hop;
  const onTime = () => { if (s.audio.currentTime >= end) stopRefSegment(); };
  s.refStop = () => { s.audio.pause(); s.audio.removeEventListener('timeupdate', onTime); s.refStop = null; };
  s.audio.addEventListener('timeupdate', onTime);
  seekAndPlay(s.audio, p.start * hop);
}

function stopRefSegment() {
  if (s && s.refStop) s.refStop();
}
```

Nota: `startTake` se llama siempre desde un `click` o `submit`, y `createRecorder` crea el `AudioContext` antes de su primer `await`, así que se cumple el requisito de gesto de iOS.

- [ ] **Step 2: Crear `practice/main.js`**

```js
import { openPractice, closePractice } from './practice-ui.js';
import { isRecordingSupported } from './recorder.js';

const INDEX_URL = new URL('../assets/pitch/index.json', import.meta.url);
let available = new Set();

function songFromHash() {
  const id = decodeURIComponent((location.hash || '').slice(1)).trim();
  // SONGS es una constante global de app.js (script clásico, accesible desde módulos).
  if (typeof SONGS === 'undefined' || !Object.prototype.hasOwnProperty.call(SONGS, id)) return null;
  return { id, title: SONGS[id].title, track: SONGS[id].track };
}

function syncButton() {
  const header = document.querySelector('#song-view .audio-card-header');
  const view = document.getElementById('song-view');
  if (!header || !view) return;
  let btn = document.getElementById('practiceOpen');
  const song = songFromHash();
  if (!song || !available.has(song.id) || view.hidden) {
    if (btn) btn.hidden = true;
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'practiceOpen';
    btn.type = 'button';
    btn.className = 'btn small practice-open-btn';
    btn.addEventListener('click', () => {
      const current = songFromHash();
      if (current) openPractice(current);
    });
    header.append(btn);
  }
  const supported = isRecordingSupported();
  btn.hidden = false;
  btn.disabled = !supported;
  btn.textContent = supported ? 'Practicar' : 'Grabar no disponible';
  btn.title = supported ? 'Grábate y compárate con la referencia' : 'Tu navegador no permite grabar';
}

window.addEventListener('hashchange', () => { closePractice(); syncButton(); });

fetch(INDEX_URL)
  .then(r => (r.ok ? r.json() : { songs: [] }))
  .catch(() => ({ songs: [] }))
  .then(data => { available = new Set(data.songs || []); syncButton(); });
```

- [ ] **Step 3: Crear `practice/practice.css`**

```css
:root {
  --practice-good: #0ffc7e;
  --practice-warn: #ffc400;
  --practice-bad: #ff5c5c;
  --chart-good: rgba(15, 252, 126, .16);
  --chart-warn: rgba(255, 196, 0, .16);
  --chart-bad: rgba(255, 92, 92, .18);
  --chart-neutral: rgba(255, 255, 255, .05);
}

body.practice-panel-open { overflow: hidden; }
.practice-open-btn { margin-left: auto; }

.practice-panel { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
.practice-panel[hidden] { display: none; }
.practice-panel__backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .72); }
.practice-panel__sheet {
  position: relative; width: min(760px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
  background: var(--card, #111213); border: 1px solid var(--card-border, #1b1d1f); border-radius: var(--radius-xl, 28px);
  padding: 24px; color: var(--fg, #f5f8f5); font-family: var(--font-ui, system-ui, sans-serif); outline: none;
}
.practice-panel__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.practice-panel__header h2 { margin: 0; font-size: 22px; }
.practice-eyebrow { margin: 0 0 4px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent, #0ffc7e); }
.practice-close { background: none; border: 0; color: inherit; font-size: 28px; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
.practice-close:focus-visible, .practice-panel button:focus-visible, .practice-panel select:focus-visible, .practice-panel input:focus-visible { outline: 2px solid var(--accent, #0ffc7e); outline-offset: 2px; }

.practice-message { color: var(--fg-muted, #dfe4ea); }
.practice-error p { margin: 0 0 12px; }

.practice-setup fieldset { border: 0; padding: 0; margin: 0 0 16px; }
.practice-setup legend { font-weight: 700; margin-bottom: 8px; }
.practice-choice { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--card-border, #1b1d1f); border-radius: 14px; margin-bottom: 8px; cursor: pointer; }
.practice-choice:has(input:checked) { border-color: var(--accent, #0ffc7e); }
.practice-choice span { display: flex; flex-direction: column; gap: 2px; }
.practice-choice small { color: var(--fg-muted, #dfe4ea); opacity: .8; }
.practice-range { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.practice-range[hidden], .practice-warning[hidden], .practice-phrase-actions[hidden] { display: none; }
.practice-range select { margin-left: 6px; background: #000; color: inherit; border: 1px solid var(--card-border, #1b1d1f); border-radius: 8px; padding: 6px; }
.practice-warning { background: rgba(255, 196, 0, .1); border: 1px solid rgba(255, 196, 0, .4); border-radius: 12px; padding: 10px 12px; }
.practice-start { width: 100%; }

.practice-countdown { text-align: center; padding: 32px 0; }
.practice-countdown__big { font-size: 64px; font-weight: 800; margin: 0; color: var(--accent, #0ffc7e); }

.practice-recording { display: flex; flex-direction: column; gap: 14px; }
.practice-rec { display: flex; align-items: center; gap: 8px; margin: 0; font-weight: 700; }
.practice-rec__dot { width: 12px; height: 12px; border-radius: 50%; background: var(--practice-bad); animation: practice-pulse 1s infinite; }
@keyframes practice-pulse { 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .practice-rec__dot { animation: none; } }
.practice-meter, .practice-progress { height: 10px; background: #000; border-radius: 999px; overflow: hidden; }
.practice-meter__fill { height: 100%; width: 0; background: var(--practice-warn); transition: width .08s linear; }
.practice-progress__fill { height: 100%; width: 0; background: var(--accent, #0ffc7e); }
.practice-time { margin: 0; color: var(--fg-muted, #dfe4ea); font-variant-numeric: tabular-nums; }

.practice-results { display: flex; flex-direction: column; gap: 14px; }
.practice-score { display: flex; align-items: baseline; gap: 10px; }
.practice-score__value { font-size: 56px; font-weight: 800; line-height: 1; }
.practice-score__label { color: var(--fg-muted, #dfe4ea); }
.practice-metrics { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.practice-metrics li { border: 1px solid var(--card-border, #1b1d1f); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 4px; }
.practice-metrics strong { font-size: 24px; }
.score--good .practice-score__value, .practice-metrics .score--good strong { color: var(--practice-good); }
.score--warn .practice-score__value, .practice-metrics .score--warn strong { color: var(--practice-warn); }
.score--bad .practice-score__value, .practice-metrics .score--bad strong { color: var(--practice-bad); }
.practice-subtitle { margin: 4px 0 0; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--fg-muted, #dfe4ea); }
.practice-tips { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }

.practice-chart-wrap { background: #000; border-radius: 14px; padding: 8px; }
.practice-chart { display: block; width: 100%; height: 200px; }
.chart-ref, .chart-user { fill: none; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.chart-ref { stroke: rgba(255, 255, 255, .55); stroke-width: 3; }
.chart-user { stroke: var(--accent, #0ffc7e); stroke-width: 2; }
.practice-legend { display: flex; gap: 16px; margin: 6px 4px 0; font-size: 13px; color: var(--fg-muted, #dfe4ea); }
.practice-legend span::before { content: ""; display: inline-block; width: 16px; height: 3px; margin-right: 6px; vertical-align: middle; }
.legend-ref::before { background: rgba(255, 255, 255, .55); }
.legend-user::before { background: var(--accent, #0ffc7e); }

.practice-phrases { display: flex; flex-wrap: wrap; gap: 8px; }
.practice-phrase { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--card-border, #1b1d1f); background: transparent; color: inherit; cursor: pointer; font: inherit; }
.practice-phrase small { color: var(--fg-muted, #dfe4ea); opacity: .8; }
.practice-phrase.score--good { border-color: rgba(15, 252, 126, .5); }
.practice-phrase.score--warn { border-color: rgba(255, 196, 0, .5); }
.practice-phrase.score--bad { border-color: rgba(255, 92, 92, .6); }
.practice-phrase[aria-expanded="true"] { background: rgba(255, 255, 255, .08); }
.practice-phrase-actions, .practice-actions { display: flex; flex-wrap: wrap; gap: 8px; }

@media (max-width: 640px) {
  .practice-panel { padding: 0; }
  .practice-panel__sheet { border-radius: 0; max-height: 100vh; height: 100vh; padding: 20px 16px; }
  .practice-metrics { grid-template-columns: 1fr; }
  .practice-score__value { font-size: 44px; }
}
```

- [ ] **Step 4: Añadir las 2 líneas a `index.html`**

Tras `<link rel="stylesheet" href="styles.css" />`:
```html
  <link rel="stylesheet" href="practice/practice.css" />
```
Tras `<script src="app.js" defer></script>`:
```html
  <script type="module" src="practice/main.js"></script>
```

Comprobar que no hay más cambios:

Run: `git diff --stat -- index.html app.js styles.css`
Expected: solo `index.html | 2 ++`.

- [ ] **Step 5: Verificación manual en Chrome de escritorio** (`http://localhost:8000/`)

1. Inicio → abrir *Fum Fum Fum*: aparece **Practicar** en la tarjeta "Canción". En una canción no listada en `index.json`, el botón no aparece.
2. **Practicar** → el reproductor principal se pausa; se ve "Cargando referencia…" y después el formulario.
3. Modo guía + canción completa + **Empezar** (con auriculares): cuenta 3-2-1, empieza la guía y la grabación, el medidor se mueve y la barra avanza. Al terminar, "Analizando tu toma…" aparece menos de unos 3 s y luego los resultados con puntuación, métricas, consejos, gráfica y frases.
4. Tocar una frase → **Escuchar referencia** suena solo esa frase; **Practicar esta frase** abre el formulario con el fragmento elegido.
5. **Escuchar mi toma** reproduce y el botón cambia a "Detener mi toma".
6. Modo "a prueba" con un fragmento de 2 frases: suena la nota de partida, luego clics 3-2-1 y la grabación sin guía.
7. **Detener** a los 0,5 s → mensaje "No se detectó suficiente voz…" sin errores en consola.
8. *(Review Focus 5)* Cerrar con **Esc** durante la cuenta atrás, y en otro intento durante "Analizando…": el panel se cierra, no reaparece contenido, el indicador de micrófono del navegador se apaga y no hay errores en consola.
9. Volver atrás con el botón del navegador mientras graba → el panel se cierra y se libera el micrófono.
10. Bloquear el permiso de micrófono → mensaje de permiso con **Reintentar**.
11. Teclado: Tab recorre solo el panel y Esc lo cierra devolviendo el foco al botón **Practicar**.
12. Renombrar temporalmente `assets/pitch/fum.json` → "No se pudo cargar la referencia." con Reintentar (restaurar el archivo después).

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add practice/practice-ui.js practice/main.js practice/practice.css index.html
git commit -m "feat(practica): panel de práctica integrado en la vista de canción

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Pruebas en móviles y registro de calibración

**Files:**
- Create: `docs/superpowers/checklists/2026-10-12-fase1-pruebas-manuales.md`

**Interfaces:**
- Consumes: la app completa publicada por HTTPS (GitHub Pages del repositorio nuevo, o un túnel temporal: `npx cloudflared tunnel --url http://localhost:8000`).
- Produces: el registro de resultados por dispositivo y las observaciones de calibración (sin cambiar umbrales en esta fase).

- [ ] **Step 1: Crear la plantilla del checklist**

```markdown
# Fase 1 — Pruebas manuales

| # | Prueba | Chrome escritorio | Chrome Android | Safari iOS |
|---|---|---|---|---|
| 1 | Aparece "Practicar" solo en canciones con referencia | | | |
| 2 | Permiso de micrófono: aceptar / denegar + Reintentar | | | |
| 3 | Modo guía, canción completa, con auriculares | | | |
| 4 | Modo prueba: nota de partida + clics + grabación | | | |
| 5 | Fragmento de frases (desde > hasta se corrige solo) | | | |
| 6 | Resultados: puntuación, consejos, gráfica, frases | | | |
| 7 | Escuchar referencia de una frase / Practicar esta frase | | | |
| 8 | Escuchar mi toma | | | |
| 9 | Detener a los 0,5 s → "No se detectó suficiente voz" | | | |
| 10 | Cerrar durante cuenta atrás y análisis → micro liberado | | | |
| 11 | Frecuencia de muestreo (tools/mic-check.html) | | | |
| 12 | Tiempo de "Analizando…" en canción completa (s) | | | |

## Calibración (no cambiar umbrales en esta fase; anotar para revisión)

| Cantante | Canción / modo | Total | Afinación | Ritmo | Estabilidad | ¿Coincide con la percepción del jefe de cuerda? |
|---|---|---|---|---|---|---|
```

- [ ] **Step 2: Ejecutar las pruebas por HTTPS**

Rellena la tabla en los tres navegadores (✓ / ✗ con nota). Para iOS, prueba especialmente la fila 3 (el `AudioContext` se crea en el toque) y la fila 11 (debería mostrar 44100 o 48000 Hz). Si la fila 12 supera 3 s en un móvil de gama media, anótalo: es el disparador previsto en el spec para optimizar YIN con FFT.

- [ ] **Step 3: Grabar al menos 3 tomas reales de tenores** y anotar en la tabla de calibración si la puntuación coincide con la percepción del jefe de cuerda.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/checklists/2026-10-12-fase1-pruebas-manuales.md
git commit -m "docs(practica): resultados de pruebas manuales de la fase 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
