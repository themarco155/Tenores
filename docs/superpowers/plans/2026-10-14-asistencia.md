# Asistencia del equipo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los administradores tomen asistencia de cada ensayo desde el panel, consulten un reporte por temporada y vean un leaderboard de asistencia.

**Architecture:** Migración `0003_attendance.sql` con `rehearsals` y `attendance` en la misma D1. `backend/src/attendance.js` reúne las reglas puras (temporadas, fechas, cálculo del reporte) y las rutas `/api/admin/rehearsals*` y `/api/admin/attendance/*`. En el navegador, `practice/attendance.js` tiene utilidades puras (textos, fecha local, cola de guardado automático) y `practice/attendance-ui.js` pinta la pestaña "Asistencia" del panel usando las utilidades que le pasa `admin-ui.js`.

**Tech Stack:** Cloudflare Workers + D1, Node ≥ 22 (`node:test`, `node:sqlite`), JavaScript ES2022 sin dependencias en el navegador.

**Spec:** `docs/superpowers/specs/2026-10-14-asistencia-design.md`

**Rama:** crear `feature/asistencia` desde `main` antes de la Task 1.

## Global Constraints

- Solo administradores: todas las rutas nuevas llaman a `requireAdmin` (tenor → `403 forbidden`, sin sesión → `401`).
- Estados: `present`, `late`, `absent`, `excused` (interfaz: Presente, Tarde, Ausente, Justificado).
- % asistencia = (present + late) / (present + late + absent); `excused` no cuenta; sin denominador → `null`. % tardanzas = late / (present + late). Redondeo a 1 decimal.
- Temporada `Y` = del `Y-09-01` al `(Y+1)-08-31`; temporada actual: mes ≥ septiembre (UTC) → año actual, si no → año anterior.
- Leaderboard: solo activos; mínimo `ceil(0,5 × ensayos de la temporada)` registros; orden % desc, asistidos desc, tardanzas asc, nombre.
- Un ensayo por día (`409 rehearsal_exists`); fecha real `AAAA-MM-DD` no posterior a hoy + 7 días; nota ≤ 200 caracteres.
- Errores JSON: `{ "error": "<código>", ...extra }`; validación → `400 { error: 'invalid', field }`.
- Fechas de auditoría con `toISOString()`.
- Sin dependencias de ejecución en el navegador; sin módulos de Node en `backend/src/`.
- Textos en español con tildes; todo texto dinámico en `innerHTML` pasa por `esc`.
- Estilos nuevos solo al final de `practice/practice.css`; `app.js`, `index.html` y `styles.css` no se modifican.
- Commits sin líneas `Co-Authored-By` ni ninguna otra atribución.

## Review Focus

1. **El ensayo es de noche en El Salvador (UTC−6)**: la fecha "de hoy" debe ser la local del administrador, no la UTC → test de `localToday` en Task 4 y límite de +7 días en Task 1.
2. **Conexión lenta o toques rápidos durante la toma**: ningún cambio se pierde ni se pisa con uno viejo → tests de `createSaveQueue` en Task 4.
3. **Un tenor creado después de abrir el ensayo**: aparece en la lista al guardar → test en Task 2.
4. **Fechas límite** (29 de febrero, 31 de agosto / 1 de septiembre) → tests en Task 1 y Task 3.
5. **Borrar un ensayo por error**: exige escribir la fecha → test en Task 2.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/migrations/0003_attendance.sql` | Tablas `rehearsals` y `attendance` |
| `backend/src/attendance.js` | Reglas puras (temporada, fecha, reporte) y rutas de ensayos/asistencia |
| `backend/src/routes.js` | Registro de las 8 rutas |
| `practice/attendance.js` | Etiquetas, recuentos, fecha local, temporada de una fecha, cola de guardado |
| `practice/attendance-ui.js` | Pestaña "Asistencia": lista, toma de asistencia, reporte |
| `practice/admin-ui.js` | Pestaña nueva y utilidades que se le pasan |
| `practice/api.js` | Cliente de las rutas nuevas y mensaje `rehearsal_exists` |
| `practice/practice.css` | Estilos de la toma y del reporte |

---

### Task 1: Migración y reglas puras del backend

**Files:**
- Create: `backend/migrations/0003_attendance.sql`, `backend/src/attendance.js`
- Test: `backend/test/attendance.test.js`

**Interfaces:**
- Produces (`backend/src/attendance.js`): `STATUSES`, `currentSeason(now: Date) → number`, `seasonRange(season) → {from, to}`, `seasonOf(date: 'AAAA-MM-DD') → number`, `validDate(value, now: Date) → boolean`, `attendanceReport(rows, rehearsalCount) → {rehearsals, minimum, teamAverage, people, leaderboard, belowMinimum}`. `rows` = `[{user_id, display_name, username, active, date, status}]`. Cada persona: `{user:{id, displayName, username, active}, recorded, present, late, absent, excused, attendancePct, latePct, lastAbsence, history:[{date, status}]}`.

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feature/asistencia
```

- [ ] **Step 2: Tests que fallan** — `backend/test/attendance.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/app.js';
import { currentSeason, seasonRange, seasonOf, validDate, attendanceReport } from '../src/attendance.js';

test('la migración crea las tablas de asistencia', async () => {
  const t = setup();
  const { results } = await t.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('rehearsals', 'attendance') ORDER BY name").all();
  assert.deepEqual(results.map(r => r.name), ['attendance', 'rehearsals']);
});

test('temporadas: 1 de septiembre a 31 de agosto', () => {
  assert.equal(currentSeason(new Date('2026-10-14T12:00:00Z')), 2026);
  assert.equal(currentSeason(new Date('2027-08-31T23:00:00Z')), 2026);
  assert.equal(currentSeason(new Date('2027-09-01T00:00:00Z')), 2027);
  assert.deepEqual(seasonRange(2026), { from: '2026-09-01', to: '2027-08-31' });
  assert.equal(seasonOf('2026-09-01'), 2026);
  assert.equal(seasonOf('2027-08-31'), 2026);
  assert.equal(seasonOf('2026-08-31'), 2025);
});

test('validDate: días reales y como mucho 7 días en el futuro', () => {
  const now = new Date('2026-10-14T02:00:00Z'); // 13 de octubre por la noche en El Salvador
  assert.equal(validDate('2026-10-14', now), true);
  assert.equal(validDate('2026-10-21', now), true);
  assert.equal(validDate('2026-10-22', now), false);
  assert.equal(validDate('2024-02-29', now), true);
  assert.equal(validDate('2026-02-29', now), false);
  assert.equal(validDate('2026-13-01', now), false);
  assert.equal(validDate('14/10/2026', now), false);
  assert.equal(validDate(20261014, now), false);
});

const row = (user, date, status, extra = {}) => ({ user_id: user.id, display_name: user.name, username: user.name.toLowerCase(), active: 1, date, status, ...extra });
const U = { ana: { id: 1, name: 'Ana' }, beto: { id: 2, name: 'Beto' }, caro: { id: 3, name: 'Caro' }, dani: { id: 4, name: 'Dani' }, eva: { id: 5, name: 'Eva' }, fito: { id: 6, name: 'Fito' } };
const D = ['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24'];

test('reporte: %, tardanzas, mínimo, desempates e inactivos (números hechos a mano)', () => {
  const rows = [
    ...['present', 'late', 'absent', 'excused'].map((s, i) => row(U.ana, D[i], s)),
    ...D.map(d => row(U.beto, d, 'present')),
    ...['late', 'late', 'present', 'present'].map((s, i) => row(U.caro, D[i], s)),
    row(U.dani, D[3], 'present'),
    ...D.map(d => row(U.eva, d, 'present', { active: 0 })),
    row(U.fito, D[0], 'excused'), row(U.fito, D[1], 'excused'),
  ];
  const r = attendanceReport(rows, 4);
  assert.equal(r.rehearsals, 4);
  assert.equal(r.minimum, 2);
  const ana = r.people.find(p => p.user.id === 1);
  assert.deepEqual({ recorded: ana.recorded, present: ana.present, late: ana.late, absent: ana.absent, excused: ana.excused, pct: ana.attendancePct, latePct: ana.latePct, last: ana.lastAbsence },
    { recorded: 4, present: 1, late: 1, absent: 1, excused: 1, pct: 66.7, latePct: 50, last: '2026-09-17' });
  assert.deepEqual(ana.history.map(h => h.date), [...D].reverse());
  assert.equal(r.people.find(p => p.user.id === 6).attendancePct, null);
  assert.equal(r.people.find(p => p.user.id === 5).user.active, false);
  assert.deepEqual(r.people.map(p => p.user.displayName), ['Ana', 'Beto', 'Caro', 'Dani', 'Eva', 'Fito']);
  assert.deepEqual(r.leaderboard, [{ position: 1, userId: 2 }, { position: 2, userId: 3 }, { position: 3, userId: 1 }]);
  assert.deepEqual(r.belowMinimum, [{ userId: 4 }, { userId: 6 }]);
  assert.equal(r.teamAverage, 91.7);
});

test('reporte de una temporada vacía', () => {
  assert.deepEqual(attendanceReport([], 0), { rehearsals: 0, minimum: 0, teamAverage: null, people: [], leaderboard: [], belowMinimum: [] });
});
```

