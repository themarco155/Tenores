import { json } from './http.js';
import { login, logout } from './auth.js';
import { me, changePin, myAttempts, mySummary } from './users.js';
import { createAttempt } from './attempts.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['GET', '/api/me', me],
  ['POST', '/api/me/pin', changePin],
  ['GET', '/api/me/attempts', myAttempts],
  ['GET', '/api/me/summary', mySummary],
  ['POST', '/api/attempts', createAttempt],
];
