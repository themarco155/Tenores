# Fases 2 y 3 — Backend, login, "Mi progreso" y panel de administración · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los tenores entren con usuario y PIN, guarden sus intentos y vean su evolución, y que el jefe de cuerda gestione usuarios, vea al equipo y consulte un ranking privado; todo ejecutable en local.

**Architecture:** Un Cloudflare Worker (`backend/`) con D1 (SQLite) expone una API JSON. El Worker se construye con `createApp({ now })` y se prueba en Node con `node --test`, usando una base `node:sqlite` en memoria que imita la interfaz de D1 (`test/helpers/d1.js`). En local se ejecuta con `wrangler dev`. El frontend añade módulos ES en `practice/` (sesión, cliente API, diálogos, menú, "Mi progreso", administración) sin tocar `app.js` ni `styles.css`.

**Tech Stack:** Cloudflare Workers + D1, Wrangler 4.149.0 (solo devDependency de `backend/`), WebCrypto (PBKDF2-SHA256, SHA-256), Node ≥ 22 (`node:test`, `node:sqlite`), JavaScript ES2022 en el navegador.

**Specs:** `docs/superpowers/specs/2026-10-12-fase2-backend-progreso-design.md` y `docs/superpowers/specs/2026-10-12-fase3-panel-admin-design.md` (contexto: `docs/superpowers/specs/2026-10-12-sistema-practica-overview.md`).

**Rama:** crear `feature/fase2-3-backend` desde `feature/fase1-practica` (la fase 1 aún no está en `main`).

## Global Constraints

- Coste 0: Cloudflare Workers + D1 en plan gratuito.
- Ningún PIN ni token se guarda en claro: PIN con PBKDF2-SHA256 y sal de 16 bytes; token de sesión de 32 bytes guardado como SHA-256 hex.
- PIN: exactamente 6 dígitos. Iteraciones por defecto 20 000 (variable `PIN_ITERATIONS`, rango 1 000–100 000), guardadas por usuario en `pin_iterations`.
- 5 PIN erróneos seguidos bloquean el usuario 15 minutos.
- Sesión: 30 días; si quedan < 15 días se extiende a 30.
- Un tenor nunca puede leer ni escribir datos de otro; las rutas `/api/admin/*` exigen rol `admin`.
- Errores JSON: `{ "error": "<código>", ...extra }`; validación → `400 { error: 'invalid', field }` (también para cuerpos > 32 KB).
- CORS: solo orígenes de `ALLOWED_ORIGINS` (lista separada por comas; `http://localhost:*` acepta cualquier puerto); petición con `Origin` no permitido → `403 forbidden_origin`.
- Fechas en ISO 8601 UTC generadas siempre con `toISOString()`.
- `app.js`, `styles.css` e `index.html` no se modifican. Los estilos nuevos se añaden al final de `practice/practice.css`.
- Sin dependencias de ejecución en el navegador; el backend solo usa APIs de Workers (sin módulos de Node en `backend/src/`).
- Textos de interfaz en español con tildes.
- Commits sin líneas `Co-Authored-By` ni ninguna otra atribución.

## Review Focus

1. **Mayúsculas en el usuario** ("Ana" frente a "ana"): se normaliza a minúsculas al crear y al entrar → test en Task 3.
2. **Guardado doble** (reintento tras un timeout, dos pestañas): el límite de 10 s responde `429 too_fast` y la interfaz lo explica → test en Task 4 y mensaje en Task 6.
3. **El administrador se desactiva/degrada/borra a sí mismo o deja el sistema sin administradores** → `409 self_action` / `409 last_admin`, tests en Task 9.
4. **Backend apagado o URL mal configurada en local**: la práctica sigue funcionando y el guardado muestra "No se pudo conectar con el servidor." con Reintentar → test del cliente en Task 6.
5. **Borrar un usuario con intentos**: desaparecen sus intentos y sesiones (cascada) y su bloqueo de login → test en Task 9.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/package.json` · `backend/wrangler.toml` | Scripts (`test`, `dev`, migraciones, despliegue) y configuración del Worker/D1 |
| `backend/migrations/0001_init.sql` | Esquema D1 |
| `backend/src/index.js` | Export por defecto del Worker (`createApp()`) |
| `backend/src/app.js` | `createApp({ now })`: CORS, enrutado, errores |
| `backend/src/routes.js` | Tabla de rutas `[método, patrón, handler]` |
| `backend/src/http.js` | `HttpError`, `json`, `noContent`, `readJson` |
| `backend/src/cors.js` | `allowedOrigin`, `corsHeaders` |
| `backend/src/crypto.js` | Base64, PBKDF2, tokens, SHA-256, PIN aleatorio |
| `backend/src/validate.js` | Validadores de usuario, nombre, PIN, rol, id |
| `backend/src/auth.js` | Login, logout, `requireSession`, `requireAdmin`, `publicUser` |
| `backend/src/users.js` | `/api/me`, cambio de PIN, resumen propio |
| `backend/src/songs.js` | `SONG_IDS` |
| `backend/src/attempts.js` | Validación y guardado de intentos, listado paginado, resumen |
| `backend/src/admin.js` | CRUD de usuarios, equipo, ranking (fase 3) |
| `backend/tools/create-admin.mjs` | Genera el SQL del primer administrador y su PIN temporal |
| `backend/test/helpers/d1.js` · `backend/test/helpers/app.js` | Base D1 en memoria y utilidades de test |
| `backend/README.md` | Puesta en marcha local y despliegue real |
| `tools/serve.mjs` | Servidor estático local de la web (`npm run serve`) |
| `practice/config.js` | `API_BASE`, `apiEnabled` |
| `practice/session.js` | Sesión en `localStorage` y evento de cambio |
| `practice/api.js` | Cliente HTTP, mensajes de error, `toAttemptPayload` |
| `practice/format.js` | Formato puro: etiquetas, fechas, periodos, tendencia, escape |
| `practice/sheet.js` | Diálogo modal genérico apilable |
| `practice/login-ui.js` | Entrar y elegir PIN |
| `practice/menu.js` | Carpeta "Práctica" del menú hamburguesa |
| `practice/save-status.js` | Estado de guardado en los resultados de práctica |
| `practice/progress-chart.js` · `practice/progress-ui.js` | Gráfica y vista "Mi progreso" / detalle de tenor |
| `practice/admin-ui.js` | Panel de administración |

---

### Task 1: Esqueleto del Worker, base D1 en memoria, CORS y enrutado

**Files:**
- Create: `backend/package.json`, `backend/wrangler.toml`, `backend/migrations/0001_init.sql`, `backend/src/index.js`, `backend/src/app.js`, `backend/src/routes.js`, `backend/src/http.js`, `backend/src/cors.js`
- Create: `backend/test/helpers/d1.js`, `backend/test/helpers/app.js`
- Test: `backend/test/app.test.js`
- Modify: `.gitignore` (añadir `admin-seed.sql`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `HttpError(status, code, extra = {})`, `json(status, body, headers?) → Response`, `noContent() → Response`, `readJson(request, maxBytes = 32768) → Promise<object>` (lanza `HttpError(400,'invalid',{field:'body'})`).
  - `allowedOrigin(origin, env) → string|null`, `corsHeaders(allowed) → object`.
  - `createApp({ now }) → { fetch(request, env) }`. Los handlers reciben `ctx = { request, env, url, params, db, now }` y devuelven `Response` o lanzan `HttpError`.
  - `ROUTES` en `routes.js`: array de `[method, pattern, handler]` con patrones tipo `/api/admin/users/:id`.
  - Tests: `createTestDb() → D1Shim` (aplica `migrations/*.sql`); `setup() → { db, env, app, clock, call, advance, seedUser, loginAs }`; `ORIGIN`.

- [ ] **Step 1: Crear rama y configuración**

```bash
git checkout feature/fase1-practica
git checkout -b feature/fase2-3-backend
```

`backend/package.json`:
```json
{
  "name": "tenores-api",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"test/**/*.test.js\"",
    "dev": "wrangler dev --local --port 8787",
    "db:migrate:local": "wrangler d1 migrations apply tenores --local",
    "db:migrate:remote": "wrangler d1 migrations apply tenores --remote",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "4.149.0"
  }
}
```

`backend/wrangler.toml`:
```toml
name = "tenores-api"
main = "src/index.js"
compatibility_date = "2026-09-01"

[vars]
# Orígenes permitidos (coma). Al desplegar se añade el de GitHub Pages: ver backend/README.md
ALLOWED_ORIGINS = "http://127.0.0.1:8000,http://localhost:*"
PIN_ITERATIONS = "20000"

[[d1_databases]]
binding = "DB"
database_name = "tenores"
# Para local basta este valor; al desplegar se sustituye por el id de `wrangler d1 create tenores`.
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"
```

Añadir al final de `.gitignore`:
```
# SQL del primer administrador (contiene el hash del PIN temporal)
admin-seed.sql
```

- [ ] **Step 2: Esquema D1** — `backend/migrations/0001_init.sql`

```sql
CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name    TEXT NOT NULL,
  pin_hash        TEXT NOT NULL,
  pin_salt        TEXT NOT NULL,
  pin_iterations  INTEGER NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('tenor','admin')),
  active          INTEGER NOT NULL DEFAULT 1,
  must_change_pin INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deactivated_at  TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

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
  phrase_scores   TEXT NOT NULL,
  tips            TEXT NOT NULL,
  engine_version  TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX attempts_user_song ON attempts(user_id, song_id, created_at);