- [ ] **Step 3: Verlos fallar**

Run: `cd backend && node --test test/attendance.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` (`src/attendance.js`).

- [ ] **Step 4: Migración** — `backend/migrations/0003_attendance.sql`

```sql
CREATE TABLE rehearsals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,
  note        TEXT NOT NULL DEFAULT '',
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE attendance (
  rehearsal_id INTEGER NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (rehearsal_id, user_id)
);
CREATE INDEX attendance_user ON attendance(user_id);
```

- [ ] **Step 5: Reglas puras** — `backend/src/attendance.js`

```js
// Asistencia a ensayos: reglas (temporadas, fechas, reporte) y rutas de administración.
export const STATUSES = ['present', 'late', 'absent', 'excused'];
const DAY = 86_400_000;
const MAX_DAYS_AHEAD = 7;

export const currentSeason = now => (now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
export const seasonRange = season => ({ from: `${season}-09-01`, to: `${season + 1}-08-31` });

export function seasonOf(date) {
  const [y, m] = date.split('-').map(Number);
  return m >= 9 ? y : y - 1;
}

export function validDate(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const limit = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + MAX_DAYS_AHEAD * DAY;
  return d.getTime() <= limit;
}

const round1 = x => Math.round(x * 10) / 10;
const byName = (a, b) => a.user.displayName.localeCompare(b.user.displayName, 'es', { sensitivity: 'base' }) || a.user.id - b.user.id;

export function attendanceReport(rows, rehearsalCount) {
  const byUser = new Map();
  for (const r of rows) {
    let p = byUser.get(r.user_id);
    if (!p) {
      p = { user: { id: r.user_id, displayName: r.display_name, username: r.username, active: !!r.active },
        recorded: 0, present: 0, late: 0, absent: 0, excused: 0, lastAbsence: null, history: [] };
      byUser.set(r.user_id, p);
    }
    p.recorded++;
    p[r.status]++;
    p.history.push({ date: r.date, status: r.status });
    if (r.status === 'absent' && (!p.lastAbsence || r.date > p.lastAbsence)) p.lastAbsence = r.date;
  }
  const people = [...byUser.values()].map(p => {
    const attended = p.present + p.late;
    const counted = attended + p.absent;
    p.history.sort((a, b) => b.date.localeCompare(a.date));
    return { ...p, attendancePct: counted ? round1((attended / counted) * 100) : null, latePct: attended ? round1((p.late / attended) * 100) : null };
  }).sort(byName);
  const minimum = Math.ceil(rehearsalCount * 0.5);
  const active = people.filter(p => p.user.active);
  const ranked = active.filter(p => p.attendancePct !== null && p.recorded >= minimum)
    .sort((a, b) => b.attendancePct - a.attendancePct || (b.present + b.late) - (a.present + a.late) || a.late - b.late || byName(a, b));
  const pcts = active.map(p => p.attendancePct).filter(v => v !== null);
  return {
    rehearsals: rehearsalCount,
    minimum,
    teamAverage: pcts.length ? round1(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
    people,
    leaderboard: ranked.map((p, i) => ({ position: i + 1, userId: p.user.id })),
    belowMinimum: active.filter(p => !ranked.includes(p)).map(p => ({ userId: p.user.id })),
  };
}
```

- [ ] **Step 6: Tests en verde**

Run: `cd backend && npm test`
Expected: toda la suite en verde (69 anteriores + 5).

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/0003_attendance.sql backend/src/attendance.js backend/test/attendance.test.js
git commit -m "feat(backend): tablas de asistencia y cálculo del reporte por temporada"
```

---

### Task 2: Rutas de ensayos y toma de asistencia

**Files:**
- Modify: `backend/src/attendance.js` (añadir al final), `backend/src/routes.js`
- Test: `backend/test/attendance.test.js`

**Interfaces:**
- Consumes: `requireAdmin(ctx) → user` (`auth.js`), `validateId` (`validate.js`), `HttpError`, `json`, `noContent`, `readJson` (`http.js`); Task 1.
- Produces: rutas `GET/POST /api/admin/rehearsals`, `GET/PATCH/DELETE /api/admin/rehearsals/:id`, `PUT /api/admin/rehearsals/:id/attendance`. Respuestas: lista `{rehearsals:[{id, date, note, present, late, absent, excused}]}`; detalle `{rehearsal:{id, date, note}, entries:[{user:{id, displayName, username, active}, status}]}`; guardado `{entries}`.

- [ ] **Step 1: Tests que fallan** — añadir a `backend/test/attendance.test.js`

```js
async function adminSetup() {
  const t = setup(); // reloj en 2026-10-01T10:00:00Z (temporada 2026)
  const adminId = await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  const anaId = await t.seedUser({ username: 'ana', displayName: 'Ana' });
  await t.seedUser({ username: 'baja', displayName: 'Baja', active: 0 });
  const admin = await t.loginAs('jefe');
  return { ...t, adminId, anaId, admin };
}

test('crear ensayo: activos como Ausente, desactivados fuera, fecha única y válida', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30', note: '  Ensayo general ' } });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.rehearsal.date, r.body.rehearsal.note], ['2026-09-30', 'Ensayo general']);
  assert.deepEqual(r.body.entries.map(e => [e.user.displayName, e.status]), [['Ana', 'absent'], ['Jefe', 'absent']]);
  assert.deepEqual(Object.keys(r.body.entries[0].user).sort(), ['active', 'displayName', 'id', 'username']);
  assert.deepEqual((await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } })).body, { error: 'rehearsal_exists' });
  for (const [body, field] of [[{ date: '2026-10-09' }, 'date'], [{ date: '2026-02-30' }, 'date'], [{}, 'date'], [{ date: '2026-09-29', note: 'x'.repeat(201) }, 'note']]) {
    assert.deepEqual((await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body })).body, { error: 'invalid', field });
  }
  assert.equal((await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-10-08' } })).status, 201, 'hasta 7 días en el futuro');
});

