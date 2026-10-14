# Asistencia del equipo

Fecha: 2026-10-14 · Depende de: [fase 2](2026-10-12-fase2-backend-progreso-design.md) y
[fase 3](2026-10-12-fase3-panel-admin-design.md)

## Objetivo

Que los administradores tomen asistencia de cada ensayo desde la app, consulten un reporte por temporada y, al final de
la temporada, tengan un leaderboard con los mejores porcentajes de asistencia. Todo es solo para administradores.

Hoy la asistencia de la temporada 2025 está escrita a mano en `app.js` (panel público de datos) y la de 2026 aparece
"sin registros". Este proyecto no toca ese panel público.

**Criterios de éxito**
- Un administrador toma la asistencia de un ensayo desde el móvil en menos de un minuto (lista con todos los activos,
  atajo "Marcar todos presentes" y guardado automático).
- El reporte de una temporada muestra, por integrante, presentes, tardanzas, ausencias, justificadas, % de asistencia
  y % de tardanzas, y un leaderboard con mínimo de participación y desempates.
- Ninguna ruta de asistencia responde a un usuario con rol `tenor` (cubierto por tests).

## Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Qué se registra | Por ensayo, un estado por integrante: Presente, Tarde, Ausente o Justificado. |
| Cálculo del % | (Presente + Tarde) ÷ (Presente + Tarde + Ausente). Justificado no cuenta. Las tardanzas se muestran aparte. |
| Sesiones | Solo ensayos (no presentaciones). |
| Integrantes | Todos los usuarios activos, tenores y administradores. |
| Leaderboard | Mínimo: registro en al menos el 50 % (redondeo hacia arriba) de los ensayos de la temporada. Desempates: más ensayos asistidos, luego menos tardanzas. |
| Visibilidad | Solo administradores (toma, reporte y leaderboard). |
| Enfoque | Dentro de la app actual: misma base D1, mismo Worker, nueva pestaña del panel. |

## Datos (nueva migración `backend/migrations/0003_attendance.sql`)

