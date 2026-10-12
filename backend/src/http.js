export class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export const noContent = () => new Response(null, { status: 204 });

export async function readJson(request, maxBytes = 32 * 1024) {
  const tooBig = () => new HttpError(400, 'invalid', { field: 'body' });
  if (Number(request.headers.get('Content-Length') || 0) > maxBytes) throw tooBig();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw tooBig();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid', { field: 'body' });
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid', { field: 'body' });
  return value;
}
