# Pista estilo karaoke y compensación de la latencia de auriculares

Fecha: 2026-10-15 · Sustituye la barra con aguja de [indicador en vivo](2026-10-14-indicador-en-vivo-design.md)

## Objetivo

Que durante la práctica con guía sea evidente si el tenor va afinado y qué nota viene, y que el indicador funcione bien
también con auriculares Bluetooth (150–300 ms de retraso).

**Criterios de éxito**
- Con la pista de referencia como micrófono, la línea de la voz cae sobre las barras de las notas.
- Con un retraso simulado de 250 ms y la calibración hecha, la línea sigue cayendo sobre las barras.
- La calibración tarda menos de 15 s y, si no se oye bien al tenor, lo dice y no guarda nada.
- `LIVE_PITCH = false` sigue apagándolo todo y el cambio se revierte con un solo `git revert -m 1`.

## Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Visualización | Opción A2: pista estilo karaoke con "ahora" a un tercio (1,5 s cantado, 3 s por venir). |
| Texto | Se mantiene la línea Objetivo · Tú · cents · estado encima de la pista. Desaparece la barra con aguja. |
| Latencia | 1) valor automático del navegador como punto de partida; 2) botón "Calibrar auriculares"; 4) aviso actualizado. Sin deslizador manual. |
| Entrega | Junto con la pista karaoke, en una rama y una fusión `--no-ff`. |

## Retraso que se aplica (`lagMs`)

1. Si hay calibración guardada en el dispositivo (`localStorage` `tenores.latency.v1` = `{ ms, at }`), esa.
2. Si no, la del navegador: `round((context.outputLatency + context.baseLatency) × 1000) + 20` (20 ms de entrada
   estimados), si el navegador da `outputLatency > 0`.
3. Si no, 100 ms (el valor actual).

Se limita a 0–500 ms. Se usa como `lagMs` de `targetFor` y para alinear la pista (ver abajo).

## Calibración ("Calibrar auriculares")

- Botón en la pantalla de preparación de la práctica (visible en ambos modos), con el texto del retraso actual:
  "Retraso: 230 ms (calibrado)" / "(automático)" / "(estimado)".
- Flujo: aviso "Ponte los auriculares que vas a usar. Canta «ta» a la vez que cada clic." → cuenta atrás → suenan
  **6 clics** cada 600 ms por los auriculares mientras se graba el micrófono → resultado.
- Medición: se buscan los inicios de voz (subida brusca de energía) en la grabación. Para cada clic a partir del 2.º se
  toma el primer inicio en [clic − 100 ms, clic + 600 ms] y su desfase respecto al clic. Retraso = mediana de los
  desfases.
- Válida si hay ≥ 3 desfases y su dispersión (mediana de las desviaciones absolutas) es ≤ 60 ms, y el resultado está en
  0–500 ms. Si no: "No te escuché bien. Inténtalo de nuevo, más cerca del micrófono." y no se guarda.
- Si vale: se guarda y se muestra "Retraso calibrado: 230 ms".

## Pista estilo karaoke

- `<canvas>` a todo el ancho del bloque, ~120 px de alto, `aria-hidden`. Ventana: 1,5 s antes y 3 s después del
  "ahora", con la línea vertical "ahora" a un tercio.
- Tiempo efectivo `te = audio.currentTime − lagMs / 1000`: lo que el tenor debería estar cantando ya, teniendo en cuenta
  el retraso. Las barras se colocan según `te`.
- **Barras**: las notas de la referencia que caen en la ventana y dentro del fragmento elegido, redondeadas, con su
  nombre. La nota de `te` en verde; el resto en gris.
- **Tu voz**: cada lectura (cada 100 ms) se guarda con su `te` y se dibuja como línea a la izquierda de "ahora",
  plegada a la octava de la nota de ese instante; cada tramo con el color de su estado (verde / amarillo / rojo); se
  corta en los silencios. Se conservan solo las lecturas de los últimos 1,5 s.
- **Escala vertical**: semitonos de las notas visibles con margen de 1, al menos 7 semitonos de alto; el centro se
  acerca al nuevo con suavizado (20 % por fotograma) para que no salte.
- Se redibuja en cada fotograma de la grabación (el bucle `tick` existente).

## Aviso

`GUIDE_WARNING` pasa a: "Usa auriculares, mejor con cable: si el micrófono capta la guía, la puntuación no será fiable.
Con Bluetooth, pulsa «Calibrar auriculares» antes."

## Componentes

| Archivo | Cambio |
|---|---|
| `practice/latency.js` (nuevo) | `configureLatencyStorage`, `savedLatency()`, `saveLatency(ms)`, `browserLatency(context)`, `effectiveLatency(context)`, `detectOnsets(samples, sampleRate)`, `measureLatency(onsetsMs, clicksMs)`. |
| `practice/live-track.js` (nuevo) | Cálculos puros: `visibleNotes`, `foldToTarget`, `createScale`/`stepScale`, `timeToX`, `midiToY`; y `drawTrack(ctx, view)`. |
| `practice/practice-ui.js` | Pista en lugar de la barra; `lagMs` efectivo; botón y flujo de calibración en la preparación; aviso nuevo. |
| `practice/practice.css` | Estilos nuevos al final; se quitan los de la barra con aguja. |

## Pruebas

**Automáticas**: retraso efectivo (guardado > navegador > 100, límites, almacenamiento que falla); `detectOnsets` con
ráfagas sintéticas en tiempos conocidos; `measureLatency` (mediana, dispersión, pocos datos, fuera de rango);
`visibleNotes` (ventana y límite del fragmento); `foldToTarget`; escala (mínimo 7 semitonos, suavizado); `timeToX`.

**Manuales** (Chrome): toma con guía con la pista como micrófono; la misma con 250 ms de retraso simulado, antes y
después de calibrar; calibración que falla en silencio; "a prueba" sin pista; vista de móvil.

## Fuera de alcance

- Deslizador manual de retraso.
- Usar el retraso en la puntuación (el ritmo ya no cuenta en la nota).
