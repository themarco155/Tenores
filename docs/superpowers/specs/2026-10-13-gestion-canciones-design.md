# Gestión de canciones desde el panel de administración

Fecha: 2026-10-13 · Depende de: [fase 2](2026-10-12-fase2-backend-progreso-design.md) y
[fase 3](2026-10-12-fase3-panel-admin-design.md)

## Objetivo

Que el jefe de cuerda (rol `admin`) añada, edite, ordene, desactive y reactive las canciones del coro desde el
panel de administración, sin tocar código, y que el sitio público y el modo práctica reflejen esos cambios con
el mismo formato y diseño de hoy.

Hoy cada canción es un bloque fijo en `app.js` (`SONGS`: título, enlace de Cloudinary, letra), una tarjeta fija en
`index.html` y un archivo de referencia generado a mano en `assets/pitch/<id>.json` con `tools/build-pitch.html`.

**Criterios de éxito**
- El administrador puede crear una canción solo con letra, añadirle el audio después y practicarla, sin editar
  archivos ni ejecutar herramientas.
- El orden que deja el administrador es el orden de la portada (tarjetas 01, 02…).
- Una canción desactivada desaparece de la portada y de la práctica, pero su historial sigue visible con su título
  en "Mi progreso" y en el panel.
- Si el backend no responde o no está configurado, el sitio funciona como hoy con las 12 canciones incluidas.
- Ninguna ruta de administración de canciones responde a un tenor o a alguien sin sesión (cubierto por tests).

## Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Origen del audio | Se pega un enlace (Cloudinary, como hasta ahora). No se suben archivos desde el panel. |
| Audio obligatorio | No. Una canción puede existir solo con letra; entonces no tiene reproductor, descarga ni práctica. |
| Orden | Manual, con botones Subir/Bajar. Las nuevas se añaden al final. |
| Cambiar el audio | Se recalcula la referencia. Los intentos anteriores se conservan y siguen contando igual en el ranking. |
| Borrar canciones | No se borran; solo se desactivan, para no perder historial. |
| Fuente de datos | La base D1 es la fuente única; el sitio guarda una copia de respaldo (enfoque A). |

## Datos (nueva migración `backend/migrations/0002_songs.sql`)

```sql
CREATE TABLE songs (
  id          TEXT PRIMARY KEY,              -- slug inmutable: 'fum', 'canto-de-las-campanas'
  title       TEXT NOT NULL,
  track       TEXT,                          -- enlace https del audio; NULL = solo letra
  lyrics      TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL,              -- orden de la portada (1 = primera)
  active      INTEGER NOT NULL DEFAULT 1,
  legacy_reference INTEGER NOT NULL DEFAULT 0, -- 1 = vale assets/pitch/<id>.json (las 12 migradas)
  reference   TEXT,                          -- JSON de referencia calculado desde el panel
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX songs_title ON songs(title COLLATE NOCASE);
```

- La migración inserta las 12 canciones actuales con título, enlace y letra copiados de `SONGS` en `app.js`, y
  `position` según el orden de las tarjetas de `index.html` (Fum Fum Fum 1, Canto de las campanas 2,
  Adeste Fideles 3…). Su `reference` queda en `NULL` y `legacy_reference = 1`: D1 no acepta sentencias de más de 100 KB y algunas
  referencias pesan ~100 KB, así que siguen sirviéndose desde `assets/pitch/`.
- El SQL de la migración se genera una vez con un script a partir de `app.js` e `index.html` (escapando comillas)
  y se versiona; no se escribe a mano.
- **Slug**: al crear, se genera desde el título (minúsculas, sin tildes, espacios y signos → `-`, máximo 40
  caracteres). Si ya existe, se añade `-2`, `-3`… Nunca cambia aunque se edite el título, para no romper enlaces
  (`#id`) ni historial (`attempts.song_id`).

## API

### Pública (sin sesión; misma política CORS que el resto)

| Método y ruta | Respuesta |
|---|---|
| `GET /api/songs` | `{songs:[{id, title, track, lyrics, position, active, hasReference, legacyReference}]}` ordenadas por `position`. Incluye las inactivas (solo para mostrar títulos del historial); el sitio solo muestra las activas. `hasReference` = hay JSON en la base; `legacyReference` = vale el archivo de `assets/pitch/`. |
| `GET /api/songs/:id/reference` | El JSON de referencia guardado (`200`), o `404 not_found` si la canción no existe o no tiene referencia en la base. |

