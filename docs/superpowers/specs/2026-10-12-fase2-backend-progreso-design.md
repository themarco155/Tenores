# Fase 2 — Backend, login y "Mi progreso"

Fecha: 2026-10-12 · Visión general: [overview](2026-10-12-sistema-practica-overview.md) ·
Depende de: [fase 1](2026-10-12-fase1-motor-practica-design.md) (`AnalysisResult`)

## Objetivo

Que un tenor con usuario y PIN guarde automáticamente sus intentos válidos y consulte su evolución.
El login es opcional: sin sesión todo funciona como en la fase 1.

**Criterios de éxito**
- Coste 0: Cloudflare Workers + D1 en plan gratuito.
- Ningún PIN ni token se guarda en claro.
- 5 PIN erróneos seguidos bloquean el usuario 15 minutos.
- Un tenor nunca puede leer ni escribir datos de otro (cubierto por tests).

## Estructura

```
backend/
  wrangler.toml          binding D1 "DB", variable ALLOWED_ORIGINS
  package.json           devDependencies: wrangler, vitest, @cloudflare/vitest-pool-workers
  schema.sql             migración inicial
  src/
    index.js             router y CORS
    http.js              respuestas JSON, errores, lectura de body con límite de tamaño
    crypto.js            hash de PIN (PBKDF2), tokens, comparación en tiempo constante
    auth.js              login, logout, middleware de sesión y rol
    users.js             /api/me, cambio de PIN, resumen (las rutas de admin llegan en la fase 3: admin.js)
    attempts.js          guardar y listar intentos
    songs.js             lista de songIds válidos
  tools/create-admin.mjs genera el SQL para insertar el primer administrador
  test/                  Vitest con D1 emulado
```

## Esquema D1

```sql
CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- 3–24 caracteres [a-z0-9._-]
  display_name    TEXT NOT NULL,                         -- 1–40 caracteres
  pin_hash        TEXT NOT NULL,                         -- base64
  pin_salt        TEXT NOT NULL,                         -- base64, 16 bytes
  pin_iterations  INTEGER NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('tenor','admin')),
  active          INTEGER NOT NULL DEFAULT 1,
  must_change_pin INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deactivated_at  TEXT
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                           -- SHA-256 del token, hex
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE login_failures (
  username     TEXT PRIMARY KEY COLLATE NOCASE,
  failed_count INTEGER NOT NULL,
  locked_until TEXT
);
CREATE TABLE attempts (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id         TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('guide','test')),
  phrase_from     INTEGER NOT NULL,
  phrase_to       INTEGER NOT NULL,
  is_full         INTEGER NOT NULL,
  score_total     INTEGER NOT NULL,
  score_pitch     INTEGER NOT NULL,
  score_rhythm    INTEGER NOT NULL,
  score_stability INTEGER,
  coverage        REAL NOT NULL,
  phrase_scores   TEXT NOT NULL,                         -- JSON de AnalysisResult.phrases
  tips            TEXT NOT NULL,                         -- JSON de AnalysisResult.tips
  engine_version  TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX attempts_user_song ON attempts(user_id, song_id, created_at);
CREATE INDEX attempts_ranking   ON attempts(song_id, mode, is_full, created_at);
```
Fechas en ISO 8601 UTC. `PRAGMA foreign_keys` se respeta en D1.

## Autenticación

- **PIN:** exactamente 6 dígitos. PBKDF2-SHA256 con sal aleatoria de 16 bytes; las iteraciones se guardan por
  usuario (`pin_iterations`) para poder subirlas sin romper los hashes existentes. Valor inicial: el máximo que
  quepa en el límite de CPU del plan gratuito, **medido en la primera tarea de implementación** (objetivo
  ≥ 50.000; mínimo aceptable 10.000, compensado por el bloqueo).
- **Login** `POST /api/auth/login {username, pin}`:
  1. Si `login_failures.locked_until` es futuro → `429 {error:'locked', retryAfter}`.
  2. Usuario inexistente, inactivo o PIN erróneo → mismo `401 {error:'invalid_credentials'}` (sin revelar cuál)
     e incrementa `failed_count`; al llegar a 5 fija `locked_until = ahora + 15 min` y reinicia el contador.
     Para usuarios inexistentes también se calcula un hash ficticio (tiempo de respuesta similar).
  3. Éxito → borra la fila de `login_failures`, crea un token de 32 bytes aleatorios (base64url), guarda su
     SHA-256 con caducidad de 30 días y responde `{token, user:{id, username, displayName, role, mustChangePin}}`.
- **Sesión:** `Authorization: Bearer <token>`. El middleware busca el hash, comprueba caducidad y que el usuario
  esté activo; si quedan < 15 días, extiende a 30. Si falla → `401 {error:'unauthorized'}`.
