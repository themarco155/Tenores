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
| 14 | Canciones: crear una solo con letra → sale en la portada sin reproductor ni "Practicar" | | |
| 15 | Canciones: añadirle el enlace del audio → "Descargando…/Analizando…" → se puede practicar y guardar | | |
| 16 | Canciones: Subir/Bajar cambia el orden de la portada (números 01, 02…) | | |
| 17 | Canciones: enlace roto → "No se pudo descargar el audio…" y no se guarda nada | | |
| 18 | Canciones: desactivar → desaparece de la portada y de práctica; sigue en "Mi progreso" con su título | | |
| 19 | Canciones: backend apagado → la portada muestra la última lista guardada | | |