### Administración (exigen rol `admin`, igual que `/api/admin/users`)

| Método y ruta | Cuerpo / respuesta |
|---|---|
| `GET /api/admin/songs?active=1\|0\|all` | `{songs:[{id, title, track, lyrics, position, active, hasReference, legacyReference, createdAt, updatedAt}]}` |
| `POST /api/admin/songs` | `{title, track?, lyrics?}` → `201 {song}`; `position` = última + 1 |
| `PATCH /api/admin/songs/:id` | Cualquiera de `{title, track, lyrics, active}` → `{song}`. Cambiar `track` (o ponerlo a `null`) borra `reference` y pone `legacy_reference = 0` |
| `PUT /api/admin/songs/:id/reference` | El JSON de referencia (cuerpo hasta 512 KB) → `204` |
| `PUT /api/admin/songs/order` | `{ids:[...]}` con todos los ids existentes, cada uno una vez → `204`; reescribe `position` en un `db.batch` |

**Validación** (errores con el formato de siempre, `400 {error:'invalid', field}`):
- `title`: 1–80 caracteres tras recortar espacios; duplicado (sin distinguir mayúsculas) → `409 title_taken`.
- `track`: `null` o una URL `https://` de hasta 500 caracteres.
- `lyrics`: hasta 20 000 caracteres; se guardan tal cual (saltos de línea incluidos).
- Referencia: objeto con `version`, `songId` igual al de la ruta, `hopMs`, `frameCount`, `midi` (array),
  `notes` (array) y `phrases` (array con al menos una frase); si no, `400 invalid field:'reference'`. Solo se
  acepta si la canción tiene `track`.
- `order`: el conjunto de `ids` debe coincidir exactamente con el de la tabla, si no `400 invalid field:'ids'`.
- CORS añade `PUT` a los métodos permitidos.
- `readJson` acepta un límite por ruta: 32 KB por defecto, 512 KB solo en la de referencia.

### Cambios en rutas existentes
- `POST /api/attempts`: `songId` debe ser una canción **activa con `track`**; si no, `400 invalid field:'songId'`.
- `GET /api/me/attempts?song=` y `GET /api/admin/ranking?song=`: aceptan cualquier id de la tabla (activo o no).
- `backend/src/songs.js` (`SONG_IDS`) se sustituye por consultas a la tabla.

## Sitio público y práctica

### Lista de canciones (`practice/songs.js`, nuevo)
- Al cargar, usa la última lista guardada en `localStorage` (`tenores.songs.v1`); si no hay o no se puede leer,
  la de `SONGS` incluida en `app.js`.
- Pide `GET /api/songs` en segundo plano (si `apiEnabled`). Si la respuesta difiere, guarda la copia y avisa
  (evento `tenores:songs`) para repintar.
- Si el backend falla, no hay cambio visible: se sigue con la copia o con las incluidas.
- Expone `getSongs()`, `getSong(id)` y `onSongsChange(fn)` para `app.js` y los módulos de práctica.

### `app.js` e `index.html`
- Las tarjetas de `index.html` se quedan como primer pintado. Al recibir la lista, se reconstruyen con **el
  mismo marcado** (`a.mini-card[data-song]` > `span.mini-badge` + `span.mini-title`), solo las activas, en
  orden y numeradas desde `01`.
- `SONGS` pasa a actualizarse desde la lista (sigue siendo un objeto global para no romper `practice/main.js` ni
  `format.js`). Los datos de `items` del buscador se reconstruyen con las tarjetas, para que filtrar siga
  funcionando igual.
- `renderSong`: toma título, letra y audio de la lista. Una canción **sin `track`** muestra la letra y oculta el
  reproductor, la descarga y el botón "Practicar". Un `#id` inactivo o inexistente vuelve a la portada.
- Si la canción abierta cambia (otro audio, otra letra), se repinta al llegar la nueva lista.

### Práctica
- El botón "Practicar" aparece para canciones activas con `track` y con referencia disponible: `hasReference`
  o `legacyReference`.