- **Cambio de PIN obligatorio:** con `must_change_pin = 1`, toda ruta salvo `GET /api/me`, `POST /api/me/pin` y
  `POST /api/auth/logout` responde `403 {error:'pin_change_required'}`.
- **CORS:** `Access-Control-Allow-Origin` solo para orígenes de `ALLOWED_ORIGINS` (dominio de GitHub Pages
  definitivo y `http://localhost:*` en desarrollo). Sin cookies.
- **Primer admin:** `node backend/tools/create-admin.mjs <usuario> "<nombre>"` imprime un PIN aleatorio y el
  `INSERT` correspondiente para `wrangler d1 execute`.

## API de esta fase

| Método y ruta | Auth | Cuerpo / respuesta |
|---|---|---|
| `POST /api/auth/login` | — | ver arriba |
| `POST /api/auth/logout` | sesión | borra la sesión actual → `204` |
| `GET /api/me` | sesión | `{user}` |
| `POST /api/me/pin` | sesión | `{currentPin, newPin}` → `204`; `newPin` 6 dígitos y distinto del actual; borra las demás sesiones del usuario |
| `POST /api/attempts` | sesión | `AnalysisResult` sin `curves` → `201 {id}` |
| `GET /api/me/attempts?song=<id>&limit=50&before=<id>` | sesión | `{attempts:[...], next}` ordenados del más reciente |
| `GET /api/me/summary` | sesión | por canción: `{songId, attempts, best, last, lastAt, weakest}` |

**Validación de `POST /api/attempts`:** body ≤ 32 KB; `songId` en la lista de `songs.js`; `mode` válido;
`valid === true`; `1 ≤ phraseFrom ≤ phraseTo ≤ 100`; puntuaciones enteras 0–100 (`stability` puede ser
`null`); `coverage` 0–1; `phrases` ≤ 100 elementos y `tips` ≤ 5; como máximo un intento cada 10 s por
usuario (`429 {error:'too_fast'}`). Errores de validación → `400 {error:'invalid', field}`.

`weakest` = la métrica (`pitch`, `rhythm`, `stability`) con menor media en los últimos 5 intentos de esa canción.

## Cliente (`practice/api.js`, `practice/session.js`, `practice/progress-ui.js`)

- `api.js`: `fetch` con la URL base del Worker (constante `API_BASE` en un único lugar), añade el token,
  traduce errores a mensajes en español. Timeout 10 s.
- `session.js`: guarda `{token, user}` en `localStorage` (con `try/catch`); un `401` limpia la sesión y emite
  un evento `session-change`.
- **Menú:** `main.js` añade al menú hamburguesa una carpeta "Práctica" con *Entrar* / *Mi progreso* / *Salir*
  según el estado de la sesión.
- **Diálogo de entrada:** usuario + PIN (`inputmode="numeric"`, `autocomplete="off"`,
  6 dígitos). Muestra los mensajes de bloqueo con el tiempo restante. Si `mustChangePin`, encadena el diálogo
  "Elige tu PIN" (nuevo + repetir).
- **Guardado:** en resultados, si hay sesión y `valid`, se envía automáticamente y se muestra "Guardado ✓".
  Si falla: "No se pudo guardar" + "Reintentar" (el resultado sigue en pantalla). Sin sesión:
  "Inicia sesión para guardar tu progreso".
- **Mi progreso:** una tarjeta por canción practicada (mejor, última, intentos, métrica más floja). Al abrir
  una canción: gráfica SVG de `score_total` en el tiempo (dos series: guía y a prueba) y lista de intentos;
  cada intento despliega puntuaciones por frase y consejos. Componente reutilizable con
  `renderProgress(container, {userId?})` para el detalle de tenor de la fase 3.

## Pruebas (Vitest + `@cloudflare/vitest-pool-workers`)

- Login correcto; PIN erróneo; usuario inexistente (misma respuesta); usuario inactivo; bloqueo tras 5 fallos
  y desbloqueo pasado el tiempo; token caducado; logout invalida el token.
- `must_change_pin` bloquea el resto de rutas; el cambio de PIN invalida otras sesiones.
- Un tenor no puede leer intentos de otro (no existe ruta que acepte otro `userId` sin rol admin).
- Validación de intentos (cada campo inválido) y límite de 10 s.
- CORS: origen permitido y denegado.
- Medición de tiempo de PBKDF2 con las iteraciones elegidas (prueba informativa en la primera tarea).

**Manual:** `wrangler dev` + app en `localhost`, flujo completo de login → práctica → guardado → Mi progreso.

## Despliegue

`wrangler d1 create tenores`, `wrangler d1 execute tenores --remote --file schema.sql`, `wrangler deploy`,
crear el primer admin con `create-admin.mjs`, y fijar `API_BASE` y `ALLOWED_ORIGINS` con el dominio final.
Se documenta paso a paso en `backend/README.md`.