CREATE INDEX attempts_ranking   ON attempts(song_id, mode, is_full, created_at);
```

- [ ] **Step 3: Base D1 en memoria y utilidades de test**

`backend/test/helpers/d1.js`:
```js
// Imitación mínima de la API de Cloudflare D1 sobre node:sqlite (solo para tests).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../../migrations/', import.meta.url);

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    for (const p of params) {
      if (p === undefined || typeof p === 'boolean') throw new Error(`D1_TYPE_ERROR: tipo no admitido (${p})`);
    }
    return new Statement(this.db, this.sql, params);
  }

  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (row == null) return null;
    const plain = { ...row };
    return column ? plain[column] : plain;
  }

  async all() {
    const results = this.db.prepare(this.sql).all(...this.params).map(r => ({ ...r }));
    return { success: true, results, meta: {} };
  }

  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export class D1Shim {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function createTestDb() {
  const d1 = new D1Shim();
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    d1.db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  return d1;
}
```

`backend/test/helpers/app.js`:
```js
import { createApp } from '../../src/app.js';
import { createTestDb } from './d1.js';

export const ORIGIN = 'http://127.0.0.1:8000';
const SALT = 'c2FsdHNhbHRzYWx0c2FsdA=='; // 16 bytes
const TEST_ITERATIONS = 1000;

export function setup() {
  const clock = { now: new Date('2026-10-01T10:00:00.000Z') };
  const db = createTestDb();
  const env = { DB: db, ALLOWED_ORIGINS: 'http://127.0.0.1:8000,http://localhost:*', PIN_ITERATIONS: String(TEST_ITERATIONS) };
  const app = createApp({ now: () => new Date(clock.now) });

  async function call(method, path, { body, token, origin, headers = {} } = {}) {
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = `Bearer ${token}`;
    if (origin) h.Origin = origin;
    const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    const res = await app.fetch(new Request(`http://api.test${path}`, { method, headers: h, body: payload }), env);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  const advance = ms => { clock.now = new Date(clock.now.getTime() + ms); };

  async function seedUser({ username = 'ana', displayName = 'Ana', role = 'tenor', pin = '123456', active = 1, mustChangePin = 0 } = {}) {
    // Import dinámico: src/crypto.js llega en la Task 2 y en la Task 1 no se usa seedUser.
    const { hashPin } = await import('../../src/crypto.js');
    const ts = clock.now.toISOString();
    const r = await db.prepare(`INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, active, must_change_pin, created_at, updated_at, deactivated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(username, displayName, await hashPin(pin, SALT, TEST_ITERATIONS), SALT, TEST_ITERATIONS, role, active, mustChangePin, ts, ts, active ? null : ts)
      .run();
    return r.meta.last_row_id;
  }

  async function loginAs(username = 'ana', pin = '123456') {
    const r = await call('POST', '/api/auth/login', { body: { username, pin } });
    return r.body.token;
  }

  return { db, env, app, clock, call, advance, seedUser, loginAs };
}
```

- [ ] **Step 4: Escribir el test que falla** — `backend/test/app.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, ORIGIN } from './helpers/app.js';
import { readJson } from '../src/http.js';
import { allowedOrigin } from '../src/cors.js';

test('GET /api/health responde ok', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
});

test('ruta desconocida → 404 not_found; método equivocado → 405', async () => {
  const { call } = setup();
  assert.deepEqual((await call('GET', '/api/nada')).body, { error: 'not_found' });
  const r = await call('POST', '/api/health');
  assert.equal(r.status, 405);
  assert.deepEqual(r.body, { error: 'method_not_allowed' });
});

test('CORS: origen permitido recibe Access-Control-Allow-Origin', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/health', { origin: ORIGIN });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});

test('CORS: http://localhost:* acepta cualquier puerto', () => {
  const env = { ALLOWED_ORIGINS: 'http://127.0.0.1:8000,http://localhost:*' };
  assert.equal(allowedOrigin('http://localhost:5173', env), 'http://localhost:5173');
  assert.equal(allowedOrigin('http://localhost:abc', env), null);
  assert.equal(allowedOrigin('http://evil.test', env), null);
  assert.equal(allowedOrigin(null, env), null);
});

test('CORS: origen no permitido → 403 forbidden_origin sin cabecera de origen', async () => {
  const { call } = setup();
  const r = await call('GET', '/api/health', { origin: 'https://evil.test' });
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: 'forbidden_origin' });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

test('CORS: preflight OPTIONS → 204 con métodos y cabeceras', async () => {
  const { call } = setup();
  const r = await call('OPTIONS', '/api/auth/login', { origin: ORIGIN });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /PATCH/);
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

test('readJson: rechaza cuerpo > 32 KB, JSON inválido y arrays', async () => {
  const req = body => new Request('http://api.test/x', { method: 'POST', body });
  await assert.rejects(readJson(req('x'.repeat(33 * 1024))), e => e.status === 400 && e.extra.field === 'body');
  await assert.rejects(readJson(req('{no')), e => e.status === 400 && e.code === 'invalid');
  await assert.rejects(readJson(req('[1,2]')), e => e.status === 400);
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
});

test('la base de test aplica las migraciones y borra en cascada', async () => {
  const { db } = setup();
  const ts = '2026-10-01T10:00:00.000Z';
  const u = await db.prepare(`INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, created_at, updated_at)
    VALUES ('x', 'X', 'h', 's', 1000, 'tenor', ?, ?)`).bind(ts, ts).run();
  await db.prepare(`INSERT INTO attempts (user_id, song_id, mode, phrase_from, phrase_to, is_full, score_total, score_pitch, score_rhythm, score_stability, coverage, phrase_scores, tips, engine_version, created_at)
    VALUES (?, 'fum', 'test', 1, 1, 1, 80, 80, 80, NULL, 1, '[]', '[]', '1.0.0', ?)`).bind(u.meta.last_row_id, ts).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(u.meta.last_row_id).run();
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM attempts').first('n'), 0);
});
```

- [ ] **Step 5: Ejecutar y verificar que falla**

Run: `cd backend && npm test`
Expected: FAIL con `Cannot find module ... src/app.js` (o `http.js`).

- [ ] **Step 6: Implementar `http.js`, `cors.js`, `app.js`, `routes.js`, `index.js`**

`backend/src/http.js`:
```js
export class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export const noContent = () => new Response(null, { status: 204 });

export async function readJson(request, maxBytes = 32 * 1024) {
  const tooBig = () => new HttpError(400, 'invalid', { field: 'body' });
  if (Number(request.headers.get('Content-Length') || 0) > maxBytes) throw tooBig();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw tooBig();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid', { field: 'body' });
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid', { field: 'body' });
  return value;
}
```

`backend/src/cors.js`:
```js
export function allowedOrigin(origin, env) {
  if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const entry of list) {
    if (entry === origin) return origin;
    if (entry.endsWith(':*')) {
      const prefix = entry.slice(0, -1); // "http://localhost:"
      if (origin.startsWith(prefix) && /^\d+$/.test(origin.slice(prefix.length))) return origin;
    }
  }
  return null;
}

export function corsHeaders(allowed) {
  if (!allowed) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
```

`backend/src/routes.js`:
```js
import { json } from './http.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
];
```

`backend/src/app.js`:
```js
import { HttpError, json } from './http.js';
import { allowedOrigin, corsHeaders } from './cors.js';
import { ROUTES } from './routes.js';

function compile(pattern) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; });
  return { re: new RegExp(`^${source}$`), keys };
}

const TABLE = ROUTES.map(([method, pattern, handler]) => ({ method, handler, ...compile(pattern) }));

function match(method, path) {
  let pathMatched = false;
  for (const route of TABLE) {
    const m = route.re.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (route.method !== method) continue;
    const params = {};
    route.keys.forEach((key, i) => {
      try { params[key] = decodeURIComponent(m[i + 1]); } catch { throw new HttpError(404, 'not_found'); }
    });
    return { handler: route.handler, params };
  }
  throw pathMatched ? new HttpError(405, 'method_not_allowed') : new HttpError(404, 'not_found');
}

function withHeaders(res, headers) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

export function createApp({ now = () => new Date() } = {}) {
  return {
    async fetch(request, env) {
      const origin = request.headers.get('Origin');
      const allowed = allowedOrigin(origin, env);
      const cors = corsHeaders(allowed);
      if (origin && !allowed) return withHeaders(json(403, { error: 'forbidden_origin' }), cors);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      try {
        const url = new URL(request.url);
        const { handler, params } = match(request.method, url.pathname);
        const res = await handler({ request, env, url, params, db: env.DB, now: now() });
        return withHeaders(res, cors);
      } catch (err) {
        if (err instanceof HttpError) return withHeaders(json(err.status, { error: err.code, ...err.extra }), cors);
        console.error(err);
        return withHeaders(json(500, { error: 'server_error' }), cors);
      }
    },
  };
}
```

`backend/src/index.js`:
```js
import { createApp } from './app.js';

export default createApp();
```

- [ ] **Step 7: Ejecutar y verificar que pasa**

Run: `cd backend && npm test`
Expected: PASS (8 tests). La raíz (`npm test` en el directorio del repo) sigue en 76 tests: los tests de `backend/` no entran en su patrón.

- [ ] **Step 8: Commit**

```bash
git add .gitignore backend/package.json backend/wrangler.toml backend/migrations backend/src backend/test
git commit -m "feat(backend): esqueleto del Worker con CORS, enrutado y base D1 de test"
```

---

### Task 2: Criptografía, validadores y creación del primer administrador

**Files:**
- Create: `backend/src/crypto.js`, `backend/src/validate.js`, `backend/tools/create-admin.mjs`
- Test: `backend/test/crypto.test.js`

**Interfaces:**
- Consumes: `HttpError` (Task 1).
- Produces:
  - `crypto.js`: `toBase64(bytes)`, `fromBase64(str)`, `toBase64Url(bytes)`, `randomBytes(n)`, `newSalt() → base64 (16 bytes)`, `hashPin(pin, saltB64, iterations) → Promise<base64>`, `verifyPin(pin, userRow) → Promise<boolean>` (usa `pin_hash`, `pin_salt`, `pin_iterations`), `timingSafeEqual(a, b)`, `newToken() → base64url (43 caracteres)`, `sha256Hex(text) → Promise<hex>`, `randomPin() → "dddddd"`, `pinIterations(env) → number` (20000 por defecto).
  - `validate.js`: `validateUsername(v, field?) → string` (minúsculas, `^[a-z0-9._-]{3,24}$`), `validateDisplayName(v, field?)` (1–40, espacios colapsados), `validatePin(v, field?)`, `validateRole(v, field?)`, `validateId(v) → number` (404 si no es entero ≥ 1), `isInt(v, lo, hi)`.
  - `create-admin.mjs`: `buildAdminInsert({ username, displayName, iterations, now?, pin?, salt? }) → Promise<{ pin, sql }>` y CLI.

- [ ] **Step 1: Escribir el test que falla** — `backend/test/crypto.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin, newSalt, newToken, sha256Hex, randomPin, timingSafeEqual, pinIterations, fromBase64 } from '../src/crypto.js';
import { validateUsername, validateDisplayName, validatePin, validateRole, validateId } from '../src/validate.js';
import { buildAdminInsert } from '../tools/create-admin.mjs';
import { createTestDb } from './helpers/d1.js';

test('hashPin es determinista por sal y distinto entre sales', async () => {
  const s1 = newSalt(), s2 = newSalt();
  assert.equal(fromBase64(s1).length, 16);
  assert.equal(await hashPin('123456', s1, 1000), await hashPin('123456', s1, 1000));
  assert.notEqual(await hashPin('123456', s1, 1000), await hashPin('123456', s2, 1000));
});

test('verifyPin acepta el PIN correcto y rechaza otro', async () => {
  const salt = newSalt();
  const user = { pin_hash: await hashPin('246810', salt, 1000), pin_salt: salt, pin_iterations: 1000 };
  assert.equal(await verifyPin('246810', user), true);
  assert.equal(await verifyPin('246811', user), false);
});

test('newToken es base64url de 32 bytes y sha256Hex coincide con el vector conocido', async () => {
  const t = newToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newToken(), t);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('randomPin produce 6 dígitos', () => {
  for (let i = 0; i < 200; i++) assert.match(randomPin(), /^\d{6}$/);
});

test('timingSafeEqual y pinIterations', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'abcd'), false);
  assert.equal(pinIterations({}), 20000);
  assert.equal(pinIterations({ PIN_ITERATIONS: '50000' }), 50000);
  assert.equal(pinIterations({ PIN_ITERATIONS: '10' }), 20000);
});

test('validadores normalizan y rechazan', () => {
  assert.equal(validateUsername('  Ana.Perez '), 'ana.perez');
  assert.throws(() => validateUsername('ab'), e => e.status === 400 && e.extra.field === 'username');
  assert.throws(() => validateUsername('con espacio'), e => e.extra.field === 'username');
  assert.equal(validateDisplayName('  Ana   Pérez '), 'Ana Pérez');
  assert.throws(() => validateDisplayName(''), e => e.extra.field === 'displayName');
  assert.throws(() => validateDisplayName('x'.repeat(41)), e => e.extra.field === 'displayName');
  assert.equal(validatePin('012345'), '012345');
  assert.throws(() => validatePin('12345'), e => e.extra.field === 'pin');
  assert.throws(() => validatePin(123456, 'newPin'), e => e.extra.field === 'newPin');
  assert.equal(validateRole('admin'), 'admin');
  assert.throws(() => validateRole('root'), e => e.extra.field === 'role');
  assert.equal(validateId('7'), 7);
  assert.throws(() => validateId('x'), e => e.status === 404);
});

test('buildAdminInsert genera un INSERT ejecutable con PIN temporal (y escapa comillas)', async () => {
  const { pin, sql } = await buildAdminInsert({ username: 'jefe.cuerda', displayName: "Jefe O'Brien", iterations: 1000, now: new Date('2026-10-01T00:00:00Z'), pin: '135790' });
  assert.equal(pin, '135790');
  assert.equal(sql.includes('135790'), false, 'el PIN no aparece en claro');
  const db = createTestDb();
  db.db.exec(sql);
  const row = await db.prepare('SELECT * FROM users').first();
  assert.equal(row.username, 'jefe.cuerda');
  assert.equal(row.display_name, "Jefe O'Brien");
  assert.equal(row.role, 'admin');
  assert.equal(row.must_change_pin, 1);
  assert.equal(row.created_at, '2026-10-01T00:00:00.000Z');
  assert.equal(await verifyPin('135790', row), true);
});

test('buildAdminInsert rechaza usuario inválido', async () => {
  await assert.rejects(buildAdminInsert({ username: 'a', displayName: 'A', iterations: 1000 }), e => e.extra?.field === 'username');
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd backend && npm test`
Expected: FAIL (`crypto.js`, `validate.js` y `create-admin.mjs` no existen).

- [ ] **Step 3: Implementar `backend/src/crypto.js`**

```js
const enc = new TextEncoder();

export function toBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(str) {
  const s = atob(str);
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

export const toBase64Url = bytes => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
export const newSalt = () => toBase64(randomBytes(16));
export const newToken = () => toBase64Url(randomBytes(32));

export async function hashPin(pin, saltB64, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltB64), iterations }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin, user) {
  return timingSafeEqual(await hashPin(pin, user.pin_salt, user.pin_iterations), user.pin_hash);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 6 dígitos sin sesgo de módulo.
export function randomPin() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1e6) * 1e6;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(buf[0] % 1e6).padStart(6, '0');
}

export function pinIterations(env) {
  const n = Number(env.PIN_ITERATIONS);
  return Number.isInteger(n) && n >= 1000 && n <= 100000 ? n : 20000;
}
```

- [ ] **Step 4: Implementar `backend/src/validate.js`**

```js
import { HttpError } from './http.js';

const bad = field => { throw new HttpError(400, 'invalid', { field }); };

export const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function validateUsername(v, field = 'username') {
  if (typeof v !== 'string') bad(field);
  const u = v.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(u)) bad(field);
  return u;
}

export function validateDisplayName(v, field = 'displayName') {
  if (typeof v !== 'string') bad(field);
  const d = v.trim().replace(/\s+/g, ' ');
  if (d.length < 1 || d.length > 40) bad(field);
  return d;
}

export function validatePin(v, field = 'pin') {
  if (typeof v !== 'string' || !/^\d{6}$/.test(v)) bad(field);
  return v;
}

export function validateRole(v, field = 'role') {
  if (v !== 'tenor' && v !== 'admin') bad(field);
  return v;
}

export function validateId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'not_found');
  return n;
}
```

- [ ] **Step 5: Implementar `backend/tools/create-admin.mjs`**

```js
// Uso: node tools/create-admin.mjs <usuario> "<Nombre visible>" [--iterations 20000] [--out admin-seed.sql]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { hashPin, newSalt, randomPin } from '../src/crypto.js';
import { validateUsername, validateDisplayName } from '../src/validate.js';

const quote = s => `'${String(s).replace(/'/g, "''")}'`;

export async function buildAdminInsert({ username, displayName, iterations, now = new Date(), pin = randomPin(), salt = newSalt() }) {
  const u = validateUsername(username);
  const d = validateDisplayName(displayName);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 100000) throw new Error('--iterations debe estar entre 1000 y 100000');
  const hash = await hashPin(pin, salt, iterations);
  const ts = now.toISOString();
  const sql = `INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, active, must_change_pin, created_at, updated_at)
VALUES (${quote(u)}, ${quote(d)}, ${quote(hash)}, ${quote(salt)}, ${iterations}, 'admin', 1, 1, ${quote(ts)}, ${quote(ts)});`;
  return { pin, sql };
}

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  let iterations = 20000, out = 'admin-seed.sql';
  while (args.length) {
    const a = args.shift();
    if (a === '--iterations') iterations = Number(args.shift());
    else if (a === '--out') out = args.shift();
    else positional.push(a);
  }
  return { username: positional[0], displayName: positional[1], iterations, out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { username, displayName, iterations, out } = parseArgs(process.argv.slice(2));
  if (!username || !displayName) {
    console.error('Uso: node tools/create-admin.mjs <usuario> "<Nombre visible>" [--iterations 20000] [--out admin-seed.sql]');
    process.exit(1);
  }
  try {
    const { pin, sql } = await buildAdminInsert({ username, displayName, iterations });
    writeFileSync(out, `${sql}\n`);
    console.log(`SQL escrito en ${out}`);
    console.log(`PIN temporal de ${username.trim().toLowerCase()}: ${pin}`);
    console.log('Se pedirá cambiarlo en el primer inicio de sesión. Borra el archivo SQL tras usarlo.');
  } catch (err) {
    console.error(err.extra?.field ? `Dato no válido: ${err.extra.field}` : err.message);
    process.exit(1);
  }
}
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `cd backend && npm test`
Expected: PASS (todos los de Task 1 y 2).

- [ ] **Step 7: Commit**

```bash
git add backend/src/crypto.js backend/src/validate.js backend/tools/create-admin.mjs backend/test/crypto.test.js
git commit -m "feat(backend): hash de PIN, tokens, validadores y script del primer administrador"
```

---

### Task 3: Autenticación — login, bloqueo, sesión, logout, `/api/me` y cambio de PIN

**Files:**
- Create: `backend/src/auth.js`, `backend/src/users.js`
- Modify: `backend/src/routes.js`
- Test: `backend/test/auth.test.js`

**Interfaces:**
- Consumes: Task 1 (`HttpError`, `json`, `noContent`, `readJson`), Task 2 (`crypto.js`, `validate.js`).
- Produces:
  - `auth.js`: `SESSION_DAYS = 30`, `RENEW_BELOW_DAYS = 15`, `MAX_FAILURES = 5`, `LOCK_MINUTES = 15`; `publicUser(row) → { id, username, displayName, role, mustChangePin }`; `login(ctx)`, `logout(ctx)`; `requireSession(ctx, { allowPendingPin = false }) → userRow` (también fija `ctx.user`, `ctx.tokenHash`); `requireAdmin(ctx) → userRow` (403 `forbidden` si no es admin).
  - `users.js`: `me(ctx)`, `changePin(ctx)`.
  - Rutas: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`, `POST /api/me/pin`.

- [ ] **Step 1: Escribir el test que falla** — `backend/test/auth.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/app.js';
import { sha256Hex } from '../src/crypto.js';
import { requireSession } from '../src/auth.js';

const MIN = 60_000, DAY = 86_400_000;

test('login correcto devuelve token y usuario; la sesión se guarda hasheada', async () => {
  const t = setup();
  await t.seedUser();
  const r = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } });
  assert.equal(r.status, 200);
  assert.match(r.body.token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(r.body.user, { id: 1, username: 'ana', displayName: 'Ana', role: 'tenor', mustChangePin: false });
  const row = await t.db.prepare('SELECT * FROM sessions').first();
  assert.equal(row.token_hash, await sha256Hex(r.body.token));
  assert.equal(row.expires_at, '2026-10-31T10:00:00.000Z');
});

test('el usuario no distingue mayúsculas', async () => {
  const t = setup();
  await t.seedUser();
  const r = await t.call('POST', '/api/auth/login', { body: { username: '  ANA ', pin: '123456' } });
  assert.equal(r.status, 200);
});

test('PIN erróneo, usuario inexistente e inactivo dan la misma respuesta 401', async () => {
  const t = setup();
  await t.seedUser();
  await t.seedUser({ username: 'baja', active: 0 });
  for (const body of [{ username: 'ana', pin: '000000' }, { username: 'nadie', pin: '123456' }, { username: 'baja', pin: '123456' }]) {
    const r = await t.call('POST', '/api/auth/login', { body });
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { error: 'invalid_credentials' });
  }
});

test('faltan campos → 400 invalid', async () => {
  const t = setup();
  const r = await t.call('POST', '/api/auth/login', { body: { username: 'ana' } });
  assert.deepEqual([r.status, r.body], [400, { error: 'invalid', field: 'pin' }]);
});

test('5 fallos bloquean 15 minutos y el éxito limpia el contador', async () => {
  const t = setup();
  await t.seedUser();
  const bad = () => t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '999999' } });
  for (let i = 0; i < 4; i++) assert.equal((await bad()).status, 401);
  const fifth = await bad();
  assert.deepEqual([fifth.status, fifth.body], [429, { error: 'locked', retryAfter: 900 }]);
  const blocked = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } });
  assert.equal(blocked.status, 429);
  t.advance(15 * MIN + 1000);
  const ok = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } });
  assert.equal(ok.status, 200);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM login_failures').first('n'), 0);
});

test('GET /api/me con y sin token', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  const r = await t.call('GET', '/api/me', { token });
  assert.deepEqual(r.body.user.username, 'ana');
  assert.deepEqual((await t.call('GET', '/api/me')).body, { error: 'unauthorized' });
  assert.equal((await t.call('GET', '/api/me', { token: 'x'.repeat(43) })).status, 401);
});

test('la sesión caduca a los 30 días y se borra', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  t.advance(30 * DAY + 1000);
  assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM sessions').first('n'), 0);
});

test('la sesión se renueva si quedan menos de 15 días', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  t.advance(16 * DAY);
  assert.equal((await t.call('GET', '/api/me', { token })).status, 200);
  assert.equal(await t.db.prepare('SELECT expires_at FROM sessions').first('expires_at'), '2026-11-16T10:00:00.000Z');
});

test('logout invalida el token', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  assert.equal((await t.call('POST', '/api/auth/logout', { token })).status, 204);
  assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
});

test('usuario desactivado pierde el acceso con su sesión abierta', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  await t.db.prepare('UPDATE users SET active = 0').run();
  assert.equal((await t.call('GET', '/api/me', { token })).status, 401);
});

test('must_change_pin: /me funciona pero requireSession sin permiso lanza 403', async () => {
  const t = setup();
  await t.seedUser({ mustChangePin: 1 });
  const token = await t.loginAs();
  const me = await t.call('GET', '/api/me', { token });
  assert.equal(me.body.user.mustChangePin, true);
  const ctx = { request: new Request('http://api.test/x', { headers: { Authorization: `Bearer ${token}` } }), db: t.db, now: new Date(t.clock.now) };
  await assert.rejects(requireSession(ctx), e => e.status === 403 && e.code === 'pin_change_required');
});

test('cambio de PIN: validaciones', async () => {
  const t = setup();
  await t.seedUser({ mustChangePin: 1 });
  const token = await t.loginAs();
  const change = body => t.call('POST', '/api/me/pin', { token, body });
  assert.deepEqual((await change({ currentPin: '000000', newPin: '654321' })).body, { error: 'invalid', field: 'currentPin' });
  assert.deepEqual((await change({ currentPin: '123456', newPin: '12' })).body, { error: 'invalid', field: 'newPin' });
  assert.deepEqual((await change({ currentPin: '123456', newPin: '123456' })).body, { error: 'invalid', field: 'newPin' });
});

test('cambio de PIN correcto: limpia must_change_pin, cierra otras sesiones y conserva la actual', async () => {
  const t = setup();
  await t.seedUser({ mustChangePin: 1 });
  const other = await t.loginAs();
  const token = await t.loginAs();
  const r = await t.call('POST', '/api/me/pin', { token, body: { currentPin: '123456', newPin: '654321' } });
  assert.equal(r.status, 204);
  assert.equal((await t.call('GET', '/api/me', { token })).body.user.mustChangePin, false);
  assert.equal((await t.call('GET', '/api/me', { token: other })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '654321' } })).status, 200);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd backend && npm test`
Expected: FAIL (`auth.js` no existe; rutas 404).

- [ ] **Step 3: Implementar `backend/src/auth.js`**

```js
import { HttpError, json, noContent, readJson } from './http.js';
import { hashPin, newToken, sha256Hex, verifyPin, pinIterations } from './crypto.js';

export const SESSION_DAYS = 30;
export const RENEW_BELOW_DAYS = 15;
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

const DAY = 86_400_000;
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';

export function publicUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, mustChangePin: !!row.must_change_pin };
}

function lockedError(until, now) {
  return new HttpError(429, 'locked', { retryAfter: Math.max(1, Math.ceil((new Date(until) - now) / 1000)) });
}

async function saveFailure(db, username, count, lockedUntil) {
  await db.prepare(`INSERT INTO login_failures (username, failed_count, locked_until) VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until`)
    .bind(username, count, lockedUntil).run();
}

export async function createSession(db, userId, now) {
  const token = newToken();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * DAY).toISOString())
    .run();
  return token;
}

export async function login(ctx) {
  const { db, now, env } = ctx;
  const body = await readJson(ctx.request);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!username) throw new HttpError(400, 'invalid', { field: 'username' });
  if (!pin) throw new HttpError(400, 'invalid', { field: 'pin' });

  const failure = await db.prepare('SELECT failed_count, locked_until FROM login_failures WHERE username = ?').bind(username).first();
  if (failure?.locked_until && new Date(failure.locked_until) > now) throw lockedError(failure.locked_until, now);

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  let ok = false;
  if (user) ok = await verifyPin(pin, user);
  else await hashPin(pin, DUMMY_SALT, pinIterations(env)); // tiempo de respuesta similar

  if (!ok || !user.active) {
    const count = (failure?.failed_count ?? 0) + 1;
    if (count >= MAX_FAILURES) {
      const until = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
      await saveFailure(db, username, 0, until);
      throw lockedError(until, now);
    }
    await saveFailure(db, username, count, failure?.locked_until ?? null);
    throw new HttpError(401, 'invalid_credentials');
  }

  await db.prepare('DELETE FROM login_failures WHERE username = ?').bind(username).run();
  const token = await createSession(db, user.id, now);
  return json(200, { token, user: publicUser(user) });
}

