# Gestión de canciones desde el panel · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el administrador añada, edite, ordene, desactive y reactive canciones desde el panel, y que la portada, la página de canción y la práctica las tomen del backend con el mismo diseño de hoy.

**Architecture:** Una tabla `songs` en D1 (migración `0002_songs.sql`, generada desde `app.js` e `index.html`) es la fuente de verdad. El Worker expone una lista pública y rutas de administración en `backend/src/songs.js`. En el navegador, `practice/songs.js` mantiene la lista (copia en `localStorage` → incluidas en `app.js` → backend) y llama a `window.applySongList` de `app.js`, que reconstruye las tarjetas y la página de canción. El panel calcula la referencia de notas en el navegador (`practice/reference-builder.js`, mismo motor que `tools/build-pitch.js`) y la sube.

**Tech Stack:** Cloudflare Workers + D1, Node ≥ 22 (`node:test`, `node:sqlite`), JavaScript ES2022 sin dependencias en el navegador.

**Spec:** `docs/superpowers/specs/2026-10-13-gestion-canciones-design.md`

**Rama:** `main` está al día con las fases 1–3. Crear `feature/gestion-canciones` desde `main` antes de la Task 1.

## Global Constraints

- Coste 0: Cloudflare Workers + D1 en plan gratuito. Sin subida de archivos; el audio llega como enlace `https://`.
- El `id` (slug) de una canción nunca cambia tras crearla.
- Validación: `title` 1–80 caracteres tras recortar; `track` `null` o `https://` de hasta 500 caracteres; `lyrics` hasta 20 000 caracteres; título duplicado sin distinguir mayúsculas → `409 title_taken`.
- Errores JSON con el formato de siempre: `{ "error": "<código>", ...extra }`; validación → `400 { error: 'invalid', field }`.
- Las rutas `/api/admin/songs*` exigen rol `admin` (`403 forbidden`; sin sesión `401`). `GET /api/songs` y `GET /api/songs/:id/reference` son públicas.
- Cuerpos JSON hasta 32 KB, salvo `PUT /api/admin/songs/:id/reference` (512 KB).
- Cambiar o quitar el audio borra `reference` y pone `legacy_reference = 0`. Los intentos anteriores se conservan y siguen contando igual.
- Fechas en ISO 8601 UTC con `toISOString()`.
- Sin dependencias de ejecución en el navegador; el backend solo usa APIs de Workers (sin módulos de Node en `backend/src/`).
- Textos de interfaz en español con tildes; todo texto dinámico insertado con `innerHTML` pasa por `esc` (o se usa `textContent`).
- Estilos nuevos solo al final de `practice/practice.css`; `styles.css` no se modifica. `app.js` e `index.html` solo cambian donde lo indica la Task 5.
- Commits sin líneas `Co-Authored-By` ni ninguna otra atribución.

## Review Focus

1. **Títulos con tildes, apóstrofos o signos** ("Kling Glöckchen, klingelingeling", "O'Holy Night", "¡Noche de Paz!") → slug limpio y SQL bien escapado → tests en Task 1 y Task 2.
2. **Enlace que no es audio, da 404 o bloquea CORS** → error junto al campo y no se guarda nada → tests de `referenceFromUrl` en Task 6.
3. **Backend caído, lento o copia en `localStorage` corrupta al abrir el sitio** → el sitio pinta al momento con la copia o las 12 incluidas → tests en Task 4.
4. **Se desactiva o se le quita el audio a una canción mientras alguien la practica** → el guardado responde `400 field songId` y el sitio deja de ofrecerla → test en Task 2 y repintado en Task 5.
5. **Se cambia el audio de una de las 12 migradas y falla la subida de la referencia** → no se usa el archivo antiguo (`legacyReference` pasa a `false`) y el formulario permite reintentar sin duplicar → tests en Task 2 y Task 4, flujo en Task 6.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `tools/build-songs-migration.mjs` | Genera `backend/migrations/0002_songs.sql` desde `SONGS` (app.js) y el orden de las tarjetas (index.html) |
| `backend/migrations/0002_songs.sql` | Tabla `songs` + las 12 canciones (generado, versionado) |
| `backend/src/songs.js` | Slug, validación, lista pública, referencia pública y CRUD de administración de canciones (sustituye a `SONG_IDS`) |
| `backend/src/attempts.js` · `backend/src/admin.js` | Validan canciones contra la tabla |
| `backend/src/cors.js` · `backend/src/routes.js` | `PUT` en CORS y rutas nuevas |
| `practice/songs.js` | Lista de canciones del sitio (copia, incluidas, backend), práctica posible, URL de referencia, reordenar |
| `practice/api.js` | Cliente de las rutas nuevas y mensaje `title_taken` |
| `app.js` | `applySongList`, tarjetas dinámicas, canciones sin audio, buscador sobre tarjetas nuevas |
| `practice/main.js` · `practice/practice-ui.js` | Botón "Practicar" y referencia desde la lista |
| `practice/reference-builder.js` | Descargar, decodificar y analizar un audio → referencia (con errores en español) |
| `practice/admin-ui.js` | Pestaña "Canciones" y selector del ranking desde la lista |
| `tools/build-pitch.js` | Reutiliza `mixDown` de `reference-builder.js` |
| `backend/README.md` · checklist | Despliegue y pruebas manuales |

---

### Task 1: Migración de canciones y su generador

**Files:**
- Create: `tools/build-songs-migration.mjs`
- Create (generado): `backend/migrations/0002_songs.sql`
- Test: `test/songs-migration.test.js`, `backend/test/songs.test.js` (primer test)

**Interfaces:**
- Produces: tabla `songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at)` con las 12 canciones (`legacy_reference = 1`, `reference = NULL`, `created_at = updated_at = '2026-10-13T00:00:00.000Z'`), en el orden de la portada: `fum, campanas, adeste, dona, fuentecilla, estrella, paz, merry, kling, tannenbaum, mundo, stelle`. Exporta `extractSongs(appSource)`, `cardOrder(html)`, `buildMigration(songs, order)`.

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feature/gestion-canciones
```

- [ ] **Step 2: Test que falla** — `test/songs-migration.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSongs, cardOrder, buildMigration } from '../tools/build-songs-migration.mjs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ORDER = ['fum', 'campanas', 'adeste', 'dona', 'fuentecilla', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];