- Al abrir la práctica, la referencia se pide a `GET /api/songs/:id/reference` si `hasReference`; si no (y `legacyReference`), a
  `assets/pitch/<id>.json` como hoy. Así, si se cambia el audio de una canción migrada y falla la subida de
  su nueva referencia, no se usa por error el archivo antiguo.
- `songTitle(id)` (en `format.js`) usa la lista completa, incluidas las inactivas, para "Mi progreso" y el
  panel. El selector de canción del ranking se construye desde la lista (ya no fijo en `admin-ui.js`).

## Panel de administración: pestaña "Canciones"

- Cuarta pestaña junto a Equipo, Ranking y Usuarios, con los mismos componentes (tabla, botones, diálogos
  apilables de `sheet.js`, errores de formulario).
- Filtro "Mostrar" (Activas / Inactivas / Todas) y botón **Nueva canción**.
- Columnas: posición, título, audio (Sí/No), estado; acciones **Subir**, **Bajar** (guardan el orden al
  momento; desactivadas en los extremos), **Editar**, **Desactivar** / **Reactivar**.
- **Formulario** (crear y editar): Título (obligatorio), Enlace del audio (opcional), Letra (área de texto
  grande que respeta saltos de línea).
- **Al guardar con audio nuevo o cambiado**:
  1. Se muestra "Descargando audio…" y luego "Analizando audio…"; el botón queda desactivado.
  2. El navegador descarga el enlace, lo decodifica y calcula la referencia con `buildReference` (el mismo
     código que `tools/build-pitch.js`).
  3. Si la descarga falla → "No se pudo descargar el audio. Revisa el enlace." junto al campo del enlace. Si no
     se detectan frases → "No se detectaron notas en el audio." En ambos casos **no se guarda nada**.
  4. Si va bien: `POST`/`PATCH` de los datos y `PUT` de la referencia; se cierra el formulario y se recarga la
     lista. Si el `PUT` falla tras guardar los datos, se avisa ("Se guardó la canción pero no su referencia.
     Vuelve a guardar para reintentarlo.") y la canción queda sin práctica hasta reintentar.
- **Desactivar** pide confirmación: "No aparecerá en el sitio ni en práctica. Su historial se conserva y puedes
  reactivarla cuando quieras."
- Título duplicado → "Ya existe una canción con ese título." junto al campo. Sesión caducada o permisos → el
  mismo `handleAuthError` del panel.
- Todo texto dinámico pasa por `esc`.

## Casos límite

- El slug no cambia al editar el título.
- Dos pestañas reordenando a la vez: gana la última (`PUT order` reescribe todas las posiciones).
- Enlace antiguo a una canción ahora inactiva → portada.
- Una canción reactivada vuelve a su `position` guardada.
- Quitar el audio a una canción (dejar el enlace vacío) borra su referencia; deja de poder practicarse, el
  historial se conserva.

## Pruebas

**Automáticas (backend)**: crear, editar, reordenar, desactivar y reactivar con sus validaciones (título vacío,
largo o duplicado; enlace no `https`; `ids` incompletos o repetidos); tenor → `403` y sin sesión → `401` en todas
las rutas de administración de canciones; referencia con forma inválida, sin `track` y por encima de 512 KB;
intento con canción inactiva o sin audio → `400`; ranking y listado con una canción nueva; la migración deja las
12 canciones en el orden de la portada.

**Automáticas (frontend)**: `songs.js` con respuesta de la API, desde la copia y con el backend caído; marcado de
las tarjetas reconstruidas; elección del origen de la referencia; generación de slug con tildes, signos y
duplicados.

**Manuales** (Chrome contra `wrangler dev`, añadidas al checklist): crear una canción solo con letra → añadirle
audio → practicarla; reordenar y ver la portada; cambiar el audio de una existente; desactivar y comprobar
portada, práctica y "Mi progreso"; sitio con el backend apagado; vista de móvil.

## Despliegue

1. `npm run db:migrate:remote` (aplica `0002_songs.sql`) **antes** de publicar el sitio nuevo.
2. Desplegar el Worker y luego el sitio.
3. Actualizar la guía de `backend/README.md` y añadir los pasos al checklist de pruebas manuales.

## Fuera de alcance

- Subir archivos de audio desde el panel.
- Borrar canciones.
- Asistencia de los integrantes del coro (sub-proyecto aparte, se diseña después).