export async function requireSession(ctx, { allowPendingPin = false } = {}) {
  const { db, now } = ctx;
  const header = ctx.request.headers.get('Authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(header);
  if (!m) throw new HttpError(401, 'unauthorized');
  const tokenHash = await sha256Hex(m[1]);
  const row = await db.prepare(`SELECT s.token_hash, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .bind(tokenHash).first();
  if (!row) throw new HttpError(401, 'unauthorized');
  if (new Date(row.expires_at) <= now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    throw new HttpError(401, 'unauthorized');
  }
  if (!row.active) throw new HttpError(401, 'unauthorized');
  if (new Date(row.expires_at) - now < RENEW_BELOW_DAYS * DAY) {
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(new Date(now.getTime() + SESSION_DAYS * DAY).toISOString(), tokenHash).run();
  }
  if (row.must_change_pin && !allowPendingPin) throw new HttpError(403, 'pin_change_required');
  ctx.user = row;
  ctx.tokenHash = tokenHash;
  return row;
}

export async function requireAdmin(ctx) {
  const user = await requireSession(ctx);
  if (user.role !== 'admin') throw new HttpError(403, 'forbidden');
  return user;
}

export async function logout(ctx) {
  await requireSession(ctx, { allowPendingPin: true });
  await ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(ctx.tokenHash).run();
  return noContent();
}
```

- [ ] **Step 4: Implementar `backend/src/users.js`**

```js
import { HttpError, json, noContent, readJson } from './http.js';
import { hashPin, newSalt, verifyPin, pinIterations } from './crypto.js';
import { validatePin } from './validate.js';
import { publicUser, requireSession } from './auth.js';

export async function me(ctx) {
  const user = await requireSession(ctx, { allowPendingPin: true });
  return json(200, { user: publicUser(user) });
}

export async function changePin(ctx) {
  const user = await requireSession(ctx, { allowPendingPin: true });
  const body = await readJson(ctx.request);
  const currentPin = typeof body.currentPin === 'string' ? body.currentPin : '';
  if (!(await verifyPin(currentPin, user))) throw new HttpError(400, 'invalid', { field: 'currentPin' });
  const newPin = validatePin(body.newPin, 'newPin');
  if (newPin === currentPin) throw new HttpError(400, 'invalid', { field: 'newPin' });
  const salt = newSalt();
  const iterations = pinIterations(ctx.env);
  await ctx.db.batch([
    ctx.db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iterations = ?, must_change_pin = 0, updated_at = ? WHERE id = ?')
      .bind(await hashPin(newPin, salt, iterations), salt, iterations, ctx.now.toISOString(), user.id),
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').bind(user.id, ctx.tokenHash),
  ]);
  return noContent();
}
```

- [ ] **Step 5: Registrar rutas** — `backend/src/routes.js` queda:

```js
import { json } from './http.js';
import { login, logout } from './auth.js';
import { me, changePin } from './users.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['GET', '/api/me', me],
  ['POST', '/api/me/pin', changePin],
];
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth.js backend/src/users.js backend/src/routes.js backend/test/auth.test.js
git commit -m "feat(backend): login con PIN, bloqueo, sesiones y cambio de PIN"
```

---

### Task 4: Intentos — guardar, listar y resumen propio

**Files:**
- Create: `backend/src/songs.js`, `backend/src/attempts.js`
- Modify: `backend/src/users.js` (añadir `mySummary`, `myAttempts`), `backend/src/routes.js`
- Modify: `backend/test/helpers/app.js` (añadir `attemptPayload`, `insertAttempt`)
- Test: `backend/test/attempts.test.js`

**Interfaces:**
- Consumes: `requireSession` (Task 3), `isInt` (Task 2).
- Produces:
  - `SONG_IDS` (12 ids en el orden de `app.js`).
  - `attempts.js`: `validateAttempt(body) → row-ready object`, `createAttempt(ctx)`, `rowToAttempt(row) → { id, songId, mode, phraseFrom, phraseTo, isFull, scores:{total,pitch,rhythm,stability}, coverage, phrases, tips, engineVersion, createdAt }`, `attemptsPage(db, userId, url) → { attempts, next }`, `userSummary(db, userId) → { songs:[{ songId, attempts, best, last, lastAt, weakest }] }`, `weakestMetric(rows) → 'pitch'|'rhythm'|'stability'|null`.
  - Rutas: `POST /api/attempts`, `GET /api/me/attempts`, `GET /api/me/summary`.
  - Helpers de test: `attemptPayload(overrides?)`, `insertAttempt(db, { userId, songId, mode, isFull, total, pitch, rhythm, stability, createdAt })`.

- [ ] **Step 1: Ampliar `backend/test/helpers/app.js`** (añadir al final)

```js
export function attemptPayload(overrides = {}) {
  const base = {
    engineVersion: '1.0.0',
    songId: 'fum',
    mode: 'test',
    phraseFrom: 1,
    phraseTo: 14,
    isFull: true,
    valid: true,
    coverage: 0.94,
    scores: { total: 82, pitch: 85, rhythm: 78, stability: 80 },
    phrases: [{ index: 1, start: 1.2, end: 7.1, pitch: 90, rhythm: 70, stability: null, coverage: 1 }],
    tips: [{ kind: 'pitch-bias', phrase: 3, text: 'Frase 3 (0:24–0:31): tiendes a quedarte ~35 cents bajo.' }],
  };
  return { ...base, ...overrides, scores: { ...base.scores, ...(overrides.scores || {}) } };
}

export async function insertAttempt(db, { userId, songId = 'fum', mode = 'test', isFull = 1, total = 80, pitch = 80, rhythm = 80, stability = 80, createdAt }) {
  const r = await db.prepare(`INSERT INTO attempts (user_id, song_id, mode, phrase_from, phrase_to, is_full, score_total, score_pitch, score_rhythm, score_stability, coverage, phrase_scores, tips, engine_version, created_at)
    VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, 1, '[]', '[]', '1.0.0', ?)`)
    .bind(userId, songId, mode, isFull, total, pitch, rhythm, stability, createdAt).run();
  return r.meta.last_row_id;
}
```

- [ ] **Step 2: Escribir el test que falla** — `backend/test/attempts.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, attemptPayload, insertAttempt } from './helpers/app.js';
import { weakestMetric } from '../src/attempts.js';

async function tenor(t, username = 'ana') {
  await t.seedUser({ username });
  return t.loginAs(username);
}

test('guardar un intento válido → 201 y se almacena saneado', async () => {
  const t = setup();
  const token = await tenor(t);
  const payload = { ...attemptPayload(), curves: { ref: [1, 2] }, extra: 'x' };
  const r = await t.call('POST', '/api/attempts', { token, body: payload });
  assert.deepEqual([r.status, r.body], [201, { id: 1 }]);
  const row = await t.db.prepare('SELECT * FROM attempts').first();
  assert.equal(row.song_id, 'fum');
  assert.equal(row.is_full, 1);
  assert.equal(row.score_stability, 80);
  assert.equal(row.created_at, '2026-10-01T10:00:00.000Z');
  assert.deepEqual(JSON.parse(row.phrase_scores), payload.phrases);
  assert.deepEqual(JSON.parse(row.tips), payload.tips);
});

test('guardar exige sesión y PIN definitivo', async () => {
  const t = setup();
  assert.equal((await t.call('POST', '/api/attempts', { body: attemptPayload() })).status, 401);
  await t.seedUser({ username: 'nuevo', mustChangePin: 1 });
  const token = await t.loginAs('nuevo');
  const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload() });
  assert.deepEqual([r.status, r.body], [403, { error: 'pin_change_required' }]);
});

test('validación de cada campo', async () => {
  const t = setup();
  const token = await tenor(t);
  const cases = [
    [{ songId: 'otra' }, 'songId'],
    [{ mode: 'libre' }, 'mode'],
    [{ valid: false }, 'valid'],
    [{ phraseFrom: 0 }, 'phraseFrom'],
    [{ phraseFrom: 5, phraseTo: 4 }, 'phraseTo'],
    [{ isFull: 1 }, 'isFull'],
    [{ scores: { total: 101 } }, 'scores.total'],
    [{ scores: { pitch: 1.5 } }, 'scores.pitch'],
    [{ scores: { stability: 'x' } }, 'scores.stability'],
    [{ coverage: 1.2 }, 'coverage'],
    [{ phrases: Array.from({ length: 101 }, (_, i) => ({ index: 1, start: i, end: i + 1, pitch: 1, rhythm: 1, stability: null, coverage: 1 })) }, 'phrases'],
    [{ phrases: [{ index: 1, start: 'a' }] }, 'phrases'],
    [{ tips: Array.from({ length: 6 }, () => ({ kind: 'x', phrase: null, text: 't' })) }, 'tips'],
    [{ tips: [{ kind: 'x', phrase: null, text: 'y'.repeat(201) }] }, 'tips'],
    [{ engineVersion: 'v1' }, 'engineVersion'],
  ];
  for (const [override, field] of cases) {
    const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload(override) });
    assert.deepEqual([r.status, r.body], [400, { error: 'invalid', field }], `campo ${field}`);
  }
  const huge = await t.call('POST', '/api/attempts', { token, body: { ...attemptPayload(), pad: 'x'.repeat(33 * 1024) } });
  assert.deepEqual(huge.body, { error: 'invalid', field: 'body' });
});

test('stability null se acepta', async () => {
  const t = setup();
  const token = await tenor(t);
  const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload({ scores: { stability: null } }) });
  assert.equal(r.status, 201);
});

test('como máximo un intento cada 10 s', async () => {
  const t = setup();
  const token = await tenor(t);
  assert.equal((await t.call('POST', '/api/attempts', { token, body: attemptPayload() })).status, 201);
  t.advance(4000);
  const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload() });
  assert.deepEqual([r.status, r.body], [429, { error: 'too_fast', retryAfter: 6 }]);
  t.advance(6000);
  assert.equal((await t.call('POST', '/api/attempts', { token, body: attemptPayload() })).status, 201);
});

test('GET /api/me/attempts: orden, filtro, paginación y aislamiento', async () => {
  const t = setup();
  const token = await tenor(t);
  const otherId = await t.seedUser({ username: 'luis' });
  const anaId = 1;
  for (let i = 0; i < 5; i++) await insertAttempt(t.db, { userId: anaId, songId: i % 2 ? 'dona' : 'fum', total: 60 + i, createdAt: `2026-09-0${i + 1}T10:00:00.000Z` });
  await insertAttempt(t.db, { userId: otherId, createdAt: '2026-09-09T10:00:00.000Z' });

  const all = await t.call('GET', '/api/me/attempts', { token });
  assert.deepEqual(all.body.attempts.map(a => a.scores.total), [64, 63, 62, 61, 60]);
  assert.equal(all.body.next, null);
  assert.deepEqual(Object.keys(all.body.attempts[0]).sort(), ['coverage', 'createdAt', 'engineVersion', 'id', 'isFull', 'mode', 'phraseFrom', 'phraseTo', 'phrases', 'scores', 'songId', 'tips'].sort());

  const dona = await t.call('GET', '/api/me/attempts?song=dona', { token });
  assert.deepEqual(dona.body.attempts.map(a => a.songId), ['dona', 'dona']);

  const page1 = await t.call('GET', '/api/me/attempts?limit=2', { token });
  assert.equal(page1.body.attempts.length, 2);
  const page2 = await t.call('GET', `/api/me/attempts?limit=2&before=${page1.body.next}`, { token });
  assert.deepEqual(page2.body.attempts.map(a => a.scores.total), [62, 61]);

  assert.deepEqual((await t.call('GET', '/api/me/attempts?song=xx', { token })).body, { error: 'invalid', field: 'song' });
  assert.deepEqual((await t.call('GET', '/api/me/attempts?limit=0', { token })).body, { error: 'invalid', field: 'limit' });
});

test('GET /api/me/summary agrupa por canción', async () => {
  const t = setup();
  const token = await tenor(t);
  await insertAttempt(t.db, { userId: 1, songId: 'fum', total: 70, pitch: 60, rhythm: 90, stability: 80, createdAt: '2026-09-01T10:00:00.000Z' });
  await insertAttempt(t.db, { userId: 1, songId: 'fum', total: 85, pitch: 70, rhythm: 95, stability: null, createdAt: '2026-09-02T10:00:00.000Z' });
  await insertAttempt(t.db, { userId: 1, songId: 'dona', total: 50, pitch: 90, rhythm: 40, stability: 70, createdAt: '2026-09-03T10:00:00.000Z' });
  const r = await t.call('GET', '/api/me/summary', { token });
  assert.deepEqual(r.body, {
    songs: [
      { songId: 'dona', attempts: 1, best: 50, last: 50, lastAt: '2026-09-03T10:00:00.000Z', weakest: 'rhythm' },
      { songId: 'fum', attempts: 2, best: 85, last: 85, lastAt: '2026-09-02T10:00:00.000Z', weakest: 'pitch' },
    ],
  });
});

test('weakestMetric ignora stability null y usa los últimos 5', () => {
  const row = (p, r, s) => ({ score_pitch: p, score_rhythm: r, score_stability: s });
  assert.equal(weakestMetric([row(90, 80, null), row(90, 80, null)]), 'rhythm');
  assert.equal(weakestMetric([row(50, 80, 90)]), 'pitch');
  assert.equal(weakestMetric([]), null);
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `cd backend && npm test`
Expected: FAIL (`attempts.js` no existe; rutas 404).

- [ ] **Step 4: Implementar `backend/src/songs.js`**

```js
// Ids de SONGS en app.js (mismo orden). Si se añade una canción, añadirla aquí.
export const SONG_IDS = ['fum', 'adeste', 'dona', 'fuentecilla', 'campanas', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];
```

- [ ] **Step 5: Implementar `backend/src/attempts.js`**

```js
import { HttpError, json, readJson } from './http.js';
import { isInt } from './validate.js';
import { requireSession } from './auth.js';
import { SONG_IDS } from './songs.js';

const MIN_INTERVAL_MS = 10_000;
const bad = field => { throw new HttpError(400, 'invalid', { field }); };
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = v => v === null || isNum(v);
const isScore = v => isInt(v, 0, 100);

function cleanPhrase(p) {
  if (!p || !isInt(p.index, 1, 100) || !isNum(p.start) || !isNum(p.end) || !isNumOrNull(p.pitch)
    || !isNumOrNull(p.rhythm) || !isNumOrNull(p.stability) || !isNum(p.coverage)) return null;
  return { index: p.index, start: p.start, end: p.end, pitch: p.pitch, rhythm: p.rhythm, stability: p.stability, coverage: p.coverage };
}

function cleanTip(t) {
  if (!t || typeof t.kind !== 'string' || t.kind.length > 20 || typeof t.text !== 'string' || t.text.length > 200
    || !(t.phrase === null || isInt(t.phrase, 1, 100))) return null;
  return { kind: t.kind, phrase: t.phrase, text: t.text };
}

export function validateAttempt(b) {
  if (!SONG_IDS.includes(b.songId)) bad('songId');
  if (b.mode !== 'guide' && b.mode !== 'test') bad('mode');
  if (b.valid !== true) bad('valid');
  if (!isInt(b.phraseFrom, 1, 100)) bad('phraseFrom');
  if (!isInt(b.phraseTo, b.phraseFrom, 100)) bad('phraseTo');
  if (typeof b.isFull !== 'boolean') bad('isFull');
  const s = b.scores && typeof b.scores === 'object' ? b.scores : {};
  for (const k of ['total', 'pitch', 'rhythm']) if (!isScore(s[k])) bad(`scores.${k}`);
  if (s.stability !== null && !isScore(s.stability)) bad('scores.stability');
  if (!isNum(b.coverage) || b.coverage < 0 || b.coverage > 1) bad('coverage');
  if (!Array.isArray(b.phrases) || b.phrases.length > 100) bad('phrases');
  const phrases = b.phrases.map(cleanPhrase);
  if (phrases.includes(null)) bad('phrases');
  if (!Array.isArray(b.tips) || b.tips.length > 5) bad('tips');
  const tips = b.tips.map(cleanTip);
  if (tips.includes(null)) bad('tips');
  if (typeof b.engineVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(b.engineVersion)) bad('engineVersion');
  return {
    songId: b.songId, mode: b.mode, phraseFrom: b.phraseFrom, phraseTo: b.phraseTo, isFull: b.isFull ? 1 : 0,
    total: s.total, pitch: s.pitch, rhythm: s.rhythm, stability: s.stability,
    coverage: b.coverage, phrases, tips, engineVersion: b.engineVersion,
  };
}

export async function createAttempt(ctx) {
  const user = await requireSession(ctx);
  const a = validateAttempt(await readJson(ctx.request));
  const last = await ctx.db.prepare('SELECT created_at FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT 1').bind(user.id).first();
  if (last) {
    const wait = MIN_INTERVAL_MS - (ctx.now - new Date(last.created_at));
    if (wait > 0) throw new HttpError(429, 'too_fast', { retryAfter: Math.ceil(wait / 1000) });
  }
  const r = await ctx.db.prepare(`INSERT INTO attempts (user_id, song_id, mode, phrase_from, phrase_to, is_full, score_total, score_pitch, score_rhythm, score_stability, coverage, phrase_scores, tips, engine_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(user.id, a.songId, a.mode, a.phraseFrom, a.phraseTo, a.isFull, a.total, a.pitch, a.rhythm, a.stability,
      a.coverage, JSON.stringify(a.phrases), JSON.stringify(a.tips), a.engineVersion, ctx.now.toISOString())
    .run();
  return json(201, { id: r.meta.last_row_id });
}

export function rowToAttempt(row) {
  return {
    id: row.id,
    songId: row.song_id,
    mode: row.mode,
    phraseFrom: row.phrase_from,
    phraseTo: row.phrase_to,
    isFull: !!row.is_full,
    scores: { total: row.score_total, pitch: row.score_pitch, rhythm: row.score_rhythm, stability: row.score_stability },
    coverage: row.coverage,
    phrases: JSON.parse(row.phrase_scores),
    tips: JSON.parse(row.tips),
    engineVersion: row.engine_version,
    createdAt: row.created_at,
  };
}

function intParam(url, name, fallback, lo, hi) {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!isInt(n, lo, hi)) bad(name);
  return n;
}

export async function attemptsPage(db, userId, url) {
  const song = url.searchParams.get('song');
  if (song !== null && !SONG_IDS.includes(song)) bad('song');
  const limit = intParam(url, 'limit', 50, 1, 100);
  const before = intParam(url, 'before', null, 1, Number.MAX_SAFE_INTEGER);
  const where = ['user_id = ?'];
  const params = [userId];
  if (song) { where.push('song_id = ?'); params.push(song); }
  if (before) { where.push('id < ?'); params.push(before); }
  const { results } = await db.prepare(`SELECT * FROM attempts WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`)
    .bind(...params, limit + 1).all();
  const page = results.slice(0, limit);
  return { attempts: page.map(rowToAttempt), next: results.length > limit ? page[page.length - 1].id : null };
}

export function weakestMetric(rows) {
  let weakest = null;
  for (const [name, col] of [['pitch', 'score_pitch'], ['rhythm', 'score_rhythm'], ['stability', 'score_stability']]) {
    const values = rows.map(r => r[col]).filter(v => v != null);
    if (!values.length) continue;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (!weakest || avg < weakest.avg) weakest = { name, avg };
  }
  return weakest ? weakest.name : null;
}

export async function userSummary(db, userId) {
  const { results } = await db.prepare('SELECT song_id, score_total, score_pitch, score_rhythm, score_stability, created_at FROM attempts WHERE user_id = ? ORDER BY id DESC')
    .bind(userId).all();
  const bySong = new Map();
  for (const r of results) {
    if (!bySong.has(r.song_id)) bySong.set(r.song_id, []);
    bySong.get(r.song_id).push(r);
  }
  const songs = [...bySong].map(([songId, rows]) => ({
    songId,
    attempts: rows.length,
    best: Math.max(...rows.map(r => r.score_total)),
    last: rows[0].score_total,
    lastAt: rows[0].created_at,
    weakest: weakestMetric(rows.slice(0, 5)),
  }));
  return { songs };
}
```

- [ ] **Step 6: Añadir a `backend/src/users.js`**

```js
import { attemptsPage, userSummary } from './attempts.js';

export async function myAttempts(ctx) {
  const user = await requireSession(ctx);
  return json(200, await attemptsPage(ctx.db, user.id, ctx.url));
}

export async function mySummary(ctx) {
  const user = await requireSession(ctx);
  return json(200, await userSummary(ctx.db, user.id));
}
```
(El `import` va al principio del archivo, junto a los existentes.)

- [ ] **Step 7: Registrar rutas** — en `backend/src/routes.js` cambiar los imports y añadir entradas:

```js
import { json } from './http.js';
import { login, logout } from './auth.js';
import { me, changePin, myAttempts, mySummary } from './users.js';
import { createAttempt } from './attempts.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['GET', '/api/me', me],
  ['POST', '/api/me/pin', changePin],
  ['GET', '/api/me/attempts', myAttempts],
  ['GET', '/api/me/summary', mySummary],
  ['POST', '/api/attempts', createAttempt],
];
```

- [ ] **Step 8: Ejecutar y verificar que pasa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(backend): guardar intentos, listado paginado y resumen por canción"
```

---

### Task 5: Puesta en marcha local (wrangler dev) y servidor estático

**Files:**
- Create: `backend/README.md` (sección "Puesta en marcha local"; la de despliegue se añade en Task 12)
- Create: `tools/serve.mjs`
- Modify: `package.json` (raíz: script `serve`)

**Interfaces:**
- Consumes: todo el backend de Tasks 1–4.
- Produces: `npm run serve` (web en `http://127.0.0.1:8000`) y `npm run dev` en `backend/` (API en `http://127.0.0.1:8787`).

- [ ] **Step 1: Servidor estático** — `tools/serve.mjs`

```js
// Servidor estático de desarrollo: node tools/serve.mjs [puerto]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] || 8000);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(normalize(root + sep)) && file !== normalize(root)) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(err.code === 'ENOENT' ? 'No encontrado' : 'Error');
  }
}).listen(port, '127.0.0.1', () => console.log(`Web en http://127.0.0.1:${port}/`));
```

En `package.json` (raíz), dentro de `scripts`, añadir:
```json
"serve": "node tools/serve.mjs 8000"
```

- [ ] **Step 2: Instalar Wrangler y preparar la base local**

Run:
```bash
cd backend
npm install
npm run db:migrate:local
node tools/create-admin.mjs admin "Jefe de cuerda" --iterations 20000
npx wrangler d1 execute tenores --local --file admin-seed.sql
```
Expected: la migración `0001_init.sql` se aplica; el script imprime el PIN temporal; `execute` informa 1 fila escrita. Anota el PIN en el informe de la tarea (es solo de desarrollo local).

- [ ] **Step 3: Prueba de humo con la API real en local**

Run (en segundo plano): `cd backend && npm run dev`
Después:
```bash
curl -s http://127.0.0.1:8787/api/health
curl -s -X POST http://127.0.0.1:8787/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","pin":"<PIN TEMPORAL>"}'
curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: https://evil.test" http://127.0.0.1:8787/api/health
```
Expected: `{"ok":true}`; login devuelve `token` y `"mustChangePin":true`; el origen ajeno da `403`. Detén `wrangler dev` al terminar.

- [ ] **Step 4: Documentar** — `backend/README.md`

````markdown
# API de Tenores (Cloudflare Worker + D1)

## Puesta en marcha local

Requisitos: Node 22 o superior.

```bash
cd backend
npm install                       # instala Wrangler (solo desarrollo)
npm run db:migrate:local          # crea las tablas en la base local (.wrangler/)
node tools/create-admin.mjs admin "Jefe de cuerda"
npx wrangler d1 execute tenores --local --file admin-seed.sql
rm admin-seed.sql                 # contiene el hash del PIN temporal
npm run dev                       # API en http://127.0.0.1:8787
```

En otra terminal, desde la raíz del repositorio:

```bash
npm run serve                     # web en http://127.0.0.1:8000
```

Abre http://127.0.0.1:8000, menú ☰ → **Práctica → Entrar**, usa `admin` y el PIN temporal; te pedirá elegir uno nuevo.

Tests del backend: `cd backend && npm test`. Tests del motor y del frontend: `npm test` en la raíz.

Para empezar de cero en local: borra la carpeta `backend/.wrangler/` y repite desde `npm run db:migrate:local`.
````

- [ ] **Step 5: Commit**

```bash
git add tools/serve.mjs package.json backend/README.md backend/package-lock.json
git commit -m "chore: servidor estático local y guía de puesta en marcha del backend"
```

---

### Task 6: Cliente del backend — configuración, sesión, API y formato

**Files:**
- Create: `practice/config.js`, `practice/session.js`, `practice/api.js`, `practice/format.js`
- Test: `test/session.test.js`, `test/api.test.js`, `test/format.test.js`

**Interfaces:**
- Consumes: el contrato HTTP de Tasks 3–4 (y 9–10 para `api.admin`).
- Produces:
  - `config.js`: `PRODUCTION_API = ''`, `resolveApiBase(hostname) → string`, `API_BASE`, `apiEnabled`.
  - `session.js`: `configureStorage(storage)`, `getSession() → { token, user } | null`, `setSession(s)`, `updateUser(user)`, `clearSession()`, `onSessionChange(fn) → unsubscribe`.
  - `api.js`: `ApiError(status, code, message, extra)` (con `retryAfter`, `field` si vienen), `messageFor(code, extra)`, `request(method, path, body?, { timeoutMs, base })`, `query(params) → '?a=b' | ''`, `toAttemptPayload(result)` (quita `curves`), y `api` con `login`, `logout`, `me`, `changePin`, `saveAttempt`, `myAttempts({ song, before })`, `mySummary()`; `api.admin` = `users(active)`, `createUser(data)`, `updateUser(id, data)`, `resetPin(id)`, `deleteUser(id, confirmUsername)`, `userAttempts(id, { song, before })`, `userSummary(id)`, `team()`, `ranking(song, since)`.
  - `format.js`: `esc(v)`, `METRIC_LABELS`, `modeLabel(mode)`, `rangeLabel(attempt)`, `trendSymbol(t)`, `seasonStart(now)`, `sinceFor(period, now)`, `daysSince(iso, now)`, `formatDateTime(iso)`, `formatDate(iso)`, `songTitle(id)`.

- [ ] **Step 1: Escribir los tests que fallan**

`test/session.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureStorage, getSession, setSession, updateUser, clearSession, onSessionChange } from '../practice/session.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

test('guarda, lee, actualiza y borra la sesión con aviso de cambio', () => {
  const store = memoryStorage();
  configureStorage(store);
  const seen = [];
  const off = onSessionChange(s => seen.push(s?.user?.displayName ?? null));
  assert.equal(getSession(), null);
  setSession({ token: 't', user: { id: 1, displayName: 'Ana' } });
  assert.equal(getSession().token, 't');
  assert.match(store.m.get('tenores.session'), /"token":"t"/);
  updateUser({ id: 1, displayName: 'Ana P.' });
  clearSession();
  assert.equal(getSession(), null);
  off();
  setSession({ token: 'x', user: { id: 2, displayName: 'Luis' } });
  assert.deepEqual(seen, ['Ana', 'Ana P.', null]);
  clearSession();
});

test('almacenamiento corrupto o que lanza no rompe', () => {
  configureStorage({ getItem: () => '{no json', setItem() { throw new Error('lleno'); }, removeItem() { throw new Error('x'); } });
  assert.equal(getSession(), null);
  setSession({ token: 't', user: { id: 1 } });
  assert.equal(getSession().token, 't');
  clearSession();
  assert.equal(getSession(), null);
});
```

`test/api.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, toAttemptPayload, query, messageFor, ApiError } from '../practice/api.js';
import { configureStorage, setSession, getSession, clearSession } from '../practice/session.js';
import { resolveApiBase } from '../practice/config.js';

const BASE = 'http://api.test';
configureStorage({ getItem: () => null, setItem() {}, removeItem() {} });

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  return calls;
}
const jsonResponse = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('envía el token y el cuerpo JSON', async () => {
  setSession({ token: 'tok', user: { id: 1 } });
  const calls = stubFetch(() => jsonResponse(201, { id: 9 }));
  const r = await request('POST', '/api/attempts', { a: 1 }, { base: BASE });
  assert.deepEqual(r, { id: 9 });
  assert.equal(calls[0].url, 'http://api.test/api/attempts');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(calls[0].init.body, '{"a":1}');
  clearSession();
});

test('204 devuelve null', async () => {
  stubFetch(() => new Response(null, { status: 204 }));
  assert.equal(await request('POST', '/api/auth/logout', undefined, { base: BASE }), null);
});

test('error del servidor → ApiError con mensaje en español y extras', async () => {
  stubFetch(() => jsonResponse(429, { error: 'too_fast', retryAfter: 6 }));
  await assert.rejects(request('POST', '/api/attempts', {}, { base: BASE }), e =>
    e instanceof ApiError && e.status === 429 && e.code === 'too_fast' && e.retryAfter === 6 && e.message === 'Espera unos segundos antes de guardar otro intento.');
});

test('401 con sesión abierta borra la sesión', async () => {
  setSession({ token: 'tok', user: { id: 1 } });
  stubFetch(() => jsonResponse(401, { error: 'unauthorized' }));
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE }), e => e.code === 'unauthorized');
  assert.equal(getSession(), null);
});