test('extrae las 12 canciones de app.js con título, audio y letra', () => {
  const songs = extractSongs(read('app.js'));
  assert.deepEqual(Object.keys(songs).sort(), [...ORDER].sort());
  assert.equal(songs.fum.title, 'Fum Fum Fum');
  assert.match(songs.fum.track, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(songs.fum.lyrics, /^Veinticinco de diciembre\n/);
});

test('el orden sale de las tarjetas de la portada', () => {
  assert.deepEqual(cardOrder(read('index.html')), ORDER);
});

test('escapa comillas simples y numera posiciones', () => {
  const sql = buildMigration({ a: { title: "O'Holy", track: 'https://x.test/a.m4a', lyrics: "it's\nok; yes" } }, ['a']);
  assert.match(sql, /CREATE TABLE songs/);
  assert.match(sql, /VALUES \('a', 'O''Holy', 'https:\/\/x\.test\/a\.m4a', 'it''s\nok; yes', 1, 1, 1, NULL, '2026-10-13T00:00:00\.000Z', '2026-10-13T00:00:00\.000Z'\);/);
});

test('falla si una canción no tiene tarjeta', () => {
  assert.throws(() => buildMigration({ a: { title: 'A' } }, []), /sin tarjeta: a/);
  assert.throws(() => buildMigration({}, ['b']), /sin datos en SONGS: b/);
});

test('el SQL versionado coincide con el generado', () => {
  const expected = buildMigration(extractSongs(read('app.js')), cardOrder(read('index.html')));
  assert.equal(read('backend/migrations/0002_songs.sql'), expected);
});
```

- [ ] **Step 3: Verlo fallar**

Run: `node --test test/songs-migration.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` (`tools/build-songs-migration.mjs`).

- [ ] **Step 4: Generador** — `tools/build-songs-migration.mjs`

```js
// Uso: node tools/build-songs-migration.mjs — genera backend/migrations/0002_songs.sql a partir de
// SONGS (app.js) y del orden de las tarjetas de la portada (index.html). Se ejecuta una vez y el SQL
// se versiona; un test comprueba que siguen coincidiendo.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CREATED_AT = '2026-10-13T00:00:00.000Z';

const SCHEMA = `-- Generado por tools/build-songs-migration.mjs. No editar a mano.
CREATE TABLE songs (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  track            TEXT,
  lyrics           TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  legacy_reference INTEGER NOT NULL DEFAULT 0,
  reference        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX songs_title ON songs(title COLLATE NOCASE);
`;

export function extractSongs(appSource) {
  const source = appSource.replace(/\r\n/g, '\n');
  const marker = 'const SONGS=';
  const start = source.indexOf(marker);
  const end = source.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('No se encontró SONGS en app.js');
  // Código propio del repositorio: se evalúa el literal del objeto, sin ejecutar el resto de app.js.
  return new Function(`return ${source.slice(start + marker.length, end + 2)}`)();
}

export function cardOrder(html) {
  const grid = html.slice(html.indexOf('id="grid"'));
  return [...grid.slice(0, grid.indexOf('</div>')).matchAll(/data-song="([^"]+)"/g)].map(m => m[1]);
}

const sql = v => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

export function buildMigration(songs, order) {
  const noCard = Object.keys(songs).filter(id => !order.includes(id));
  if (noCard.length) throw new Error(`Canciones sin tarjeta: ${noCard.join(', ')}`);
  const noData = order.filter(id => !songs[id]);
  if (noData.length) throw new Error(`Tarjetas sin datos en SONGS: ${noData.join(', ')}`);
  const rows = order.map((id, i) => {
    const s = songs[id];
    return `INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES (${sql(id)}, ${sql(s.title)}, ${sql(s.track || null)}, ${sql(s.lyrics || '')}, ${i + 1}, 1, 1, NULL, ${sql(CREATED_AT)}, ${sql(CREATED_AT)});`;
  });
  return `${SCHEMA}${rows.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = p => readFileSync(new URL(p, ROOT), 'utf8');
  const out = new URL('backend/migrations/0002_songs.sql', ROOT);
  writeFileSync(out, buildMigration(extractSongs(read('app.js')), cardOrder(read('index.html'))));
  console.log(`Escrito ${fileURLToPath(out)}`);
}
```

- [ ] **Step 5: Generar el SQL y pasar los tests**

Run: `node tools/build-songs-migration.mjs && node --test test/songs-migration.test.js`
Expected: "Escrito …0002_songs.sql" y 5 tests en verde.

- [ ] **Step 6: Test de la migración en el backend** — crear `backend/test/songs.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/app.js';

const ORDER = ['fum', 'campanas', 'adeste', 'dona', 'fuentecilla', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];

test('la migración deja las 12 canciones en el orden de la portada', async () => {
  const t = setup();
  const { results } = await t.db.prepare('SELECT id, title, position, active, legacy_reference, reference, lyrics FROM songs ORDER BY position').all();
  assert.deepEqual(results.map(r => r.id), ORDER);
  assert.deepEqual(results.map(r => r.position), ORDER.map((_, i) => i + 1));
  assert.ok(results.every(r => r.active === 1 && r.legacy_reference === 1 && r.reference === null));
  assert.equal(results.find(r => r.id === 'kling').title, 'Kling Glöckchen, klingelingeling');
  assert.match(results.find(r => r.id === 'adeste').lyrics, /;/);
});
```

Run: `cd backend && npm test`
Expected: toda la suite en verde (54 anteriores + 1).

- [ ] **Step 7: Comprobar la migración con Wrangler en local**

Run: `cd backend && npm run db:migrate:local`
Expected: Wrangler aplica `0002_songs.sql` sin errores (las letras contienen `;` dentro de cadenas: este paso confirma que Wrangler las trata bien). Después: `npx wrangler d1 execute tenores --local --command "SELECT COUNT(*) AS n FROM songs"` → `n = 12`.

- [ ] **Step 8: Commit**

```bash
git add tools/build-songs-migration.mjs backend/migrations/0002_songs.sql test/songs-migration.test.js backend/test/songs.test.js
git commit -m "feat(backend): tabla de canciones con las 12 actuales"
```

---

### Task 2: Backend — lista pública, referencia y validación de canciones contra la tabla

**Files:**
- Modify: `backend/src/songs.js` (sustituir por completo), `backend/src/attempts.js`, `backend/src/admin.js`, `backend/src/routes.js`
- Test: `backend/test/songs.test.js`

**Interfaces:**
- Consumes: tabla `songs` (Task 1); `HttpError`, `json` (`http.js`).
- Produces (en `backend/src/songs.js`): `slugify(title) → string`, `SONG_COLUMNS` (string SQL), `publicSong(row)`, `songExists(db, id) → Promise<boolean>`, `practicableSong(db, id) → Promise<boolean>`, handlers `listSongs(ctx)` y `songReference(ctx)`. Respuesta pública por canción: `{id, title, track, lyrics, position, active, hasReference, legacyReference}`.

- [ ] **Step 1: Tests que fallan** — añadir a `backend/test/songs.test.js` (cambiar la línea de import por la de abajo)

```js
import { setup, attemptPayload } from './helpers/app.js';
import { slugify } from '../src/songs.js';

test('slugify: tildes, signos, longitud y vacío', () => {
  assert.equal(slugify('Canto de las campanas'), 'canto-de-las-campanas');
  assert.equal(slugify('Kling Glöckchen, klingelingeling'), 'kling-glockchen-klingelingeling');
  assert.equal(slugify('  ¡Noche de Paz!  '), 'noche-de-paz');
  assert.equal(slugify("O'Holy Night"), 'o-holy-night');
  assert.equal(slugify('Ñandú & Co.'), 'nandu-co');
  assert.equal(slugify('???'), 'cancion');
  assert.equal(slugify(`${'a'.repeat(39)} b`), 'a'.repeat(39));
  assert.ok(slugify('x'.repeat(100)).length <= 40);
});

test('GET /api/songs es público y lista las canciones en orden', async () => {
  const t = setup();
  const r = await t.call('GET', '/api/songs');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.songs.map(s => s.id), ORDER);
  const fum = r.body.songs[0];
  assert.deepEqual(Object.keys(fum).sort(), ['active', 'hasReference', 'id', 'legacyReference', 'lyrics', 'position', 'title', 'track']);
  assert.deepEqual([fum.title, fum.position, fum.active, fum.hasReference, fum.legacyReference], ['Fum Fum Fum', 1, true, false, true]);
});

test('GET /api/songs/:id/reference: 404 sin referencia guardada o canción inexistente', async () => {
  const t = setup();
  assert.deepEqual((await t.call('GET', '/api/songs/fum/reference')).body, { error: 'not_found' });
  assert.equal((await t.call('GET', '/api/songs/nada/reference')).status, 404);
  await t.db.prepare('UPDATE songs SET reference = ? WHERE id = ?').bind('{"version":1,"songId":"fum"}', 'fum').run();
  const r = await t.call('GET', '/api/songs/fum/reference');
  assert.deepEqual([r.status, r.body], [200, { version: 1, songId: 'fum' }]);
  assert.match(r.headers.get('Content-Type'), /application\/json/);
});

test('intentos: solo canciones activas con audio; listado acepta cualquier canción de la tabla', async () => {
  const t = setup();
  await t.seedUser();
  const token = await t.loginAs();
  await t.db.prepare("INSERT INTO songs (id, title, track, lyrics, position, created_at, updated_at) VALUES ('solo-letra', 'Solo letra', NULL, '', 13, 'x', 'x')").run();
  await t.db.prepare("UPDATE songs SET active = 0 WHERE id = 'dona'").run();
  for (const songId of ['solo-letra', 'dona', 'nada']) {
    const r = await t.call('POST', '/api/attempts', { token, body: attemptPayload({ songId }) });
    assert.deepEqual([r.status, r.body], [400, { error: 'invalid', field: 'songId' }], songId);
  }
  assert.equal((await t.call('POST', '/api/attempts', { token, body: attemptPayload({ songId: 'campanas' }) })).status, 201);
  assert.equal((await t.call('GET', '/api/me/attempts?song=dona', { token })).status, 200);
  assert.equal((await t.call('GET', '/api/me/attempts?song=solo-letra', { token })).status, 200);
  assert.deepEqual((await t.call('GET', '/api/me/attempts?song=nada', { token })).body, { error: 'invalid', field: 'song' });
});

test('ranking acepta canciones de la tabla, también inactivas', async () => {
  const t = setup();
  await t.seedUser({ username: 'jefe', role: 'admin' });
  const admin = await t.loginAs('jefe');
  await t.db.prepare("UPDATE songs SET active = 0 WHERE id = 'dona'").run();
  assert.equal((await t.call('GET', '/api/admin/ranking?song=dona', { token: admin })).status, 200);
  assert.deepEqual((await t.call('GET', '/api/admin/ranking?song=nada', { token: admin })).body, { error: 'invalid', field: 'song' });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `cd backend && node --test test/songs.test.js`
Expected: FAIL (`slugify` no existe y `GET /api/songs` da 404).

- [ ] **Step 3: `backend/src/songs.js`** (sustituye al archivo con `SONG_IDS`)

```js
import { HttpError, json } from './http.js';

export const SONG_COLUMNS = 'id, title, track, lyrics, position, active, legacy_reference, reference IS NOT NULL AS has_reference, created_at, updated_at';

export function slugify(title) {
  const base = String(title).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '');
  return base || 'cancion';
}

export function publicSong(row) {
  return {
    id: row.id,
    title: row.title,
    track: row.track,
    lyrics: row.lyrics,
    position: row.position,
    active: !!row.active,
    hasReference: !!row.has_reference,
    legacyReference: !!row.legacy_reference,
  };
}

export async function songExists(db, id) {
  return !!(await db.prepare('SELECT 1 AS x FROM songs WHERE id = ?').bind(id).first());
}

// Se puede practicar y guardar intentos: activa y con audio.
export async function practicableSong(db, id) {
  const row = await db.prepare('SELECT active, track FROM songs WHERE id = ?').bind(id).first();
  return !!(row && row.active && row.track);
}

export async function listSongs(ctx) {
  const { results } = await ctx.db.prepare(`SELECT ${SONG_COLUMNS} FROM songs ORDER BY position, id`).all();
  return json(200, { songs: results.map(publicSong) });
}

export async function songReference(ctx) {
  const row = await ctx.db.prepare('SELECT reference FROM songs WHERE id = ?').bind(ctx.params.id).first();
  if (!row || row.reference === null) throw new HttpError(404, 'not_found');
  return new Response(row.reference, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
```

- [ ] **Step 4: `backend/src/attempts.js`**

Cambiar el import `import { SONG_IDS } from './songs.js';` por:

```js
import { songExists, practicableSong } from './songs.js';
```

En `validateAttempt`, sustituir `if (!SONG_IDS.includes(b.songId)) bad('songId');` por:

```js
  if (typeof b.songId !== 'string' || !b.songId) bad('songId');
```

En `createAttempt`, justo después de `const a = validateAttempt(await readJson(ctx.request));`, añadir:

```js
  if (!(await practicableSong(ctx.db, a.songId))) bad('songId');
```

En `attemptsPage`, sustituir `if (song !== null && !SONG_IDS.includes(song)) bad('song');` por:

```js
  if (song !== null && !(await songExists(db, song))) bad('song');
```

- [ ] **Step 5: `backend/src/admin.js`**

Cambiar `import { SONG_IDS } from './songs.js';` por `import { songExists } from './songs.js';` y en `ranking` sustituir
`if (song !== 'all' && !SONG_IDS.includes(song)) throw new HttpError(400, 'invalid', { field: 'song' });` por:

```js
  if (song !== 'all' && (song === null || !(await songExists(ctx.db, song)))) throw new HttpError(400, 'invalid', { field: 'song' });
```

- [ ] **Step 6: Rutas** — en `backend/src/routes.js` añadir el import y las dos rutas públicas tras `/api/health`:

```js
import { listSongs, songReference } from './songs.js';
```

```js
  ['GET', '/api/songs', listSongs],
  ['GET', '/api/songs/:id/reference', songReference],
```

- [ ] **Step 7: Suite completa**

Run: `cd backend && npm test`
Expected: todo en verde (`grep -rn SONG_IDS backend/src` no devuelve nada).

- [ ] **Step 8: Commit**

```bash
git add backend/src/songs.js backend/src/attempts.js backend/src/admin.js backend/src/routes.js backend/test/songs.test.js
git commit -m "feat(backend): lista pública de canciones y validación contra la tabla"
```

---

### Task 3: Backend — administración de canciones

**Files:**
- Modify: `backend/src/songs.js` (añadir al final), `backend/src/routes.js`, `backend/src/cors.js`
- Test: `backend/test/songs.test.js`

**Interfaces:**
- Consumes: `requireAdmin(ctx)` (`auth.js`), `readJson(request, maxBytes)`, `noContent` (`http.js`), `SONG_COLUMNS`, `publicSong`, `slugify` (Task 2).
- Produces: `adminSong(row)` = `publicSong(row)` + `{createdAt, updatedAt}`; handlers `adminListSongs`, `createSong`, `updateSong`, `putSongReference`, `reorderSongs`; rutas `GET/POST /api/admin/songs`, `PUT /api/admin/songs/order`, `PATCH /api/admin/songs/:id`, `PUT /api/admin/songs/:id/reference`. Errores nuevos: `409 title_taken`, `400 invalid` con `field` ∈ `title|track|lyrics|active|reference|ids|body`.

- [ ] **Step 1: Tests que fallan** — añadir a `backend/test/songs.test.js`

```js
async function adminSetup() {
  const t = setup();
  await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  await t.seedUser({ username: 'ana', displayName: 'Ana' });
  const admin = await t.loginAs('jefe');
  return { ...t, admin };
}

const REF = id => ({ version: 1, songId: id, source: 'https://x.test/a.m4a', hopMs: 10, frameCount: 3, midi: [57, 57, 57],
  notes: [{ start: 0, end: 3, midi: 57 }], phrases: [{ index: 1, start: 0, end: 3, noteFrom: 0, noteTo: 0 }] });

test('las rutas de administración de canciones rechazan a un tenor (403) y sin sesión (401)', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const routes = [['GET', '/api/admin/songs'], ['POST', '/api/admin/songs'], ['PATCH', '/api/admin/songs/fum'],
    ['PUT', '/api/admin/songs/fum/reference'], ['PUT', '/api/admin/songs/order']];
  for (const [method, path] of routes) {
    const body = method === 'GET' ? undefined : {};
    assert.deepEqual((await t.call(method, path, { token: tenor, body })).body, { error: 'forbidden' }, `${method} ${path}`);
    assert.equal((await t.call(method, path, { body })).status, 401, `${method} ${path} sin sesión`);
  }
});

test('CORS permite PUT', async () => {
  const t = setup();
  const r = await t.call('OPTIONS', '/api/admin/songs/order', { origin: 'http://127.0.0.1:8000' });
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /PUT/);
});

test('crear: slug, al final, sin audio, duplicados y sufijo', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: '  Noche de Paz ', lyrics: 'Noche de paz,\r\nnoche de amor' } });
  assert.equal(r.status, 201);
  const s = r.body.song;
  assert.deepEqual([s.id, s.title, s.track, s.lyrics, s.position, s.active, s.hasReference, s.legacyReference, s.createdAt, s.updatedAt],
    ['noche-de-paz', 'Noche de Paz', null, 'Noche de paz,\nnoche de amor', 13, true, false, false, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z']);
  assert.deepEqual((await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'NOCHE DE PAZ' } })).body, { error: 'title_taken' });
  const other = await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Noche de paz!', track: 'https://x.test/n.m4a' } });
  assert.deepEqual([other.body.song.id, other.body.song.position, other.body.song.track], ['noche-de-paz-2', 14, 'https://x.test/n.m4a']);
  const cases = [[{ title: '' }, 'title'], [{ title: 'x'.repeat(81) }, 'title'], [{ title: 5 }, 'title'],
    [{ title: 'A', track: 'http://x.test/a.m4a' }, 'track'], [{ title: 'A', track: `https://x.test/${'a'.repeat(500)}` }, 'track'],
    [{ title: 'A', track: 'https:// con espacios' }, 'track'], [{ title: 'A', lyrics: 'x'.repeat(20001) }, 'lyrics'], [{ title: 'A', lyrics: 7 }, 'lyrics']];
  for (const [body, field] of cases) {
    assert.deepEqual((await t.call('POST', '/api/admin/songs', { token: t.admin, body })).body, { error: 'invalid', field }, JSON.stringify(body).slice(0, 60));
  }
});

