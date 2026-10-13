import { json } from './http.js';
import { login, logout } from './auth.js';
import { me, changePin } from './users.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['GET', '/api/me', me],
  ['POST', '/api/me/pin', changePin],
];