test('sin conexión → network; tiempo agotado → timeout', async () => {
  stubFetch(() => { throw new TypeError('fetch failed'); });
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE }), e => e.code === 'network' && e.status === 0 && e.message === 'No se pudo conectar con el servidor.');
  stubFetch((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortError' })))));
  await assert.rejects(request('GET', '/api/me', undefined, { base: BASE, timeoutMs: 20 }), e => e.code === 'timeout');
});

test('bloqueo con minutos restantes', () => {
  assert.equal(messageFor('locked', { retryAfter: 600 }), 'Demasiados intentos. Vuelve a intentarlo en 10 min.');
  assert.equal(messageFor('desconocido'), 'Error del servidor. Inténtalo de nuevo.');
});

test('toAttemptPayload quita las curvas y query omite vacíos', () => {
  const p = toAttemptPayload({ songId: 'fum', curves: { ref: [] }, scores: { total: 1 } });
  assert.deepEqual(p, { songId: 'fum', scores: { total: 1 } });
  assert.equal(query({ song: 'fum', before: null, x: '' }), '?song=fum');
  assert.equal(query({}), '');
});

test('resolveApiBase: local usa wrangler dev; producción sin configurar queda vacía', () => {
  assert.equal(resolveApiBase('127.0.0.1'), 'http://127.0.0.1:8787');
  assert.equal(resolveApiBase('localhost'), 'http://127.0.0.1:8787');
  assert.equal(resolveApiBase('tenores.github.io'), '');
});
```

`test/format.test.js`:
```js
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL (módulos no encontrados).

- [ ] **Step 3: Implementar `practice/config.js`**

```js
// URL del backend. En local se usa `wrangler dev`; en producción se rellena PRODUCTION_API
// al desplegar (ver backend/README.md). Vacío = backend desactivado: la práctica funciona
// igual pero sin login ni guardado.
export const PRODUCTION_API = '';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function resolveApiBase(hostname = globalThis.location?.hostname ?? '') {
  return LOCAL_HOSTS.includes(hostname) ? 'http://127.0.0.1:8787' : PRODUCTION_API;
}

export const API_BASE = resolveApiBase();
export const apiEnabled = API_BASE !== '';
```

- [ ] **Step 4: Implementar `practice/session.js`**

```js
const KEY = 'tenores.session';
const events = new EventTarget();
let storage = () => globalThis.localStorage;
let cache; // undefined = aún no leído

function read() {
  try {
    const raw = storage()?.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value.token === 'string' && value.user ? value : null;
  } catch {
    return null;
  }
}

const emit = () => events.dispatchEvent(new Event('change'));

export function configureStorage(store) {
  storage = () => store;
  cache = undefined;
}

export function getSession() {
  if (cache === undefined) cache = read();
  return cache;
}

export function setSession(session) {
  cache = session;
  try { storage()?.setItem(KEY, JSON.stringify(session)); } catch { /* sin almacenamiento: solo en memoria */ }
  emit();
}

export function updateUser(user) {
  const current = getSession();
  if (current) setSession({ ...current, user });
}

export function clearSession() {
  const had = getSession() !== null;
  cache = null;
  try { storage()?.removeItem(KEY); } catch { /* nada que borrar */ }
  if (had) emit();
}

export function onSessionChange(fn) {
  const handler = () => fn(getSession());
  events.addEventListener('change', handler);
  return () => events.removeEventListener('change', handler);
}
```

- [ ] **Step 5: Implementar `practice/api.js`**

```js
import { API_BASE } from './config.js';
import { getSession, clearSession } from './session.js';

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

const MESSAGES = {
  invalid_credentials: 'Usuario o PIN incorrectos.',
  locked: 'Demasiados intentos. Vuelve a intentarlo más tarde.',
  unauthorized: 'Tu sesión ha caducado. Vuelve a entrar.',
  pin_change_required: 'Tienes que elegir un PIN nuevo antes de continuar.',
  forbidden: 'No tienes permiso para hacer esto.',
  too_fast: 'Espera unos segundos antes de guardar otro intento.',
  username_taken: 'Ese nombre de usuario ya existe.',
  self_action: 'No puedes hacer eso con tu propio usuario.',
  last_admin: 'Debe quedar al menos un administrador activo.',
  not_found: 'No se encontró lo que buscabas.',
  invalid: 'Hay datos no válidos.',
  network: 'No se pudo conectar con el servidor.',
  timeout: 'El servidor tardó demasiado en responder.',
  server_error: 'Error del servidor. Inténtalo de nuevo.',
};

export function messageFor(code, extra = {}) {
  if (code === 'locked' && extra.retryAfter) return `Demasiados intentos. Vuelve a intentarlo en ${Math.ceil(extra.retryAfter / 60)} min.`;
  return MESSAGES[code] || MESSAGES.server_error;
}

export async function request(method, path, body, { timeoutMs = 10_000, base = API_BASE } = {}) {
  const session = getSession();
  const headers = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    const code = err && err.name === 'AbortError' ? 'timeout' : 'network';
    throw new ApiError(0, code, messageFor(code));
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const { error = 'server_error', ...extra } = data || {};
    if (res.status === 401 && session) clearSession();
    throw new ApiError(res.status, error, messageFor(error, extra), extra);
  }
  return data;
}

export function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function toAttemptPayload(result) {
  const { curves, ...rest } = result;
  return rest;
}

export const api = {
  login: (username, pin) => request('POST', '/api/auth/login', { username, pin }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/me'),
  changePin: (currentPin, newPin) => request('POST', '/api/me/pin', { currentPin, newPin }),
  saveAttempt: result => request('POST', '/api/attempts', toAttemptPayload(result)),
  myAttempts: ({ song, before } = {}) => request('GET', `/api/me/attempts${query({ song, before, limit: 100 })}`),
  mySummary: () => request('GET', '/api/me/summary'),
  admin: {
    users: (active = 'all') => request('GET', `/api/admin/users${query({ active })}`),
    createUser: data => request('POST', '/api/admin/users', data),
    updateUser: (id, data) => request('PATCH', `/api/admin/users/${id}`, data),
    resetPin: id => request('POST', `/api/admin/users/${id}/reset-pin`),
    deleteUser: (id, confirmUsername) => request('DELETE', `/api/admin/users/${id}`, { confirmUsername }),
    userAttempts: (id, { song, before } = {}) => request('GET', `/api/admin/users/${id}/attempts${query({ song, before, limit: 100 })}`),
    userSummary: id => request('GET', `/api/admin/users/${id}/summary`),
    team: () => request('GET', '/api/admin/team'),
    ranking: (song, since) => request('GET', `/api/admin/ranking${query({ song, since })}`),
  },
};
```

- [ ] **Step 6: Implementar `practice/format.js`**

```js
const DAY = 86_400_000;

export const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const METRIC_LABELS = { pitch: 'Afinación', rhythm: 'Ritmo y entradas', stability: 'Estabilidad' };

export const modeLabel = mode => (mode === 'test' ? 'A prueba' : 'Con guía');

export function rangeLabel(a) {
  if (a.isFull) return 'Completa';
  return a.phraseFrom === a.phraseTo ? `Frase ${a.phraseFrom}` : `Frases ${a.phraseFrom}–${a.phraseTo}`;
}

export function trendSymbol(t) {
  if (t == null) return '–';
  if (t > 0) return `↑ ${t}`;
  if (t < 0) return `↓ ${Math.abs(t)}`;
  return '= 0';
}

export function seasonStart(now = new Date()) {
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 8, 1));
}

export function sinceFor(period, now = new Date()) {
  if (period === '7d') return new Date(now.getTime() - 7 * DAY).toISOString();
  if (period === '30d') return new Date(now.getTime() - 30 * DAY).toISOString();
  return seasonStart(now).toISOString();
}

export function daysSince(iso, now = new Date()) {
  return iso ? Math.floor((now.getTime() - Date.parse(iso)) / DAY) : null;
}

export const formatDateTime = iso => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatDate = iso => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

export function songTitle(id) {
  return (typeof SONGS !== 'undefined' && SONGS[id] && SONGS[id].title) || id;
}
```

- [ ] **Step 7: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS (los 76 anteriores más los nuevos).

- [ ] **Step 8: Commit**

```bash
git add practice/config.js practice/session.js practice/api.js practice/format.js test/session.test.js test/api.test.js test/format.test.js
git commit -m "feat(practica): cliente del backend, sesión y utilidades de formato"
```

---

### Task 7: Diálogos, login y menú "Práctica"

**Files:**
- Create: `practice/sheet.js`, `practice/login-ui.js`, `practice/menu.js`
- Modify: `practice/main.js` (montar el menú), `practice/practice.css` (añadir estilos al final)

**Interfaces:**
- Consumes: `api`, `ApiError` (Task 6), `getSession`, `setSession`, `updateUser`, `clearSession`, `onSessionChange` (Task 6), `apiEnabled` (Task 6), `esc` (Task 6).
- Produces:
  - `sheet.js`: `openSheet({ title, eyebrow = '', wide = false, onClose }) → { root, panel, body, setTitle(t), close() }` (apilable; Esc y Tab gestionados en fase de captura por el diálogo superior), `focusFirst(root)`.
  - `login-ui.js`: `openLogin() → Promise<boolean>` (true si quedó con sesión y PIN definitivo), `openPinChange() → Promise<boolean>`.
  - `menu.js`: `mountPracticeMenu({ onProgress, onAdmin })`. Las entradas son `button.quick-menu__item[data-practice-action]` con valores `login`, `pin`, `progress`, `admin`, `logout`.
  - `main.js` monta el menú si `apiEnabled`, pasando `openMyProgress` (Task 8) y `openAdmin` (Task 11). En esta tarea `onProgress`/`onAdmin` son funciones que no hacen nada si aún no existen (ver Step 4).

- [ ] **Step 1: `practice/sheet.js`**

