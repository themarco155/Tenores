# Fase 3 — Panel de administración

Fecha: 2026-10-12 · Visión general: [overview](2026-10-12-sistema-practica-overview.md) ·
Depende de: [fase 2](2026-10-12-fase2-backend-progreso-design.md)

## Objetivo

Que el jefe de cuerda (rol `admin`) gestione a los tenores y siga el progreso del equipo, incluido un ranking
que solo él ve.

**Criterios de éxito**
- El administrador puede crear, editar, desactivar, reactivar, restablecer el PIN y eliminar usuarios sin tocar
  la base de datos a mano.
- Un tenor desactivado no puede entrar, pierde sus sesiones y desaparece del ranking y de la vista de equipo,
  pero su historial sigue disponible en la pestaña Usuarios.
- Ninguna ruta de administración responde a un usuario con rol `tenor` (cubierto por tests).

## API (nuevo `backend/src/admin.js`; todas exigen rol `admin` mediante el middleware de la fase 2)

| Método y ruta | Cuerpo / respuesta |
|---|---|
| `GET /api/admin/users?active=1\|0\|all` | `{users:[{id, username, displayName, role, active, createdAt, deactivatedAt, lastAttemptAt}]}` |
| `POST /api/admin/users` | `{username, displayName, role}` → `201 {user, temporaryPin}` (`must_change_pin = 1`) |
| `PATCH /api/admin/users/:id` | Cualquiera de `{username, displayName, role, active}` → `{user}`. `active:false` fija `deactivated_at` y borra sus sesiones; `active:true` lo limpia |
| `POST /api/admin/users/:id/reset-pin` | → `{temporaryPin}`; fija `must_change_pin = 1`, borra sus sesiones y su bloqueo |
| `DELETE /api/admin/users/:id` | `{confirmUsername}` debe coincidir → `204`; borra el usuario, sesiones e intentos (cascada) |
| `GET /api/admin/users/:id/attempts` · `GET /api/admin/users/:id/summary` | Igual que las rutas `/api/me/...` pero para ese usuario |
| `GET /api/admin/team` | Por tenor activo: `{user, lastAttemptAt, attempts7d, attempts30d, avg30d, trend}` |
| `GET /api/admin/ranking?song=<id>\|all&since=<ISO>` | `{rows:[{position, user, best, pitch, rhythm, stability, attempts}]}` |

**Reglas de protección**
- Un admin no puede desactivarse, bajarse el rol ni eliminarse a sí mismo (`409 {error:'self_action'}`), y no
  se puede dejar el sistema sin ningún admin activo (`409 {error:'last_admin'}`).
- `username` duplicado → `409 {error:'username_taken'}`.
- El PIN temporal se genera con `crypto.getRandomValues` (6 dígitos) y solo viaja en esa respuesta.

**Cálculos**
- `trend`: diferencia entre la media de `score_total` de los últimos 14 días y la de los 14 anteriores
  (`null` si alguno de los periodos no tiene intentos).
- **Ranking por canción:** solo usuarios activos, `mode = 'test'`, `is_full = 1`, `created_at ≥ since`. Por
  usuario, el intento con mayor `score_total` (empate → el más antiguo); se muestran sus métricas y el número de
  intentos que cuentan. Orden descendente por `best`.
- **Ranking general (`song=all`):** por usuario, la media de sus mejores notas en cada canción con al menos un
  intento que cuente; columna adicional "canciones". Orden por media y, en empate, por número de canciones.
- Periodos en la interfaz: 7 días, 30 días, temporada (desde el 1 de septiembre más reciente).

## Interfaz (`practice/admin-ui.js`)

Acceso desde la carpeta "Práctica" del menú → *Administración* (visible solo con rol `admin`). Panel a pantalla
completa con cuatro pestañas:

1. **Equipo:** tabla de tenores activos con último intento, intentos en 7 y 30 días, media de 30 días y
   tendencia (↑ ↓ –). Marca "Sin practicar" a quien lleve más de 14 días sin intentos o no tenga ninguno.
   Al tocar un tenor se abre su detalle.
2. **Ranking:** selector de canción (o "General") y de periodo; tabla con posición, nombre, mejor nota y
   desglose. Nota visible: "Solo cuentan canciones completas en modo 'Ponerme a prueba'".
3. **Usuarios:** filtro Activos / Inactivos / Todos. Acciones por fila: Editar, Restablecer PIN,
   Desactivar/Reactivar, Eliminar. Botón "Nuevo usuario".
   - Crear y restablecer muestran el **PIN temporal una sola vez** en un diálogo con botón "Copiar" y el texto
     "Compártelo con el tenor; tendrá que cambiarlo al entrar."
   - Eliminar abre un diálogo que explica que se borra todo su historial y pide escribir el usuario.
   - Desactivar pide una confirmación simple.
4. **Detalle de tenor:** reutiliza `renderProgress(container, {userId})` de la fase 2, con un enlace "Volver".

**Errores:** los `409` se muestran junto al campo correspondiente; un `403` o `401` cierra el panel y vuelve a
pedir el login; los fallos de red muestran "Reintentar" sin perder lo escrito en los formularios.

## Pruebas

**Backend (Vitest):** cada ruta con rol `tenor` → `403`; crear (PIN temporal válido, `must_change_pin`),
username duplicado, editar, desactivar (sesiones borradas, login rechazado, fuera del ranking y del equipo),
reactivar, restablecer PIN (desbloquea y obliga a cambiarlo), eliminar con confirmación incorrecta y correcta
(cascada), protecciones `self_action` y `last_admin`; ranking por canción y general con datos sembrados
(filtros de modo, completitud, periodo, inactivos, desempates); `trend`.

**Manual:** flujo completo del administrador en escritorio y móvil.
