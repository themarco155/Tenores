// URL del backend. En local se usa `wrangler dev`; en producción se rellena PRODUCTION_API
// al desplegar (ver backend/README.md). Vacío = backend desactivado: la práctica funciona
// igual pero sin login ni guardado.
export const PRODUCTION_API = 'https://tenores-api.tenores-api.workers.dev';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function resolveApiBase(hostname = globalThis.location?.hostname ?? '') {
  return LOCAL_HOSTS.includes(hostname) ? 'http://127.0.0.1:8787' : PRODUCTION_API;
}

export const API_BASE = resolveApiBase();
export const apiEnabled = API_BASE !== '';