test('listar con recuentos por temporada, de más reciente a más antiguo', async () => {
  const t = await adminSetup();
  const a = (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-10' } })).body.rehearsal.id;
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-17' } });
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-08-20' } }); // temporada 2025
  await t.call('PUT', `/api/admin/rehearsals/${a}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'late' }] } });
  const list = await t.call('GET', '/api/admin/rehearsals?season=2026', { token: t.admin });
  assert.deepEqual(list.body.rehearsals.map(r => [r.date, r.present, r.late, r.absent, r.excused]), [['2026-09-17', 0, 0, 2, 0], ['2026-09-10', 0, 1, 1, 0]]);
  assert.deepEqual((await t.call('GET', '/api/admin/rehearsals', { token: t.admin })).body.rehearsals.length, 2, 'sin season → temporada actual');
  assert.deepEqual((await t.call('GET', '/api/admin/rehearsals?season=2025', { token: t.admin })).body.rehearsals.map(r => r.date), ['2026-08-20']);
  assert.deepEqual((await t.call('GET', '/api/admin/rehearsals?season=abc', { token: t.admin })).body, { error: 'invalid', field: 'season' });
});

test('guardar estados en lote; altas posteriores entran como Ausente; validación', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } })).body.rehearsal.id;
  const nuevoId = await t.seedUser({ username: 'nuevo', displayName: 'Nuevo' });
  const r = await t.call('PUT', `/api/admin/rehearsals/${id}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }, { userId: t.adminId, status: 'excused' }] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.entries.map(e => [e.user.displayName, e.status]), [['Ana', 'present'], ['Jefe', 'excused'], ['Nuevo', 'absent']]);
  assert.equal((await t.call('PUT', `/api/admin/rehearsals/${id}/attendance`, { token: t.admin, body: { entries: [{ userId: nuevoId, status: 'late' }] } })).status, 200);
  const detail = await t.call('GET', `/api/admin/rehearsals/${id}`, { token: t.admin });
  assert.deepEqual(detail.body.entries.map(e => e.status), ['present', 'excused', 'late']);
  const bajaId = (await t.db.prepare("SELECT id FROM users WHERE username = 'baja'").first()).id;
  for (const entries of [[], [{ userId: t.anaId, status: 'tarde' }], [{ userId: 999, status: 'present' }], [{ userId: bajaId, status: 'present' }], 'x', [{ userId: String(t.anaId), status: 'present' }]]) {
    assert.deepEqual((await t.call('PUT', `/api/admin/rehearsals/${id}/attendance`, { token: t.admin, body: { entries } })).body, { error: 'invalid', field: 'entries' }, JSON.stringify(entries));
  }
  assert.equal((await t.call('PUT', '/api/admin/rehearsals/999/attendance', { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }] } })).status, 404);
});

test('editar fecha y nota; borrar exige escribir la fecha', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } })).body.rehearsal.id;
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-23' } });
  const e = await t.call('PATCH', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { date: '2026-09-29', note: 'Cambio de día' } });
  assert.deepEqual(e.body.rehearsal, { id, date: '2026-09-29', note: 'Cambio de día' });
  assert.deepEqual((await t.call('PATCH', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { date: '2026-09-23' } })).body, { error: 'rehearsal_exists' });
  assert.deepEqual((await t.call('PATCH', `/api/admin/rehearsals/${id}`, { token: t.admin, body: {} })).body, { error: 'invalid', field: 'body' });
  assert.deepEqual((await t.call('DELETE', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { confirmDate: '2026-09-30' } })).body, { error: 'invalid', field: 'confirmDate' });
  assert.equal((await t.call('DELETE', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { confirmDate: '2026-09-29' } })).status, 204);
  assert.equal((await t.db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE rehearsal_id = ?').bind(id).first('n')), 0);
  assert.equal((await t.call('GET', `/api/admin/rehearsals/${id}`, { token: t.admin })).status, 404);
});

test('borrar un usuario borra sus registros de asistencia', async () => {
  const t = await adminSetup();
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } });
  assert.equal((await t.call('DELETE', `/api/admin/users/${t.anaId}`, { token: t.admin, body: { confirmUsername: 'ana' } })).status, 204);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE user_id = ?').bind(t.anaId).first('n'), 0);
});
```

- [ ] **Step 2: Verlos fallar**

Run: `cd backend && node --test test/attendance.test.js`
Expected: FAIL (rutas → 404).

- [ ] **Step 3: Rutas** — al principio de `backend/src/attendance.js` añadir los imports y al final del archivo el código:

```js
import { HttpError, json, noContent, readJson } from './http.js';
import { requireAdmin } from './auth.js';
import { validateId } from './validate.js';
```

```js
const bad = field => { throw new HttpError(400, 'invalid', { field }); };
const MAX_ENTRIES = 200;

function validateNote(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') bad('note');
  const note = v.trim();
  if (note.length > 200) bad('note');
  return note;
}

function seasonParam(url, now) {
  const raw = url.searchParams.get('season');
  if (raw === null) return currentSeason(now);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) bad('season');
  return n;
}