test('editar: título, letra y audio; cambiar o quitar el audio invalida la referencia', async () => {
  const t = await adminSetup();
  const r1 = await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { title: 'Fum, fum, fum', lyrics: 'Nueva\r\nletra' } });
  assert.equal(r1.status, 200);
  assert.deepEqual([r1.body.song.id, r1.body.song.title, r1.body.song.lyrics, r1.body.song.legacyReference], ['fum', 'Fum, fum, fum', 'Nueva\nletra', true]);
  const r2 = await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { track: 'https://x.test/nuevo.m4a' } });
  assert.deepEqual([r2.body.song.track, r2.body.song.hasReference, r2.body.song.legacyReference], ['https://x.test/nuevo.m4a', false, false]);
  assert.equal((await t.call('PUT', '/api/admin/songs/fum/reference', { token: t.admin, body: REF('fum') })).status, 204);
  assert.equal((await t.call('GET', '/api/songs')).body.songs[0].hasReference, true);
  const r3 = await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { track: null } });
  assert.deepEqual([r3.body.song.track, r3.body.song.hasReference], [null, false]);
  assert.deepEqual((await t.call('PUT', '/api/admin/songs/fum/reference', { token: t.admin, body: REF('fum') })).body, { error: 'invalid', field: 'track' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: {} })).body, { error: 'invalid', field: 'body' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/nada', { token: t.admin, body: { title: 'X' } })).body, { error: 'not_found' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { title: 'adeste fideles' } })).body, { error: 'title_taken' });
  assert.deepEqual((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { active: 'no' } })).body, { error: 'invalid', field: 'active' });
  assert.equal((await t.call('PATCH', '/api/admin/songs/fum', { token: t.admin, body: { title: 'Fum, fum, fum' } })).status, 200, 'su propio título no cuenta como duplicado');
});

test('desactivar y reactivar conserva la posición; filtro de la lista', async () => {
  const t = await adminSetup();
  const off = await t.call('PATCH', '/api/admin/songs/dona', { token: t.admin, body: { active: false } });
  assert.deepEqual([off.body.song.active, off.body.song.position], [false, 4]);
  assert.equal((await t.call('GET', '/api/songs')).body.songs.find(s => s.id === 'dona').active, false);
  assert.deepEqual((await t.call('GET', '/api/admin/songs?active=0', { token: t.admin })).body.songs.map(s => s.id), ['dona']);
  assert.equal((await t.call('GET', '/api/admin/songs?active=1', { token: t.admin })).body.songs.length, 11);
  assert.deepEqual((await t.call('GET', '/api/admin/songs?active=x', { token: t.admin })).body, { error: 'invalid', field: 'active' });
  const all = (await t.call('GET', '/api/admin/songs', { token: t.admin })).body.songs;
  assert.equal(all.length, 12);
  assert.deepEqual(Object.keys(all[0]).sort(), ['active', 'createdAt', 'hasReference', 'id', 'legacyReference', 'lyrics', 'position', 'title', 'track', 'updatedAt']);
  const on = await t.call('PATCH', '/api/admin/songs/dona', { token: t.admin, body: { active: true } });
  assert.deepEqual([on.body.song.active, on.body.song.position], [true, 4]);
});

