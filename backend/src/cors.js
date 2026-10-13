export function allowedOrigin(origin, env) {
  if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const entry of list) {
    if (entry === origin) return origin;
    if (entry.endsWith(':*')) {
      const prefix = entry.slice(0, -1); // "http://localhost:"
      if (origin.startsWith(prefix) && /^\d+$/.test(origin.slice(prefix.length))) return origin;
    }
  }
  return null;
}

export function corsHeaders(allowed) {
  if (!allowed) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
