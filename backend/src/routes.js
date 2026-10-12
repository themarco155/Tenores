import { json } from './http.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
];