async function rehearsalRow(db, id) {
  const row = await db.prepare('SELECT id, date, note FROM rehearsals WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function rehearsalEntries(db, id) {
  const { results } = await db.prepare(`SELECT a.status, u.id, u.display_name, u.username, u.active
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.rehearsal_id = ? ORDER BY u.display_name COLLATE NOCASE, u.id`).bind(id).all();
  return results.map(r => ({ user: { id: r.id, displayName: r.display_name, username: r.username, active: !!r.active }, status: r.status }));
}

async function dateTaken(db, date, exceptId = 0) {
  return !!(await db.prepare('SELECT id FROM rehearsals WHERE date = ? AND id <> ?').bind(date, exceptId).first());
}

// Usuarios activos que aún no están en la lista del ensayo → Ausente.
const addMissingActive = (db, id, ts) => db.prepare(`INSERT OR IGNORE INTO attendance (rehearsal_id, user_id, status, updated_at)
  SELECT ?, id, 'absent', ? FROM users WHERE active = 1`).bind(id, ts);

export async function listRehearsals(ctx) {
  await requireAdmin(ctx);
  const { from, to } = seasonRange(seasonParam(ctx.url, ctx.now));
  const { results } = await ctx.db.prepare(`SELECT r.id, r.date, r.note,
      SUM(a.status = 'present') AS present, SUM(a.status = 'late') AS late,
      SUM(a.status = 'absent') AS absent, SUM(a.status = 'excused') AS excused
    FROM rehearsals r LEFT JOIN attendance a ON a.rehearsal_id = r.id
    WHERE r.date BETWEEN ? AND ? GROUP BY r.id ORDER BY r.date DESC`).bind(from, to).all();
  return json(200, { rehearsals: results.map(r => ({ id: r.id, date: r.date, note: r.note,
    present: r.present || 0, late: r.late || 0, absent: r.absent || 0, excused: r.excused || 0 })) });
}

export async function createRehearsal(ctx) {
  const admin = await requireAdmin(ctx);
  const body = await readJson(ctx.request);
  if (!validDate(body.date, ctx.now)) bad('date');
  const note = validateNote(body.note);
  if (await dateTaken(ctx.db, body.date)) throw new HttpError(409, 'rehearsal_exists');
  const ts = ctx.now.toISOString();
  const r = await ctx.db.prepare('INSERT INTO rehearsals (date, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(body.date, note, admin.id, ts, ts).run();
  const id = r.meta.last_row_id;
  await addMissingActive(ctx.db, id, ts).run();
  return json(201, { rehearsal: await rehearsalRow(ctx.db, id), entries: await rehearsalEntries(ctx.db, id) });
}

export async function getRehearsal(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  return json(200, { rehearsal: await rehearsalRow(ctx.db, id), entries: await rehearsalEntries(ctx.db, id) });
}

export async function updateRehearsal(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const current = await rehearsalRow(ctx.db, id);
  const body = await readJson(ctx.request);
  if (!('date' in body) && !('note' in body)) bad('body');
  const date = 'date' in body ? body.date : current.date;
  if ('date' in body && !validDate(date, ctx.now)) bad('date');
  const note = 'note' in body ? validateNote(body.note) : current.note;
  if (await dateTaken(ctx.db, date, id)) throw new HttpError(409, 'rehearsal_exists');
  await ctx.db.prepare('UPDATE rehearsals SET date = ?, note = ?, updated_at = ? WHERE id = ?').bind(date, note, ctx.now.toISOString(), id).run();
  return json(200, { rehearsal: await rehearsalRow(ctx.db, id) });
}

export async function saveAttendance(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  await rehearsalRow(ctx.db, id);
  const { entries } = await readJson(ctx.request);
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_ENTRIES) bad('entries');
  const ts = ctx.now.toISOString();
  await addMissingActive(ctx.db, id, ts).run();
  const { results } = await ctx.db.prepare('SELECT user_id FROM attendance WHERE rehearsal_id = ?').bind(id).all();
  const listed = new Set(results.map(r => r.user_id));
  for (const e of entries) {
    if (!e || !Number.isInteger(e.userId) || !listed.has(e.userId) || !STATUSES.includes(e.status)) bad('entries');
  }
  await ctx.db.batch(entries.map(e => ctx.db.prepare('UPDATE attendance SET status = ?, updated_at = ? WHERE rehearsal_id = ? AND user_id = ?')
    .bind(e.status, ts, id, e.userId)));
  return json(200, { entries: await rehearsalEntries(ctx.db, id) });
}

export async function deleteRehearsal(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const current = await rehearsalRow(ctx.db, id);
  const { confirmDate } = await readJson(ctx.request);
  if (confirmDate !== current.date) bad('confirmDate');
  await ctx.db.prepare('DELETE FROM rehearsals WHERE id = ?').bind(id).run();
  return noContent();
}
```

- [ ] **Step 4: Registrar las rutas** — en `backend/src/routes.js`:

```js
import { listRehearsals, createRehearsal, getRehearsal, updateRehearsal, saveAttendance, deleteRehearsal } from './attendance.js';
```

y al final de `ROUTES`:

```js
  ['GET', '/api/admin/rehearsals', listRehearsals],
  ['POST', '/api/admin/rehearsals', createRehearsal],
  ['GET', '/api/admin/rehearsals/:id', getRehearsal],
  ['PATCH', '/api/admin/rehearsals/:id', updateRehearsal],
  ['DELETE', '/api/admin/rehearsals/:id', deleteRehearsal],
  ['PUT', '/api/admin/rehearsals/:id/attendance', saveAttendance],
```


- [ ] **Step 5: Tests de esta tarea en verde**

Run: `cd backend && node --test test/attendance.test.js`
Expected: todos en verde.

- [ ] **Step 6: Commit**

```bash
git add backend/src/attendance.js backend/src/routes.js backend/test/attendance.test.js
git commit -m "feat(backend): crear, editar y borrar ensayos y guardar la asistencia"
```

---

### Task 3: Reporte y temporadas

**Files:**
- Modify: `backend/src/attendance.js` (añadir al final), `backend/src/routes.js`
- Test: `backend/test/attendance.test.js`

**Interfaces:**
- Consumes: `attendanceReport`, `seasonRange`, `seasonOf`, `currentSeason` (Task 1); `seasonParam` (Task 2).
- Produces: `GET /api/admin/attendance/report?season=` → `{season, from, to, ...attendanceReport}`; `GET /api/admin/attendance/seasons` → `{seasons:number[], current:number}`.

- [ ] **Step 1: Tests que fallan** — añadir a `backend/test/attendance.test.js`

```js
test('las rutas de asistencia rechazan a un tenor (403) y sin sesión (401)', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const routes = [['GET', '/api/admin/rehearsals'], ['POST', '/api/admin/rehearsals'], ['GET', '/api/admin/rehearsals/1'], ['PATCH', '/api/admin/rehearsals/1'],
    ['DELETE', '/api/admin/rehearsals/1'], ['PUT', '/api/admin/rehearsals/1/attendance'], ['GET', '/api/admin/attendance/report'], ['GET', '/api/admin/attendance/seasons']];
  for (const [method, path] of routes) {
    const body = method === 'GET' ? undefined : {};
    assert.deepEqual((await t.call(method, path, { token: tenor, body })).body, { error: 'forbidden' }, `${method} ${path}`);
    assert.equal((await t.call(method, path, { body })).status, 401, `${method} ${path} sin sesión`);
  }
});

test('reporte por API: solo ensayos de la temporada, límites de fecha y temporadas disponibles', async () => {
  const t = await adminSetup();
  const mk = async date => (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date } })).body.rehearsal.id;
  const sep1 = await mk('2026-09-01');
  await mk('2026-09-08');
  const aug31 = await mk('2026-08-31'); // temporada 2025
  await t.call('PUT', `/api/admin/rehearsals/${sep1}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }, { userId: t.adminId, status: 'late' }] } });
  await t.call('PUT', `/api/admin/rehearsals/${aug31}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }] } });
  const r = await t.call('GET', '/api/admin/attendance/report?season=2026', { token: t.admin });
  assert.deepEqual([r.body.season, r.body.from, r.body.to, r.body.rehearsals, r.body.minimum], [2026, '2026-09-01', '2027-08-31', 2, 1]);
  const ana = r.body.people.find(p => p.user.id === t.anaId);
  assert.deepEqual([ana.recorded, ana.present, ana.absent, ana.attendancePct, ana.lastAbsence], [2, 1, 1, 50, '2026-09-08']);
  assert.deepEqual(r.body.leaderboard.map(l => l.userId), [t.anaId, t.adminId], 'empate en % y asistidos → menos tardanzas primero');
  const r25 = await t.call('GET', '/api/admin/attendance/report?season=2025', { token: t.admin });
  assert.deepEqual([r25.body.rehearsals, r25.body.people.find(p => p.user.id === t.anaId).attendancePct], [1, 100]);
  const empty = await t.call('GET', '/api/admin/attendance/report?season=2030', { token: t.admin });
  assert.deepEqual([empty.body.rehearsals, empty.body.teamAverage, empty.body.people], [0, null, []]);
  assert.deepEqual((await t.call('GET', '/api/admin/attendance/report?season=1999', { token: t.admin })).body, { error: 'invalid', field: 'season' });
  assert.deepEqual((await t.call('GET', '/api/admin/attendance/seasons', { token: t.admin })).body, { seasons: [2026, 2025], current: 2026 });
});
```

- [ ] **Step 2: Verlo fallar**

Run: `cd backend && node --test test/attendance.test.js`
Expected: FAIL en el test de reporte y en el de permisos (las dos rutas → 404).

- [ ] **Step 3: Rutas** — al final de `backend/src/attendance.js`:

```js
export async function attendanceReportRoute(ctx) {
  await requireAdmin(ctx);
  const season = seasonParam(ctx.url, ctx.now);
  const { from, to } = seasonRange(season);
  const count = await ctx.db.prepare('SELECT COUNT(*) AS n FROM rehearsals WHERE date BETWEEN ? AND ?').bind(from, to).first('n');
  const { results } = await ctx.db.prepare(`SELECT a.user_id, a.status, r.date, u.display_name, u.username, u.active
    FROM attendance a JOIN rehearsals r ON r.id = a.rehearsal_id JOIN users u ON u.id = a.user_id
    WHERE r.date BETWEEN ? AND ?`).bind(from, to).all();
  return json(200, { season, from, to, ...attendanceReport(results, count) });
}

export async function attendanceSeasons(ctx) {
  await requireAdmin(ctx);
  const { results } = await ctx.db.prepare('SELECT date FROM rehearsals').all();
  const current = currentSeason(ctx.now);
  const seasons = [...new Set([current, ...results.map(r => seasonOf(r.date))])].sort((a, b) => b - a);
  return json(200, { seasons, current });
}
```

En `backend/src/routes.js`, ampliar el import de `./attendance.js` con `attendanceReportRoute, attendanceSeasons` y añadir a `ROUTES`:

```js
  ['GET', '/api/admin/attendance/report', attendanceReportRoute],
  ['GET', '/api/admin/attendance/seasons', attendanceSeasons],
