// Asistencia a ensayos: reglas (temporadas, fechas, reporte) y rutas de administración.
import { HttpError, json, noContent, readJson } from './http.js';
import { requireAdmin } from './auth.js';
import { validateId } from './validate.js';

export const STATUSES = ['present', 'late', 'absent', 'excused'];
const DAY = 86_400_000;
const MAX_DAYS_AHEAD = 7;

export const currentSeason = now => (now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
export const seasonRange = season => ({ from: `${season}-09-01`, to: `${season + 1}-08-31` });

export function seasonOf(date) {
  const [y, m] = date.split('-').map(Number);
  return m >= 9 ? y : y - 1;
}

export function validDate(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const limit = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + MAX_DAYS_AHEAD * DAY;
  return d.getTime() <= limit;
}

const round1 = x => Math.round(x * 10) / 10;
const byName = (a, b) => a.user.displayName.localeCompare(b.user.displayName, 'es', { sensitivity: 'base' }) || a.user.id - b.user.id;

export function attendanceReport(rows, rehearsalCount) {
  const byUser = new Map();
  for (const r of rows) {
    let p = byUser.get(r.user_id);
    if (!p) {
      p = { user: { id: r.user_id, displayName: r.display_name, username: r.username, active: !!r.active },
        recorded: 0, present: 0, late: 0, absent: 0, excused: 0, lastAbsence: null, history: [] };
      byUser.set(r.user_id, p);
    }
    p.recorded++;
    p[r.status]++;
    p.history.push({ date: r.date, status: r.status });
    if (r.status === 'absent' && (!p.lastAbsence || r.date > p.lastAbsence)) p.lastAbsence = r.date;
  }
  const people = [...byUser.values()].map(p => {
    const attended = p.present + p.late;
    const counted = attended + p.absent;
    p.history.sort((a, b) => b.date.localeCompare(a.date));
    return { ...p, attendancePct: counted ? round1((attended / counted) * 100) : null, latePct: attended ? round1((p.late / attended) * 100) : null };
  }).sort(byName);
  const minimum = Math.ceil(rehearsalCount * 0.5);
  const active = people.filter(p => p.user.active);
  const ranked = active.filter(p => p.attendancePct !== null && p.recorded >= minimum)
    .sort((a, b) => b.attendancePct - a.attendancePct || (b.present + b.late) - (a.present + a.late) || a.late - b.late || byName(a, b));
  const pcts = active.map(p => p.attendancePct).filter(v => v !== null);
  return {
    rehearsals: rehearsalCount,
    minimum,
    teamAverage: pcts.length ? round1(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
    people,
    leaderboard: ranked.map((p, i) => ({ position: i + 1, userId: p.user.id })),
    belowMinimum: active.filter(p => !ranked.includes(p)).map(p => ({ userId: p.user.id })),
  };
}

const bad = field => { throw new HttpError(400, 'invalid', { field }); };
const MAX_ENTRIES = 200;

function validateNote(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') bad('note');
  const note = v.trim();
  if (note.length > 200) bad('note');
  return note;
}

export function seasonParam(url, now) {
  const raw = url.searchParams.get('season');
  if (raw === null) return currentSeason(now);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) bad('season');
  return n;
}

async function rehearsalRow(db, id) {
  const row = await db.prepare('SELECT id, date, note FROM rehearsals WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function rehearsalEntries(db, id) {
  const { results } = await db.prepare(`SELECT a.status, u.id, u.display_name, u.username, u.active
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.rehearsal_id = ? ORDER BY u.display_name COLLATE NOCASE, u.id`).bind(id).all();
  return results.map(r => ({ user: { id: r.id, displayName: r.display_name, username: r.username, active: !!r.active }, status: r.status }));
}

async function dateTaken(db, date, exceptId = 0) {
  return !!(await db.prepare('SELECT id FROM rehearsals WHERE date = ? AND id <> ?').bind(date, exceptId).first());
}

// Usuarios activos que aún no están en la lista del ensayo → Ausente.
const addMissingActive = (db, id, ts) => db.prepare(`INSERT OR IGNORE INTO attendance (rehearsal_id, user_id, status, updated_at)
  SELECT ?, id, 'absent', ? FROM users WHERE active = 1`).bind(id, ts);

export async function listRehearsals(ctx) {
  await requireAdmin(ctx);
  const { from, to } = seasonRange(seasonParam(ctx.url, ctx.now));
  const { results } = await ctx.db.prepare(`SELECT r.id, r.date, r.note,
      SUM(a.status = 'present') AS present, SUM(a.status = 'late') AS late,
      SUM(a.status = 'absent') AS absent, SUM(a.status = 'excused') AS excused
    FROM rehearsals r LEFT JOIN attendance a ON a.rehearsal_id = r.id
    WHERE r.date BETWEEN ? AND ? GROUP BY r.id ORDER BY r.date DESC`).bind(from, to).all();
  return json(200, { rehearsals: results.map(r => ({ id: r.id, date: r.date, note: r.note,
    present: r.present || 0, late: r.late || 0, absent: r.absent || 0, excused: r.excused || 0 })) });
}

export async function createRehearsal(ctx) {
  const admin = await requireAdmin(ctx);
  const body = await readJson(ctx.request);
  if (!validDate(body.date, ctx.now)) bad('date');
  const note = validateNote(body.note);
  if (await dateTaken(ctx.db, body.date)) throw new HttpError(409, 'rehearsal_exists');
  const ts = ctx.now.toISOString();
  const r = await ctx.db.prepare('INSERT INTO rehearsals (date, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(body.date, note, admin.id, ts, ts).run();
  const id = r.meta.last_row_id;
  await addMissingActive(ctx.db, id, ts).run();
  return json(201, { rehearsal: await rehearsalRow(ctx.db, id), entries: await rehearsalEntries(ctx.db, id) });
}

export async function getRehearsal(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  return json(200, { rehearsal: await rehearsalRow(ctx.db, id), entries: await rehearsalEntries(ctx.db, id) });
}

export async function updateRehearsal(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const current = await rehearsalRow(ctx.db, id);
  const body = await readJson(ctx.request);
  if (!('date' in body) && !('note' in body)) bad('body');
  const date = 'date' in body ? body.date : current.date;
  if ('date' in body && !validDate(date, ctx.now)) bad('date');
  const note = 'note' in body ? validateNote(body.note) : current.note;
  if (await dateTaken(ctx.db, date, id)) throw new HttpError(409, 'rehearsal_exists');
  await ctx.db.prepare('UPDATE rehearsals SET date = ?, note = ?, updated_at = ? WHERE id = ?').bind(date, note, ctx.now.toISOString(), id).run();
  return json(200, { rehearsal: await rehearsalRow(ctx.db, id) });
}

export async function saveAttendance(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  await rehearsalRow(ctx.db, id);
  const { entries } = await readJson(ctx.request);
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_ENTRIES) bad('entries');
  const ts = ctx.now.toISOString();
  await addMissingActive(ctx.db, id, ts).run();
  const { results } = await ctx.db.prepare('SELECT user_id FROM attendance WHERE rehearsal_id = ?').bind(id).all();
  const listed = new Set(results.map(r => r.user_id));
  for (const e of entries) {
    if (!e || !Number.isInteger(e.userId) || !listed.has(e.userId) || !STATUSES.includes(e.status)) bad('entries');
  }
  await ctx.db.batch(entries.map(e => ctx.db.prepare('UPDATE attendance SET status = ?, updated_at = ? WHERE rehearsal_id = ? AND user_id = ?')
    .bind(e.status, ts, id, e.userId)));
  return json(200, { entries: await rehearsalEntries(ctx.db, id) });
}

export async function deleteRehearsal(ctx) {
  await requireAdmin(ctx);
  const id = validateId(ctx.params.id);
  const current = await rehearsalRow(ctx.db, id);
  const { confirmDate } = await readJson(ctx.request);
  if (confirmDate !== current.date) bad('confirmDate');
  await ctx.db.prepare('DELETE FROM rehearsals WHERE id = ?').bind(id).run();
  return noContent();
}
