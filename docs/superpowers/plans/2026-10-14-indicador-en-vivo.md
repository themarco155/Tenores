# Indicador de afinación en vivo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar durante la grabación con guía la nota objetivo, la nota cantada y la desviación en cents, en tiempo real.

**Architecture:** `practice/live-pitch.js` reúne funciones puras (búfer circular, nombres de nota, nota objetivo en un instante, nota en vivo con el detector YIN existente, desviación plegada por octavas y estado). `practice/recorder.js` guarda los últimos 0,5 s de micrófono en ese búfer y expone `recent(ms)`. `practice/practice-ui.js` pinta el bloque en `renderRecording` solo en modo guía y si `LIVE_PITCH` está activo.

**Tech Stack:** JavaScript ES2022 sin dependencias, Web Audio (AudioWorklet existente), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-14-indicador-en-vivo-design.md`

**Rama:** crear `feature/afinador-en-vivo` desde `main`. Al terminar se fusiona con `git merge --no-ff` para poder revertirlo con un solo `git revert -m 1`.

## Global Constraints

- Solo en modo `guide`; en `test` no aparece.
- Retraso compensado: nota objetivo en `audio.currentTime − 0,1 s`.
- Ventana de análisis: 200 ms; nota = mediana de los frames con voz de los últimos 60 ms útiles; nivel mínimo 0,01.
- Estados: |c| ≤ 20 "Afinado"; ≤ 50 "Un poco alto/bajo"; > 50 "Muy alto/bajo". Desviación plegada a [−600, +600).
- Nombres latinos con octava (57 → "La3", 60 → "Do4").
- Bloque `aria-hidden="true"`; refresco ~cada 100 ms.
- Interruptor `LIVE_PITCH` en `practice/config.js`. Puntuación, guardado y backend no cambian.
- Estilos solo al final de `practice/practice.css`; `app.js`, `index.html`, `styles.css` no se tocan.
- Commits sin `Co-Authored-By` ni otra atribución.

## Review Focus

1. **Silencio o respiración entre frases**: debe mostrar "—", no notas inventadas por ruido → tests de nivel bajo y silencio en Task 1.
2. **Final del fragmento analizado** (el detector rellena con ceros): no debe dar una nota falsa → se descartan los 3 últimos frames y lo cubre el test del tono en Task 1.
3. **Tenor una octava abajo de la referencia**: debe verse "Afinado", no −1200 → test de plegado en Task 1.
4. **El búfer circular al dar la vuelta**: debe devolver las últimas muestras en orden → test en Task 1.
5. **Rendimiento en móvil**: el análisis de 200 ms cada 100 ms no debe bloquear la grabación → comprobación manual en Task 2.

---

### Task 1: Funciones puras del indicador

**Files:**
- Create: `practice/live-pitch.js`
- Test: `test/live-pitch.test.js`

**Interfaces:**
- Consumes: `detectPitch(samples, sampleRate) → {hopMs, midi[]}` (`pitch.js`), `median(values)` (`util.js`).
- Produces: `LIVE`, `createSampleRing(capacity) → {push(Float32Array), latest(n) → Float32Array}`, `noteName(midi) → string`, `targetAt(ref, seconds, lagMs?) → number|null`, `livePitch(samples, sampleRate, level) → number|null`, `deviationCents(user, target) → number|null`, `tuningState(cents) → {key: 'none'|'ok'|'warn'|'bad', text}`.

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feature/afinador-en-vivo
```

