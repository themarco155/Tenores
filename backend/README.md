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

Antes de entrar, deja abierto en otra terminal `npx wrangler tail` y vigílalo durante el primer acceso **y** durante el cambio de PIN (`POST /api/me/pin`). Si aparece el error 1102 ("Worker exceeded CPU time limit"), el hash del PIN no cabe en el límite de CPU: baja `PIN_ITERATIONS` (ver la sección siguiente).

### Límite de CPU del plan gratuito

El plan gratuito de Workers limita el tiempo de CPU por petición. El hash del PIN usa 20 000 iteraciones (`PIN_ITERATIONS`), pensado para caber holgadamente, pero no se ha medido en el plan gratuito. La petición más costosa es el primer cambio de PIN (`POST /api/me/pin`): comprueba el PIN actual y calcula el hash del nuevo, el doble de CPU que entrar; es la comprobación crítica tras desplegar. Si al entrar ves errores 1102 o "Worker exceeded CPU time limit" en `npx wrangler tail`, baja `PIN_ITERATIONS` en `wrangler.toml` (mínimo 10 000) y vuelve a desplegar; los PIN existentes siguen funcionando porque cada usuario guarda sus propias iteraciones, y se actualizan al cambiar o restablecer el PIN.

### Copias de seguridad

```bash
npx wrangler d1 export tenores --remote --output copia-tenores.sql
```

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

## Asistencia

Los administradores toman asistencia en **Administración → Asistencia**: "Tomar asistencia de hoy" abre la lista de
todos los usuarios activos (empiezan como Ausente), se marca Presente, Tarde, Ausente o Justificado y cada cambio se
guarda solo. **Reporte** muestra la temporada (1 de septiembre a 31 de agosto): % de asistencia de cada integrante
(Tarde cuenta como asistido, Justificado no cuenta), tardanzas y un leaderboard (mínimo: registro en la mitad de los
ensayos). Todo es solo para administradores.

**Al desplegar esta versión:** `npm run db:migrate:remote` (aplica `0003_attendance.sql`), `npm run deploy` y después
publicar la web.