```sql
CREATE TABLE rehearsals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,           -- 'AAAA-MM-DD', un ensayo por día
  note        TEXT NOT NULL DEFAULT '',       -- hasta 200 caracteres
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

## Reglas

- **Lista de un ensayo**: al crearlo se inserta una fila `absent` por cada usuario activo en ese momento (tenores y
  administradores). Al guardar estados, se añaden como `absent` los usuarios activos que aún no estén en la lista (alta
  posterior a la creación del ensayo). Los usuarios dados de alta más tarde no tienen filas en ensayos anteriores y por
  tanto esos ensayos no les cuentan.
- **% de asistencia** de una persona en un periodo: `(present + late) / (present + late + absent)`; `excused` no entra en
  numerador ni denominador. Sin denominador (solo justificadas) → `null`.
- **% de tardanzas**: `late / (present + late)`; sin asistencias → `null`.
- **Temporada**: del 1 de septiembre al 31 de agosto, la misma regla que `seasonStart` (`practice/format.js`). La temporada
  "2026" va del 2026-09-01 al 2027-08-31. Un ensayo pertenece a la temporada de su `date`.
- **Leaderboard** de una temporada:
  - Solo usuarios activos.
  - `ensayosConRegistro` = presentes + tardes + ausencias + justificadas de esa persona en la temporada.
  - Mínimo: `ensayosConRegistro >= ceil(0,5 × ensayosDeLaTemporada)`. Quien no llega va a la lista "sin mínimo".
  - Orden: mayor % de asistencia; empate → más ensayos asistidos (present + late); empate → menos tardanzas; empate →
    nombre. Posición compartida en empate total no se usa: se numeran 1, 2, 3… en ese orden.
  - Quien tiene % `null` (solo justificadas) va a "sin mínimo".
- **Usuario desactivado**: no entra en ensayos nuevos ni en el leaderboard; sus filas se conservan y vuelve a contar si se
  reactiva. **Usuario eliminado**: sus filas se borran (cascada).
- **Asistencia media del equipo**: media de los % de asistencia de los usuarios activos con % no nulo en la temporada.

## API (todas exigen rol `admin` mediante `requireAdmin`; errores con el formato de siempre)

| Método y ruta | Cuerpo / respuesta |
|---|---|
| `GET /api/admin/rehearsals?season=2026` | `{rehearsals:[{id, date, note, present, late, absent, excused}]}` de esa temporada, de más reciente a más antiguo. Sin `season` → temporada actual. |
| `POST /api/admin/rehearsals` | `{date, note?}` → `201 {rehearsal, entries}`. Fecha repetida → `409 rehearsal_exists`. |
| `GET /api/admin/rehearsals/:id` | `{rehearsal:{id, date, note}, entries:[{user:{id, displayName, username, active}, status}]}`, ordenadas por nombre visible. |
| `PATCH /api/admin/rehearsals/:id` | Cualquiera de `{date, note}` → `{rehearsal}`. Fecha ocupada por otro ensayo → `409 rehearsal_exists`. |
| `PUT /api/admin/rehearsals/:id/attendance` | `{entries:[{userId, status}]}` (1–200 entradas) → `{entries}` (lista completa tras guardar). Se aplica en un `db.batch`. |
| `DELETE /api/admin/rehearsals/:id` | `{confirmDate}` igual a la fecha → `204`; borra ensayo y registros. |
| `GET /api/admin/attendance/report?season=2026` | Ver abajo. |
| `GET /api/admin/attendance/seasons` | `{seasons:[2026, 2025…], current: 2026}`: temporadas con ensayos más la actual, de más reciente a más antigua. |

**Validación** (`400 {error:'invalid', field}`):
- `date`: `AAAA-MM-DD` de un día real y no posterior a hoy + 7 días (`field: 'date'`).
- `note`: texto de hasta 200 caracteres tras recortar (`field: 'note'`).
- `entries`: array de 1–200; cada `userId` debe ser un usuario de la lista del ensayo o un usuario activo; `status` uno de
  los cuatro valores (`field: 'entries'`).
- `season`: año entero entre 2000 y 2100 (`field: 'season'`).
- `confirmDate` distinta de la fecha → `400 invalid field:'confirmDate'`.

**Reporte** — `GET /api/admin/attendance/report?season=2026`:

```json
{
  "season": 2026,
  "from": "2026-09-01",
  "to": "2027-08-31",
  "rehearsals": 11,
  "minimum": 6,
  "teamAverage": 84.2,
  "people": [
    { "user": {"id": 1, "displayName": "Ana", "username": "ana", "active": true},
      "recorded": 11, "present": 8, "late": 1, "absent": 1, "excused": 1,
      "attendancePct": 90.0, "latePct": 11.1, "lastAbsence": "2026-10-08",
      "history": [{"date": "2026-10-08", "status": "absent"}] }
  ],
  "leaderboard": [{ "position": 1, "userId": 1 }],
  "belowMinimum": [{ "userId": 7 }]
}
```

- Porcentajes redondeados a 1 decimal. `people` incluye activos e inactivos con registros en la temporada (los inactivos
  con `active:false`), ordenados por nombre visible.
- `history` es el historial de esa persona en la temporada (fecha y estado), del ensayo más reciente al más antiguo; lo usa
  el detalle por persona del panel.
- `leaderboard` y `belowMinimum` solo incluyen activos.
- El cálculo vive en una función pura del backend (`attendanceReport(rows, rehearsalCount)`) para probarlo con números
  hechos a mano.

## Panel de administración: pestaña "Asistencia"

Quinta pestaña junto a Equipo, Ranking, Usuarios y Canciones, con los mismos componentes (tablas, botones, filtros,
diálogos apilables de `sheet.js`). Todo texto dinámico pasa por `esc`.

**Lista de ensayos**
- Botón **"Tomar asistencia de hoy"**: crea el ensayo de la fecha local de hoy o, si ya existe (`409`), abre ese.
- Enlace **"Otra fecha…"**: pide fecha (`<input type="date">`) y nota opcional.
- Selector **Temporada** (de `/attendance/seasons`, recordado mientras el panel está abierto) y botón **Reporte**.
- Tabla: fecha ("mar 14 oct 2026"), nota y recuentos con texto ("8 presentes · 1 tarde · 1 ausente · 0 justificados").
  Clic en una fila → toma de asistencia de ese ensayo.
- Sin ensayos: "Todavía no hay ensayos registrados en esta temporada."

**Tomar asistencia**
- Cabecera con fecha y nota editables (botón "Editar") y recuento en vivo.
- Atajo **"Marcar todos presentes"** (solo cambia a Presente a quien esté en Ausente).
- Una fila por persona: nombre y cuatro botones **Presente · Tarde · Ausente · Justificado** como grupo de radio
  accesible (`role="radiogroup"`, flechas para moverse). Los inactivos que ya estaban en el ensayo muestran "(inactivo)".
- **Guardado automático**: los cambios se agrupan 500 ms y se envían en un `PUT …/attendance`. Indicador abajo:
  "Guardando…", "Guardado ✓" o "No se pudo guardar." con **Reintentar**; los cambios pendientes se conservan mientras el
  diálogo siga abierto. Al cerrar con cambios sin guardar se intenta un último envío.
- **Borrar ensayo** al final, con confirmación que pide escribir la fecha (`AAAA-MM-DD`).

**Reporte de temporada**
- Tres tarjetas: ensayos realizados, asistencia media del equipo, mínimo para el leaderboard ("6 de 11").
- **Leaderboard**: tabla numerada (posición, nombre, % asistencia, asistidos/con registro, tardanzas); los tres primeros
  con distintivo. Debajo, en gris, "Sin mínimo" con su % entre paréntesis.
- **Detalle por persona**: presentes, tardes, ausencias, justificadas, % asistencia, % tardanzas y última falta. Clic en
  un nombre → historial ensayo a ensayo de esa temporada (fecha y estado).

## Casos límite

- Dos administradores tomando asistencia a la vez: gana el último cambio de cada persona (los estados se guardan por
  persona, no la lista entera).
- Cambiar la fecha de un ensayo a otra temporada: pasa a contar en esa temporada.
- Usuario reactivado: entra en ensayos nuevos; en los antiguos solo cuenta si ya estaba en la lista.
- Ensayo con todos justificados: cuenta para `rehearsals` de la temporada pero no altera ningún %.
- Temporada sin ensayos: reporte con `rehearsals: 0`, `minimum: 0`, `teamAverage: null` y listas vacías.

## Pruebas

**Automáticas (backend)**: 403 para tenor y 401 sin sesión en las 8 rutas; crear ensayo (activos como Ausente,
desactivados fuera, fecha repetida 409, fechas imposibles o a más de 7 días); guardar estados (lote, estado o usuario
inválido, alta posterior añadida como Ausente); editar fecha a una ocupada (409); borrar con y sin confirmación; cálculo
del reporte con números hechos a mano (Tarde suma, Justificado no cuenta, mínimo del 50 %, desempates, desactivado fuera
del leaderboard, alta a mitad de temporada, límites 31-ago/1-sep, temporada vacía); borrar un usuario borra sus registros.

**Automáticas (frontend)**: texto de recuentos; cola de guardado automático (agrupación, error y reintento sin perder
cambios).

**Manuales** (Chrome contra `wrangler dev`, al checklist): tomar asistencia de hoy en vista de móvil; marcar todos
presentes y cambiar algunos; cortar la API → Reintentar sin pérdida; ensayo de otra fecha; reporte y leaderboard; borrar
un ensayo.

## Despliegue

1. `npm run db:migrate:remote` (aplica `0003_attendance.sql`).
2. `npm run deploy` (API).
3. `git push` (web).

Actualizar `backend/README.md`, el checklist de pruebas manuales y `comandos-utiles.txt`.

## Fuera de alcance

- Asistencia por QR o autorregistro de cada tenor.
- Avisos a quien falte.
- Panel público de datos 2025/2026.
- Presentaciones y conciertos.