```

- [ ] **Step 4: Suite completa en verde**

Run: `cd backend && npm test`
Expected: toda la suite en verde, incluido el test de permisos.

- [ ] **Step 5: Commit**

```bash
git add backend/src/attendance.js backend/src/routes.js backend/test/attendance.test.js
git commit -m "feat(backend): reporte de asistencia y temporadas disponibles"
```

---

### Task 4: Utilidades de asistencia en el navegador y cliente de la API

**Files:**
- Create: `practice/attendance.js`
- Modify: `practice/api.js`
- Test: `test/attendance.test.js`, `test/api.test.js`

**Interfaces:**
- Produces (`practice/attendance.js`): `STATUSES`, `STATUS_LABELS`, `countEntries(entries) → {present, late, absent, excused}`, `countsLabel(counts) → string`, `localToday(now?) → 'AAAA-MM-DD'`, `seasonOfDate(date) → number`, `seasonLabel(season) → '2026–2027'`, `formatRehearsalDate(date) → string`, `createSaveQueue({ send, delay?, onState?, timers? }) → { set(userId, status), flush() → Promise, pendingCount }`. Estados de `onState`: `'pending' | 'saving' | 'saved' | 'error'` (con el error como segundo argumento).
- Produces (`practice/api.js`): `api.admin.rehearsals(season)`, `createRehearsal(data)`, `rehearsal(id)`, `updateRehearsal(id, data)`, `saveAttendance(id, entries)`, `deleteRehearsal(id, confirmDate)`, `attendanceReport(season)`, `attendanceSeasons()`; mensaje `rehearsal_exists`.

- [ ] **Step 1: Tests que fallan** — `test/attendance.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countEntries, countsLabel, localToday, seasonOfDate, seasonLabel, createSaveQueue } from '../practice/attendance.js';

test('recuentos y texto con singular y plural', () => {
  const c = countEntries([{ status: 'present' }, { status: 'present' }, { status: 'late' }, { status: 'excused' }]);
  assert.deepEqual(c, { present: 2, late: 1, absent: 0, excused: 1 });
  assert.equal(countsLabel(c), '2 presentes · 1 tarde · 0 ausentes · 1 justificado');
  assert.equal(countsLabel({ present: 1, late: 2, absent: 1, excused: 0 }), '1 presente · 2 tardes · 1 ausente · 0 justificados');
});

test('localToday usa la fecha local, no la UTC', () => {
  assert.equal(localToday(new Date(2026, 9, 14, 23, 30)), '2026-10-14');
  assert.equal(localToday(new Date(2027, 0, 5, 0, 5)), '2027-01-05');
});

test('temporada de una fecha y su etiqueta', () => {
  assert.equal(seasonOfDate('2026-09-01'), 2026);
  assert.equal(seasonOfDate('2027-08-31'), 2026);
  assert.equal(seasonLabel(2026), '2026–2027');
});

function fakeTimers() {
  const calls = [];
  return { calls, set: (fn, ms) => { calls.push(fn); return calls.length; }, clear() {}, run() { const fn = calls.pop(); calls.length = 0; fn && fn(); } };
}

test('la cola agrupa cambios y envía el último estado de cada persona', async () => {
  const timers = fakeTimers();
  const sent = [];
  const states = [];
  const q = createSaveQueue({ send: async batch => { sent.push(batch); }, timers, onState: s => states.push(s) });
  q.set(1, 'present'); q.set(2, 'late'); q.set(1, 'excused');
  assert.equal(q.pendingCount, 2);
  timers.run();
  await q.flush();
  assert.deepEqual(sent, [[{ userId: 1, status: 'excused' }, { userId: 2, status: 'late' }]]);
  assert.equal(states.at(-1), 'saved');
  assert.equal(q.pendingCount, 0);
});

test('si falla, conserva los cambios; un cambio nuevo durante el fallo gana; Reintentar los envía', async () => {
  const timers = fakeTimers();
  let fail = true;
  const sent = [];
  const states = [];
  const q = createSaveQueue({ send: async batch => { if (fail) throw new Error('red'); sent.push(batch); }, timers, onState: s => states.push(s) });
  q.set(1, 'present'); q.set(2, 'late');
  await assert.rejects(q.flush());
  assert.equal(states.at(-1), 'error');
  q.set(2, 'absent');
  fail = false;
  await q.flush();
  assert.deepEqual(sent, [[{ userId: 1, status: 'present' }, { userId: 2, status: 'absent' }]]);
  assert.equal(states.at(-1), 'saved');
});

test('los cambios hechos mientras se envía se mandan después', async () => {
  const timers = fakeTimers();
  const sent = [];
  let release;
  const q = createSaveQueue({ send: batch => new Promise(r => { sent.push(batch); release = r; }), timers });
  q.set(1, 'present');
  const first = q.flush();
  q.set(2, 'late');
  release();
  await first;
  timers.run(); // el temporizador programado al terminar el primer envío lanza el segundo
  release();
  await q.flush();
  assert.deepEqual(sent, [[{ userId: 1, status: 'present' }], [{ userId: 2, status: 'late' }]]);
});
```

Y añadir a `test/api.test.js`:

```js
test('mensaje de ensayo repetido', () => {
  assert.equal(messageFor('rehearsal_exists'), 'Ya hay un ensayo registrado ese día.');
});
```

- [ ] **Step 2: Verlos fallar**

Run: `node --test test/attendance.test.js test/api.test.js`
Expected: FAIL (`practice/attendance.js` no existe; mensaje genérico).

- [ ] **Step 3: `practice/attendance.js`**

```js
// Utilidades de la asistencia en el panel (sin DOM): textos, fechas y cola de guardado automático.
export const STATUSES = ['present', 'late', 'absent', 'excused'];
export const STATUS_LABELS = { present: 'Presente', late: 'Tarde', absent: 'Ausente', excused: 'Justificado' };
const COUNT_WORDS = { present: ['presente', 'presentes'], late: ['tarde', 'tardes'], absent: ['ausente', 'ausentes'], excused: ['justificado', 'justificados'] };

export function countEntries(entries) {
  const c = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const e of entries) c[e.status]++;
  return c;
}

export const countsLabel = c => STATUSES.map(s => `${c[s]} ${COUNT_WORDS[s][c[s] === 1 ? 0 : 1]}`).join(' · ');

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function seasonOfDate(date) {
  const [y, m] = date.split('-').map(Number);
  return m >= 9 ? y : y - 1;
}

export const seasonLabel = season => `${season}–${season + 1}`;

export const formatRehearsalDate = date =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Guarda los cambios de estado agrupados: espera `delay` ms tras el último toque y envía el último estado de cada
// persona. Si el envío falla, los cambios vuelven a la cola (sin pisar uno más nuevo) hasta que se llame a flush().
export function createSaveQueue({ send, delay = 500, onState = () => {}, timers = { set: setTimeout, clear: clearTimeout } }) {
  const pending = new Map();
  let timer = null;
  let inflight = null;

  const schedule = () => {
    timers.clear(timer);
    timer = timers.set(() => { timer = null; flush().catch(() => {}); }, delay);
  };

  function flush() {
    timers.clear(timer);
    timer = null;
    if (inflight) return inflight;
    if (!pending.size) return Promise.resolve();
    const batch = [...pending].map(([userId, status]) => ({ userId, status }));
    pending.clear();
    onState('saving');
    inflight = (async () => {
      let ok = false;
      try {
        const result = await send(batch);
        ok = true;
        onState(pending.size ? 'pending' : 'saved');
        return result;
      } catch (err) {
        for (const e of batch) if (!pending.has(e.userId)) pending.set(e.userId, e.status);
        onState('error', err);
        throw err;
      } finally {
        inflight = null;
        if (ok && pending.size) schedule();
      }
    })();
    return inflight;
  }

  return {
    set(userId, status) {
      pending.set(userId, status);
      onState('pending');
      if (!inflight) schedule();
    },
    flush,
    get pendingCount() { return pending.size; },
  };
}
```

- [ ] **Step 4: `practice/api.js`**

En `MESSAGES`, tras `title_taken`, añadir:

```js
  rehearsal_exists: 'Ya hay un ensayo registrado ese día.',