- [ ] **Step 2: Tests que fallan** — `test/live-pitch.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSampleRing, noteName, targetAt, livePitch, deviationCents, tuningState } from '../practice/live-pitch.js';
import { sine, silence } from './helpers/synth.js';

test('búfer circular: últimas muestras en orden, también al dar la vuelta', () => {
  const ring = createSampleRing(5);
  ring.push(Float32Array.of(1, 2, 3));
  assert.deepEqual([...ring.latest(2)], [2, 3]);
  ring.push(Float32Array.of(4, 5, 6, 7));
  assert.deepEqual([...ring.latest(5)], [3, 4, 5, 6, 7]);
  assert.deepEqual([...ring.latest(10)], [3, 4, 5, 6, 7], 'nunca más de lo guardado');
  assert.equal(createSampleRing(4).latest(3).length, 0);
});

test('nombres de nota latinos con octava', () => {
  assert.equal(noteName(57), 'La3');
  assert.equal(noteName(60), 'Do4');
  assert.equal(noteName(59.36), 'Si3');
  assert.equal(noteName(61), 'Do#4');
  assert.equal(noteName(47.6), 'Do3');
});

const REF = { hopMs: 10, notes: [{ start: 60, end: 79, midi: 60.1 }, { start: 79, end: 111, midi: 59.36 }, { start: 120, end: 150, midi: 57 }] };

test('nota objetivo con 100 ms de retraso y fuera de notas', () => {
  assert.equal(targetAt(REF, 0.75), 60.1);   // frame 65
  assert.equal(targetAt(REF, 0.89), 59.36);  // frame 79: empieza la segunda nota
  assert.equal(targetAt(REF, 1.25), null);   // frame 115: entre notas
  assert.equal(targetAt(REF, 0.05), null);   // antes de empezar
  assert.equal(targetAt(REF, 0.85, 0), 59.36); // frame 85, sin retraso
});

test('desviación en cents con plegado de octava', () => {
  assert.equal(deviationCents(57.12, 57), 12);
  assert.equal(deviationCents(45, 57), 0, 'una octava abajo cuenta como afinado');
  assert.equal(deviationCents(57 - 5.9, 57), -590);
  assert.equal(deviationCents(57 + 6.1, 57), -590);
  assert.equal(deviationCents(null, 57), null);
  assert.equal(deviationCents(57, null), null);
});

test('estado según la desviación', () => {
  assert.deepEqual(tuningState(null), { key: 'none', text: '' });
  assert.deepEqual(tuningState(20), { key: 'ok', text: 'Afinado' });
  assert.deepEqual(tuningState(-21), { key: 'warn', text: 'Un poco bajo' });
  assert.deepEqual(tuningState(50), { key: 'warn', text: 'Un poco alto' });
  assert.deepEqual(tuningState(51), { key: 'bad', text: 'Muy alto' });
  assert.deepEqual(tuningState(-300), { key: 'bad', text: 'Muy bajo' });
});

test('nota en vivo: tono de 220 Hz → La3; silencio o nivel bajo → null', () => {
  const tone = sine(220, 0.2);
  const m = livePitch(tone, 48000, 0.3);
  assert.ok(Math.abs(m - 57) < 0.1, `midi ${m}`);
  assert.equal(livePitch(silence(0.2), 48000, 0.3), null);
  assert.equal(livePitch(tone, 48000, 0.005), null, 'nivel por debajo del mínimo');
  assert.equal(livePitch(new Float32Array(0), 48000, 0.3), null);
});
```

- [ ] **Step 3: Verlos fallar**

Run: `node --test test/live-pitch.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` (`practice/live-pitch.js`).

- [ ] **Step 4: `practice/live-pitch.js`**

```js
import { detectPitch } from './pitch.js';
import { median } from './util.js';

// Indicador de afinación en vivo (modo con guía): utilidades puras.
export const LIVE = { lagMs: 100, windowMs: 200, tailMs: 60, minLevel: 0.01, okCents: 20, warnCents: 50, edgeFrames: 3 };
const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

// Búfer circular de muestras: guarda las últimas `capacity` y devuelve las últimas `n` en orden.
export function createSampleRing(capacity) {
  const buf = new Float32Array(capacity);
  let write = 0, filled = 0;
  return {
    push(block) {
      for (let i = 0; i < block.length; i++) {
        buf[write] = block[i];
        write = (write + 1) % capacity;
      }
      filled = Math.min(capacity, filled + block.length);
    },
    latest(n) {
      const k = Math.min(n, filled);
      const out = new Float32Array(k);
      for (let i = 0; i < k; i++) out[i] = buf[(write - k + i + capacity) % capacity];
      return out;
    },
  };
}

export function noteName(midi) {
  const n = Math.round(midi);
  return `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

