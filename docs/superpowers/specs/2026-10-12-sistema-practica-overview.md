# Sistema de práctica con comparación de voz — Visión general

Fecha: 2026-10-12 · Estado: diseño aprobado en conversación, pendiente de revisión escrita

## Objetivo

La app Tenores (sitio estático en GitHub Pages: `index.html`, `app.js`, `styles.css`) sirve hoy como
referencia de audio y letra para que los tenores estudien las piezas del coro. Se añade:

1. Grabarse con el micrófono, comparar con la referencia y obtener una **puntuación** y **áreas de mejora**.
2. Un **backend** opcional para registrar el progreso de cada tenor.
3. Un **panel de administración** (jefe de cuerda) con CRUD de usuarios, vista del equipo y ranking.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Audio de referencia | Contiene solo la voz de tenor aislada (monofónica) |
| Dónde se analiza | Siempre en el navegador; el backend solo recibe métricas, nunca audio |
| Métricas | Afinación (50 %), ritmo/entradas (30 %), estabilidad (20 %). Sin dinámica, sin pronunciación |
| Modos | "Practicar con guía" (referencia en auriculares) y "Ponerme a prueba" (a capela con cuenta atrás) |
| Alcance de un intento | Canción completa o rango de frases elegido |
| Login | Opcional: solo necesario para guardar progreso. La app sigue siendo pública como hoy |
| Identidad | Usuario + PIN numérico de 6 dígitos, creados por el administrador |
| Roles | `tenor` (ve su progreso) y `admin` (ve todo, ranking, CRUD) |
| Ranking | Visible solo para administradores |
| Bajas | Desactivar (conserva historial) por defecto; eliminar es definitivo y aparte |
| Backend | Cloudflare Workers + D1, plan gratuito (coste 0, sin pausas por inactividad) |
| App existente | `app.js` y `styles.css` sin cambios; `index.html` solo añade 2 líneas (script módulo + CSS) |

## Fases (cada una publicable por separado)

1. [Motor de análisis y práctica](2026-10-12-fase1-motor-practica-design.md) — sin backend.
2. [Backend, login y "Mi progreso"](2026-10-12-fase2-backend-progreso-design.md).
3. [Panel de administración](2026-10-12-fase3-panel-admin-design.md).

## Estructura de archivos resultante

```
index.html                 (+2 líneas)
practice/
  main.js                  punto de entrada; inyecta botón "Practicar" y carpeta "Práctica" del menú
  practice.css
  util.js                  utilidades numéricas (puro)
  pitch.js                 YIN (puro)
  segment.js               segmentación en notas y frases (puro)
  reference.js             construir y recortar referencias (puro)
  align.js                 DTW (puro)
  scoring-config.js        constantes SCORING (único lugar para calibrar)
  score.js                 puntuaciones (puro)
  tips.js                  consejos (puro)
  analyze.js               orquesta pitch → align → score (puro)
  analysis-worker.js       Web Worker que ejecuta analyze.js
  analysis-client.js       envía la toma al worker
  recorder.js              micrófono + AudioWorklet
  recorder-worklet.js
  tones.js                 nota de partida y claqueta
  practice-ui.js           panel de práctica
  chart.js                 gráficas SVG
  api.js                   cliente HTTP del backend          (fase 2)
  session.js               token y usuario actual            (fase 2)
  progress-ui.js           "Mi progreso" / detalle de tenor  (fase 2)
  admin-ui.js              panel de administración           (fase 3)
assets/pitch/<songId>.json curvas de referencia precalculadas
tools/build-pitch.html     genera assets/pitch/*.json desde los audios (en el navegador)
tools/check-pitch.mjs      valida los JSON generados
tools/mic-check.html       diagnóstico rápido de micrófono y afinación
package.json               solo "type": "module" y el script de tests (sin dependencias)
test/                      tests de Node (node --test) del motor
backend/                   Worker, esquema D1, tests (fase 2)
```

## Fuera de alcance

Análisis de pronunciación o letra, dinámica, timbre, almacenamiento de audio, fragmentos predefinidos por
el administrador, protección real del contenido actual de la app (es estático y público), puntuación
verificada en servidor.
