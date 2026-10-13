import { HttpError, json } from './http.js';

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