```js
const stack = [];
let counter = 0;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

export function focusFirst(root) {
  const el = [...root.querySelectorAll(FOCUSABLE)].find(e => e.offsetParent !== null);
  (el || root).focus({ preventScroll: true });
}

// Captura en document: el diálogo superior gestiona Esc/Tab antes que el panel de práctica.
function onKey(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    top.close();
    return;
  }
  if (e.key !== 'Tab') return;
  e.stopPropagation();
  const items = [...top.panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  if (!items.length) { e.preventDefault(); top.panel.focus(); return; }
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement;
  if (!top.panel.contains(active) || active === top.panel) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

export function openSheet({ title, eyebrow = '', wide = false, onClose } = {}) {
  const opener = document.activeElement;
  const id = `tsheet-title-${++counter}`;
  const root = document.createElement('div');
  root.className = 'tsheet';
  root.innerHTML = `<div class="tsheet__backdrop" data-close></div>
    <section class="tsheet__panel${wide ? ' tsheet__panel--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1">
      <header class="tsheet__header">
        <div><p class="tsheet__eyebrow"></p><h2 class="tsheet__title" id="${id}"></h2></div>
        <button type="button" class="tsheet__close" data-close aria-label="Cerrar">&times;</button>
      </header>
      <div class="tsheet__body"></div>
    </section>`;
  const panel = root.querySelector('.tsheet__panel');
  const titleEl = root.querySelector('.tsheet__title');
  const eyebrowEl = root.querySelector('.tsheet__eyebrow');
  titleEl.textContent = title;
  eyebrowEl.textContent = eyebrow;
  eyebrowEl.hidden = !eyebrow;
  let closed = false;
  const sheet = {
    root,
    panel,
    body: root.querySelector('.tsheet__body'),
    setTitle(t) { titleEl.textContent = t; },
    close() {
      if (closed) return;
      closed = true;
      root.remove();
      stack.splice(stack.indexOf(sheet), 1);
      if (!stack.length) {
        document.removeEventListener('keydown', onKey, true);
        document.body.classList.remove('tsheet-open');
      }
      if (onClose) onClose();
      if (opener && document.contains(opener)) opener.focus();
    },
  };
  root.addEventListener('click', e => { if (e.target.closest('[data-close]')) sheet.close(); });
  if (!stack.length) {
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('tsheet-open');
  }
  stack.push(sheet);
  document.body.append(root);
  panel.focus();
  return sheet;
}
```

- [ ] **Step 2: `practice/login-ui.js`**

```js
import { openSheet, focusFirst } from './sheet.js';
import { api } from './api.js';
import { setSession, updateUser, getSession } from './session.js';
import { esc } from './format.js';

const PIN_INPUT = 'inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="off" required';

function showError(form, message) {
  const el = form.querySelector('[data-error]');
  el.textContent = message;
  el.hidden = !message;
}

function renderPinForm(sheet, { askCurrent, currentPin, resolve }) {
  sheet.setTitle('Elige tu PIN');
  sheet.body.innerHTML = `<form class="account-form" novalidate>
    <p>Tu PIN es temporal. Elige uno nuevo de 6 cifras que solo conozcas tú.</p>
    ${askCurrent ? `<label>PIN actual<input name="current" type="password" ${PIN_INPUT}></label>` : ''}
    <label>PIN nuevo<input name="pin" type="password" ${PIN_INPUT}></label>
    <label>Repite el PIN<input name="repeat" type="password" ${PIN_INPUT}></label>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">Guardar PIN</button>
  </form>`;
  const form = sheet.body.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const current = askCurrent ? form.elements.current.value : currentPin;
    const pin = form.elements.pin.value, repeat = form.elements.repeat.value;
    if (!/^\d{6}$/.test(pin)) return showError(form, 'El PIN debe tener exactamente 6 cifras.');
    if (pin !== repeat) return showError(form, 'Los dos PIN no coinciden.');
    if (pin === current) return showError(form, 'El PIN nuevo debe ser distinto del actual.');
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    showError(form, '');
    try {
      await api.changePin(current, pin);
      const session = getSession();
      if (session) updateUser({ ...session.user, mustChangePin: false });
      resolve(true);
      sheet.close();
    } catch (err) {
      showError(form, err.field === 'currentPin' ? 'El PIN actual no es correcto.' : err.message);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

export function openPinChange() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sheet = openSheet({ title: 'Elige tu PIN', eyebrow: 'Cuenta', onClose: () => finish(false) });
    renderPinForm(sheet, { askCurrent: true, resolve: finish });
  });
}

export function openLogin() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sheet = openSheet({ title: 'Entrar', eyebrow: 'Cuenta', onClose: () => finish(false) });
    sheet.body.innerHTML = `<form class="account-form" novalidate>
      <p>Entra con el usuario y el PIN que te dio el jefe de cuerda para guardar tu progreso.</p>
      <label>Usuario<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label>PIN<input name="pin" type="password" ${PIN_INPUT}></label>
      <p class="account-form__error" role="alert" data-error hidden></p>
      <button type="submit" class="btn">Entrar</button>
    </form>`;
    const form = sheet.body.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const username = form.elements.username.value.trim();
      const pin = form.elements.pin.value;
      if (!username) return showError(form, 'Escribe tu usuario.');
      if (!/^\d{6}$/.test(pin)) return showError(form, 'El PIN debe tener exactamente 6 cifras.');
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      showError(form, '');
      try {
        const { token, user } = await api.login(username, pin);
        setSession({ token, user });
        if (user.mustChangePin) renderPinForm(sheet, { askCurrent: false, currentPin: pin, resolve: finish });
        else { finish(true); sheet.close(); }
      } catch (err) {
        showError(form, err.message);
        button.disabled = false;
      }
    });
    focusFirst(form);
  });
}

export const greeting = user => `Sesión: ${esc(user.displayName)}`;
```

- [ ] **Step 3: `practice/menu.js`**

```js
import { getSession, clearSession, onSessionChange } from './session.js';
import { api } from './api.js';
import { openLogin, openPinChange, greeting } from './login-ui.js';

function items(session) {
  if (!session) return [['login', 'Entrar']];
  if (session.user.mustChangePin) return [['pin', 'Elegir mi PIN'], ['logout', 'Salir']];
  const list = [['progress', 'Mi progreso']];
  if (session.user.role === 'admin') list.push(['admin', 'Administración']);
  list.push(['logout', 'Salir']);
  return list;
}

export function mountPracticeMenu({ onProgress, onAdmin }) {
  const menu = document.getElementById('quickMenu');
  if (!menu || document.getElementById('practiceMenu')) return;
  const folder = document.createElement('details');
  folder.className = 'quick-menu__folder';
  folder.id = 'practiceMenu';
  folder.innerHTML = '<summary>Práctica</summary><div class="quick-menu__contents"></div>';
  const contents = folder.querySelector('.quick-menu__contents');
  menu.append(folder);

  const render = session => {
    const note = session ? `<p class="quick-menu__note">${greeting(session.user)}</p>` : '';
    contents.innerHTML = note + items(session)
      .map(([action, label]) => `<button class="quick-menu__item" type="button" data-practice-action="${action}">${label}</button>`)
      .join('');
  };

  // app.js cierra el menú al pulsar cualquier .quick-menu__item; aquí solo se ejecuta la acción.
  contents.addEventListener('click', async e => {
    const btn = e.target.closest('[data-practice-action]');
    if (!btn) return;
    const action = btn.dataset.practiceAction;
    if (action === 'login') { if (await openLogin()) onProgress(); }
    else if (action === 'pin') openPinChange();
    else if (action === 'progress') onProgress();
    else if (action === 'admin') onAdmin();
    else if (action === 'logout') {
      try { await api.logout(); } catch { /* la sesión se borra igualmente */ }
      clearSession();
    }
  });

  render(getSession());
  onSessionChange(render);
}
```

Nota: tras entrar con éxito desde el menú se abre "Mi progreso" directamente (es lo que el tenor quiere ver).

- [ ] **Step 4: Montar en `practice/main.js`**

Añadir imports al principio:
```js
import { apiEnabled } from './config.js';
import { mountPracticeMenu } from './menu.js';
```
Y al final del archivo:
```js
// Login y progreso: solo si hay backend configurado (ver practice/config.js).
// openMyProgress y openAdmin llegan en las tareas de "Mi progreso" y administración.
const practiceHandlers = { onProgress: () => {}, onAdmin: () => {} };
if (apiEnabled) mountPracticeMenu({ onProgress: () => practiceHandlers.onProgress(), onAdmin: () => practiceHandlers.onAdmin() });
export { practiceHandlers };
```

- [ ] **Step 5: Estilos** — añadir al final de `practice/practice.css`

```css
/* ---------- Diálogos de cuenta, progreso y administración ---------- */
body.tsheet-open { overflow: hidden; }
.tsheet { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
.tsheet__backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .72); }
.tsheet__panel {
  position: relative; width: min(480px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
  background: var(--card, #111213); border: 1px solid var(--card-border, #1b1d1f); border-radius: var(--radius-xl, 28px);
  padding: 24px; color: var(--fg, #f5f8f5); font-family: var(--font-ui, system-ui, sans-serif); outline: none;
}
.tsheet__panel--wide { width: min(980px, 100%); }
.tsheet__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.tsheet__title { margin: 0; font-size: 22px; }
.tsheet__eyebrow { margin: 0 0 4px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent, #0ffc7e); }
.tsheet__close { background: none; border: 0; color: inherit; font-size: 28px; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
.tsheet button:focus-visible, .tsheet input:focus-visible, .tsheet select:focus-visible { outline: 2px solid var(--accent, #0ffc7e); outline-offset: 2px; }
@media (max-width: 640px) {
  .tsheet { padding: 0; }
  .tsheet__panel { border-radius: 0; height: 100vh; max-height: 100vh; height: 100dvh; max-height: 100dvh; padding: 20px 16px; }
}

.account-form { display: flex; flex-direction: column; gap: 12px; }
.account-form label { display: flex; flex-direction: column; gap: 6px; font-weight: 600; }
.account-form input, .account-form select {
  background: #000; color: inherit; border: 1px solid var(--card-border, #1b1d1f); border-radius: 10px;
  padding: 10px 12px; font: inherit; font-weight: 400;
}
.account-form__error { margin: 0; color: var(--practice-bad, #ff5c5c); }
.account-form__error[hidden] { display: none; }
.account-form .btn { align-self: flex-start; }

.quick-menu__note { margin: 4px 0 6px; font-size: 13px; color: var(--fg-muted, #dfe4ea); opacity: .8; }
```

- [ ] **Step 6: Verificación**

Run: `node --check practice/sheet.js && node --check practice/login-ui.js && node --check practice/menu.js && node --check practice/main.js && npm test`
Expected: sin errores de sintaxis; tests en verde.

Manual (con `npm run serve` y `cd backend && npm run dev`, admin creado en Task 5): ☰ → **Práctica → Entrar** → usuario `admin` + PIN temporal → pide elegir PIN → tras guardarlo el menú muestra "Sesión: Jefe de cuerda", "Mi progreso", "Administración", "Salir". Esc cierra el diálogo; Tab no sale de él. "Salir" vuelve a mostrar "Entrar". Con `wrangler dev` apagado, "Entrar" muestra "No se pudo conectar con el servidor." Deja constancia en el informe si no se pudo hacer.

- [ ] **Step 7: Commit**

```bash
git add practice/sheet.js practice/login-ui.js practice/menu.js practice/main.js practice/practice.css
git commit -m "feat(practica): diálogos de cuenta, login con PIN y menú Práctica"
```

---

### Task 8: Guardar intentos desde la práctica y vista "Mi progreso"

**Files:**
- Create: `practice/save-status.js`, `practice/progress-chart.js`, `practice/progress-ui.js`
- Modify: `practice/practice-ui.js:364-366` (insertar el estado de guardado) y `:385` (montarlo), `practice/main.js` (conectar `onProgress`), `practice/practice.css` (añadir al final)
- Test: `test/progress-chart.test.js`

**Interfaces:**
- Consumes: `api`, `getSession`, `apiEnabled`, `openLogin`, `openPinChange`, `openSheet`, `focusFirst`, `format.js`.
- Produces:
  - `mountSaveStatus(el, result)`.
  - `renderProgressChart(attempts) → string` (SVG; `''` si no hay datos). Clases `progress-chart`, `progress-dot--guide`, `progress-dot--test`, `progress-line--guide`, `progress-line--test`.
  - `renderProgress(container, { userId } = {})` (reutilizable por administración) y `openMyProgress()`.

- [ ] **Step 1: Test que falla** — `test/progress-chart.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProgressChart } from '../practice/progress-chart.js';

const count = (s, needle) => s.split(needle).length - 1;
const a = (createdAt, mode, total) => ({ createdAt, mode, scores: { total } });

test('sin intentos no hay gráfica', () => {
  assert.equal(renderProgressChart([]), '');
});

test('una línea por modo con al menos dos puntos y un punto por intento', () => {
  const svg = renderProgressChart([
    a('2026-09-01T10:00:00Z', 'guide', 60),
    a('2026-09-03T10:00:00Z', 'guide', 70),
    a('2026-09-02T10:00:00Z', 'test', 55),
  ]);
  assert.ok(svg.startsWith('<svg class="progress-chart"'));
  assert.equal(count(svg, 'class="progress-dot--guide"'), 2);
  assert.equal(count(svg, 'class="progress-dot--test"'), 1);
  assert.equal(count(svg, 'class="progress-line--guide"'), 1);
  assert.equal(count(svg, 'class="progress-line--test"'), 0);
  assert.match(svg, /<title>[^<]*70[^<]*<\/title>/);
});

test('un único intento se dibuja centrado sin dividir por cero', () => {
  const svg = renderProgressChart([a('2026-09-01T10:00:00Z', 'test', 80)]);
  assert.match(svg, /cx="300\.0"/);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL (`progress-chart.js` no existe).

- [ ] **Step 3: `practice/progress-chart.js`**

```js
import { modeLabel } from './format.js';

const W = 600, H = 180, PAD = 28;

