# Indicador de afinación en vivo (práctica con guía)

Fecha: 2026-10-14 · Depende de: [fase 1](2026-10-12-fase1-motor-practica-design.md)

## Objetivo

Mientras un tenor graba en modo **"Practicar con guía"**, ver en tiempo real la nota que debería cantar (la de la
referencia en ese momento), la nota que está cantando y cuántos cents se desvía, como apoyo visual al aprender la voz.

**Criterios de éxito**
- Durante una toma con guía, el indicador se actualiza unas 10 veces por segundo sin entorpecer la grabación ni la
  puntuación final.
- Cantando la propia referencia (prueba con la pista como micrófono), la aguja se mantiene en la zona verde.
- En modo "Ponerme a prueba" el indicador no aparece.
- Se puede apagar con una constante (`LIVE_PITCH = false` en `practice/config.js`) y revertir con un solo `git revert`.

## Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Dónde | Solo dentro de la grabación en modo "con guía". Sin pantalla de afinador aparte por ahora. |
| "A prueba" | Sin indicador: el modo mide cómo canta sin ayuda. |
| Enfoque | Analizar en la propia página los últimos ~0,2 s de micrófono, ~10 veces/s, con el mismo detector YIN de la puntuación. |
| Reversibilidad | Rama propia, fusión con commit de fusión (`--no-ff`) e interruptor `LIVE_PITCH` en `practice/config.js`. |

## Comportamiento

- **Nota objetivo**: la de la referencia en el instante `t = audio.currentTime − 0,1 s` (compensa el retraso entre oír
  la guía y cantar). Se toma la nota de `ref.notes` que contiene el frame `round(t × 1000 / hopMs)`. Fuera de cualquier
  nota (entre frases, antes o después) → sin objetivo ("—").
- **Tu nota**: se analiza el último fragmento de micrófono (200 ms) con `detectPitch`; se toma la mediana de los frames
  con voz de los últimos 60 ms. Si el nivel del micrófono (`recorder.level`) está por debajo de 0,01 o no hay frames con
  voz → "—".
- **Desviación**: `(tu midi − midi objetivo) × 100` cents, plegada por octavas al rango [−600, +600) (cantar una octava
  abajo no es error, igual que en la puntuación). Solo se calcula con objetivo y nota tuya.
- **Estado** según |desviación|: ≤ 20 → "Afinado" (verde); ≤ 50 → "Un poco alto" / "Un poco bajo" (amarillo);
  > 50 → "Muy alto" / "Muy bajo" (rojo). Sin desviación → texto vacío.
- **Nombres de nota** en notación latina con octava: Do, Do#, Re, Re#, Mi, Fa, Fa#, Sol, Sol#, La, La#, Si (p. ej.
  midi 57 → "La3", 60 → "Do4"). La nota objetivo se nombra por el semitono más cercano al midi de la referencia.

## Pantalla (durante la grabación con guía)

Debajo del medidor de nivel, un bloque `practice-live`:
- Línea: **Objetivo:** Si3 · **Tú:** Si3 · **+12 cents**.
- Barra horizontal de −50 a +50 cents con zona central verde de ±20 y una aguja (desviación limitada a ±50 para
  dibujarla).
- Texto de estado ("Afinado", "Un poco alto"…).
- Todo el bloque lleva `aria-hidden="true"`: es un apoyo visual que se refresca 10 veces por segundo y no debe leerse con
  lector de pantalla. El resto de la pantalla de grabación no cambia.

## Componentes

| Archivo | Cambio |
|---|---|
| `practice/recorder.js` | Nuevo método `recent(ms) → { samples, sampleRate }` con los últimos `ms` milisegundos capturados, independiente de `start/stop`. Usa un búfer circular puro `createSampleRing(capacity)` (en `live-pitch.js`) con `push(block)` y `latest(n)`. |
| `practice/live-pitch.js` (nuevo) | Funciones puras: `createSampleRing(capacity)`, `noteName(midi)`, `targetAt(ref, seconds, lagMs = 100)`, `livePitch(samples, sampleRate, level)`, `deviationCents(user, target)`, `tuningState(cents)`. |
| `practice/practice-ui.js` | En `renderRecording`, si `take.mode === 'guide'` y `LIVE_PITCH`, pinta el bloque y lo actualiza cada ~100 ms con `s.audio.currentTime`, `s.ref` y `s.recorder.recent(200)`. |
| `practice/config.js` | `export const LIVE_PITCH = true;` |
| `practice/practice.css` | Estilos del bloque, al final del archivo. |

Nada cambia en la puntuación, el guardado de intentos ni el backend.

## Pruebas

**Automáticas** (`test/live-pitch.test.js`): nombres de nota; `targetAt` con el retraso y fuera de notas; desviación con
plegado de octava (+1200 cents → 0; −590 → −590; +610 → −590); estados en ±20 y ±50; `livePitch` con un tono sintético de
220 Hz → ≈ 57 (La3), con silencio → `null` y con nivel bajo → `null`; el búfer circular devuelve solo las
últimas muestras, también tras dar la vuelta.

**Manuales** (Chrome contra el servidor local): toma con guía usando la pista de referencia como micrófono → aguja en
verde la mayor parte del tiempo y objetivo "—" entre frases; toma "a prueba" → sin indicador; `LIVE_PITCH = false` → sin
indicador; vista de móvil.

## Fuera de alcance

- Pantalla de afinador independiente (libre + nota objetivo).
- Indicador en modo "a prueba".
- Guardar o puntuar con los datos en vivo.