test('subir referencia: forma, songId y límite de 512 KB', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Canción nueva', track: 'https://x.test/a.m4a' } })).body.song.id;
  assert.equal(id, 'cancion-nueva');
  const bad = [{ ...REF(id), songId: 'otra' }, { ...REF(id), version: 2 }, { ...REF(id), phrases: [] }, { ...REF(id), frameCount: 9 }, { ...REF(id), hopMs: 20 }, { ...REF(id), notes: 'x' }];
  for (const body of bad) {
    assert.deepEqual((await t.call('PUT', `/api/admin/songs/${id}/reference`, { token: t.admin, body })).body, { error: 'invalid', field: 'reference' });
  }
  const big = n => ({ ...REF(id), frameCount: n, midi: Array(n).fill(57.12) });
  assert.equal((await t.call('PUT', `/api/admin/songs/${id}/reference`, { token: t.admin, body: big(60000) })).status, 204, '~360 KB se acepta');
  assert.deepEqual((await t.call('PUT', `/api/admin/songs/${id}/reference`, { token: t.admin, body: big(200000) })).body, { error: 'invalid', field: 'body' });
  assert.equal((await t.call('PUT', '/api/admin/songs/nada/reference', { token: t.admin, body: REF('nada') })).status, 404);
  const ref = await t.call('GET', `/api/songs/${id}/reference`);
  assert.equal(ref.body.midi.length, 60000);
});

test('reordenar: todos los ids una vez; la lista pública sigue el nuevo orden', async () => {
  const t = await adminSetup();
  const rev = [...ORDER].reverse();
  assert.equal((await t.call('PUT', '/api/admin/songs/order', { token: t.admin, body: { ids: rev } })).status, 204);
  assert.deepEqual((await t.call('GET', '/api/songs')).body.songs.map(s => s.id), rev);
  for (const ids of [ORDER.slice(1), [...ORDER, 'fum'], [...ORDER.slice(1), 'nada'], 'fum', [...ORDER.slice(1), 'dona']]) {
    assert.deepEqual((await t.call('PUT', '/api/admin/songs/order', { token: t.admin, body: { ids } })).body, { error: 'invalid', field: 'ids' });
  }
});

test('una canción nueva con audio se puede practicar y entra en el ranking', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/songs', { token: t.admin, body: { title: 'Nueva', track: 'https://x.test/n.m4a' } })).body.song.id;
  const tenor = await t.loginAs('ana');
  assert.equal((await t.call('POST', '/api/attempts', { token: tenor, body: attemptPayload({ songId: id }) })).status, 201);
  const ranking = await t.call('GET', `/api/admin/ranking?song=${id}`, { token: t.admin });
  assert.deepEqual([ranking.status, ranking.body.rows[0].best], [200, 82]);
});
```

- [ ] **Step 2: Verlos fallar**

Run: `cd backend && node --test test/songs.test.js`
Expected: FAIL (rutas `/api/admin/songs*` → 404; `Allow-Methods` sin `PUT`).

- [ ] **Step 3: Añadir al final de `backend/src/songs.js`** (y ampliar los imports de la primera línea)

Primera línea:

```js
import { HttpError, json, noContent, readJson } from './http.js';
import { requireAdmin } from './auth.js';
```

Al final del archivo:

```js
const REFERENCE_MAX_BYTES = 512 * 1024;
const bad = field => { throw new HttpError(400, 'invalid', { field }); };

export const adminSong = row => ({ ...publicSong(row), createdAt: row.created_at, updatedAt: row.updated_at });

function validateTitle(v) {
  if (typeof v !== 'string') bad('title');
  const title = v.trim();
  if (title.length < 1 || title.length > 80) bad('title');
  return title;
}

function validateTrack(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') bad('track');
  const track = v.trim();
  if (track.length > 500 || !/^https:\/\/\S+$/.test(track)) bad('track');
  try { new URL(track); } catch { bad('track'); }
  return track;
}

function validateLyrics(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > 20000) bad('lyrics');
  return v.replace(/\r\n/g, '\n');
}

function validateReference(ref, id) {
  const ok = ref.version === 1 && ref.songId === id && ref.hopMs === 10 && Array.isArray(ref.midi)
    && Number.isInteger(ref.frameCount) && ref.frameCount === ref.midi.length
    && Array.isArray(ref.notes) && Array.isArray(ref.phrases) && ref.phrases.length > 0;
  if (!ok) bad('reference');
}

async function songRow(db, id) {
  const row = await db.prepare(`SELECT ${SONG_COLUMNS} FROM songs WHERE id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function titleTaken(db, title, exceptId = '') {
  return !!(await db.prepare('SELECT id FROM songs WHERE title = ? COLLATE NOCASE AND id <> ?').bind(title, exceptId).first());
}

async function uniqueSlug(db, title) {
  const base = slugify(title);
  let id = base;
  for (let n = 2; await songExists(db, id); n++) id = `${base}-${n}`;
  return id;
}

export async function adminListSongs(ctx) {
  await requireAdmin(ctx);
  const active = ctx.url.searchParams.get('active') ?? 'all';
  if (!['all', '1', '0'].includes(active)) bad('active');
  const where = active === 'all' ? '' : 'WHERE active = ?';
  const stmt = ctx.db.prepare(`SELECT ${SONG_COLUMNS} FROM songs ${where} ORDER BY position, id`);
  const { results } = await (active === 'all' ? stmt : stmt.bind(Number(active))).all();
  return json(200, { songs: results.map(adminSong) });
}

export async function createSong(ctx) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.request);
  const title = validateTitle(body.title);
  const track = validateTrack(body.track);
  const lyrics = validateLyrics(body.lyrics);
  if (await titleTaken(ctx.db, title)) throw new HttpError(409, 'title_taken');
  const id = await uniqueSlug(ctx.db, title);
  const position = await ctx.db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM songs').first('p');
  const ts = ctx.now.toISOString();
  await ctx.db.prepare(`INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)`).bind(id, title, track, lyrics, position, ts, ts).run();
  return json(201, { song: adminSong(await songRow(ctx.db, id)) });
}

export async function updateSong(ctx) {
  await requireAdmin(ctx);
  const current = await songRow(ctx.db, ctx.params.id);
  const body = await readJson(ctx.request);
  if (!['title', 'track', 'lyrics', 'active'].some(k => k in body)) bad('body');
  const next = { title: current.title, track: current.track, lyrics: current.lyrics, active: current.active };
  if ('title' in body) {
    next.title = validateTitle(body.title);
    if (await titleTaken(ctx.db, next.title, current.id)) throw new HttpError(409, 'title_taken');
  }
  if ('track' in body) next.track = validateTrack(body.track);
  if ('lyrics' in body) next.lyrics = validateLyrics(body.lyrics);
  if ('active' in body) {
    if (typeof body.active !== 'boolean') bad('active');
    next.active = body.active ? 1 : 0;
  }
  // Otro audio (o ninguno): la referencia anterior ya no vale, tampoco el archivo de assets/pitch/.
  const resetReference = next.track !== current.track ? ', reference = NULL, legacy_reference = 0' : '';
  await ctx.db.prepare(`UPDATE songs SET title = ?, track = ?, lyrics = ?, active = ?, updated_at = ?${resetReference} WHERE id = ?`)
    .bind(next.title, next.track, next.lyrics, next.active, ctx.now.toISOString(), current.id).run();
  return json(200, { song: adminSong(await songRow(ctx.db, current.id)) });
}

export async function putSongReference(ctx) {
  await requireAdmin(ctx);
  const current = await songRow(ctx.db, ctx.params.id);
  const ref = await readJson(ctx.request, REFERENCE_MAX_BYTES);
  if (!current.track) bad('track');
  validateReference(ref, current.id);
  await ctx.db.prepare('UPDATE songs SET reference = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(ref), ctx.now.toISOString(), current.id).run();
  return noContent();
}

export async function reorderSongs(ctx) {
  await requireAdmin(ctx);
  const { ids } = await readJson(ctx.request);
  const { results } = await ctx.db.prepare('SELECT id FROM songs').all();
  const existing = new Set(results.map(r => r.id));
  if (!Array.isArray(ids) || ids.length !== existing.size || new Set(ids).size !== ids.length || !ids.every(id => existing.has(id))) bad('ids');
  await ctx.db.batch(ids.map((id, i) => ctx.db.prepare('UPDATE songs SET position = ? WHERE id = ?').bind(i + 1, id)));
  return noContent();
}
```

- [ ] **Step 4: Rutas y CORS**

En `backend/src/routes.js`, ampliar el import de `./songs.js` a:

```js
import { listSongs, songReference, adminListSongs, createSong, updateSong, putSongReference, reorderSongs } from './songs.js';
```

y añadir al final de `ROUTES`:

```js
  ['GET', '/api/admin/songs', adminListSongs],
  ['POST', '/api/admin/songs', createSong],
  ['PUT', '/api/admin/songs/order', reorderSongs],
  ['PATCH', '/api/admin/songs/:id', updateSong],
  ['PUT', '/api/admin/songs/:id/reference', putSongReference],
```

En `backend/src/cors.js` cambiar `'GET, POST, PATCH, DELETE, OPTIONS'` por `'GET, POST, PUT, PATCH, DELETE, OPTIONS'`.

- [ ] **Step 5: Suite completa**

Run: `cd backend && npm test`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add backend/src/songs.js backend/src/routes.js backend/src/cors.js backend/test/songs.test.js
git commit -m "feat(backend): crear, editar, ordenar y desactivar canciones desde administración"
```

---

### Task 4: Lista de canciones en el navegador y cliente de la API

**Files:**
- Create: `practice/songs.js`
- Modify: `practice/api.js`
- Test: `test/songs.test.js`, `test/api.test.js`

**Interfaces:**
- Consumes: `API_BASE`, `apiEnabled` (`config.js`); contrato de Tasks 2–3.
- Produces (`practice/songs.js`): `configureSongsStorage(store)`, `normalizeSongs(raw) → Song[] | null`, `initSongs({ builtIn, fetchImpl?, base?, enabled? }) → Promise<Song[]>`, `refreshSongs({ fetchImpl?, base?, enabled? }) → Promise<Song[]>`, `getSongs() → Song[]`, `getSong(id) → Song | null`, `onSongsChange(fn) → unsubscribe`, `canPractice(song) → boolean`, `referenceUrl(song, base?) → string`, `moveInOrder(allIds, visibleIds, id, dir) → string[]`. `Song = {id, title, track|null, lyrics, position, active, hasReference, legacyReference}`. Clave de `localStorage`: `tenores.songs.v1`.
- Produces (`practice/api.js`): `api.songs()`, `api.admin.songs(active)`, `api.admin.createSong(data)`, `api.admin.updateSong(id, data)`, `api.admin.putSongReference(id, ref)`, `api.admin.reorderSongs(ids)`; mensaje `title_taken`.

- [ ] **Step 1: Tests que fallan** — `test/songs.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureSongsStorage, normalizeSongs, initSongs, refreshSongs, getSongs, getSong, onSongsChange, canPractice, referenceUrl, moveInOrder } from '../practice/songs.js';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}
const song = (id, extra = {}) => ({ id, title: id.toUpperCase(), track: `https://x.test/${id}.m4a`, lyrics: '', position: 1, active: true, hasReference: false, legacyReference: true, ...extra });
const BUILT_IN = [song('fum', { position: 1 }), song('dona', { position: 2 })];
const ok = body => async () => new Response(JSON.stringify(body), { status: 200 });
const OPTS = { base: 'http://api.test', enabled: true };