export function renderProgressChart(attempts) {
  const points = attempts
    .map(a => ({ t: Date.parse(a.createdAt), v: a.scores?.total, mode: a.mode === 'test' ? 'test' : 'guide' }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((p, q) => p.t - q.t);
  if (!points.length) return '';
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = t => (t1 === t0 ? W / 2 : PAD + ((t - t0) / (t1 - t0)) * (W - 2 * PAD));
  const y = v => H - PAD - (v / 100) * (H - 2 * PAD);
  const grid = [0, 50, 80, 100].map(v =>
    `<line class="progress-grid" x1="${PAD}" x2="${W - PAD}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="progress-axis" x="4" y="${(y(v) + 4).toFixed(1)}">${v}</text>`).join('');
  const series = ['guide', 'test'].map(mode => {
    const pts = points.filter(p => p.mode === mode);
    const line = pts.length >= 2
      ? `<polyline class="progress-line--${mode}" points="${pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`
      : '';
    const dots = pts.map(p => `<circle class="progress-dot--${mode}" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4"><title>${modeLabel(mode)}: ${p.v}</title></circle>`).join('');
    return line + dots;
  }).join('');
  return `<svg class="progress-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la puntuación">${grid}${series}</svg>`;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `practice/save-status.js`**

```js
import { apiEnabled } from './config.js';
import { getSession } from './session.js';
import { api } from './api.js';
import { openLogin, openPinChange } from './login-ui.js';
import { esc } from './format.js';

export function mountSaveStatus(el, result) {
  if (!el) return;
  if (!apiEnabled || !result.valid) { el.hidden = true; return; }
  const show = html => { el.innerHTML = html; };
  const ask = (text, action, label) =>
    show(`<span>${esc(text)}</span> <button type="button" class="btn small quiet" data-save-act="${action}">${label}</button>`);

  async function save() {
    show('<span>Guardando…</span>');
    try {
      await api.saveAttempt(result);
      show('<span class="practice-save__ok">Guardado ✓</span>');
    } catch (err) {
      if (err.code === 'pin_change_required') ask('Elige tu PIN para guardar este intento.', 'pin', 'Elegir PIN');
      else if (err.status === 401) ask('Tu sesión caducó. Entra de nuevo para guardar.', 'login', 'Entrar');
      else show(`<span class="practice-save__err">No se pudo guardar: ${esc(err.message)}</span> <button type="button" class="btn small quiet" data-save-act="retry">Reintentar</button>`);
    }
  }

  el.addEventListener('click', async e => {
    const action = e.target.closest('[data-save-act]')?.dataset.saveAct;
    if (action === 'retry') save();
    else if (action === 'login' && await openLogin()) save();
    else if (action === 'pin' && await openPinChange()) save();
  });

  if (getSession()) save();
  else ask('Inicia sesión para guardar tu progreso.', 'login', 'Entrar');
}
```

- [ ] **Step 6: Integrar en `practice/practice-ui.js`**

Añadir el import arriba, junto a los demás:
```js
import { mountSaveStatus } from './save-status.js';
```
En `renderResults`, rama válida, insertar una línea nueva justo después de la `<ul class="practice-metrics">…</ul>` (línea 368 actual), antes de los consejos:
```js
      <p class="practice-save" data-save aria-live="polite"></p>
```
Y justo después de la línea `let selected = null;` (línea 385 actual), añadir:
```js
  if (r.valid) mountSaveStatus(body.querySelector('[data-save]'), r);
```

- [ ] **Step 7: `practice/progress-ui.js`**

```js
import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { renderProgressChart } from './progress-chart.js';
import { esc, METRIC_LABELS, modeLabel, rangeLabel, formatDateTime, formatDate, songTitle } from './format.js';

const band = v => (v == null ? 'none' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');

function source(userId) {
  return userId
    ? { summary: () => api.admin.userSummary(userId), attempts: opts => api.admin.userAttempts(userId, opts) }
    : { summary: () => api.mySummary(), attempts: opts => api.myAttempts(opts) };
}

function renderError(container, err, retry) {
  container.innerHTML = `<div class="practice-error" role="alert"><p>${esc(err.message)}</p><button type="button" class="btn small" data-retry>Reintentar</button></div>`;
  container.querySelector('[data-retry]').addEventListener('click', retry);
}

export async function renderProgress(container, { userId } = {}) {
  const src = source(userId);
  container.innerHTML = '<p class="practice-message">Cargando…</p>';
  let data;
  try { data = await src.summary(); } catch (err) { renderError(container, err, () => renderProgress(container, { userId })); return; }
  if (!data.songs.length) {
    container.innerHTML = `<p class="practice-message">Aún no hay intentos guardados. Practica una canción con la sesión iniciada para empezar.</p>`;
    return;
  }
  container.innerHTML = `<ul class="progress-cards">${data.songs.map(s => `
    <li><button type="button" class="progress-card" data-song="${esc(s.songId)}">
      <span class="progress-card__title">${esc(songTitle(s.songId))}</span>
      <span class="progress-card__scores"><span class="score--${band(s.best)}">Mejor <strong>${s.best}</strong></span><span>Última <strong>${s.last}</strong></span><span>${s.attempts} intento${s.attempts === 1 ? '' : 's'}</span></span>
      <span class="progress-card__meta">${s.weakest ? `A mejorar: ${METRIC_LABELS[s.weakest]}` : ''} · ${formatDate(s.lastAt)}</span>
    </button></li>`).join('')}</ul>`;
  container.querySelector('.progress-cards').addEventListener('click', e => {
    const card = e.target.closest('[data-song]');
    if (card) renderSongDetail(container, src, card.dataset.song, () => renderProgress(container, { userId }));
  });
  focusFirst(container);
}

function attemptItem(a) {
  const metrics = ['pitch', 'rhythm', 'stability'].map(k => `${METRIC_LABELS[k]} ${a.scores[k] ?? '—'}`).join(' · ');
  const phrases = a.phrases.map(p => `<li>Frase ${p.index}: afinación ${p.pitch}, ritmo ${p.rhythm}${p.stability == null ? '' : `, estabilidad ${p.stability}`}</li>`).join('');
  const tips = a.tips.map(t => `<li>${esc(t.text)}</li>`).join('');
  return `<li class="progress-attempt">
    <button type="button" class="progress-attempt__head" aria-expanded="false">
      <span class="score--${band(a.scores.total)}"><strong>${a.scores.total}</strong></span>
      <span>${esc(formatDateTime(a.createdAt))} · ${modeLabel(a.mode)} · ${rangeLabel(a)}</span>
    </button>
    <div class="progress-attempt__body" hidden>
      <p>${metrics}</p>
      ${tips ? `<p class="practice-subtitle">Consejos</p><ul>${tips}</ul>` : ''}
      ${phrases ? `<p class="practice-subtitle">Frases</p><ul>${phrases}</ul>` : ''}
    </div></li>`;
}

async function renderSongDetail(container, src, songId, back) {
  container.innerHTML = '<p class="practice-message">Cargando…</p>';
  let attempts = [], next = null;
  const load = async before => {
    const page = await src.attempts({ song: songId, before });
    attempts = attempts.concat(page.attempts);
    next = page.next;
  };
  try { await load(); } catch (err) { renderError(container, err, () => renderSongDetail(container, src, songId, back)); return; }

  const draw = () => {
    container.innerHTML = `<button type="button" class="data-back progress-back">← Todas las canciones</button>
      <h3 class="progress-song">${esc(songTitle(songId))}</h3>
      <div class="progress-chart-wrap">${renderProgressChart(attempts)}
        <p class="practice-legend"><span class="legend-guide">Con guía</span><span class="legend-test">A prueba</span></p></div>
      <ul class="progress-attempts">${attempts.map(attemptItem).join('')}</ul>
      ${next ? '<button type="button" class="btn small quiet" data-more>Cargar más</button>' : ''}`;
    container.querySelector('.progress-back').addEventListener('click', back);
    container.querySelector('.progress-attempts').addEventListener('click', e => {
      const head = e.target.closest('.progress-attempt__head');
      if (!head) return;
      const open = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', String(open));
      head.nextElementSibling.hidden = !open;
    });
    container.querySelector('[data-more]')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { await load(next); draw(); } catch (err) { e.target.disabled = false; e.target.textContent = `${err.message} Reintentar`; }
    });
    focusFirst(container);
  };
  draw();
}

export function openMyProgress() {
  const sheet = openSheet({ title: 'Mi progreso', eyebrow: 'Práctica', wide: true });
  renderProgress(sheet.body);
}
```

- [ ] **Step 8: Conectar en `practice/main.js`**

Añadir el import:
```js
import { openMyProgress } from './progress-ui.js';
```
Y cambiar la línea `const practiceHandlers = { onProgress: () => {}, onAdmin: () => {} };` por:
```js
const practiceHandlers = { onProgress: openMyProgress, onAdmin: () => {} };
```

- [ ] **Step 9: Estilos** — añadir al final de `practice/practice.css`

```css
.practice-save { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--fg-muted, #dfe4ea); }
.practice-save[hidden] { display: none; }
.practice-save__ok { color: var(--practice-good, #0ffc7e); font-weight: 700; }
.practice-save__err { color: var(--practice-bad, #ff5c5c); }

.progress-cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.progress-card { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 16px; border: 1px solid var(--card-border, #1b1d1f); background: #000; color: inherit; font: inherit; cursor: pointer; }
.progress-card:hover, .progress-card:focus-visible { border-color: var(--accent, #0ffc7e); }
.progress-card__title { font-weight: 700; }
.progress-card__scores { display: flex; flex-wrap: wrap; gap: 12px; }
.progress-card__meta { font-size: 13px; color: var(--fg-muted, #dfe4ea); opacity: .8; }
.progress-card .score--good strong { color: var(--practice-good); }
.progress-card .score--warn strong { color: var(--practice-warn); }
.progress-card .score--bad strong { color: var(--practice-bad); }
.progress-back { margin-bottom: 8px; }
.progress-song { margin: 4px 0 10px; }
.progress-chart-wrap { background: #000; border-radius: 14px; padding: 8px; margin-bottom: 12px; }
.progress-chart { display: block; width: 100%; height: auto; }
.progress-grid { stroke: rgba(255, 255, 255, .08); }
.progress-axis { fill: rgba(255, 255, 255, .45); font-size: 11px; }
.progress-line--guide, .progress-line--test { fill: none; stroke-width: 2; }
.progress-line--guide { stroke: rgba(255, 255, 255, .6); }
.progress-line--test { stroke: var(--accent, #0ffc7e); }
.progress-dot--guide { fill: rgba(255, 255, 255, .8); }
.progress-dot--test { fill: var(--accent, #0ffc7e); }
.legend-guide::before { background: rgba(255, 255, 255, .6); }
.legend-test::before { background: var(--accent, #0ffc7e); }
.progress-attempts { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.progress-attempt__head { width: 100%; display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-border, #1b1d1f); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.progress-attempt__head strong { font-size: 18px; }
.progress-attempt__body { padding: 8px 12px 4px; }
.progress-attempt__body[hidden] { display: none; }
.progress-attempt__body ul { margin: 4px 0 8px; padding-left: 20px; }
.progress-attempt .score--good strong { color: var(--practice-good); }
.progress-attempt .score--warn strong { color: var(--practice-warn); }
.progress-attempt .score--bad strong { color: var(--practice-bad); }
```

- [ ] **Step 10: Verificación**

Run: `node --check practice/save-status.js && node --check practice/progress-ui.js && node --check practice/practice-ui.js && node --check practice/main.js && npm test`
Expected: sin errores; tests en verde.

Manual (web + `wrangler dev`): con sesión de un tenor, practicar *Fum Fum Fum* → en resultados aparece "Guardando…" y luego "Guardado ✓". Repetir antes de 10 s → "No se pudo guardar: Espera unos segundos…" con Reintentar. Sin sesión → "Inicia sesión para guardar tu progreso." + Entrar; tras entrar se guarda. Menú → "Mi progreso" muestra la tarjeta de la canción; al abrirla, gráfica, lista y detalle desplegable. Con el backend apagado, la práctica funciona y el guardado ofrece Reintentar.

- [ ] **Step 11: Commit**

```bash
git add practice/save-status.js practice/progress-chart.js practice/progress-ui.js practice/practice-ui.js practice/main.js practice/practice.css test/progress-chart.test.js
git commit -m "feat(practica): guardado automático de intentos y vista Mi progreso"
```

---

### Task 9: Administración (backend) — CRUD de usuarios con protecciones

**Files:**
- Create: `backend/src/admin.js`
- Modify: `backend/src/routes.js`
- Test: `backend/test/admin-users.test.js`

**Interfaces:**
- Consumes: `requireAdmin`, `publicUser` (Task 3), validadores y `crypto.js` (Task 2), `attemptsPage`, `userSummary` (Task 4).
- Produces:
  - `adminUser(row) → { id, username, displayName, role, active, mustChangePin, createdAt, deactivatedAt, lastAttemptAt }`.
  - Handlers: `listUsers`, `createUser`, `updateUser`, `resetPin`, `deleteUser`, `userAttemptsAdmin`, `userSummaryAdmin`.
  - Rutas: `GET/POST /api/admin/users`, `PATCH/DELETE /api/admin/users/:id`, `POST /api/admin/users/:id/reset-pin`, `GET /api/admin/users/:id/attempts`, `GET /api/admin/users/:id/summary`.

- [ ] **Step 1: Test que falla** — `backend/test/admin-users.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, insertAttempt } from './helpers/app.js';

async function adminSetup() {
  const t = setup();
  const adminId = await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  const tenorId = await t.seedUser({ username: 'ana', displayName: 'Ana' });
  const admin = await t.loginAs('jefe');
  return { ...t, adminId, tenorId, admin };
}

test('todas las rutas de administración rechazan a un tenor (403) y sin sesión (401)', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const routes = [['GET', '/api/admin/users'], ['POST', '/api/admin/users'], ['PATCH', '/api/admin/users/1'], ['POST', '/api/admin/users/1/reset-pin'],
    ['DELETE', '/api/admin/users/1'], ['GET', '/api/admin/users/1/attempts'], ['GET', '/api/admin/users/1/summary']];
  for (const [method, path] of routes) {
    assert.deepEqual((await t.call(method, path, { token: tenor, body: {} })).body, { error: 'forbidden' }, `${method} ${path}`);
    assert.equal((await t.call(method, path, { body: {} })).status, 401, `${method} ${path} sin sesión`);
  }
});

test('listar con filtro de activos y último intento', async () => {
  const t = await adminSetup();
  await t.seedUser({ username: 'baja', displayName: 'Baja', active: 0 });
  await insertAttempt(t.db, { userId: t.tenorId, createdAt: '2026-09-20T10:00:00.000Z' });
  const all = await t.call('GET', '/api/admin/users', { token: t.admin });
  assert.deepEqual(all.body.users.map(u => u.username), ['ana', 'jefe', 'baja']);
  assert.equal(all.body.users[0].lastAttemptAt, '2026-09-20T10:00:00.000Z');
  assert.deepEqual(Object.keys(all.body.users[0]).sort(), ['active', 'createdAt', 'deactivatedAt', 'displayName', 'id', 'lastAttemptAt', 'mustChangePin', 'role', 'username'].sort());
  assert.deepEqual((await t.call('GET', '/api/admin/users?active=0', { token: t.admin })).body.users.map(u => u.username), ['baja']);
  assert.deepEqual((await t.call('GET', '/api/admin/users?active=1', { token: t.admin })).body.users.length, 2);
  assert.deepEqual((await t.call('GET', '/api/admin/users?active=x', { token: t.admin })).body, { error: 'invalid', field: 'active' });
});

test('crear usuario: PIN temporal de 6 cifras, must_change_pin y duplicados', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/users', { token: t.admin, body: { username: 'Luis.G', displayName: 'Luis', role: 'tenor' } });
  assert.equal(r.status, 201);
  assert.match(r.body.temporaryPin, /^\d{6}$/);
  assert.equal(r.body.user.username, 'luis.g');
  assert.equal(r.body.user.mustChangePin, true);
  const login = await t.call('POST', '/api/auth/login', { body: { username: 'luis.g', pin: r.body.temporaryPin } });
  assert.equal(login.body.user.mustChangePin, true);
  const dup = await t.call('POST', '/api/admin/users', { token: t.admin, body: { username: 'LUIS.G', displayName: 'Otro', role: 'tenor' } });
  assert.deepEqual([dup.status, dup.body], [409, { error: 'username_taken' }]);
  const bad = await t.call('POST', '/api/admin/users', { token: t.admin, body: { username: 'x', displayName: 'X', role: 'tenor' } });
  assert.deepEqual(bad.body, { error: 'invalid', field: 'username' });
});

test('editar nombre, usuario y rol', async () => {
  const t = await adminSetup();
  const r = await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { displayName: 'Ana María', username: 'anamaria', role: 'admin' } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.user.displayName, r.body.user.username, r.body.user.role], ['Ana María', 'anamaria', 'admin']);
  assert.deepEqual((await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { username: 'jefe' } })).body, { error: 'username_taken' });
  assert.deepEqual((await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: {} })).body, { error: 'invalid', field: 'body' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/users/999', { token: t.admin, body: { displayName: 'X' } })).body, { error: 'not_found' });
});

test('desactivar borra sesiones, impide entrar y se puede reactivar', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const r = await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { active: false } });
  assert.deepEqual([r.body.user.active, r.body.user.deactivatedAt], [false, '2026-10-01T10:00:00.000Z']);
  assert.equal((await t.call('GET', '/api/me', { token: tenor })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } })).status, 401);
  const back = await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { active: true } });
  assert.deepEqual([back.body.user.active, back.body.user.deactivatedAt], [true, null]);
  assert.equal((await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '123456' } })).status, 200);
});

test('active debe ser booleano', async () => {
  const t = await adminSetup();
  assert.deepEqual((await t.call('PATCH', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { active: 0 } })).body, { error: 'invalid', field: 'active' });
});

test('restablecer PIN: nuevo PIN temporal, desbloquea y cierra sesiones', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  for (let i = 0; i < 5; i++) await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '000000' } });
  const r = await t.call('POST', `/api/admin/users/${t.tenorId}/reset-pin`, { token: t.admin });
  assert.match(r.body.temporaryPin, /^\d{6}$/);
  assert.equal((await t.call('GET', '/api/me', { token: tenor })).status, 401);
  const login = await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: r.body.temporaryPin } });
  assert.deepEqual([login.status, login.body.user.mustChangePin], [200, true]);
});

test('protecciones: no actuar sobre uno mismo', async () => {
  const t = await adminSetup();
  const self = body => t.call('PATCH', `/api/admin/users/${t.adminId}`, { token: t.admin, body });
  assert.deepEqual((await self({ active: false })).body, { error: 'self_action' });
  assert.deepEqual((await self({ role: 'tenor' })).body, { error: 'self_action' });
  assert.deepEqual((await t.call('DELETE', `/api/admin/users/${t.adminId}`, { token: t.admin, body: { confirmUsername: 'jefe' } })).body, { error: 'self_action' });
  assert.equal((await self({ displayName: 'Jefe de cuerda' })).status, 200);
});

test('protecciones: con dos administradores uno puede degradar al otro', async () => {
  const t = await adminSetup();
  const subId = await t.seedUser({ username: 'sub', displayName: 'Sub', role: 'admin' });
  assert.equal((await t.call('PATCH', `/api/admin/users/${subId}`, { token: t.admin, body: { role: 'tenor' } })).status, 200);
});

test('wouldRemoveLastAdmin: solo bloquea quitar el último administrador activo', async () => {
  const t = await adminSetup();
  const { wouldRemoveLastAdmin } = await import('../src/admin.js');
  const inactiveAdmin = await t.seedUser({ username: 'viejo', displayName: 'Viejo', role: 'admin', active: 0 });
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: t.adminId, role: 'admin', active: 1 }), true);
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: inactiveAdmin, role: 'admin', active: 0 }), false);
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: t.tenorId, role: 'tenor', active: 1 }), false);
  await t.seedUser({ username: 'sub', displayName: 'Sub', role: 'admin' });
  assert.equal(await wouldRemoveLastAdmin(t.db, { id: t.adminId, role: 'admin', active: 1 }), false);
});
```

Por qué `last_admin` se prueba con la función pura: quien llama a las rutas de administración es siempre un administrador activo y no puede actuar sobre sí mismo (`self_action`), así que por HTTP solo se alcanzaría con dos administradores degradándose a la vez. El handler la comprueba igualmente después de `self_action`.

- [ ] **Step 2: Test de borrado** — añadir a `backend/test/admin-users.test.js`

```js
test('eliminar exige confirmar el usuario y borra en cascada', async () => {
  const t = await adminSetup();
  await insertAttempt(t.db, { userId: t.tenorId, createdAt: '2026-09-20T10:00:00.000Z' });
  await t.loginAs('ana');
  await t.call('POST', '/api/auth/login', { body: { username: 'ana', pin: '000000' } });
  const wrong = await t.call('DELETE', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { confirmUsername: 'otra' } });
  assert.deepEqual([wrong.status, wrong.body], [400, { error: 'invalid', field: 'confirmUsername' }]);
  const ok = await t.call('DELETE', `/api/admin/users/${t.tenorId}`, { token: t.admin, body: { confirmUsername: ' ANA ' } });
  assert.equal(ok.status, 204);
  for (const table of ['users WHERE id = 2', 'attempts', 'sessions WHERE user_id = 2', "login_failures WHERE username = 'ana'"]) {
    assert.equal(await t.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n'), 0, table);
  }
});

test('intentos y resumen de un usuario concreto', async () => {
  const t = await adminSetup();
  await insertAttempt(t.db, { userId: t.tenorId, total: 77, createdAt: '2026-09-20T10:00:00.000Z' });
  const attempts = await t.call('GET', `/api/admin/users/${t.tenorId}/attempts`, { token: t.admin });
  assert.deepEqual(attempts.body.attempts.map(a => a.scores.total), [77]);
  const summary = await t.call('GET', `/api/admin/users/${t.tenorId}/summary`, { token: t.admin });
  assert.equal(summary.body.songs[0].best, 77);
  assert.deepEqual((await t.call('GET', '/api/admin/users/999/summary', { token: t.admin })).body, { error: 'not_found' });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `cd backend && npm test`
Expected: FAIL (`admin.js` no existe).

- [ ] **Step 4: `backend/src/admin.js`** (parte de usuarios)

```js
import { HttpError, json, noContent, readJson } from './http.js';
import { requireAdmin } from './auth.js';
import { hashPin, newSalt, randomPin, pinIterations } from './crypto.js';
import { validateUsername, validateDisplayName, validateRole, validateId } from './validate.js';
import { attemptsPage, userSummary } from './attempts.js';

const USER_SELECT = `SELECT u.*, (SELECT MAX(created_at) FROM attempts a WHERE a.user_id = u.id) AS last_attempt_at FROM users u`;

export function adminUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    active: !!row.active,
    mustChangePin: !!row.must_change_pin,
    createdAt: row.created_at,
    deactivatedAt: row.deactivated_at,
    lastAttemptAt: row.last_attempt_at ?? null,
  };
}

async function findUser(db, id) {
  const row = await db.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function usernameTaken(db, username, exceptId = 0) {
  return !!(await db.prepare('SELECT id FROM users WHERE username = ? AND id <> ?').bind(username, exceptId).first());
}

// ¿Dejaría el cambio al sistema sin ningún administrador activo?
export async function wouldRemoveLastAdmin(db, target) {
  if (target.role !== 'admin' || !target.active) return false;
  const others = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?").bind(target.id).first('n');
  return others === 0;
}

export async function listUsers(ctx) {
  await requireAdmin(ctx);
  const active = ctx.url.searchParams.get('active') ?? 'all';
  if (!['all', '1', '0'].includes(active)) throw new HttpError(400, 'invalid', { field: 'active' });
  const where = active === 'all' ? '' : 'WHERE u.active = ?';
  const stmt = ctx.db.prepare(`${USER_SELECT} ${where} ORDER BY u.active DESC, u.display_name COLLATE NOCASE, u.id`);
  const { results } = await (active === 'all' ? stmt : stmt.bind(Number(active))).all();
  return json(200, { users: results.map(adminUser) });
}

export async function createUser(ctx) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.request);
  const username = validateUsername(body.username);
  const displayName = validateDisplayName(body.displayName);
  const role = validateRole(body.role);
  if (await usernameTaken(ctx.db, username)) throw new HttpError(409, 'username_taken');
  const pin = randomPin();
  const salt = newSalt();
  const iterations = pinIterations(ctx.env);
  const ts = ctx.now.toISOString();
  const r = await ctx.db.prepare(`INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, active, must_change_pin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`)
    .bind(username, displayName, await hashPin(pin, salt, iterations), salt, iterations, role, ts, ts).run();
  return json(201, { user: adminUser(await findUser(ctx.db, r.meta.last_row_id)), temporaryPin: pin });
}