// Nota de la referencia que suena `lagMs` antes del instante `seconds` de la canción (o null entre notas).
export function targetAt(ref, seconds, lagMs = LIVE.lagMs) {
  const frame = Math.round((seconds * 1000 - lagMs) / ref.hopMs);
  if (frame < 0) return null;
  const note = ref.notes.find(n => frame >= n.start && frame < n.end);
  return note ? note.midi : null;
}

// Nota cantada en el último fragmento de micrófono (midi) o null si hay silencio.
export function livePitch(samples, sampleRate, level) {
  if (level < LIVE.minLevel || !samples.length) return null;
  const { midi, hopMs } = detectPitch(samples, sampleRate);
  // Los últimos frames analizan ventanas que salen del fragmento (relleno con ceros): se descartan.
  const usable = midi.slice(0, Math.max(0, midi.length - LIVE.edgeFrames));
  return median(usable.slice(-Math.max(1, Math.round(LIVE.tailMs / hopMs))));
}

export function deviationCents(user, target) {
  if (user == null || target == null) return null;
  const d = (user - target) * 100;
  return Math.round(((d + 600) % 1200 + 1200) % 1200 - 600);
}

export function tuningState(cents) {
  if (cents == null) return { key: 'none', text: '' };
  const a = Math.abs(cents);
  if (a <= LIVE.okCents) return { key: 'ok', text: 'Afinado' };
  const dir = cents > 0 ? 'alto' : 'bajo';
  return a <= LIVE.warnCents ? { key: 'warn', text: `Un poco ${dir}` } : { key: 'bad', text: `Muy ${dir}` };
}
```

- [ ] **Step 5: Tests en verde**

Run: `npm test`
Expected: suite raíz en verde.

- [ ] **Step 6: Commit**

```bash
git add practice/live-pitch.js test/live-pitch.test.js
git commit -m "feat(practica): cálculo de la afinación en vivo"
```

---

### Task 2: Indicador en la grabación con guía

**Files:**
- Modify: `practice/recorder.js`, `practice/practice-ui.js`, `practice/config.js`, `practice/practice.css`

**Interfaces:**
- Consumes: Task 1.
- Produces: `recorder.recent(ms) → { samples, sampleRate }`; `LIVE_PITCH` en `config.js`.

- [ ] **Step 1: `practice/recorder.js`** — importar el búfer y guardarlo en cada bloque

Añadir arriba `import { createSampleRing } from './live-pitch.js';`. Tras crear `node`, añadir:

```js
  const ring = createSampleRing(Math.round(context.sampleRate * 0.5)); // últimos 0,5 s, para el indicador en vivo
```

En `node.port.onmessage`, justo después de calcular `level`, añadir `ring.push(data);`. En el objeto devuelto, añadir:

```js
    recent(ms) { return { samples: ring.latest(Math.round((ms / 1000) * context.sampleRate)), sampleRate: context.sampleRate }; },
```

- [ ] **Step 2: `practice/config.js`** — al final:

```js
// Indicador de afinación en vivo durante la práctica con guía. false = desactivado.
export const LIVE_PITCH = true;
```

- [ ] **Step 3: `practice/practice-ui.js`** — imports:

```js
import { LIVE_PITCH } from './config.js';
import { LIVE, noteName, targetAt, livePitch, deviationCents, tuningState } from './live-pitch.js';
```

En `renderRecording`, calcular antes del `innerHTML`:

```js
  const live = LIVE_PITCH && take.mode === 'guide';
