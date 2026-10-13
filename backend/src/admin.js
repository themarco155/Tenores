import { HttpError, json, noContent, readJson } from './http.js';
import { requireAdmin } from './auth.js';
import { hashPin, newSalt, randomPin, pinIterations } from './crypto.js';
import { validateUsername, validateDisplayName, validateRole, validateId } from './validate.js';
import { attemptsPage, userSummary } from './attempts.js';
import { songExists } from './songs.js';

const USER_SELECT = `SELECT u.*, (SELECT MAX(created_at) FROM attempts a WHERE a.user_id = u.id) AS last_attempt_at FROM users u`;

export function adminUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    active: !!row.active,
    mustChangePin: !!row.must_change_pin,
    createdAt: row.created_at,
    deactivatedAt: row.deactivated_at,
    lastAttemptAt: row.last_attempt_at ?? null,
  };
}

async function findUser(db, id) {
  const row = await db.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function usernameTaken(db, username, exceptId = 0) {
  return !!(await db.prepare('SELECT id FROM users WHERE username = ? AND id <> ?').bind(username, exceptId).first());
}

// ¿Dejaría el cambio al sistema sin ningún administrador activo?
export async function wouldRemoveLastAdmin(db, target) {
  if (target.role !== 'admin' || !target.active) return false;
  const others = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?").bind(target.id).first('n');
  return others === 0;
}

export async function listUsers(ctx) {
  await requireAdmin(ctx);
  const active = ctx.url.searchParams.get('active') ?? 'all';
  if (!['all', '1', '0'].includes(active)) throw new HttpError(400, 'invalid', { field: 'active' });
  const where = active === 'all' ? '' : 'WHERE u.active = ?';
  const stmt = ctx.db.prepare(`${USER_SELECT} ${where} ORDER BY u.active DESC, u.display_name COLLATE NOCASE, u.id`);
  const { results } = await (active === 'all' ? stmt : stmt.bind(Number(active))).all();
  return json(200, { users: results.map(adminUser) });
}

export async function createUser(ctx) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.request);
  const username = validateUsername(body.username);
  const displayName = validateDisplayName(body.displayName);
  const role = validateRole(body.role);
  if (await usernameTaken(ctx.db, username)) throw new HttpError(409, 'username_taken');
  const pin = randomPin();
  const salt = newSalt();
  const iterations = pinIterations(ctx.env);
  const ts = ctx.now.toISOString();
  const r = await ctx.db.prepare(`INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, active, must_change_pin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`)
    .bind(username, displayName, await hashPin(pin, salt, iterations), salt, iterations, role, ts, ts).run();
  return json(201, { user: adminUser(await findUser(ctx.db, r.meta.last_row_id)), temporaryPin: pin });
}

export async function updateUser(ctx) {
  const admin = await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const target = await findUser(ctx.db, id);
  const body = await readJson(ctx.request);
  const sets = [];
  const params = [];
  if ('username' in body) {
    const username = validateUsername(body.username);
    if (await usernameTaken(ctx.db, username, id)) throw new HttpError(409, 'username_taken');
    sets.push('username = ?'); params.push(username);
  }
  if ('displayName' in body) { sets.push('display_name = ?'); params.push(validateDisplayName(body.displayName)); }
  let role = target.role;
  if ('role' in body) { role = validateRole(body.role); sets.push('role = ?'); params.push(role); }
  let active = !!target.active;
  if ('active' in body) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'invalid', { field: 'active' });
    active = body.active;
    sets.push('active = ?', 'deactivated_at = ?');
    params.push(active ? 1 : 0, active ? null : ctx.now.toISOString());
  }
  if (!sets.length) throw new HttpError(400, 'invalid', { field: 'body' });
  const losesAdmin = (target.role === 'admin' && role !== 'admin') || (!!target.active && !active);
  if (id === admin.id && losesAdmin) throw new HttpError(409, 'self_action');
  if (losesAdmin && await wouldRemoveLastAdmin(ctx.db, target)) throw new HttpError(409, 'last_admin');
  sets.push('updated_at = ?');
  params.push(ctx.now.toISOString());
  const statements = [ctx.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id)];
  if (!active) statements.push(ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  await ctx.db.batch(statements);
  return json(200, { user: adminUser(await findUser(ctx.db, id)) });
}

export async function resetPin(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const target = await findUser(ctx.db, id);
  const pin = randomPin();
  const salt = newSalt();
  const iterations = pinIterations(ctx.env);
  await ctx.db.batch([
    ctx.db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iterations = ?, must_change_pin = 1, updated_at = ? WHERE id = ?')
      .bind(await hashPin(pin, salt, iterations), salt, iterations, ctx.now.toISOString(), id),
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    ctx.db.prepare('DELETE FROM login_failures WHERE username = ?').bind(target.username),
  ]);
  return json(200, { temporaryPin: pin });
}