export async function updateUser(ctx) {
  const admin = await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const target = await findUser(ctx.db, id);
  const body = await readJson(ctx.request);
  const sets = [];
  const params = [];
  if ('username' in body) {
    const username = validateUsername(body.username);
    if (await usernameTaken(ctx.db, username, id)) throw new HttpError(409, 'username_taken');
    sets.push('username = ?'); params.push(username);
  }
  if ('displayName' in body) { sets.push('display_name = ?'); params.push(validateDisplayName(body.displayName)); }
  let role = target.role;
  if ('role' in body) { role = validateRole(body.role); sets.push('role = ?'); params.push(role); }
  let active = !!target.active;
  if ('active' in body) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'invalid', { field: 'active' });
    active = body.active;
    sets.push('active = ?', 'deactivated_at = ?');
    params.push(active ? 1 : 0, active ? null : ctx.now.toISOString());
  }
  if (!sets.length) throw new HttpError(400, 'invalid', { field: 'body' });
  const losesAdmin = (target.role === 'admin' && role !== 'admin') || (!!target.active && !active);
  if (id === admin.id && losesAdmin) throw new HttpError(409, 'self_action');
  if (losesAdmin && await wouldRemoveLastAdmin(ctx.db, target)) throw new HttpError(409, 'last_admin');
  sets.push('updated_at = ?');
  params.push(ctx.now.toISOString());
  const statements = [ctx.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id)];
  if (!active) statements.push(ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  await ctx.db.batch(statements);
  return json(200, { user: adminUser(await findUser(ctx.db, id)) });
}

export async function resetPin(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const target = await findUser(ctx.db, id);
  const pin = randomPin();
  const salt = newSalt();
  const iterations = pinIterations(ctx.env);
  await ctx.db.batch([
    ctx.db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iterations = ?, must_change_pin = 1, updated_at = ? WHERE id = ?')
      .bind(await hashPin(pin, salt, iterations), salt, iterations, ctx.now.toISOString(), id),
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    ctx.db.prepare('DELETE FROM login_failures WHERE username = ?').bind(target.username),
  ]);
  return json(200, { temporaryPin: pin });
}

export async function deleteUser(ctx) {
  const admin = await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const target = await findUser(ctx.db, id);
  const body = await readJson(ctx.request);
  if (id === admin.id) throw new HttpError(409, 'self_action');
  if (await wouldRemoveLastAdmin(ctx.db, target)) throw new HttpError(409, 'last_admin');
  const confirm = typeof body.confirmUsername === 'string' ? body.confirmUsername.trim().toLowerCase() : '';
  if (confirm !== target.username) throw new HttpError(400, 'invalid', { field: 'confirmUsername' });
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ctx.db.prepare('DELETE FROM login_failures WHERE username = ?').bind(target.username),
  ]);
  return noContent();
}

export async function userAttemptsAdmin(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  await findUser(ctx.db, id);
  return json(200, await attemptsPage(ctx.db, id, ctx.url));
}

export async function userSummaryAdmin(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  await findUser(ctx.db, id);
  return json(200, await userSummary(ctx.db, id));
}
```

- [ ] **Step 5: Rutas** — `backend/src/routes.js`: añadir el import y las entradas al final del array

```js
import { listUsers, createUser, updateUser, resetPin, deleteUser, userAttemptsAdmin, userSummaryAdmin } from './admin.js';
```
```js
  ['GET', '/api/admin/users', listUsers],
  ['POST', '/api/admin/users', createUser],
  ['PATCH', '/api/admin/users/:id', updateUser],
  ['DELETE', '/api/admin/users/:id', deleteUser],
  ['POST', '/api/admin/users/:id/reset-pin', resetPin],
  ['GET', '/api/admin/users/:id/attempts', userAttemptsAdmin],
  ['GET', '/api/admin/users/:id/summary', userSummaryAdmin],
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `cd backend && npm test`
Expected: PASS. Nota sobre el primer test (rutas rechazan a un tenor): `requireAdmin` se evalúa antes de leer el cuerpo, por eso un `body: {}` basta en todas.

- [ ] **Step 7: Commit**

```bash
git add backend/src/admin.js backend/src/routes.js backend/test/admin-users.test.js
git commit -m "feat(backend): CRUD de usuarios para administración con protecciones"
```

---

### Task 10: Administración (backend) — vista de equipo y ranking

**Files:**
- Modify: `backend/src/admin.js` (añadir `team`, `ranking`), `backend/src/routes.js`
- Test: `backend/test/admin-stats.test.js`

**Interfaces:**
- Consumes: `requireAdmin`, `SONG_IDS`, `insertAttempt` (helper).
- Produces:
  - `GET /api/admin/team` → `{ team: [{ user: { id, username, displayName, role }, lastAttemptAt, attempts7d, attempts30d, avg30d, trend }] }` (usuarios activos, orden por nombre).
  - `GET /api/admin/ranking?song=<id>|all&since=<ISO>` → canción: `{ rows: [{ position, user, best, pitch, rhythm, stability, attempts }] }`; general: `{ rows: [{ position, user, average, songs, attempts }] }`.

- [ ] **Step 1: Test que falla** — `backend/test/admin-stats.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, insertAttempt } from './helpers/app.js';

const DAY = 86_400_000;
const ago = (t, days) => new Date(t.clock.now.getTime() - days * DAY).toISOString();

async function stats() {
  const t = setup();
  await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  const ana = await t.seedUser({ username: 'ana', displayName: 'Ana' });
  const luis = await t.seedUser({ username: 'luis', displayName: 'Luis' });
  const baja = await t.seedUser({ username: 'baja', displayName: 'Baja', active: 0 });
  const admin = await t.loginAs('jefe');
  return { t, admin, ana, luis, baja };
}

test('equipo: actividad, medias y tendencia', async () => {
  const { t, admin, ana, luis } = await stats();
  await insertAttempt(t.db, { userId: ana, total: 60, createdAt: ago(t, 20) });
  await insertAttempt(t.db, { userId: ana, total: 70, createdAt: ago(t, 16) });
  await insertAttempt(t.db, { userId: ana, total: 80, createdAt: ago(t, 5) });
  await insertAttempt(t.db, { userId: ana, total: 90, createdAt: ago(t, 1) });
  await insertAttempt(t.db, { userId: luis, total: 50, createdAt: ago(t, 40) });
  const r = await t.call('GET', '/api/admin/team', { token: admin });
  const byName = Object.fromEntries(r.body.team.map(row => [row.user.username, row]));
  assert.deepEqual(Object.keys(byName), ['ana', 'jefe', 'luis']);
  assert.deepEqual(byName.ana, {
    user: { id: ana, username: 'ana', displayName: 'Ana', role: 'tenor' },
    lastAttemptAt: ago(t, 1), attempts7d: 2, attempts30d: 4, avg30d: 75, trend: 20,
  });
  assert.deepEqual([byName.luis.attempts30d, byName.luis.avg30d, byName.luis.trend, byName.luis.lastAttemptAt], [0, null, null, ago(t, 40)]);
  assert.deepEqual([byName.jefe.lastAttemptAt, byName.jefe.trend], [null, null]);
});

test('ranking por canción: solo completas en modo prueba, activos, periodo y desempates', async () => {
  const { t, admin, ana, luis, baja } = await stats();
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 80, pitch: 81, rhythm: 79, stability: 70, createdAt: ago(t, 3) });
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 80, pitch: 99, rhythm: 99, stability: 99, createdAt: ago(t, 2) }); // empate: gana el más antiguo
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 90, createdAt: ago(t, 2) });
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 99, mode: 'guide', createdAt: ago(t, 2) }); // no cuenta: guía
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 99, isFull: 0, createdAt: ago(t, 2) }); // no cuenta: fragmento
  await insertAttempt(t.db, { userId: baja, songId: 'fum', total: 100, createdAt: ago(t, 2) }); // no cuenta: inactivo
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 95, createdAt: ago(t, 40) }); // fuera del periodo
  const r = await t.call('GET', `/api/admin/ranking?song=fum&since=${encodeURIComponent(ago(t, 30))}`, { token: admin });
  assert.deepEqual(r.body.rows, [
    { position: 1, user: { id: luis, username: 'luis', displayName: 'Luis' }, best: 90, pitch: 80, rhythm: 80, stability: 80, attempts: 1 },
    { position: 2, user: { id: ana, username: 'ana', displayName: 'Ana' }, best: 80, pitch: 81, rhythm: 79, stability: 70, attempts: 2 },
  ]);
});

test('ranking general: media de mejores por canción, desempate por número de canciones', async () => {
  const { t, admin, ana, luis } = await stats();
  await insertAttempt(t.db, { userId: ana, songId: 'fum', total: 80, createdAt: ago(t, 2) });
  await insertAttempt(t.db, { userId: ana, songId: 'dona', total: 60, createdAt: ago(t, 2) });
  await insertAttempt(t.db, { userId: ana, songId: 'dona', total: 70, createdAt: ago(t, 1) });
  await insertAttempt(t.db, { userId: luis, songId: 'fum', total: 75, createdAt: ago(t, 2) });
  const r = await t.call('GET', '/api/admin/ranking?song=all', { token: admin });
  assert.deepEqual(r.body.rows, [
    { position: 1, user: { id: ana, username: 'ana', displayName: 'Ana' }, average: 75, songs: 2, attempts: 3 },
    { position: 2, user: { id: luis, username: 'luis', displayName: 'Luis' }, average: 75, songs: 1, attempts: 1 },
  ]);
});

test('ranking valida parámetros', async () => {
  const { t, admin } = await stats();
  assert.deepEqual((await t.call('GET', '/api/admin/ranking', { token: admin })).body, { error: 'invalid', field: 'song' });
  assert.deepEqual((await t.call('GET', '/api/admin/ranking?song=xx', { token: admin })).body, { error: 'invalid', field: 'song' });
  assert.deepEqual((await t.call('GET', '/api/admin/ranking?song=fum&since=ayer', { token: admin })).body, { error: 'invalid', field: 'since' });
});
```

Comprobación del caso de equipo: últimos 14 días = {80, 90} → 85; 14–28 días = {60 (20 d), 70 (16 d)} → 65; tendencia 20. Media de 30 días = (60+70+80+90)/4 = 75. Luis: único intento hace 40 días → 30 días sin datos.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd backend && npm test`
Expected: FAIL (rutas 404).

- [ ] **Step 3: Añadir a `backend/src/admin.js`**

```js
import { SONG_IDS } from './songs.js';

const DAY = 86_400_000;
const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const roundOrNull = v => (v == null ? null : Math.round(v));
const shortUser = row => ({ id: row.user_id ?? row.id, username: row.username, displayName: row.display_name });

export async function team(ctx) {
  await requireAdmin(ctx);
  const now = ctx.now.getTime();
  const iso = days => new Date(now - days * DAY).toISOString();
  const { results: users } = await ctx.db.prepare('SELECT id, username, display_name, role FROM users WHERE active = 1 ORDER BY display_name COLLATE NOCASE, id').all();
  const { results: recent } = await ctx.db.prepare('SELECT user_id, score_total, created_at FROM attempts WHERE created_at >= ?').bind(iso(30)).all();
  const { results: lasts } = await ctx.db.prepare('SELECT user_id, MAX(created_at) AS last FROM attempts GROUP BY user_id').all();
  const lastBy = new Map(lasts.map(r => [r.user_id, r.last]));
  const rows = users.map(u => {
    const mine = recent.filter(r => r.user_id === u.id);
    const within = days => mine.filter(r => r.created_at >= iso(days));
    const last14 = within(14).map(r => r.score_total);
    const prev14 = mine.filter(r => r.created_at >= iso(28) && r.created_at < iso(14)).map(r => r.score_total);
    return {
      user: { id: u.id, username: u.username, displayName: u.display_name, role: u.role },
      lastAttemptAt: lastBy.get(u.id) ?? null,
      attempts7d: within(7).length,
      attempts30d: mine.length,
      avg30d: roundOrNull(mean(mine.map(r => r.score_total))),
      trend: last14.length && prev14.length ? Math.round(mean(last14) - mean(prev14)) : null,
    };
  });
  return json(200, { team: rows });
}

export async function ranking(ctx) {
  await requireAdmin(ctx);
  const song = ctx.url.searchParams.get('song');
  if (song !== 'all' && !SONG_IDS.includes(song)) throw new HttpError(400, 'invalid', { field: 'song' });
  const sinceRaw = ctx.url.searchParams.get('since');
  let since = '0000-01-01T00:00:00.000Z';
  if (sinceRaw !== null) {
    const d = new Date(sinceRaw);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'invalid', { field: 'since' });
    since = d.toISOString();
  }
  const songFilter = song === 'all' ? '' : 'AND a.song_id = ?';
  const stmt = ctx.db.prepare(`SELECT a.id, a.user_id, a.song_id, a.score_total, a.score_pitch, a.score_rhythm, a.score_stability, u.username, u.display_name
    FROM attempts a JOIN users u ON u.id = a.user_id
    WHERE u.active = 1 AND a.mode = 'test' AND a.is_full = 1 AND a.created_at >= ? ${songFilter}
    ORDER BY a.id ASC`);
  const { results } = await (song === 'all' ? stmt.bind(since) : stmt.bind(since, song)).all();

  // Mejor intento por usuario y canción (empate → el más antiguo, por id ascendente).
  const best = new Map(); // `${user}:${song}` → row
  const count = new Map(); // user → intentos que cuentan
  for (const r of results) {
    count.set(r.user_id, (count.get(r.user_id) || 0) + 1);
    const key = `${r.user_id}:${r.song_id}`;
    const prev = best.get(key);
    if (!prev || r.score_total > prev.score_total) best.set(key, r);
  }

  const byName = (a, b) => a.user.displayName.localeCompare(b.user.displayName, 'es');
  let rows;
  if (song !== 'all') {
    rows = [...best.values()]
      .sort((a, b) => b.score_total - a.score_total || a.id - b.id)
      .map(r => ({ user: shortUser(r), best: r.score_total, pitch: r.score_pitch, rhythm: r.score_rhythm, stability: r.score_stability, attempts: count.get(r.user_id) }));
  } else {
    const perUser = new Map();
    for (const r of best.values()) {
      if (!perUser.has(r.user_id)) perUser.set(r.user_id, { user: shortUser(r), scores: [] });
      perUser.get(r.user_id).scores.push(r.score_total);
    }
    rows = [...perUser.values()]
      .map(u => ({ user: u.user, average: Math.round(mean(u.scores) * 10) / 10, songs: u.scores.length, attempts: count.get(u.user.id) }))
      .sort((a, b) => b.average - a.average || b.songs - a.songs || byName(a, b));
  }
  return json(200, { rows: rows.map((r, i) => ({ position: i + 1, ...r })) });
}
```
(El `import { SONG_IDS }` va al principio del archivo.)

- [ ] **Step 4: Rutas** — añadir al import de `admin.js` en `routes.js` `team, ranking` y al array:

```js
  ['GET', '/api/admin/team', team],
  ['GET', '/api/admin/ranking', ranking],
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin.js backend/src/routes.js backend/test/admin-stats.test.js
git commit -m "feat(backend): vista de equipo y ranking para administración"
```

---

### Task 11: Panel de administración (frontend)

**Files:**
- Create: `practice/admin-ui.js`
- Modify: `practice/main.js` (conectar `onAdmin`), `practice/practice.css` (añadir al final)

**Interfaces:**
- Consumes: `api.admin.*` (Task 6), `openSheet`, `focusFirst` (Task 7), `renderProgress` (Task 8), `format.js` (Task 6), `getSession` (Task 6).
- Produces: `openAdmin()`.

- [ ] **Step 1: `practice/admin-ui.js`**

```js
import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { renderProgress } from './progress-ui.js';
import { getSession } from './session.js';
import { esc, trendSymbol, daysSince, sinceFor, formatDate, songTitle } from './format.js';

const TABS = [['team', 'Equipo'], ['ranking', 'Ranking'], ['users', 'Usuarios']];
const INACTIVE_DAYS = 14;
const SONG_IDS = ['fum', 'adeste', 'dona', 'fuentecilla', 'campanas', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];

// Estado del panel abierto. Cada vista se pinta en un contenedor nuevo (freshView) para que
// los listeners de una vista anterior no se acumulen ni reciban clics de la siguiente.
let state = null; // { sheet, tab, usersFilter, rankingSong, rankingPeriod }

function handleAuthError(err) {
  if (err.status !== 401 && err.status !== 403) return false;
  state?.sheet.close();
  const s = openSheet({ title: 'Administración', eyebrow: 'Práctica' });
  s.body.innerHTML = `<p class="practice-message">${esc(err.status === 401 ? 'Tu sesión ha caducado. Vuelve a entrar.' : 'Tu usuario no tiene permisos de administración.')}</p>`;
  return true;
}

function showError(container, err, retry) {
  if (handleAuthError(err)) return;
  container.innerHTML = `<div class="practice-error" role="alert"><p>${esc(err.message)}</p><button type="button" class="btn small" data-retry>Reintentar</button></div>`;
  container.querySelector('[data-retry]').addEventListener('click', retry);
}

export function openAdmin() {
  const sheet = openSheet({ title: 'Administración', eyebrow: 'Jefe de cuerda', wide: true, onClose: () => { state = null; } });
  state = { sheet, tab: 'team', usersFilter: '1', rankingSong: 'all', rankingPeriod: 'season' };
  sheet.body.innerHTML = `<div class="admin-tabs" role="tablist">${TABS.map(([id, label]) =>
    `<button type="button" role="tab" class="data-tab" data-tab="${id}" aria-selected="false">${label}</button>`).join('')}</div>
    <div class="admin-view" role="tabpanel"></div>`;
  sheet.body.querySelector('.admin-tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) showTab(tab.dataset.tab);
  });
  showTab('team');
}

function freshView() {
  const old = state.sheet.body.querySelector('.admin-view');
  const view = document.createElement('div');
  view.className = 'admin-view';
  view.setAttribute('role', 'tabpanel');
  old.replaceWith(view);
  return view;
}

function showTab(tab) {
  if (!state) return;
  state.tab = tab;
  state.sheet.body.querySelectorAll('[data-tab]').forEach(b => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.classList.toggle('is-active', on);
  });
  const view = freshView();
  if (tab === 'team') renderTeam(view);
  else if (tab === 'ranking') renderRanking(view);
  else renderUsers(view);
}

const reloadTab = () => showTab(state?.tab);

function showDetail(user) {
  const view = freshView();
  view.innerHTML = `<button type="button" class="data-back" data-back>← Volver</button>
    <h3 class="progress-song">${esc(user.displayName)} <small>@${esc(user.username)}</small></h3><div data-progress></div>`;
  view.querySelector('[data-back]').addEventListener('click', reloadTab);
  renderProgress(view.querySelector('[data-progress]'), { userId: user.id });
}

