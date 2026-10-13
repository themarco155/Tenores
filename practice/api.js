import { API_BASE } from './config.js';
import { getSession, clearSession } from './session.js';

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

const MESSAGES = {
  invalid_credentials: 'Usuario o PIN incorrectos.',
  locked: 'Demasiados intentos. Vuelve a intentarlo más tarde.',
  unauthorized: 'Tu sesión ha caducado. Vuelve a entrar.',
  pin_change_required: 'Tienes que elegir un PIN nuevo antes de continuar.',
  forbidden: 'No tienes permiso para hacer esto.',
  too_fast: 'Espera unos segundos antes de guardar otro intento.',
  username_taken: 'Ese nombre de usuario ya existe.',
  self_action: 'No puedes hacer eso con tu propio usuario.',
  last_admin: 'Debe quedar al menos un administrador activo.',
  not_found: 'No se encontró lo que buscabas.',
  invalid: 'Hay datos no válidos.',
  network: 'No se pudo conectar con el servidor.',
  timeout: 'El servidor tardó demasiado en responder.',
  server_error: 'Error del servidor. Inténtalo de nuevo.',
};

export function messageFor(code, extra = {}) {
  if (code === 'locked' && extra.retryAfter) return `Demasiados intentos. Vuelve a intentarlo en ${Math.ceil(extra.retryAfter / 60)} min.`;
  return MESSAGES[code] || MESSAGES.server_error;
}

export async function request(method, path, body, { timeoutMs = 10_000, base = API_BASE } = {}) {
  const session = getSession();
  const headers = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    const code = err && err.name === 'AbortError' ? 'timeout' : 'network';
    throw new ApiError(0, code, messageFor(code));
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const { error = 'server_error', ...extra } = data || {};
    if (res.status === 401 && session) clearSession();
    throw new ApiError(res.status, error, messageFor(error, extra), extra);
  }
  return data;
}

export function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function toAttemptPayload(result) {
  const { curves, ...rest } = result;
  return rest;
}

export const api = {
  login: (username, pin) => request('POST', '/api/auth/login', { username, pin }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/me'),
  changePin: (currentPin, newPin) => request('POST', '/api/me/pin', { currentPin, newPin }),
  saveAttempt: result => request('POST', '/api/attempts', toAttemptPayload(result)),
  myAttempts: ({ song, before } = {}) => request('GET', `/api/me/attempts${query({ song, before, limit: 100 })}`),
  mySummary: () => request('GET', '/api/me/summary'),
  admin: {
    users: (active = 'all') => request('GET', `/api/admin/users${query({ active })}`),
    createUser: data => request('POST', '/api/admin/users', data),
    updateUser: (id, data) => request('PATCH', `/api/admin/users/${id}`, data),
    resetPin: id => request('POST', `/api/admin/users/${id}/reset-pin`),
    deleteUser: (id, confirmUsername) => request('DELETE', `/api/admin/users/${id}`, { confirmUsername }),
    userAttempts: (id, { song, before } = {}) => request('GET', `/api/admin/users/${id}/attempts${query({ song, before, limit: 100 })}`),
    userSummary: id => request('GET', `/api/admin/users/${id}/summary`),
    team: () => request('GET', '/api/admin/team'),
    ranking: (song, since) => request('GET', `/api/admin/ranking${query({ song, since })}`),
  },
};
