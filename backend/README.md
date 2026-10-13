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
