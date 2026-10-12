# Fase 1 — Motor de análisis y pantalla de práctica

Fecha: 2026-10-12 · Visión general: [overview](2026-10-12-sistema-practica-overview.md)

## Objetivo

Que cualquier visitante pueda grabarse cantando la parte de tenor de una canción, y obtener una puntuación
(afinación, ritmo/entradas, estabilidad) y hasta 3 áreas de mejora concretas, sin backend ni login.

**Criterios de éxito**
- Una grabación que reproduce la referencia desplazada +50 cents obtiene una afinación claramente menor
  (< 70; con los umbrales iniciales da ~62) que la misma sin desplazar (> 90), y aparece un consejo
  `pitch-bias` que menciona "alto".
- Una grabación estirada en el tiempo un 10 % en modo "a prueba" conserva afinación > 90.
- El análisis de 70 s de audio termina en menos de 3 s en un móvil de gama media y no congela la interfaz.
- `app.js` y `styles.css` no se modifican; `index.html` solo gana 2 líneas.

## Integración con la app existente

- `index.html` añade `<link rel="stylesheet" href="practice/practice.css">` y
  `<script type="module" src="practice/main.js"></script>`.
- `practice/main.js` escucha `hashchange` y la carga inicial. Cuando `#song-view` está visible y la canción
  actual (id = hash) aparece en `assets/pitch/index.json`, inserta un botón **"Practicar"** en la cabecera
  de la tarjeta de audio. Si no aparece, no hay botón.
- Lee título y URL de la pista desde la constante global `SONGS` de `app.js` (accesible desde un script
  módulo como binding léxico global). Se protege con `typeof SONGS !== 'undefined'`; si no existe, no hace nada.
- Al abrir el panel de práctica pausa `#audio-track` (el reproductor actual) y usa su propio `<audio>`.
- El panel es un overlay a pantalla completa (`role="dialog"`, `aria-modal`, foco atrapado, `Esc` cierra),
  sin rutas nuevas: el `route()` actual trataría `#fum/practicar` como canción inexistente.

## Curvas de referencia

### Formato `assets/pitch/<songId>.json`
```json
{
  "version": 1,
  "songId": "fum",
  "source": "https://res.cloudinary.com/.../fum_fum_fum_cancion_c7zzyg.wav",
  "hopMs": 10,
  "frameCount": 6893,
  "midi": [null, null, 57.02, 57.05, ...],
  "notes": [{ "start": 120, "end": 161, "midi": 57.03 }],
  "phrases": [{ "index": 1, "start": 120, "end": 712, "noteFrom": 0, "noteTo": 7 }]
}
```
- Tiempos en frames de 10 ms. `midi` es número MIDI decimal con 2 decimales, o `null` sin voz.
- `assets/pitch/index.json`: `{ "songs": ["fum", ...] }`.

### Generación: `tools/build-pitch.html`
Página local (se abre con el servidor de desarrollo) que, por cada canción de `SONGS`, descarga la pista,
la decodifica con `decodeAudioData` (soporta WAV y MP3 sin dependencias), ejecuta `pitch.js` +
segmentación, dibuja la curva para revisión visual y permite descargar el JSON y el `index.json`.
Los JSON se versionan en el repo. Se eligió página de navegador en lugar de script de Node porque la mayoría
de pistas son MP3 y Node no las decodifica sin dependencias.

### Segmentación (`segment.js`)
- **Notas:** tramos de frames con voz; se corta cuando la mediana móvil (5 frames) cambia > 0,5 semitonos
  durante ≥ 3 frames. Duración mínima 60 ms (tramos más cortos se fusionan con el vecino). `midi` = mediana.
- **Frases:** se cortan en silencios ≥ 300 ms. Frases < 1 s se fusionan con la siguiente. Numeradas desde 1.

## Motor de análisis (módulos puros, sin DOM ni Web Audio)

### `pitch.js` — `detectPitch(samples: Float32Array, sampleRate) → { hopMs, midi: (number|null)[], rms: number[] }`
- Remuestreo a 16 kHz (filtro paso bajo simple + diezmado).
- YIN: ventana 512 muestras (32 ms), salto 160 (10 ms), umbral 0,15, búsqueda 80–700 Hz,
  interpolación parabólica.