```

Y dentro de `admin`, al final:

```js
    rehearsals: season => request('GET', `/api/admin/rehearsals${query({ season })}`),
    createRehearsal: data => request('POST', '/api/admin/rehearsals', data),
    rehearsal: id => request('GET', `/api/admin/rehearsals/${id}`),
    updateRehearsal: (id, data) => request('PATCH', `/api/admin/rehearsals/${id}`, data),
    saveAttendance: (id, entries) => request('PUT', `/api/admin/rehearsals/${id}/attendance`, { entries }),
    deleteRehearsal: (id, confirmDate) => request('DELETE', `/api/admin/rehearsals/${id}`, { confirmDate }),
    attendanceReport: season => request('GET', `/api/admin/attendance/report${query({ season })}`),
    attendanceSeasons: () => request('GET', '/api/admin/attendance/seasons'),
```

- [ ] **Step 5: Tests en verde**

Run: `npm test`
Expected: suite raíz en verde.

- [ ] **Step 6: Commit**

```bash
git add practice/attendance.js practice/api.js test/attendance.test.js test/api.test.js
git commit -m "feat(practica): utilidades de asistencia, cola de guardado y cliente de la API"
```

---

### Task 5: Pestaña "Asistencia" en el panel

**Files:**
- Create: `practice/attendance-ui.js`
- Modify: `practice/admin-ui.js`, `practice/practice.css` (añadir al final)

**Interfaces:**
- Consumes: Task 4; `openSheet`, `focusFirst` (`sheet.js`); `esc` (`format.js`); utilidades privadas de `admin-ui.js` que se pasan como `ui`.
- Produces: `renderAttendance(view, ui)` con `ui = { state, reloadTab, showError, handleAuthError, alertSheet, confirmSheet, formError }`.

- [ ] **Step 1: `practice/attendance-ui.js`**

```js
import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { esc } from './format.js';
import { STATUSES, STATUS_LABELS, countEntries, countsLabel, localToday, seasonOfDate, seasonLabel, formatRehearsalDate, createSaveQueue } from './attendance.js';