// ---------- Equipo ----------
async function renderTeam(view) {
  view.innerHTML = '<p class="practice-message">Cargando…</p>';
  let data;
  try { data = await api.admin.team(); } catch (err) { showError(view, err, reloadTab); return; }
  if (!data.team.length) { view.innerHTML = '<p class="practice-message">No hay usuarios activos.</p>'; return; }
  const users = new Map(data.team.map(r => [String(r.user.id), r.user]));
  view.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Tenor</th><th>Último intento</th><th>7 días</th><th>30 días</th><th>Media 30 d</th><th>Tendencia</th></tr></thead>
    <tbody>${data.team.map(r => {
      const days = daysSince(r.lastAttemptAt);
      const idle = days == null || days > INACTIVE_DAYS;
      return `<tr>
        <td><button type="button" class="admin-link" data-user="${r.user.id}">${esc(r.user.displayName)}</button>${idle ? ' <span class="admin-badge">Sin practicar</span>' : ''}</td>
        <td>${r.lastAttemptAt ? esc(formatDate(r.lastAttemptAt)) : '—'}</td>
        <td>${r.attempts7d}</td><td>${r.attempts30d}</td><td>${r.avg30d ?? '—'}</td><td>${trendSymbol(r.trend)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  view.addEventListener('click', e => {
    const btn = e.target.closest('[data-user]');
    if (btn) showDetail(users.get(btn.dataset.user));
  });
  focusFirst(view);
}

// ---------- Ranking ----------
async function renderRanking(view) {
  const { rankingSong: song, rankingPeriod: period } = state;
  view.innerHTML = `<div class="admin-filters">
      <label>Canción <select data-song><option value="all">General</option>${SONG_IDS.map(id => `<option value="${id}">${esc(songTitle(id))}</option>`).join('')}</select></label>
      <label>Periodo <select data-period><option value="7d">7 días</option><option value="30d">30 días</option><option value="season">Temporada</option></select></label>
    </div>
    <p class="admin-note">Solo cuentan canciones completas en modo "Ponerme a prueba".</p>
    <div data-results><p class="practice-message">Cargando…</p></div>`;
  const songSel = view.querySelector('[data-song]');
  const periodSel = view.querySelector('[data-period]');
  songSel.value = song;
  periodSel.value = period;
  songSel.addEventListener('change', () => { state.rankingSong = songSel.value; reloadTab(); });
  periodSel.addEventListener('change', () => { state.rankingPeriod = periodSel.value; reloadTab(); });
  const results = view.querySelector('[data-results]');
  let data;
  try { data = await api.admin.ranking(song, sinceFor(period)); } catch (err) { showError(results, err, reloadTab); return; }
  if (!data.rows.length) { results.innerHTML = '<p class="practice-message">Todavía no hay intentos que cuenten en este periodo.</p>'; return; }
  const general = song === 'all';
  results.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>#</th><th>Tenor</th>${general ? '<th>Media</th><th>Canciones</th>' : '<th>Mejor</th><th>Afinación</th><th>Ritmo</th><th>Estabilidad</th>'}<th>Intentos</th></tr></thead>
    <tbody>${data.rows.map(r => `<tr><td>${r.position}</td><td>${esc(r.user.displayName)}</td>${general
      ? `<td><strong>${r.average}</strong></td><td>${r.songs}</td>`
      : `<td><strong>${r.best}</strong></td><td>${r.pitch}</td><td>${r.rhythm}</td><td>${r.stability ?? '—'}</td>`}<td>${r.attempts}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Usuarios ----------
async function renderUsers(view) {
  view.innerHTML = `<div class="admin-filters">
      <label>Mostrar <select data-filter><option value="1">Activos</option><option value="0">Inactivos</option><option value="all">Todos</option></select></label>
      <button type="button" class="btn small" data-new>Nuevo usuario</button>
    </div><div data-list><p class="practice-message">Cargando…</p></div>`;
  const filterSel = view.querySelector('[data-filter]');
  filterSel.value = state.usersFilter;
  filterSel.addEventListener('change', () => { state.usersFilter = filterSel.value; reloadTab(); });
  view.querySelector('[data-new]').addEventListener('click', () => userForm(null));
  const list = view.querySelector('[data-list]');
  let data;
  try { data = await api.admin.users(state.usersFilter); } catch (err) { showError(list, err, reloadTab); return; }
  if (!data.users.length) { list.innerHTML = '<p class="practice-message">No hay usuarios en esta lista.</p>'; return; }
  const me = getSession()?.user?.id;
  list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${data.users.map(u => `<tr data-id="${u.id}">
      <td><button type="button" class="admin-link" data-act="detail">${esc(u.displayName)}</button></td>
      <td>@${esc(u.username)}</td>
      <td>${u.role === 'admin' ? 'Administrador' : 'Tenor'}</td>
      <td>${u.active ? 'Activo' : `Inactivo${u.deactivatedAt ? ` desde ${esc(formatDate(u.deactivatedAt))}` : ''}`}${u.mustChangePin ? ' · PIN temporal' : ''}</td>
      <td class="admin-actions">
        <button type="button" class="btn small quiet" data-act="edit">Editar</button>
        <button type="button" class="btn small quiet" data-act="reset">Restablecer PIN</button>
        ${u.id === me ? '' : `<button type="button" class="btn small quiet" data-act="${u.active ? 'deactivate' : 'reactivate'}">${u.active ? 'Desactivar' : 'Reactivar'}</button>
        <button type="button" class="btn small quiet admin-danger" data-act="delete">Eliminar</button>`}
      </td></tr>`).join('')}</tbody></table></div>`;
  const byId = new Map(data.users.map(u => [String(u.id), u]));
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const user = byId.get(btn.closest('tr').dataset.id);
    const act = btn.dataset.act;
    if (act === 'detail') showDetail(user);
    else if (act === 'edit') userForm(user);
    else if (act === 'reset') confirmReset(user);
    else if (act === 'deactivate') confirmDeactivate(user);
    else if (act === 'reactivate') api.admin.updateUser(user.id, { active: true }).then(reloadTab, alertSheet);
    else if (act === 'delete') confirmDelete(user);
  });
  focusFirst(view);
}

function alertSheet(err) {
  if (handleAuthError(err)) return;
  const s = openSheet({ title: 'No se pudo completar', eyebrow: 'Administración' });
  s.body.innerHTML = `<p role="alert">${esc(err.message)}</p><button type="button" class="btn small" data-close>Entendido</button>`;
  focusFirst(s.body);
}

const FIELD_NAMES = { username: 'el usuario', displayName: 'el nombre', role: 'el rol', confirmUsername: 'la confirmación' };

function formError(form, err) {
  const el = form.querySelector('[data-error]');
  el.textContent = err.code === 'invalid' && err.field ? `Revisa ${FIELD_NAMES[err.field] || 'los datos'}.` : err.message;
  el.hidden = false;
  const field = err.code === 'username_taken' ? 'username' : err.field;
  if (field && form.elements[field]) form.elements[field].focus();
}

function showPin(user, pin, intro) {
  const s = openSheet({ title: 'PIN temporal', eyebrow: 'Administración' });
  s.body.innerHTML = `<div class="account-form">
    <p>${esc(intro)}</p>
    <p class="admin-pin" aria-label="PIN temporal">${esc(pin)}</p>
    <p>Compártelo con ${esc(user.displayName)} (usuario <strong>@${esc(user.username)}</strong>); tendrá que cambiarlo al entrar. No se volverá a mostrar.</p>
    <div class="practice-actions"><button type="button" class="btn small" data-copy>Copiar</button><button type="button" class="btn small quiet" data-close>Hecho</button></div>
  </div>`;
  s.body.querySelector('[data-copy]').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(pin); e.target.textContent = 'Copiado ✓'; } catch { e.target.textContent = 'Cópialo a mano'; }
  });
  focusFirst(s.body);
}

function userForm(user) {
  const editing = !!user;
  const s = openSheet({ title: editing ? 'Editar usuario' : 'Nuevo usuario', eyebrow: 'Administración' });
  s.body.innerHTML = `<form class="account-form" novalidate>
    <label>Nombre visible<input name="displayName" maxlength="40" required value="${editing ? esc(user.displayName) : ''}"></label>
    <label>Usuario<input name="username" maxlength="24" autocapitalize="none" spellcheck="false" required value="${editing ? esc(user.username) : ''}"></label>
    <p class="admin-note">3–24 caracteres: letras, números, punto, guion o guion bajo.</p>
    <label>Rol<select name="role"><option value="tenor">Tenor</option><option value="admin">Administrador</option></select></label>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">${editing ? 'Guardar cambios' : 'Crear usuario'}</button>
  </form>`;
  const form = s.body.querySelector('form');
  form.elements.role.value = editing ? user.role : 'tenor';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { displayName: form.elements.displayName.value, username: form.elements.username.value, role: form.elements.role.value };
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      if (editing) {
        const changes = {};
        if (data.displayName.trim() !== user.displayName) changes.displayName = data.displayName;
        if (data.username.trim().toLowerCase() !== user.username) changes.username = data.username;
        if (data.role !== user.role) changes.role = data.role;
        if (Object.keys(changes).length) await api.admin.updateUser(user.id, changes);
        s.close();
        reloadTab();
      } else {
        const r = await api.admin.createUser(data);
        s.close();
        reloadTab();
        showPin(r.user, r.temporaryPin, 'Usuario creado.');
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      formError(form, err);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

function confirmSheet({ title, html, confirmLabel, danger = false, onConfirm }) {
  const s = openSheet({ title, eyebrow: 'Administración' });
  s.body.innerHTML = `<form class="account-form" novalidate>${html}
    <p class="account-form__error" role="alert" data-error hidden></p>
    <div class="practice-actions"><button type="submit" class="btn small${danger ? ' admin-danger' : ''}">${confirmLabel}</button><button type="button" class="btn small quiet" data-close>Cancelar</button></div>
  </form>`;
  const form = s.body.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await onConfirm(form, s);
    } catch (err) {
      if (handleAuthError(err)) return;
      formError(form, err);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

function confirmReset(user) {
  confirmSheet({
    title: 'Restablecer PIN',
    html: `<p>Se generará un PIN temporal nuevo para <strong>${esc(user.displayName)}</strong> y se cerrarán sus sesiones abiertas.</p>`,
    confirmLabel: 'Restablecer',
    onConfirm: async (form, s) => {
      const { temporaryPin } = await api.admin.resetPin(user.id);
      s.close();
      reloadTab();
      showPin(user, temporaryPin, 'PIN restablecido.');
    },
  });
}

function confirmDeactivate(user) {
  confirmSheet({
    title: 'Desactivar usuario',
    html: `<p><strong>${esc(user.displayName)}</strong> no podrá entrar ni aparecerá en el equipo ni en el ranking. Su historial se conserva y puedes reactivarlo cuando quieras.</p>`,
    confirmLabel: 'Desactivar',
    onConfirm: async (form, s) => {
      await api.admin.updateUser(user.id, { active: false });
      s.close();
      reloadTab();
    },
  });
}

function confirmDelete(user) {
  confirmSheet({
    title: 'Eliminar usuario',
    danger: true,
    html: `<p>Se borrará <strong>${esc(user.displayName)}</strong> y <strong>todo su historial de intentos</strong>. No se puede deshacer. Si solo ha dejado el coro, mejor desactívalo.</p>
      <label>Escribe <strong>${esc(user.username)}</strong> para confirmar<input name="confirmUsername" autocapitalize="none" spellcheck="false" autocomplete="off" required></label>`,
    confirmLabel: 'Eliminar definitivamente',
    onConfirm: async (form, s) => {
      await api.admin.deleteUser(user.id, form.elements.confirmUsername.value);
      s.close();
      reloadTab();
    },
  });
}
```

- [ ] **Step 2: Conectar en `practice/main.js`**

Añadir el import:
```js
import { openAdmin } from './admin-ui.js';
```
Y cambiar la línea de `practiceHandlers` por:
```js
const practiceHandlers = { onProgress: openMyProgress, onAdmin: openAdmin };
```

- [ ] **Step 3: Estilos** — añadir al final de `practice/practice.css`

```css
.admin-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.admin-tabs .data-tab.is-active { border-color: var(--accent, #0ffc7e); color: var(--accent, #0ffc7e); }
.admin-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 10px; }
.admin-filters label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.admin-filters select { background: #000; color: inherit; border: 1px solid var(--card-border, #1b1d1f); border-radius: 8px; padding: 6px 8px; font: inherit; }
.admin-note { margin: 0 0 10px; font-size: 13px; color: var(--fg-muted, #dfe4ea); opacity: .8; }
.admin-table-wrap { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th, .admin-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--card-border, #1b1d1f); vertical-align: middle; }
.admin-table th { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--fg-muted, #dfe4ea); }
.admin-link { background: none; border: 0; padding: 0; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.admin-badge { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: rgba(255, 196, 0, .15); color: var(--practice-warn, #ffc400); }
.admin-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.admin-danger { color: var(--practice-bad, #ff5c5c); border-color: rgba(255, 92, 92, .6); }
.admin-pin { margin: 4px 0; font-size: 40px; font-weight: 800; letter-spacing: .2em; color: var(--accent, #0ffc7e); font-variant-numeric: tabular-nums; }
.progress-song small { font-weight: 400; color: var(--fg-muted, #dfe4ea); opacity: .8; }
```

- [ ] **Step 4: Verificación**

Run: `node --check practice/admin-ui.js && node --check practice/main.js && npm test && (cd backend && npm test)`
Expected: sin errores; ambas suites en verde.

Manual (web + `wrangler dev`, sesión de administrador):
1. Menú → **Administración**: pestaña Equipo con los tenores activos; "Sin practicar" para quien no tiene intentos en 14 días; clic en un nombre → detalle con su progreso y "← Volver".
2. Ranking: cambiar canción y periodo recarga la tabla; aparece la nota de "Solo cuentan…".
3. Usuarios → Nuevo usuario → muestra PIN temporal con Copiar. Entrar con ese usuario en otra ventana privada → pide elegir PIN.
4. Editar con un usuario repetido → "Ese nombre de usuario ya existe." junto al formulario.
5. Desactivar → confirmación → desaparece de "Activos" y aparece en "Inactivos" con fecha; Reactivar lo devuelve.
6. Restablecer PIN → nuevo PIN; la sesión abierta de ese usuario deja de funcionar.
7. Eliminar → escribir mal el usuario da error; bien, lo borra.
8. En tu propia fila no aparecen Desactivar ni Eliminar.
9. Un tenor (no admin) no ve "Administración" en el menú.

- [ ] **Step 5: Commit**

```bash
git add practice/admin-ui.js practice/main.js practice/practice.css
git commit -m "feat(practica): panel de administración con equipo, ranking y gestión de usuarios"
```

---

### Task 12: Guía de despliegue real y checklist de pruebas

**Files:**
- Modify: `backend/README.md` (añadir sección "Despliegue en Cloudflare y GitHub Pages")
- Create: `docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación.

- [ ] **Step 1: Añadir a `backend/README.md`**

````markdown
## Despliegue en Cloudflare y GitHub Pages

### 1. Cuenta y sesión de Wrangler

Crea una cuenta gratuita en https://dash.cloudflare.com/sign-up y, desde `backend/`:

```bash
npx wrangler login        # abre el navegador para autorizar
```

### 2. Base de datos D1

```bash
npx wrangler d1 create tenores
```

Copia el `database_id` que imprime y sustitúyelo en `wrangler.toml` (línea `database_id = ...`). Después:

```bash
npm run db:migrate:remote
```

### 3. Orígenes permitidos

En `wrangler.toml`, añade a `ALLOWED_ORIGINS` el origen de tu GitHub Pages. El origen es solo esquema y dominio, **sin** la ruta del repositorio:

```toml
ALLOWED_ORIGINS = "https://TU-USUARIO.github.io,http://127.0.0.1:8000,http://localhost:*"
```

### 4. Publicar el Worker

```bash
npm run deploy
```

Wrangler imprime la URL, del estilo `https://tenores-api.TU-SUBDOMINIO.workers.dev`. Compruébala:

```bash
curl https://tenores-api.TU-SUBDOMINIO.workers.dev/api/health   # {"ok":true}
```

### 5. Primer administrador en producción

```bash
node tools/create-admin.mjs tu.usuario "Tu nombre"
npx wrangler d1 execute tenores --remote --file admin-seed.sql
rm admin-seed.sql
```

Guarda el PIN temporal que imprime: lo cambiarás en el primer acceso.

### 6. Conectar la web

En `practice/config.js`, pon la URL del Worker:

```js
export const PRODUCTION_API = 'https://tenores-api.TU-SUBDOMINIO.workers.dev';
```

Haz commit, sube el repositorio a GitHub y activa **Settings → Pages → Deploy from a branch → main / (root)**.

### 7. Comprobar

Abre tu web en GitHub Pages → menú ☰ → **Práctica → Entrar** con el administrador → elige tu PIN → **Administración → Usuarios → Nuevo usuario** para cada tenor.

### Límite de CPU del plan gratuito

El plan gratuito de Workers limita el tiempo de CPU por petición. El hash del PIN usa 20 000 iteraciones (`PIN_ITERATIONS`), pensado para caber holgadamente. Si al entrar ves errores 1102 o "Worker exceeded CPU time limit" en `npx wrangler tail`, baja `PIN_ITERATIONS` en `wrangler.toml` (mínimo 10 000) y vuelve a desplegar; los PIN existentes siguen funcionando porque cada usuario guarda sus propias iteraciones, y se actualizan al cambiar o restablecer el PIN.

### Copias de seguridad

```bash
npx wrangler d1 export tenores --remote --output copia-tenores.sql
```
````

- [ ] **Step 2: Checklist** — `docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md`

```markdown
# Fases 2 y 3 — Pruebas manuales

Entorno local: `npm run serve` (raíz) + `cd backend && npm run dev`.

| # | Prueba | Local | Producción |
|---|---|---|---|
| 1 | Entrar con el administrador y elegir PIN | | |
| 2 | PIN incorrecto ×5 → bloqueo con minutos restantes | | |
| 3 | Crear tenor, entrar con su PIN temporal y cambiarlo | | |
| 4 | Practicar con sesión → "Guardado ✓" | | |
| 5 | Repetir en menos de 10 s → aviso y Reintentar | | |
| 6 | Practicar sin sesión → "Inicia sesión…" → Entrar → se guarda | | |
| 7 | Backend apagado → la práctica funciona; guardar ofrece Reintentar | | |
| 8 | Mi progreso: tarjetas, gráfica, detalle de intentos, Cargar más | | |
| 9 | Administración → Equipo (Sin practicar, tendencia) y detalle de tenor | | |
| 10 | Ranking por canción y general, por periodo | | |
| 11 | Editar, desactivar, reactivar, restablecer PIN y eliminar usuario | | |
| 12 | Un tenor no ve "Administración"; Esc y Tab en todos los diálogos | | |
| 13 | Móvil: diálogos a pantalla completa, teclado numérico en el PIN | | |
```

- [ ] **Step 3: Verificación final**

Run: `npm test && (cd backend && npm test) && git diff --stat main -- app.js styles.css index.html`
Expected: ambas suites en verde; el diff contra `main` de esos tres archivos solo muestra los cambios ya existentes de la fase 1 (`index.html` +2 líneas, `app.js` con las URLs `.m4a`) y nada de esta rama.

- [ ] **Step 4: Commit**

```bash
git add backend/README.md docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md
git commit -m "docs: guía de despliegue en Cloudflare y GitHub Pages y checklist de pruebas"
```