test('normalizeSongs: valida, completa valores y ordena por posición', () => {
  assert.equal(normalizeSongs(null), null);
  assert.equal(normalizeSongs([{ id: 'x' }]), null);
  assert.deepEqual(normalizeSongs([{ id: 'b', title: 'B', position: 2, track: '' }, { id: 'a', title: 'A', position: 1, active: false, hasReference: true }]), [
    { id: 'a', title: 'A', track: null, lyrics: '', position: 1, active: false, hasReference: true, legacyReference: false },
    { id: 'b', title: 'B', track: null, lyrics: '', position: 2, active: true, hasReference: false, legacyReference: false },
  ]);
});

test('sin copia guardada usa las incluidas y luego la lista del backend, que guarda', async () => {
  const store = memoryStorage();
  configureSongsStorage(store);
  let changes = 0;
  const off = onSongsChange(() => { changes++; });
  const fresh = [song('dona', { position: 1 }), song('nueva', { position: 2, legacyReference: false })];
  const calls = [];
  const done = initSongs({ builtIn: BUILT_IN, ...OPTS, fetchImpl: async (url, init) => { calls.push([url, init]); return ok({ songs: fresh })(); } });
  assert.deepEqual(getSongs().map(s => s.id), ['fum', 'dona'], 'primer pintado con las incluidas');
  await done;
  off();
  assert.deepEqual(getSongs().map(s => s.id), ['dona', 'nueva']);
  assert.equal(calls[0][0], 'http://api.test/api/songs');
  assert.equal(changes, 2);
  assert.deepEqual(JSON.parse(store.m.get('tenores.songs.v1')).map(s => s.id), ['dona', 'nueva']);
  assert.equal(getSong('nueva').title, 'NUEVA');
  assert.equal(getSong('nada'), null);
});

test('con copia guardada la usa al momento; si el backend falla se queda con ella', async () => {
  configureSongsStorage(memoryStorage({ 'tenores.songs.v1': JSON.stringify([song('copia')]) }));
  await initSongs({ builtIn: BUILT_IN, ...OPTS, fetchImpl: async () => { throw new TypeError('offline'); } });
  assert.deepEqual(getSongs().map(s => s.id), ['copia']);
  await refreshSongs({ ...OPTS, fetchImpl: async () => new Response('x', { status: 500 }) });
  assert.deepEqual(getSongs().map(s => s.id), ['copia']);
});

test('copia corrupta o almacenamiento que falla → incluidas; sin backend no se pide nada', async () => {
  configureSongsStorage(memoryStorage({ 'tenores.songs.v1': '{roto' }));
  let called = false;
  await initSongs({ builtIn: BUILT_IN, base: 'http://api.test', enabled: false, fetchImpl: async () => { called = true; } });
  assert.deepEqual(getSongs().map(s => s.id), ['fum', 'dona']);
  assert.equal(called, false);
  configureSongsStorage({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } });
  await initSongs({ builtIn: BUILT_IN, ...OPTS, fetchImpl: ok({ songs: [song('a')] }) });
  assert.deepEqual(getSongs().map(s => s.id), ['a'], 'sin almacenamiento sigue funcionando en memoria');
});

test('canPractice exige activa, audio y alguna referencia', () => {
  assert.equal(canPractice(song('a')), true);
  assert.equal(canPractice(song('a', { legacyReference: false })), false);
  assert.equal(canPractice(song('a', { legacyReference: false, hasReference: true })), true);
  assert.equal(canPractice(song('a', { track: null })), false);
  assert.equal(canPractice(song('a', { active: false })), false);
  assert.equal(canPractice(null), false);
});

test('referenceUrl: backend si hay referencia guardada, archivo si no', () => {
  assert.equal(referenceUrl(song('a b', { hasReference: true }), 'http://api.test'), 'http://api.test/api/songs/a%20b/reference');
  assert.match(referenceUrl(song('fum')), /\/assets\/pitch\/fum\.json$/);
});