// Pestaña "Asistencia" del panel de administración. `ui` trae utilidades de admin-ui.js:
// { state, reloadTab, showError, handleAuthError, alertSheet, confirmSheet, formError }.
export async function renderAttendance(view, ui) {
  const { state } = ui;
  view.innerHTML = `<div class="admin-filters">
      <button type="button" class="btn small" data-today>Tomar asistencia de hoy</button>
      <button type="button" class="btn small quiet" data-other>Otra fecha…</button>
      <label>Temporada <select data-season></select></label>
      <button type="button" class="btn small quiet" data-report>Reporte</button>
    </div><div data-list><p class="practice-message">Cargando…</p></div>`;
  const list = view.querySelector('[data-list]');
  let seasons;
  try { seasons = await api.admin.attendanceSeasons(); } catch (err) { ui.showError(list, err, ui.reloadTab); return; }
  if (!state.attendanceSeason) state.attendanceSeason = seasons.current;
  const sel = view.querySelector('[data-season]');
  const options = seasons.seasons.includes(state.attendanceSeason) ? seasons.seasons : [state.attendanceSeason, ...seasons.seasons];
  sel.innerHTML = options.map(y => `<option value="${y}">${esc(seasonLabel(y))}</option>`).join('');
  sel.value = String(state.attendanceSeason);
  sel.addEventListener('change', () => { state.attendanceSeason = Number(sel.value); ui.reloadTab(); });
  view.querySelector('[data-today]').addEventListener('click', e => openForDate(localToday(), '', ui, e.currentTarget));
  view.querySelector('[data-other]').addEventListener('click', () => otherDateForm(ui));
  view.querySelector('[data-report]').addEventListener('click', () => openReport(state.attendanceSeason, ui));
  let data;
  try { data = await api.admin.rehearsals(state.attendanceSeason); } catch (err) { ui.showError(list, err, ui.reloadTab); return; }
  if (!data.rehearsals.length) {
    list.innerHTML = '<p class="practice-message">Todavía no hay ensayos registrados en esta temporada.</p>';
    focusFirst(view);
    return;
  }
  list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Fecha</th><th>Nota</th><th>Asistencia</th></tr></thead>
    <tbody>${data.rehearsals.map(r => `<tr>
      <td><button type="button" class="admin-link" data-rehearsal="${r.id}">${esc(formatRehearsalDate(r.date))}</button></td>
      <td>${esc(r.note) || '—'}</td>
      <td>${esc(countsLabel(r))}</td></tr>`).join('')}</tbody></table></div>`;
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-rehearsal]');
    if (b) openRehearsal(Number(b.dataset.rehearsal), ui);
  });
  focusFirst(view);
}

// Crea el ensayo de esa fecha o, si ya existe, abre el existente.
async function openForDate(date, note, ui, button) {
  if (button) button.disabled = true;
  try {
    const created = await api.admin.createRehearsal({ date, note });
    attendanceSheet(created, ui);
  } catch (err) {
    if (err.code === 'rehearsal_exists') {
      try {
        const { rehearsals } = await api.admin.rehearsals(seasonOfDate(date));
        const found = rehearsals.find(r => r.date === date);
        if (found) { await openRehearsal(found.id, ui); return; }
      } catch (err2) { ui.alertSheet(err2); return; }
    }
    ui.alertSheet(err);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openRehearsal(id, ui) {
  try { attendanceSheet(await api.admin.rehearsal(id), ui); } catch (err) { ui.alertSheet(err); }
}

function otherDateForm(ui) {
  const s = openSheet({ title: 'Registrar ensayo', eyebrow: 'Asistencia' });
  s.body.innerHTML = `<form class="account-form" novalidate>
    <label>Fecha<input name="date" type="date" required value="${esc(localToday())}"></label>
    <label>Nota (opcional)<input name="note" maxlength="200" placeholder="Ensayo general"></label>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">Abrir lista</button>
  </form>`;
  const form = s.body.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const date = form.elements.date.value;
    try {
      const created = await api.admin.createRehearsal({ date, note: form.elements.note.value });
      s.close();
      attendanceSheet(created, ui);
    } catch (err) {
      if (err.code === 'rehearsal_exists') { s.close(); await openForDate(date, '', ui); return; }
      if (ui.handleAuthError(err)) return;
      ui.formError(form, err);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

const SAVE_TEXT = { pending: 'Guardando…', saving: 'Guardando…', saved: 'Guardado ✓' };

function attendanceSheet(initial, ui) {
  let rehearsal = initial.rehearsal;
  let entries = initial.entries;
  const status = new Map(entries.map(e => [e.user.id, e.status]));
  const queue = createSaveQueue({
    send: async batch => {
      const r = await api.admin.saveAttendance(rehearsal.id, batch);
      if (r.entries.length !== entries.length) { entries = r.entries; for (const e of r.entries) if (!status.has(e.user.id)) status.set(e.user.id, e.status); renderList(); }
      return r;
    },
    onState: (st, err) => showSave(st, err),
  });
  const s = openSheet({ title: formatRehearsalDate(rehearsal.date), eyebrow: 'Asistencia', wide: true,
    onClose: () => { queue.flush().catch(() => {}); ui.reloadTab(); } });
  s.body.innerHTML = `<div class="attendance-head">
      <p class="admin-note" data-note></p>
      <button type="button" class="btn small quiet" data-edit>Editar</button>
    </div>
    <p class="attendance-counts" data-counts aria-live="polite"></p>
    <button type="button" class="btn small" data-all>Marcar todos presentes</button>
    <ul class="attendance-list" data-rows></ul>
    <p class="attendance-save" data-save aria-live="polite"></p>
    <button type="button" class="btn small quiet admin-danger" data-delete>Borrar ensayo</button>`;
  const $rows = s.body.querySelector('[data-rows]');
  const $counts = s.body.querySelector('[data-counts]');
  const $save = s.body.querySelector('[data-save]');

  const current = () => entries.map(e => ({ ...e, status: status.get(e.user.id) }));
  const showHead = () => {
    s.setTitle(formatRehearsalDate(rehearsal.date));
    s.body.querySelector('[data-note]').textContent = rehearsal.note || 'Sin nota';
  };
  const showCounts = () => { $counts.textContent = countsLabel(countEntries(current())); };

  function renderList() {
    $rows.innerHTML = current().map(e => `<li class="attendance-row" data-user="${e.user.id}">
      <span class="attendance-name">${esc(e.user.displayName)}${e.user.active ? '' : ' <small>(inactivo)</small>'}</span>
      <div class="attendance-options" role="radiogroup" aria-label="Asistencia de ${esc(e.user.displayName)}">
        ${STATUSES.map(st => `<button type="button" role="radio" class="attendance-option attendance-option--${st}" data-status="${st}"
          aria-checked="${st === e.status}" tabindex="${st === e.status ? 0 : -1}">${STATUS_LABELS[st]}</button>`).join('')}
      </div></li>`).join('');
    showCounts();
  }

  function choose(userId, st, focus = false) {
    status.set(userId, st);
    const row = $rows.querySelector(`[data-user="${userId}"]`);
    row.querySelectorAll('[data-status]').forEach(b => {
      const on = b.dataset.status === st;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    showCounts();
    queue.set(userId, st);
  }

  function showSave(st, err) {
    if (st === 'error') {
      if (ui.handleAuthError(err)) return;
      $save.innerHTML = 'No se pudo guardar. <button type="button" class="btn small" data-retry>Reintentar</button>';
      $save.querySelector('[data-retry]').addEventListener('click', () => queue.flush().catch(() => {}));
      return;
    }
    $save.textContent = SAVE_TEXT[st] || '';
  }

  $rows.addEventListener('click', e => {
    const b = e.target.closest('[data-status]');
    if (b) choose(Number(b.closest('[data-user]').dataset.user), b.dataset.status);
  });
  $rows.addEventListener('keydown', e => {
    const b = e.target.closest('[data-status]');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!b || !step) return;
    e.preventDefault();
    const next = STATUSES[(STATUSES.indexOf(b.dataset.status) + step + STATUSES.length) % STATUSES.length];
    choose(Number(b.closest('[data-user]').dataset.user), next, true);
  });
  s.body.querySelector('[data-all]').addEventListener('click', () => {
    for (const e of current()) if (e.status === 'absent') choose(e.user.id, 'present');
  });
  s.body.querySelector('[data-edit]').addEventListener('click', () => editForm());
  s.body.querySelector('[data-delete]').addEventListener('click', () => ui.confirmSheet({
    title: 'Borrar ensayo',
    danger: true,
    html: `<p>Se borrará el ensayo del <strong>${esc(formatRehearsalDate(rehearsal.date))}</strong> y toda su asistencia. No se puede deshacer.</p>
      <label>Escribe <strong>${esc(rehearsal.date)}</strong> para confirmar<input name="confirmDate" autocomplete="off" required></label>`,
    confirmLabel: 'Borrar definitivamente',
    onConfirm: async (form, c) => {
      await api.admin.deleteRehearsal(rehearsal.id, form.elements.confirmDate.value.trim());
      c.close();
      s.close();
    },
  }));

  function editForm() {
    const f = openSheet({ title: 'Editar ensayo', eyebrow: 'Asistencia' });
    f.body.innerHTML = `<form class="account-form" novalidate>
      <label>Fecha<input name="date" type="date" required value="${esc(rehearsal.date)}"></label>
      <label>Nota (opcional)<input name="note" maxlength="200" value="${esc(rehearsal.note)}"></label>
      <p class="account-form__error" role="alert" data-error hidden></p>
      <button type="submit" class="btn">Guardar cambios</button>
    </form>`;
    const form = f.body.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      try {
        rehearsal = (await api.admin.updateRehearsal(rehearsal.id, { date: form.elements.date.value, note: form.elements.note.value })).rehearsal;
        showHead();
        f.close();
      } catch (err) {
        if (ui.handleAuthError(err)) return;
        ui.formError(form, err);
        button.disabled = false;
      }
    });
    focusFirst(form);
  }

  showHead();
  renderList();
  focusFirst(s.body);
}

async function openReport(season, ui) {
  const s = openSheet({ title: 'Reporte de asistencia', eyebrow: `Temporada ${seasonLabel(season)}`, wide: true });
  s.body.innerHTML = '<p class="practice-message">Cargando…</p>';
  let r;
  try { r = await api.admin.attendanceReport(season); } catch (err) {
    if (ui.handleAuthError(err)) return;
    s.body.innerHTML = `<div class="practice-error" role="alert"><p>${esc(err.message)}</p></div>`;
    return;
  }
  const byId = new Map(r.people.map(p => [p.user.id, p]));
  const pct = v => (v == null ? '—' : `${String(v).replace('.', ',')} %`);
  const date = d => (d ? esc(formatRehearsalDate(d)) : '—');

  function summary() {
    if (!r.rehearsals) {
      s.body.innerHTML = '<p class="practice-message">Todavía no hay ensayos registrados en esta temporada.</p>';
      return;
    }
    const medal = i => (i < 3 ? ` <span class="attendance-medal attendance-medal--${i + 1}" aria-label="Puesto ${i + 1}">${['🥇', '🥈', '🥉'][i]}</span>` : '');
    s.body.innerHTML = `<div class="attendance-cards">
        <div class="attendance-card"><strong>${r.rehearsals}</strong><span>Ensayos realizados</span></div>
        <div class="attendance-card"><strong>${pct(r.teamAverage)}</strong><span>Asistencia media del equipo</span></div>
        <div class="attendance-card"><strong>${r.minimum} de ${r.rehearsals}</strong><span>Mínimo para el leaderboard</span></div>
      </div>
      <h3 class="progress-song">Leaderboard</h3>
      ${r.leaderboard.length ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>#</th><th>Integrante</th><th>Asistencia</th><th>Asistidos</th><th>Tardanzas</th></tr></thead>
        <tbody>${r.leaderboard.map((l, i) => { const p = byId.get(l.userId); return `<tr>
          <td>${l.position}${medal(i)}</td><td>${esc(p.user.displayName)}</td><td><strong>${pct(p.attendancePct)}</strong></td>
          <td>${p.present + p.late} de ${p.recorded - p.excused}</td><td>${p.late}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<p class="practice-message">Nadie llega todavía al mínimo de ensayos.</p>'}
      ${r.belowMinimum.length ? `<p class="admin-note attendance-below">Sin mínimo: ${r.belowMinimum.map(b => { const p = byId.get(b.userId);
        return `${esc(p.user.displayName)} (${pct(p.attendancePct)})`; }).join(', ')}</p>` : ''}
      <h3 class="progress-song">Detalle por integrante</h3>
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Integrante</th><th>Presente</th><th>Tarde</th><th>Ausente</th><th>Justificado</th><th>% asistencia</th><th>% tardanzas</th><th>Última falta</th></tr></thead>
        <tbody>${r.people.map(p => `<tr>
          <td><button type="button" class="admin-link" data-person="${p.user.id}">${esc(p.user.displayName)}</button>${p.user.active ? '' : ' <small>(inactivo)</small>'}</td>
          <td>${p.present}</td><td>${p.late}</td><td>${p.absent}</td><td>${p.excused}</td>
          <td>${pct(p.attendancePct)}</td><td>${pct(p.latePct)}</td><td>${date(p.lastAbsence)}</td></tr>`).join('')}</tbody></table></div>`;
    s.body.querySelectorAll('[data-person]').forEach(b => b.addEventListener('click', () => history(byId.get(Number(b.dataset.person)))));
    focusFirst(s.body);
  }

  function history(p) {
    s.body.innerHTML = `<button type="button" class="data-back" data-back>← Volver</button>
      <h3 class="progress-song">${esc(p.user.displayName)}</h3>
      <ul class="attendance-history">${p.history.map(h => `<li><span>${date(h.date)}</span>
        <span class="attendance-tag attendance-tag--${h.status}">${STATUS_LABELS[h.status]}</span></li>`).join('')}</ul>`;
    s.body.querySelector('[data-back]').addEventListener('click', summary);
    focusFirst(s.body);
  }

  summary();
}
```

- [ ] **Step 2: `practice/admin-ui.js`** — conectar la pestaña

Añadir el import:

```js
import { renderAttendance } from './attendance-ui.js';
```

Cambiar `TABS` a:

```js
const TABS = [['team', 'Equipo'], ['ranking', 'Ranking'], ['users', 'Usuarios'], ['songs', 'Canciones'], ['attendance', 'Asistencia']];
```

En `openAdmin`, añadir `attendanceSeason: null` al objeto `state`:

```js
  state = { sheet, tab: 'team', usersFilter: '1', songsFilter: '1', focusSong: null, attendanceSeason: null, rankingSong: 'all', rankingPeriod: 'season' };
```

En `showTab`, antes de `else if (tab === 'songs') renderSongs(view);`:

```js
  else if (tab === 'attendance') renderAttendance(view, { state, reloadTab, showError, handleAuthError, alertSheet, confirmSheet, formError });
```

Y añadir `date: 'la fecha', note: 'la nota', confirmDate: 'la confirmación'` a `FIELD_NAMES` (las demás claves se quedan), y el caso del 409 en `formError`:

```js
  const field = err.code === 'username_taken' ? 'username' : err.code === 'title_taken' ? 'title' : err.code === 'rehearsal_exists' ? 'date' : err.field;
```

- [ ] **Step 3: Estilos** — añadir al final de `practice/practice.css`

```css
/* Asistencia */
.attendance-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.attendance-head .admin-note { margin: 0; }
.attendance-counts { margin: 6px 0 10px; font-weight: 600; }
.attendance-list { list-style: none; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.attendance-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--card-border, #1b1d1f); }
.attendance-name { font-weight: 600; }
.attendance-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; flex: 1 1 320px; max-width: 460px; }
.attendance-option { min-height: 44px; border: 1px solid var(--card-border, #1b1d1f); border-radius: 10px; background: #000; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.attendance-option:focus-visible { outline: 2px solid var(--accent, #0ffc7e); outline-offset: 2px; }
.attendance-option[aria-checked="true"].attendance-option--present { background: rgba(15, 252, 126, .18); border-color: var(--accent, #0ffc7e); }
.attendance-option[aria-checked="true"].attendance-option--late { background: rgba(255, 196, 0, .18); border-color: var(--practice-warn, #ffc400); }
.attendance-option[aria-checked="true"].attendance-option--absent { background: rgba(255, 92, 92, .18); border-color: var(--practice-bad, #ff5c5c); }
.attendance-option[aria-checked="true"].attendance-option--excused { background: rgba(160, 170, 185, .2); border-color: #a0aab9; }
.attendance-save { min-height: 1.4em; margin: 8px 0; color: var(--fg-muted, #dfe4ea); }
.attendance-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
.attendance-card { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--card-border, #1b1d1f); border-radius: 14px; }
.attendance-card strong { font-size: 22px; }
.attendance-card span { font-size: 13px; color: var(--fg-muted, #dfe4ea); }
.attendance-below { margin-top: 8px; }
.attendance-history { list-style: none; margin: 10px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.attendance-history li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--card-border, #1b1d1f); }
.attendance-tag { padding: 2px 10px; border-radius: 999px; font-size: 12px; background: rgba(160, 170, 185, .2); }
.attendance-tag--present { background: rgba(15, 252, 126, .18); }
.attendance-tag--late { background: rgba(255, 196, 0, .18); }
.attendance-tag--absent { background: rgba(255, 92, 92, .18); }
@media (max-width: 640px) { .attendance-options { flex-basis: 100%; max-width: none; } }
```

- [ ] **Step 4: Comprobaciones**

Run: `node --check practice/attendance-ui.js && node --check practice/admin-ui.js && npm test`
Expected: sin errores; suite raíz en verde. (La prueba en el navegador se hace en la Task 6.)

- [ ] **Step 5: Commit**

```bash
git add practice/attendance-ui.js practice/admin-ui.js practice/practice.css
git commit -m "feat(practica): pestaña Asistencia con toma de lista, guardado automático y reporte"
```

---

### Task 6: Documentación, migración local y prueba en el navegador

**Files:**
- Modify: `backend/README.md`, `docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md`, `comandos-utiles.txt`

- [ ] **Step 1: Migración local**

Run: `cd backend && npm run db:migrate:local`
Expected: Wrangler aplica `0003_attendance.sql` sin errores.

- [ ] **Step 2: Guía** — al final de `backend/README.md`:

````markdown
## Asistencia

Los administradores toman asistencia en **Administración → Asistencia**: "Tomar asistencia de hoy" abre la lista de
todos los usuarios activos (empiezan como Ausente), se marca Presente, Tarde, Ausente o Justificado y cada cambio se
guarda solo. **Reporte** muestra la temporada (1 de septiembre a 31 de agosto): % de asistencia de cada integrante
(Tarde cuenta como asistido, Justificado no cuenta), tardanzas y un leaderboard (mínimo: registro en la mitad de los
ensayos). Todo es solo para administradores.

**Al desplegar esta versión:** `npm run db:migrate:remote` (aplica `0003_attendance.sql`), `npm run deploy` y después
publicar la web.
````

- [ ] **Step 3: Checklist** — añadir al final de la tabla:

```markdown
| 20 | Asistencia: "Tomar asistencia de hoy" en móvil → lista con todos los activos en Ausente | | |
| 21 | Asistencia: marcar todos presentes y cambiar algunos → "Guardado ✓" | | |
| 22 | Asistencia: API apagada al marcar → "No se pudo guardar" + Reintentar sin perder cambios | | |
| 23 | Asistencia: registrar un ensayo de otra fecha y editar su nota | | |
| 24 | Asistencia: reporte con tarjetas, leaderboard, "Sin mínimo" y detalle por integrante | | |
| 25 | Asistencia: borrar un ensayo exige escribir la fecha | | |
```

- [ ] **Step 4: `comandos-utiles.txt`** — en el apartado "3. PUBLICAR CAMBIOS", tras la explicación de `npm run db:migrate:remote`, añadir:

```
    Ejemplo: la versión con Asistencia trae la migración 0003_attendance.sql.
```

- [ ] **Step 5: Suites completas**

Run: `npm test && (cd backend && npm test)`
Expected: ambas en verde.

- [ ] **Step 6: Commit**

```bash
git add backend/README.md docs/superpowers/checklists/2026-10-12-fase2-3-pruebas-manuales.md
git commit -m "docs: despliegue y pruebas de la asistencia"
```

(`comandos-utiles.txt` no está versionado: se actualiza sin commit salvo que el usuario lo pida.)

- [ ] **Step 7: Prueba en el navegador (controlador)** — con `cd backend && npm run dev` y `npm run serve`, sesión de administrador: filas 20–25 del checklist, navegación con teclado por los botones de estado y vista de móvil (390 px) de la toma y del reporte.
