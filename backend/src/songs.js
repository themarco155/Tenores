import { HttpError, json, noContent, readJson } from './http.js';
import { requireAdmin } from './auth.js';

export const SONG_COLUMNS = 'id, title, track, lyrics, position, active, legacy_reference, reference IS NOT NULL AS has_reference, created_at, updated_at';

export function slugify(title) {
  const base = String(title).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '');
  return base || 'cancion';
}

export function publicSong(row) {
  return {
    id: row.id,
    title: row.title,
    track: row.track,
    lyrics: row.lyrics,
    position: row.position,
    active: !!row.active,
    hasReference: !!row.has_reference,
    legacyReference: !!row.legacy_reference,
  };
}

export async function songExists(db, id) {
  return !!(await db.prepare('SELECT 1 AS x FROM songs WHERE id = ?').bind(id).first());
}

// Se puede practicar y guardar intentos: activa y con audio.
export async function practicableSong(db, id) {
  const row = await db.prepare('SELECT active, track FROM songs WHERE id = ?').bind(id).first();
  return !!(row && row.active && row.track);
}

export async function listSongs(ctx) {
  const { results } = await ctx.db.prepare(`SELECT ${SONG_COLUMNS} FROM songs ORDER BY position, id`).all();
  return json(200, { songs: results.map(publicSong) });
}

export async function songReference(ctx) {
  const row = await ctx.db.prepare('SELECT reference FROM songs WHERE id = ?').bind(ctx.params.id).first();
  if (!row || row.reference === null) throw new HttpError(404, 'not_found');
  return new Response(row.reference, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const REFERENCE_MAX_BYTES = 512 * 1024;
const bad = field => { throw new HttpError(400, 'invalid', { field }); };

export const adminSong = row => ({ ...publicSong(row), createdAt: row.created_at, updatedAt: row.updated_at });

function validateTitle(v) {
  if (typeof v !== 'string') bad('title');
  const title = v.trim();
  if (title.length < 1 || title.length > 80) bad('title');
  return title;
}

function validateTrack(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') bad('track');
  const track = v.trim();
  if (track.length > 500 || !/^https:\/\/\S+$/.test(track)) bad('track');
  try { new URL(track); } catch { bad('track'); }
  return track;
}

function validateLyrics(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > 20000) bad('lyrics');
  return v.replace(/\r\n/g, '\n');
}

function validateReference(ref, id) {
  const ok = ref.version === 1 && ref.songId === id && ref.hopMs === 10 && Array.isArray(ref.midi)
    && Number.isInteger(ref.frameCount) && ref.frameCount === ref.midi.length
    && Array.isArray(ref.notes) && Array.isArray(ref.phrases) && ref.phrases.length > 0;
  if (!ok) bad('reference');
}

async function songRow(db, id) {
  const row = await db.prepare(`SELECT ${SONG_COLUMNS} FROM songs WHERE id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

async function titleTaken(db, title, exceptId = '') {
  return !!(await db.prepare('SELECT id FROM songs WHERE title = ? COLLATE NOCASE AND id <> ?').bind(title, exceptId).first());
}

// Rutas del sitio que no pueden ser el id de una canción (app.js las enruta antes que las canciones).
const RESERVED_SLUGS = new Set(['recuerdos']);

async function uniqueSlug(db, title) {
  const base = slugify(title);
  let id = base;
  for (let n = 2; RESERVED_SLUGS.has(id) || await songExists(db, id); n++) id = `${base}-${n}`;
  return id;
}

export async function adminListSongs(ctx) {
  await requireAdmin(ctx);
  const active = ctx.url.searchParams.get('active') ?? 'all';
  if (!['all', '1', '0'].includes(active)) bad('active');
  const where = active === 'all' ? '' : 'WHERE active = ?';
  const stmt = ctx.db.prepare(`SELECT ${SONG_COLUMNS} FROM songs ${where} ORDER BY position, id`);
  const { results } = await (active === 'all' ? stmt : stmt.bind(Number(active))).all();
  return json(200, { songs: results.map(adminSong) });
}

export async function createSong(ctx) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.request);
  const title = validateTitle(body.title);
  const track = validateTrack(body.track);
  const lyrics = validateLyrics(body.lyrics);
  if (await titleTaken(ctx.db, title)) throw new HttpError(409, 'title_taken');
  const id = await uniqueSlug(ctx.db, title);
  const position = await ctx.db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM songs').first('p');
  const ts = ctx.now.toISOString();
  await ctx.db.prepare(`INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)`).bind(id, title, track, lyrics, position, ts, ts).run();
  return json(201, { song: adminSong(await songRow(ctx.db, id)) });
}

export async function updateSong(ctx) {
  await requireAdmin(ctx);
  const current = await songRow(ctx.db, ctx.params.id);
  const body = await readJson(ctx.request);
  if (!['title', 'track', 'lyrics', 'active'].some(k => k in body)) bad('body');
  const next = { title: current.title, track: current.track, lyrics: current.lyrics, active: current.active };
  if ('title' in body) {
    next.title = validateTitle(body.title);
    if (await titleTaken(ctx.db, next.title, current.id)) throw new HttpError(409, 'title_taken');
  }
  if ('track' in body) next.track = validateTrack(body.track);
  if ('lyrics' in body) next.lyrics = validateLyrics(body.lyrics);
  if ('active' in body) {
    if (typeof body.active !== 'boolean') bad('active');
    next.active = body.active ? 1 : 0;
  }
  // Otro audio (o ninguno): la referencia anterior ya no vale, tampoco el archivo de assets/pitch/.
  const resetReference = next.track !== current.track ? ', reference = NULL, legacy_reference = 0' : '';
  await ctx.db.prepare(`UPDATE songs SET title = ?, track = ?, lyrics = ?, active = ?, updated_at = ?${resetReference} WHERE id = ?`)
    .bind(next.title, next.track, next.lyrics, next.active, ctx.now.toISOString(), current.id).run();
  return json(200, { song: adminSong(await songRow(ctx.db, current.id)) });
}

export async function putSongReference(ctx) {
  await requireAdmin(ctx);
  const current = await songRow(ctx.db, ctx.params.id);
  const ref = await readJson(ctx.request, REFERENCE_MAX_BYTES);
  if (!current.track) bad('track');
  validateReference(ref, current.id);
  await ctx.db.prepare('UPDATE songs SET reference = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(ref), ctx.now.toISOString(), current.id).run();
  return noContent();
}

export async function reorderSongs(ctx) {
  await requireAdmin(ctx);
  const { ids } = await readJson(ctx.request);
  const { results } = await ctx.db.prepare('SELECT id FROM songs').all();
  const existing = new Set(results.map(r => r.id));
  if (!Array.isArray(ids) || ids.length !== existing.size || new Set(ids).size !== ids.length || !ids.every(id => existing.has(id))) bad('ids');
  await ctx.db.batch(ids.map((id, i) => ctx.db.prepare('UPDATE songs SET position = ? WHERE id = ?').bind(i + 1, id)));
  return noContent();
}