export async function deleteUser(ctx) {
  const admin = await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const target = await findUser(ctx.db, id);
  const body = await readJson(ctx.request);
  if (id === admin.id) throw new HttpError(409, 'self_action');
  if (await wouldRemoveLastAdmin(ctx.db, target)) throw new HttpError(409, 'last_admin');
  const confirm = typeof body.confirmUsername === 'string' ? body.confirmUsername.trim().toLowerCase() : '';
  if (confirm !== target.username) throw new HttpError(400, 'invalid', { field: 'confirmUsername' });
  await ctx.db.batch([
    ctx.db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ctx.db.prepare('DELETE FROM login_failures WHERE username = ?').bind(target.username),
  ]);
  return noContent();
}

export async function userAttemptsAdmin(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  await findUser(ctx.db, id);
  return json(200, await attemptsPage(ctx.db, id, ctx.url));
}

export async function userSummaryAdmin(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  await findUser(ctx.db, id);
  return json(200, await userSummary(ctx.db, id));
}

const DAY = 86_400_000;
const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const roundOrNull = v => (v == null ? null : Math.round(v));
const shortUser = row => ({ id: row.user_id ?? row.id, username: row.username, displayName: row.display_name });

export async function team(ctx) {
  await requireAdmin(ctx);
  const now = ctx.now.getTime();
  const iso = days => new Date(now - days * DAY).toISOString();
  const { results: users } = await ctx.db.prepare('SELECT id, username, display_name, role FROM users WHERE active = 1 ORDER BY display_name COLLATE NOCASE, id').all();
  const { results: recent } = await ctx.db.prepare('SELECT user_id, score_total, created_at FROM attempts WHERE created_at >= ?').bind(iso(30)).all();
  const { results: lasts } = await ctx.db.prepare('SELECT user_id, MAX(created_at) AS last FROM attempts GROUP BY user_id').all();
  const lastBy = new Map(lasts.map(r => [r.user_id, r.last]));
  const rows = users.map(u => {
    const mine = recent.filter(r => r.user_id === u.id);
    const within = days => mine.filter(r => r.created_at >= iso(days));
    const last14 = within(14).map(r => r.score_total);
    const prev14 = mine.filter(r => r.created_at >= iso(28) && r.created_at < iso(14)).map(r => r.score_total);
    return {
      user: { id: u.id, username: u.username, displayName: u.display_name, role: u.role },
      lastAttemptAt: lastBy.get(u.id) ?? null,
      attempts7d: within(7).length,
      attempts30d: mine.length,
      avg30d: roundOrNull(mean(mine.map(r => r.score_total))),
      trend: last14.length && prev14.length ? Math.round(mean(last14) - mean(prev14)) : null,
    };
  });
  return json(200, { team: rows });
}

export async function ranking(ctx) {
  await requireAdmin(ctx);
  const song = ctx.url.searchParams.get('song');
  if (song !== 'all' && (song === null || !(await songExists(ctx.db, song)))) throw new HttpError(400, 'invalid', { field: 'song' });
  const sinceRaw = ctx.url.searchParams.get('since');
  let since = '0000-01-01T00:00:00.000Z';
  if (sinceRaw !== null) {
    const d = new Date(sinceRaw);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'invalid', { field: 'since' });
    since = d.toISOString();
  }
  const songFilter = song === 'all' ? '' : 'AND a.song_id = ?';
  const stmt = ctx.db.prepare(`SELECT a.id, a.user_id, a.song_id, a.score_total, a.score_pitch, a.score_rhythm, a.score_stability, u.username, u.display_name
    FROM attempts a JOIN users u ON u.id = a.user_id
    WHERE u.active = 1 AND a.mode = 'test' AND a.is_full = 1 AND a.created_at >= ? ${songFilter}
    ORDER BY a.id ASC`);
  const { results } = await (song === 'all' ? stmt.bind(since) : stmt.bind(since, song)).all();

  // Mejor intento por usuario y canción (empate → el más antiguo, por id ascendente).
  const best = new Map(); // `${user}:${song}` → row
  const count = new Map(); // user → intentos que cuentan
  for (const r of results) {
    count.set(r.user_id, (count.get(r.user_id) || 0) + 1);
    const key = `${r.user_id}:${r.song_id}`;
    const prev = best.get(key);
    if (!prev || r.score_total > prev.score_total) best.set(key, r);
  }

  const byName = (a, b) => a.user.displayName.localeCompare(b.user.displayName, 'es');
  let rows;
  if (song !== 'all') {
    rows = [...best.values()]
      .sort((a, b) => b.score_total - a.score_total || a.id - b.id)
      .map(r => ({ user: shortUser(r), best: r.score_total, pitch: r.score_pitch, rhythm: r.score_rhythm, stability: r.score_stability, attempts: count.get(r.user_id) }));
  } else {
    const perUser = new Map();
    for (const r of best.values()) {
      if (!perUser.has(r.user_id)) perUser.set(r.user_id, { user: shortUser(r), scores: [] });
      perUser.get(r.user_id).scores.push(r.score_total);
    }
    rows = [...perUser.values()]
      .map(u => ({ user: u.user, average: Math.round(mean(u.scores) * 10) / 10, songs: u.scores.length, attempts: count.get(u.user.id) }))
      .sort((a, b) => b.average - a.average || b.songs - a.songs || byName(a, b));
  }
  return json(200, { rows: rows.map((r, i) => ({ position: i + 1, ...r })) });
}