test('moveInOrder mueve respecto a la vecina visible y respeta los extremos', () => {
  const all = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveInOrder(all, all, 'c', -1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveInOrder(all, all, 'a', 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(moveInOrder(all, ['a', 'c', 'd'], 'c', -1), ['c', 'a', 'b', 'd'], 'b está oculta');
  assert.deepEqual(moveInOrder(all, ['a', 'c', 'd'], 'c', 1), ['a', 'b', 'd', 'c']);
  assert.deepEqual(moveInOrder(all, all, 'a', -1), all);
  assert.deepEqual(moveInOrder(all, all, 'd', 1), all);
});
```

Y añadir a `test/api.test.js`:

```js
test('mensaje de título duplicado', () => {
  assert.equal(messageFor('title_taken'), 'Ya existe una canción con ese título.');
});
```

- [ ] **Step 2: Verlos fallar**

Run: `node --test test/songs.test.js test/api.test.js`
Expected: FAIL (`practice/songs.js` no existe; mensaje genérico en vez del de título).

- [ ] **Step 3: `practice/songs.js`**

```js
import { API_BASE, apiEnabled } from './config.js';

// Canciones del sitio. Orden de preferencia: copia guardada → incluidas en app.js → backend.
// El backend se pide en segundo plano; si falla, se sigue con lo que hay.
const KEY = 'tenores.songs.v1';
const events = new EventTarget();
let storage = () => globalThis.localStorage;
let list = [];

export function configureSongsStorage(store) {
  storage = () => store;
  list = [];
}

export function normalizeSongs(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const s of raw) {
    if (!s || typeof s.id !== 'string' || !s.id || typeof s.title !== 'string') return null;
    out.push({
      id: s.id,
      title: s.title,
      track: typeof s.track === 'string' && s.track ? s.track : null,
      lyrics: typeof s.lyrics === 'string' ? s.lyrics : '',
      position: Number.isFinite(s.position) ? s.position : out.length + 1,
      active: s.active !== false,
      hasReference: s.hasReference === true,
      legacyReference: s.legacyReference === true,
    });
  }
  return out.sort((a, b) => a.position - b.position);
}

function readCache() {
  try { return normalizeSongs(JSON.parse(storage()?.getItem(KEY) ?? 'null')); } catch { return null; }
}

function writeCache(songs) {
  try { storage()?.setItem(KEY, JSON.stringify(songs)); } catch { /* sin almacenamiento: solo en memoria */ }
}

function setList(next) {
  if (JSON.stringify(next) === JSON.stringify(list)) return;
  list = next;
  events.dispatchEvent(new Event('change'));
}

export const getSongs = () => list;
export const getSong = id => list.find(s => s.id === id) || null;

export function onSongsChange(fn) {
  events.addEventListener('change', fn);
  return () => events.removeEventListener('change', fn);
}

export async function refreshSongs({ fetchImpl = globalThis.fetch, base = API_BASE, enabled = apiEnabled } = {}) {
  if (!enabled) return list;
  try {
    const res = await fetchImpl(`${base}/api/songs`, { cache: 'no-store' });
    if (!res.ok) return list;
    const fresh = normalizeSongs((await res.json())?.songs);
    if (fresh && fresh.length) {
      writeCache(fresh);
      setList(fresh);
    }
  } catch { /* backend caído o lento: se sigue con la copia o las incluidas */ }
  return list;
}

export function initSongs({ builtIn = [], ...options } = {}) {
  setList(readCache() || normalizeSongs(builtIn) || []);
  return refreshSongs(options);
}

export function canPractice(song) {
  return !!song && song.active && !!song.track && (song.hasReference || song.legacyReference);
}

export function referenceUrl(song, base = API_BASE) {
  return song.hasReference
    ? `${base}/api/songs/${encodeURIComponent(song.id)}/reference`
    : new URL(`../assets/pitch/${encodeURIComponent(song.id)}.json`, import.meta.url).href;
}

// Nuevo orden completo tras mover `id` una posición (dir −1 sube, +1 baja) respecto a la canción
// vecina dentro de la lista visible (p. ej. solo las activas).
export function moveInOrder(allIds, visibleIds, id, dir) {
  const neighbour = visibleIds[visibleIds.indexOf(id) + dir];
  if (neighbour === undefined) return allIds.slice();
  const ids = allIds.filter(x => x !== id);
  const at = ids.indexOf(neighbour);
  ids.splice(dir < 0 ? at : at + 1, 0, id);
  return ids;
}
```

- [ ] **Step 4: `practice/api.js`**

En `MESSAGES`, tras `username_taken`, añadir:

```js
  title_taken: 'Ya existe una canción con ese título.',
```

En el objeto `api`, añadir antes de `admin:`:

```js
  songs: () => request('GET', '/api/songs'),
```

y dentro de `admin`, al final:

```js
    songs: (active = 'all') => request('GET', `/api/admin/songs${query({ active })}`),
    createSong: data => request('POST', '/api/admin/songs', data),
    updateSong: (id, data) => request('PATCH', `/api/admin/songs/${encodeURIComponent(id)}`, data),
    putSongReference: (id, ref) => request('PUT', `/api/admin/songs/${encodeURIComponent(id)}/reference`, ref, { timeoutMs: 30_000 }),
    reorderSongs: ids => request('PUT', '/api/admin/songs/order', { ids }),
```

- [ ] **Step 5: Tests en verde**

Run: `npm test`
Expected: toda la suite raíz en verde.

- [ ] **Step 6: Commit**

```bash
git add practice/songs.js practice/api.js test/songs.test.js test/api.test.js
git commit -m "feat(practica): lista de canciones con copia local y cliente de la API de canciones"
```

---

### Task 5: El sitio toma las canciones de la lista

**Files:**
- Modify: `app.js` (líneas indicadas), `practice/main.js`, `practice/practice-ui.js:160-174`

**Interfaces:**
- Consumes: `initSongs`, `getSongs`, `getSong`, `onSongsChange`, `canPractice`, `referenceUrl` (Task 4).
- Produces: `window.applySongList(list: Song[])` en `app.js`; `openPractice(song)` acepta `song.referenceUrl`.

- [ ] **Step 1: `app.js` — referencia a la tarjeta de audio**

Tras la línea `const $lblTrk=document.getElementById('lbl-track');` (≈ línea 273) añadir:

```js
const $audioCard=document.querySelector('#song-view .audio-card');
```

- [ ] **Step 2: `app.js` — `renderSong` acepta canciones inactivas o sin audio**

En `renderSong`, sustituir `const s=SONGS[id]; if(!s) return renderHome();` por:

```js
  const s=SONGS[id]; if(!s||s.active===false) return renderHome();
```

sustituir las dos líneas `$trk.src=s.track;` y `$trk.load();` por:

```js
    if(s.track) $trk.src=s.track; else $trk.removeAttribute('src');
    $trk.load();
```

y justo después de `$lblTrk.dataset.default=$lblTrk.textContent;` añadir:

```js
  $audioCard.hidden=!s.track; // canción solo con letra: sin reproductor, descarga ni práctica
```

- [ ] **Step 3: `app.js` — tarjetas dinámicas y buscador**

Sustituir la línea `const items=[...document.querySelectorAll('#grid [data-song]')].map(a=>({el:a,id:a.getAttribute('data-song'),title:normalize(a.querySelector('.mini-title').textContent)}));` por:

```js
function collectItems(){return [...document.querySelectorAll('#grid [data-song]')].map(a=>({el:a,id:a.getAttribute('data-song'),title:normalize(a.querySelector('.mini-title').textContent)}));}
let items=collectItems();
```

Y tras la línea `$q.addEventListener('keydown',e=>{ if(e.key==='Escape'){ $q.value=''; applyFilter(''); $q.blur(); }});` añadir:

```js
// Lista de canciones (practice/songs.js la actualiza desde el backend). Reconstruye las tarjetas con el
// mismo marcado que index.html y repinta la canción abierta si cambió.
function applySongList(list){
  const before=currentSongId&&SONGS[currentSongId]?{...SONGS[currentSongId]}:null;
  for(const id of Object.keys(SONGS)) delete SONGS[id];
  for(const s of list) SONGS[s.id]={title:s.title,track:s.track||'',lyrics:s.lyrics||'',active:s.active!==false};
  $grid.replaceChildren(...list.filter(s=>s.active!==false).map((s,i)=>{
    const a=document.createElement('a');
    a.className='mini-card'; a.href=`#${encodeURIComponent(s.id)}`; a.dataset.song=s.id;
    const badge=document.createElement('span'); badge.className='mini-badge'; badge.textContent=String(i+1).padStart(2,'0');
    const title=document.createElement('span'); title.className='mini-title'; title.textContent=s.title;
    a.append(badge,title);
    return a;
  }));
  items=collectItems();
  applyFilter($q.value);
  if(!$songView.hidden) setActiveCard(currentSongId||'');
  if(!$songView.hidden&&currentSongId){
    const now=SONGS[currentSongId];
    const same=before&&now&&now.active&&now.title===before.title&&now.track===before.track&&now.lyrics===before.lyrics;
    if(!same){
      if(!now||!before||now.track!==before.track) currentSongId=null; // fuerza recargar el audio
      route();
    }
  }
}
window.applySongList=applySongList;
```

- [ ] **Step 4: `practice/main.js`** — sustituir desde la primera línea hasta `window.addEventListener('hashchange', …)` y el bloque `fetch(INDEX_URL)…` por:

```js
import { openPractice, closePractice } from './practice-ui.js';
import { isRecordingSupported } from './recorder.js';
import { apiEnabled } from './config.js';
import { mountPracticeMenu } from './menu.js';
import { openMyProgress } from './progress-ui.js';
import { openAdmin } from './admin-ui.js';
import { initSongs, getSongs, getSong, onSongsChange, canPractice, referenceUrl } from './songs.js';

// Canciones incluidas en el sitio: SONGS de app.js (script clásico, global) en el orden de las tarjetas
// de index.html. Se usan hasta que llega la lista del backend, o siempre si no hay backend.
function builtInSongs() {
  const all = typeof SONGS === 'undefined' ? {} : SONGS;
  const order = [...document.querySelectorAll('#grid [data-song]')].map(a => a.dataset.song);
  return order.filter(id => all[id]).map((id, i) => ({
    id, title: all[id].title, track: all[id].track || null, lyrics: all[id].lyrics || '',
    position: i + 1, active: true, hasReference: false, legacyReference: true,
  }));
}

function songFromHash() {
  let id;
  try { id = decodeURIComponent((location.hash || '').slice(1)).trim(); }
  catch { return null; } // hash mal formado (p. ej. #%E0): sin canción
  const song = getSong(id);
  if (!canPractice(song)) return null;
  return { id: song.id, title: song.title, track: song.track, referenceUrl: referenceUrl(song) };
}

function syncButton() {
  const header = document.querySelector('#song-view .audio-card-header');
  const view = document.getElementById('song-view');
  if (!header || !view) return;
  let btn = document.getElementById('practiceOpen');
  const song = songFromHash();
  if (!song || view.hidden) {
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
  btn.textContent = supported ? 'Practicar' : 'Tu navegador no permite grabar';
  btn.title = supported ? 'Grábate y compárate con la referencia' : 'Tu navegador no permite grabar';
}

window.addEventListener('hashchange', () => { closePractice(); syncButton(); });

onSongsChange(() => {
  if (typeof window.applySongList === 'function') window.applySongList(getSongs());
  syncButton();
});
initSongs({ builtIn: builtInSongs() });
```

(El bloque final de `practiceHandlers` y `mountPracticeMenu` se queda igual.)

- [ ] **Step 5: `practice/practice-ui.js` — referencia desde la lista**

En `loadReference`, sustituir `const res = await fetch(new URL(\`${encodeURIComponent(s.song.id)}.json\`, PITCH_DIR));` por:

```js
    const res = await fetch(s.song.referenceUrl || new URL(`${encodeURIComponent(s.song.id)}.json`, PITCH_DIR));
```

- [ ] **Step 6: Comprobaciones**

Run: `node --check app.js && node --check practice/main.js && node --check practice/practice-ui.js && npm test`
Expected: sin errores; suite raíz en verde. (La comprobación en el navegador la hace el controlador en la Task 7.)

- [ ] **Step 7: Commit**

```bash
git add app.js practice/main.js practice/practice-ui.js
git commit -m "feat(sitio): la portada, la canción y la práctica usan la lista de canciones"
```

---

### Task 6: Pestaña "Canciones" en el panel

**Files:**
- Create: `practice/reference-builder.js`
- Modify: `practice/admin-ui.js`, `tools/build-pitch.js` (usar `mixDown` compartido), `practice/practice.css` (añadir al final)
- Test: `test/reference-builder.test.js`

**Interfaces:**
- Consumes: `buildReference` (`practice/reference.js`); `api.admin.songs/createSong/updateSong/putSongReference/reorderSongs`; `getSongs`, `refreshSongs`, `moveInOrder` (Task 4).
- Produces: `mixDown(buffer) → Float32Array`; `referenceFromUrl(songId, url, { onStage?, fetchImpl?, decode? }) → Promise<Reference>`; `ReferenceBuildError` con `code` ∈ `download|decode|no_phrases` y mensaje en español.

- [ ] **Step 1: Test que falla** — `test/reference-builder.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceFromUrl, mixDown, ReferenceBuildError } from '../practice/reference-builder.js';
import { sine, silence, concat } from './helpers/synth.js';

const fakeBuffer = (...channels) => ({ numberOfChannels: channels.length, length: channels[0].length, sampleRate: 48000, getChannelData: c => channels[c] });
const okFetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

test('mixDown promedia los canales', () => {
  assert.deepEqual([...mixDown(fakeBuffer(Float32Array.of(1, 1), Float32Array.of(0, 0.5)))], [0.5, 0.75]);
});

test('descarga fallida o con error HTTP → error "download"', async () => {
  for (const fetchImpl of [async () => { throw new TypeError('cors'); }, async () => ({ ok: false })]) {
    await assert.rejects(referenceFromUrl('x', 'https://x.test/a.m4a', { fetchImpl, decode: async () => fakeBuffer(silence(1)) }),
      e => e instanceof ReferenceBuildError && e.code === 'download' && e.message === 'No se pudo descargar el audio. Revisa el enlace.');
  }
});

test('archivo que no es audio → error "decode"', async () => {
  await assert.rejects(referenceFromUrl('x', 'https://x.test/a.txt', { fetchImpl: okFetch, decode: async () => { throw new Error('EncodingError'); } }),
    e => e.code === 'decode' && e.message === 'El enlace no contiene un audio válido.');
});

test('audio sin notas → error "no_phrases"', async () => {
  await assert.rejects(referenceFromUrl('x', 'https://x.test/a.m4a', { fetchImpl: okFetch, decode: async () => fakeBuffer(silence(2)) }),
    e => e.code === 'no_phrases' && e.message === 'No se detectaron notas en el audio.');
});

test('audio con notas → referencia versión 1 y aviso de etapas', async () => {
  const stages = [];
  const audio = concat(sine(220, 1.5), silence(0.5), sine(246.94, 1.5));
  const ref = await referenceFromUrl('nueva', 'https://x.test/a.m4a', { fetchImpl: okFetch, decode: async () => fakeBuffer(audio), onStage: s => stages.push(s) });
  assert.deepEqual(stages, ['download', 'analyze']);
  assert.equal(ref.version, 1);
  assert.equal(ref.songId, 'nueva');
  assert.equal(ref.source, 'https://x.test/a.m4a');
  assert.equal(ref.phrases.length, 2);
});
```

- [ ] **Step 2: Verlo fallar**

Run: `node --test test/reference-builder.test.js`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: `practice/reference-builder.js`**

```js
import { buildReference } from './reference.js';

// Calcula en el navegador la referencia de notas de un audio (mismo motor que tools/build-pitch.html).
export class ReferenceBuildError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function mixDown(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

const decodeAudio = data => new OfflineAudioContext(1, 1, 48000).decodeAudioData(data);

export async function referenceFromUrl(songId, url, { onStage = () => {}, fetchImpl = globalThis.fetch, decode = decodeAudio } = {}) {
  onStage('download');
  let data;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.arrayBuffer();
  } catch {
    throw new ReferenceBuildError('download', 'No se pudo descargar el audio. Revisa el enlace.');
  }
  onStage('analyze');
  await new Promise(r => setTimeout(r)); // deja pintar el aviso antes del análisis, que bloquea un momento
  let buffer;
  try { buffer = await decode(data); } catch { throw new ReferenceBuildError('decode', 'El enlace no contiene un audio válido.'); }
  const ref = buildReference({ songId, source: url, samples: mixDown(buffer), sampleRate: buffer.sampleRate });
  if (!ref.phrases.length) throw new ReferenceBuildError('no_phrases', 'No se detectaron notas en el audio.');
  return ref;
}
```

- [ ] **Step 4: Test en verde**

Run: `node --test test/reference-builder.test.js`
Expected: 5 tests en verde.

- [ ] **Step 5: `tools/build-pitch.js` reutiliza `mixDown`**

Añadir `import { mixDown } from '../practice/reference-builder.js';` a los imports y borrar la función local `mixDown` (las líneas `function mixDown(buffer) { … }`).

- [ ] **Step 6: `practice/admin-ui.js` — imports, pestaña y ranking**

Sustituir el bloque de imports y constantes (líneas 1–9) por:

```js
import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { renderProgress } from './progress-ui.js';
import { getSession } from './session.js';
import { esc, trendSymbol, daysSince, sinceFor, formatDate } from './format.js';
import { getSongs, refreshSongs, moveInOrder } from './songs.js';
import { referenceFromUrl } from './reference-builder.js';

const TABS = [['team', 'Equipo'], ['ranking', 'Ranking'], ['users', 'Usuarios'], ['songs', 'Canciones']];
const INACTIVE_DAYS = 14;
```

En `openAdmin`, sustituir `state = { sheet, tab: 'team', usersFilter: '1', rankingSong: 'all', rankingPeriod: 'season' };` por:

```js
  state = { sheet, tab: 'team', usersFilter: '1', songsFilter: '1', focusSong: null, rankingSong: 'all', rankingPeriod: 'season' };
```

En `showTab`, sustituir `else renderUsers(view);` por:

```js
  else if (tab === 'songs') renderSongs(view);
  else renderUsers(view);
```

En `renderRanking`, sustituir `${SONG_IDS.map(id => \`<option value="${id}">${esc(songTitle(id))}</option>\`).join('')}` por:

```js
${getSongs().map(s => `<option value="${esc(s.id)}">${esc(s.title)}${s.active ? '' : ' (inactiva)'}</option>`).join('')}
```

Sustituir `FIELD_NAMES` y `formError` por:

```js
const FIELD_NAMES = { username: 'el usuario', displayName: 'el nombre', role: 'el rol', confirmUsername: 'la confirmación', title: 'el título', track: 'el enlace del audio', lyrics: 'la letra' };

function showFormError(form, message, field) {
  const el = form.querySelector('[data-error]');
  el.textContent = message;
  el.hidden = false;
  if (field && form.elements[field]) form.elements[field].focus();
}

function formError(form, err) {
  const field = err.code === 'username_taken' ? 'username' : err.code === 'title_taken' ? 'title' : err.field;
  showFormError(form, err.code === 'invalid' && err.field ? `Revisa ${FIELD_NAMES[err.field] || 'los datos'}.` : err.message, field);
}
```

- [ ] **Step 7: `practice/admin-ui.js` — sección "Canciones"** (añadir al final del archivo)

```js
// ---------- Canciones ----------
const afterSongChange = () => { refreshSongs(); reloadTab(); };

async function renderSongs(view) {
  view.innerHTML = `<div class="admin-filters">
      <label>Mostrar <select data-filter><option value="1">Activas</option><option value="0">Inactivas</option><option value="all">Todas</option></select></label>
      <button type="button" class="btn small" data-new>Nueva canción</button>
    </div><div data-list><p class="practice-message">Cargando…</p></div>`;
  const filterSel = view.querySelector('[data-filter]');
  filterSel.value = state.songsFilter;
  filterSel.addEventListener('change', () => { state.songsFilter = filterSel.value; reloadTab(); });
  view.querySelector('[data-new]').addEventListener('click', () => songForm(null));
  const list = view.querySelector('[data-list]');
  let data;
  try { data = await api.admin.songs('all'); } catch (err) { showError(list, err, reloadTab); return; }
  const all = data.songs; // en orden de portada
  const shown = all.filter(s => state.songsFilter === 'all' || String(Number(s.active)) === state.songsFilter);
  if (!shown.length) { list.innerHTML = '<p class="practice-message">No hay canciones en esta lista.</p>'; return; }
  const number = new Map(all.filter(s => s.active).map((s, i) => [s.id, String(i + 1).padStart(2, '0')]));
  list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>#</th><th>Título</th><th>Audio</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${shown.map((s, k) => `<tr data-id="${esc(s.id)}">
      <td>${number.get(s.id) || '—'}</td>
      <td>${esc(s.title)}</td>
      <td>${s.track ? 'Sí' : 'No'}</td>
      <td>${s.active ? 'Activa' : 'Inactiva'}</td>
      <td class="admin-actions">
        <button type="button" class="btn small quiet" data-act="up" aria-label="Subir ${esc(s.title)}"${k === 0 ? ' disabled' : ''}>Subir</button>
        <button type="button" class="btn small quiet" data-act="down" aria-label="Bajar ${esc(s.title)}"${k === shown.length - 1 ? ' disabled' : ''}>Bajar</button>
        <button type="button" class="btn small quiet" data-act="edit">Editar</button>
        <button type="button" class="btn small quiet" data-act="${s.active ? 'deactivate' : 'reactivate'}">${s.active ? 'Desactivar' : 'Reactivar'}</button>
      </td></tr>`).join('')}</tbody></table></div>`;
  const byId = new Map(all.map(s => [s.id, s]));
  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const song = byId.get(btn.closest('tr').dataset.id);
    const act = btn.dataset.act;
    if (act === 'up' || act === 'down') {
      btn.disabled = true;
      const ids = moveInOrder(all.map(s => s.id), shown.map(s => s.id), song.id, act === 'up' ? -1 : 1);
      try {
        await api.admin.reorderSongs(ids);
        state.focusSong = { id: song.id, act };
        afterSongChange();
      } catch (err) { btn.disabled = false; alertSheet(err); }
    } else if (act === 'edit') songForm(song);
    else if (act === 'deactivate') confirmDeactivateSong(song);
    else if (act === 'reactivate') api.admin.updateSong(song.id, { active: true }).then(afterSongChange, alertSheet);
  });
  // Tras Subir/Bajar se repinta la tabla: el foco vuelve al mismo botón de la misma canción.
  const focus = state.focusSong;
  state.focusSong = null;
  const target = focus && [...list.querySelectorAll('tr[data-id]')].find(tr => tr.dataset.id === focus.id)?.querySelector(`[data-act="${focus.act}"]`);
  if (target && !target.disabled) target.focus(); else focusFirst(view);
}

function songForm(song) {
  let current = song; // tras crear, el formulario pasa a editar esa canción (para reintentar sin duplicar)
  let pendingRef = null; // referencia calculada que no se pudo subir
  const s = openSheet({ title: song ? 'Editar canción' : 'Nueva canción', eyebrow: 'Administración', wide: true });
  s.body.innerHTML = `<form class="account-form" novalidate>
    <label>Título<input name="title" maxlength="80" required value="${song ? esc(song.title) : ''}"></label>
    <label>Enlace del audio<input name="track" type="url" inputmode="url" maxlength="500" autocapitalize="none" spellcheck="false" placeholder="https://res.cloudinary.com/…" value="${song && song.track ? esc(song.track) : ''}"></label>
    <p class="admin-note">Opcional. Sin audio, la canción muestra solo la letra y no se puede practicar.</p>
    <label>Letra<textarea name="lyrics" rows="12" maxlength="20000">${song ? esc(song.lyrics) : ''}</textarea></label>
    <p class="admin-note" data-stage aria-live="polite" hidden></p>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">${song ? 'Guardar cambios' : 'Crear canción'}</button>
  </form>`;
  const form = s.body.querySelector('form');
  const stage = form.querySelector('[data-stage]');
  const button = form.querySelector('button[type=submit]');
  const say = text => { stage.textContent = text; stage.hidden = !text; };
  const fail = (message, field) => { say(''); showFormError(form, message, field); button.disabled = false; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    form.querySelector('[data-error]').hidden = true;
    const title = form.elements.title.value.trim();
    const track = form.elements.track.value.trim() || null;
    const lyrics = form.elements.lyrics.value;
    if (!title) return showFormError(form, 'Escribe el título.', 'title');
    if (track && !/^https:\/\//i.test(track)) return showFormError(form, 'El enlace debe empezar por https://', 'track');
    button.disabled = true;

    // 1. Si el audio es nuevo, se analiza antes de guardar nada.
    const oldTrack = current?.track || null;
    let ref = null;
    if (track && (track !== oldTrack || (pendingRef && pendingRef.source === track))) {
      if (pendingRef && pendingRef.source === track) ref = pendingRef;
      else {
        try {
          ref = await referenceFromUrl(current?.id || 'nueva', track, { onStage: st => say(st === 'download' ? 'Descargando audio…' : 'Analizando audio…') });
        } catch (err) { return fail(err.message, 'track'); }
      }
    }

    // 2. Datos de la canción.
    say('Guardando…');
    try {
      if (current) {
        const changes = {};
        if (title !== current.title) changes.title = title;
        if (track !== oldTrack) changes.track = track;
        if (lyrics !== current.lyrics) changes.lyrics = lyrics;
        if (Object.keys(changes).length) current = (await api.admin.updateSong(current.id, changes)).song;
      } else {
        current = (await api.admin.createSong({ title, track, lyrics })).song;
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      say('');
      formError(form, err);
      button.disabled = false;
      return;
    }

    // 3. Referencia de notas.
    if (ref) {
      try {
        await api.admin.putSongReference(current.id, { ...ref, songId: current.id });
        pendingRef = null;
      } catch (err) {
        if (handleAuthError(err)) return;
        pendingRef = ref;
        refreshSongs();
        return fail('Se guardó la canción pero no su referencia. Vuelve a guardar para reintentarlo.', 'track');
      }
    }
    s.close();
    afterSongChange();
  });
  focusFirst(form);
}

function confirmDeactivateSong(song) {
  confirmSheet({
    title: 'Desactivar canción',
    html: `<p><strong>${esc(song.title)}</strong> no aparecerá en el sitio ni en práctica. Su historial se conserva y puedes reactivarla cuando quieras.</p>`,
    confirmLabel: 'Desactivar',
    onConfirm: async (form, s) => {
      await api.admin.updateSong(song.id, { active: false });
      s.close();
      afterSongChange();
    },
  });
}
```

- [ ] **Step 8: Estilos** — añadir al final de `practice/practice.css`

```css
/* Gestión de canciones */
.account-form textarea {
  background: #000; color: inherit; border: 1px solid var(--card-border, #1b1d1f); border-radius: 10px;
  padding: 10px 12px; font: inherit; font-weight: 400; line-height: 1.5; min-height: 220px; resize: vertical;
}
```

- [ ] **Step 9: Comprobaciones**

Run: `node --check practice/admin-ui.js && node --check practice/reference-builder.js && node --check tools/build-pitch.js && npm test`
Expected: sin errores; suite raíz en verde.

- [ ] **Step 10: Commit**

```bash
git add practice/reference-builder.js practice/admin-ui.js practice/practice.css tools/build-pitch.js test/reference-builder.test.js
git commit -m "feat(practica): pestaña Canciones en administración con análisis del audio en el navegador"
```

---

### Task 7: Despliegue, checklist y prueba en el navegador

**Files:**
- Modify: `backend/README.md`, `docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md`

- [ ] **Step 1: Guía** — al final de `backend/README.md` añadir esta sección:

````markdown
## Canciones

Las canciones viven en la tabla `songs` (migración `0002_songs.sql`, que carga las 12 originales). Se gestionan
desde **Administración → Canciones**: crear, editar, subir/bajar, desactivar y reactivar.

- El audio se pega como enlace `https://` (por ejemplo, de Cloudinary). Al guardar, tu navegador descarga el audio
  y calcula la referencia de notas para la práctica; tarda unos segundos.
- Una canción sin enlace muestra solo la letra.
- Si cambias el audio, los intentos anteriores se conservan y siguen contando en el ranking.
- El sitio guarda la última lista en el navegador y usa las 12 canciones incluidas en `app.js` si el backend no
  responde.

**Al desplegar esta versión:** aplica la migración (`npm run db:migrate:remote`) y publica el Worker **antes** de
publicar el sitio nuevo.

Para regenerar `0002_songs.sql` (solo si se cambian las canciones de `app.js` antes del primer despliegue):
`node tools/build-songs-migration.mjs`.
````

- [ ] **Step 2: Checklist** — añadir al final de la tabla del checklist:

```markdown
| 14 | Canciones: crear una solo con letra → sale en la portada sin reproductor ni "Practicar" | | |
| 15 | Canciones: añadirle el enlace del audio → "Descargando…/Analizando…" → se puede practicar y guardar | | |
| 16 | Canciones: Subir/Bajar cambia el orden de la portada (números 01, 02…) | | |
| 17 | Canciones: enlace roto → "No se pudo descargar el audio…" y no se guarda nada | | |
| 18 | Canciones: desactivar → desaparece de la portada y de práctica; sigue en "Mi progreso" con su título | | |
| 19 | Canciones: backend apagado → la portada muestra la última lista guardada | | |
```

- [ ] **Step 3: Suites completas**

Run: `npm test && (cd backend && npm test)`
Expected: ambas suites en verde.

- [ ] **Step 4: Commit**

```bash
git add backend/README.md docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md
git commit -m "docs: despliegue y pruebas de la gestión de canciones"
```

- [ ] **Step 5: Prueba en el navegador (controlador)** — con `cd backend && npm run dev` y `npm run serve`, sesión de administrador, recorrer las filas 14–19 del checklist y además: letra con `<b>` se ve como texto; título con tildes y apóstrofo; vista de móvil (390 px) de la pestaña y del formulario. Anotar el resultado en el informe final.