```

e insertar en la plantilla, justo después del `<div class="practice-meter">…</div>`:

```js
    ${live ? `<div class="practice-live" aria-hidden="true" data-state="none">
      <p class="practice-live__notes">Objetivo: <strong data-live-target>—</strong> · Tú: <strong data-live-user>—</strong> <span data-live-cents></span></p>
      <div class="practice-live__scale"><span class="practice-live__ok"></span><span class="practice-live__needle" data-live-needle hidden></span></div>
      <p class="practice-live__state" data-live-state></p>
    </div>` : ''}
```

Tras las consultas existentes (`stopBtn`…), añadir:

```js
  const liveEl = live ? body.querySelector('.practice-live') : null;
  let lastLive = 0;
  const updateLive = () => {
    const { samples, sampleRate } = s.recorder.recent(LIVE.windowMs);
    const user = livePitch(samples, sampleRate, s.recorder.level);
    const target = targetAt(s.ref, s.audio.currentTime);
    const cents = deviationCents(user, target);
    const st = tuningState(cents);
    liveEl.dataset.state = st.key;
    liveEl.querySelector('[data-live-target]').textContent = target == null ? '—' : noteName(target);
    liveEl.querySelector('[data-live-user]').textContent = user == null ? '—' : noteName(user);
    liveEl.querySelector('[data-live-cents]').textContent = cents == null ? '' : `${cents > 0 ? '+' : ''}${cents} cents`;
    liveEl.querySelector('[data-live-state]').textContent = st.text;
    const needle = liveEl.querySelector('[data-live-needle]');
    needle.hidden = cents == null;
    if (cents != null) needle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
  };
```

Y dentro de `tick`, antes de `s.raf = requestAnimationFrame(tick);`:

```js
    const now = performance.now();
    if (liveEl && now - lastLive >= 100) { lastLive = now; updateLive(); }
```

- [ ] **Step 4: Estilos** — al final de `practice/practice.css`:

```css
/* Indicador de afinación en vivo (práctica con guía) */
.practice-live { display: flex; flex-direction: column; gap: 6px; margin: 4px 0; }
.practice-live__notes { margin: 0; font-size: 15px; }
.practice-live__notes strong { font-size: 18px; }
.practice-live__scale { position: relative; height: 14px; background: #000; border-radius: 999px; border: 1px solid var(--card-border, #1b1d1f); }
.practice-live__ok { position: absolute; top: 0; bottom: 0; left: 30%; width: 40%; background: rgba(15, 252, 126, .18); border-radius: 999px; }
.practice-live__needle { position: absolute; top: -3px; width: 4px; height: 20px; margin-left: -2px; border-radius: 2px; background: #fff; transition: left .08s linear; }
.practice-live__needle[hidden] { display: none; }
.practice-live__state { margin: 0; min-height: 1.3em; font-weight: 600; }
.practice-live[data-state="ok"] .practice-live__state, .practice-live[data-state="ok"] [data-live-cents] { color: var(--practice-good, #0ffc7e); }
.practice-live[data-state="warn"] .practice-live__state, .practice-live[data-state="warn"] [data-live-cents] { color: var(--practice-warn, #ffc400); }
.practice-live[data-state="bad"] .practice-live__state, .practice-live[data-state="bad"] [data-live-cents] { color: var(--practice-bad, #ff5c5c); }
```

- [ ] **Step 5: Comprobaciones**

Run: `node --check practice/recorder.js && node --check practice/practice-ui.js && node --check practice/config.js && npm test`
Expected: sin errores; suite raíz en verde.

- [ ] **Step 6: Commit**

```bash
git add practice/recorder.js practice/practice-ui.js practice/config.js practice/practice.css
git commit -m "feat(practica): indicador de afinación en vivo al practicar con guía"
```

- [ ] **Step 7: Prueba en el navegador (controlador)** — con la web local: toma con guía usando la pista de referencia como micrófono (aguja en verde la mayor parte del tiempo, "—" entre frases, fluidez); toma "a prueba" sin indicador; `LIVE_PITCH = false` sin indicador; vista de móvil (390 px). Después, fusionar con `git merge --no-ff feature/afinador-en-vivo`.