- Frame `null` si RMS < umbral de silencio (relativo: −45 dB respecto al pico de la toma) o aperiodicidad
  > 0,35. Filtro de mediana de 5 frames sobre los valores con voz.
- Si el rendimiento no cumple el criterio de < 3 s, se sustituye la función diferencia por su cálculo vía FFT
  (misma interfaz).

### `align.js` — `align(user: midi[], ref: midi[], { bandFrames }) → path: [userIdx, refIdx][]`
- DTW sobre las curvas submuestreadas a 20 ms. Banda Sakoe-Chiba: **guía** ±50 frames (±1 s);
  **a prueba** ±15 % de la longitud del rango (mínimo ±100 frames).
- Coste: ambos `null` → 0; uno `null` → 1,0; ambos con voz → `min(|d|, ||d| − 12|)` limitado a 3 (semitonos).
  Los errores de octava no descuadran la alineación; sí se puntúan después.
- Matriz de direcciones en `Uint8Array`; el camino se reexpande a 10 ms.

### `score.js` — `score(user, ref, path, refSegment, mode) → AnalysisResult`
Por cada nota de referencia dentro del rango, se toman los frames del cantante alineados con el **núcleo**
de la nota (excluye los primeros 50 ms y los últimos 30 ms).

| Métrica | Por nota | Agregado |
|---|---|---|
| **Cobertura** | Nota "cantada" si ≥ 50 % de sus frames alineados tienen voz | Proporción ponderada por duración |
| **Afinación** | `dev` = mediana de (usuario − ref) en cents. Si \|dev\| > 600 → error de octava, puntuación 0. Si no, `lin(|dev|, 20, 100)` | Media ponderada por duración de las notas cantadas |
| **Ritmo** | Desfase del inicio: tiempo del cantante emparejado con el inicio de la nota, menos el inicio de referencia. **Guía:** se resta la mediana de desfases limitada a ±150 ms (latencia del dispositivo). **A prueba:** se ajusta una recta `t_user = a·t_ref + b` y se usa el residuo. `lin(|desfase|, 80, 400)` ms | Media de las notas cantadas |
| **Estabilidad** | Solo notas con núcleo ≥ 400 ms. `sd` = desviación típica de (usuario − ref) en cents; `deriva` = \|media del último 25 % − media del primer 25 %\|. `min(lin(sd,15,60), lin(deriva,15,60))` | Media; `null` si no hay notas largas |

`lin(x, ok, bad)` = 100 si `x ≤ ok`, 0 si `x ≥ bad`, lineal entre medias.

**Total** = `(0,5·P + 0,3·R + 0,2·S) × min(1, cobertura / 0,9)`. Si `S` es `null`, los pesos se reparten
como 0,625·P + 0,375·R. Todas las puntuaciones se redondean a enteros 0–100.

**Validez:** si cobertura < 0,5 → `valid: false`, la interfaz muestra "No se detectó suficiente voz" y
no se ofrece guardar.

Todas las constantes (umbrales, pesos, bandas) viven en un único objeto exportado `SCORING` para
calibrarlas con grabaciones reales.

### Consejos (`score.js`)
Candidatos, cada uno con prioridad = penalización × duración afectada; se devuelven los 3 mayores:

| Tipo | Condición | Texto ejemplo |
|---|---|---|
| `pitch-bias` | Mediana firmada de una frase con \|valor\| > 25 cents | "Frase 3 (0:24–0:31): tiendes a quedarte ~35 cents bajo." |
| `octave` | ≥ 1 nota con error de octava en una frase | "Frase 2: estás cantando una octava por debajo." |
| `entry` | Primera nota de la frase con \|desfase\| > 150 ms | "Entras 0,3 s tarde en la frase 5." |
| `drift` | ≥ 2 notas largas con deriva > 20 cents en el mismo sentido | "En las notas largas caes ~25 cents al final." |
| `missed` | Cobertura de una frase < 60 % | "Frase 6: faltan notas; repásala con la guía." |

Si no hay candidatos y el total ≥ 90 → un único consejo `praise`: "¡Muy bien! Prueba el modo 'Ponerme a prueba'."

