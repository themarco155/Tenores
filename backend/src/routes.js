import { json } from './http.js';
import { login, logout } from './auth.js';
import { me, changePin, myAttempts, mySummary } from './users.js';
import { createAttempt } from './attempts.js';
import { listSongs, songReference, adminListSongs, createSong, updateSong, putSongReference, reorderSongs } from './songs.js';
import { listUsers, createUser, updateUser, resetPin, deleteUser, userAttemptsAdmin, userSummaryAdmin, team, ranking } from './admin.js';

const health = async () => json(200, { ok: true });

export const ROUTES = [
  ['GET', '/api/health', health],
  ['GET', '/api/songs', listSongs],
  ['GET', '/api/songs/:id/reference', songReference],
  ['POST', '/api/auth/login', login],
  ['POST', '/api/auth/logout', logout],
  ['GET', '/api/me', me],
  ['POST', '/api/me/pin', changePin],
  ['GET', '/api/me/attempts', myAttempts],
  ['GET', '/api/me/summary', mySummary],
  ['POST', '/api/attempts', createAttempt],
  ['GET', '/api/admin/users', listUsers],
  ['POST', '/api/admin/users', createUser],
  ['PATCH', '/api/admin/users/:id', updateUser],
  ['DELETE', '/api/admin/users/:id', deleteUser],
  ['POST', '/api/admin/users/:id/reset-pin', resetPin],
  ['GET', '/api/admin/users/:id/attempts', userAttemptsAdmin],
  ['GET', '/api/admin/users/:id/summary', userSummaryAdmin],
  ['GET', '/api/admin/team', team],
  ['GET', '/api/admin/ranking', ranking],
  ['GET', '/api/admin/songs', adminListSongs],
  ['POST', '/api/admin/songs', createSong],
  ['PUT', '/api/admin/songs/order', reorderSongs],
  ['PATCH', '/api/admin/songs/:id', updateSong],
  ['PUT', '/api/admin/songs/:id/reference', putSongReference],
];
