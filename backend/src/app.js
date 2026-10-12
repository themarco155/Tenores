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