### `AnalysisResult` (contrato con la fase 2)
```js
{
  engineVersion: '1.0.0',
  songId: 'fum',
  mode: 'guide' | 'test',
  phraseFrom: 1, phraseTo: 9, isFull: true,
  valid: true,
  coverage: 0.94,
  scores: { total: 82, pitch: 85, rhythm: 78, stability: 80 /* o null */ },
  phrases: [{ index: 1, start: 1.2, end: 7.1, pitch: 90, rhythm: 70, stability: null, coverage: 1 }],
  tips: [{ kind: 'pitch-bias', phrase: 3, text: '...' }],
  // Solo para la interfaz, no se envía al backend:
  curves: { ref: [...], user: [...] /* alineada al eje de referencia */, hopMs: 10, startSec: 0 }
}
```

### `analyze.js` y `analysis-worker.js`
`analyze({ samples, sampleRate, refData, mode, phraseFrom, phraseTo })` encadena
`detectPitch` → recorte de la referencia al rango → `align` → `score`. El worker recibe el mensaje con el
`Float32Array` transferido y devuelve el `AnalysisResult`.

## Grabación (`recorder.js`, `recorder-worklet.js`)
- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`.
- `AudioContext` creado en el gesto del usuario (requisito de iOS). El worklet acumula `Float32Array` mono.
- Expone `start()`, `stop() → { samples, sampleRate }`, `level` (RMS para el medidor) y `dispose()` (detiene
  las pistas del micrófono).

## Pantalla de práctica (`practice-ui.js`, `chart.js`)

**Configurar:** modo ("Practicar con guía" / "Ponerme a prueba"), rango ("Completa" o "Desde frase X hasta
frase Y", con la hora de cada frase), botón "Empezar". En guía, aviso: "Usa auriculares: si el micrófono
capta la guía, la puntuación no será fiable."

**Cuenta atrás:**
- **Guía:** 3-2-1 visual y empieza la referencia en el inicio del rango junto con la grabación.
- **A prueba:** suena la **nota de partida** (primera nota del rango, tono sintético 1 s), luego 3-2-1 con
  clic, y empieza la grabación.

**Grabando:** medidor de nivel, barra de progreso del rango, botón "Detener". Fin automático:
guía → al acabar el rango + 1 s; a prueba → duración del rango × 1,3 + 2 s.

**Analizando:** indicador mientras trabaja el worker.

**Resultados:** total grande y tres métricas; hasta 3 consejos; gráfica SVG tipo piano-roll (curva de
referencia y curva alineada del usuario, frases sombreadas por color según puntuación). Al tocar una frase:
"Escuchar referencia" y "Practicar esta frase". Botones: "Escuchar mi toma", "Repetir", "Cambiar ajustes".
La toma vive solo en memoria y se descarta al cerrar.

**Errores**

| Caso | Comportamiento |
|---|---|
| Permiso de micrófono denegado | Mensaje con pasos para habilitarlo; botón "Reintentar" |
| Sin micrófono / navegador sin `getUserMedia` o `AudioWorklet` | "Tu navegador no permite grabar"; el botón Practicar queda deshabilitado |
| Falla la carga de `assets/pitch/<id>.json` | "No se pudo cargar la referencia"; "Reintentar" |
| `valid: false` | "No se detectó suficiente voz. Acércate al micrófono o canta más fuerte." |
| Cierre del panel o cambio de canción durante la grabación | Se detiene todo y se libera el micrófono |
| Error del worker | "No se pudo analizar la toma"; se conserva la toma para reintentar |

## Pruebas

**Automáticas (`node --test test/`)**, sin dependencias:
- `pitch`: senos y diente de sierra a 110, 220, 330, 440 Hz → error < 5 cents; silencio → `null`;
  ruido blanco → mayoría `null`.
- `align`: curva desplazada 300 ms y estirada 10 % → el camino recupera el desplazamiento (± 20 ms).
- `score`: curva idéntica → total ≥ 95; +50 cents → afinación < 70 y consejo `pitch-bias` "alto";
  octava abajo → consejo `octave`; frase entera retrasada 300 ms → consejo `entry`; nota larga con caída de
  30 cents → consejo `drift`; silencio → `valid: false`.
- Integración: `audios/Fum Fum Fum - cancion.wav` (lector WAV mínimo en `test/helpers`) contra su propia
  curva → total ≥ 95; la misma desplazada +50 cents por remuestreo → afinación < 70.

**Manuales:** Chrome escritorio, Chrome Android, Safari iOS (vía HTTPS): permisos, ambos modos, rango de
frases, auriculares, cierre a mitad de grabación.
