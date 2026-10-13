import { HttpError, json, readJson } from './http.js';
import { isInt } from './validate.js';
import { requireSession } from './auth.js';
import { SONG_IDS } from './songs.js';

const MIN_INTERVAL_MS = 10_000;
const bad = field => { throw new HttpError(400, 'invalid', { field }); };
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = v => v === null || isNum(v);
const isScore = v => isInt(v, 0, 100);

function cleanPhrase(p) {
  if (!p || !isInt(p.index, 1, 100) || !isNum(p.start) || !isNum(p.end) || !isNumOrNull(p.pitch)
    || !isNumOrNull(p.rhythm) || !isNumOrNull(p.stability) || !isNum(p.coverage)) return null;
  return { index: p.index, start: p.start, end: p.end, pitch: p.pitch, rhythm: p.rhythm, stability: p.stability, coverage: p.coverage };
}

function cleanTip(t) {
  if (!t || typeof t.kind !== 'string' || t.kind.length > 20 || typeof t.text !== 'string' || t.text.length > 200
    || !(t.phrase === null || isInt(t.phrase, 1, 100))) return null;
  return { kind: t.kind, phrase: t.phrase, text: t.text };
}

export function validateAttempt(b) {
  if (!SONG_IDS.includes(b.songId)) bad('songId');
  if (b.mode !== 'guide' && b.mode !== 'test') bad('mode');
  if (b.valid !== true) bad('valid');
  if (!isInt(b.phraseFrom, 1, 100)) bad('phraseFrom');
  if (!isInt(b.phraseTo, b.phraseFrom, 100)) bad('phraseTo');
  if (typeof b.isFull !== 'boolean') bad('isFull');
  const s = b.scores && typeof b.scores === 'object' ? b.scores : {};
  for (const k of ['total', 'pitch', 'rhythm']) if (!isScore(s[k])) bad(`scores.${k}`);
  if (s.stability !== null && !isScore(s.stability)) bad('scores.stability');
  if (!isNum(b.coverage) || b.coverage < 0 || b.coverage > 1) bad('coverage');
  if (!Array.isArray(b.phrases) || b.phrases.length > 100) bad('phrases');
  const phrases = b.phrases.map(cleanPhrase);
  if (phrases.includes(null)) bad('phrases');
  if (!Array.isArray(b.tips) || b.tips.length > 5) bad('tips');
  const tips = b.tips.map(cleanTip);
  if (tips.includes(null)) bad('tips');
  if (typeof b.engineVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(b.engineVersion)) bad('engineVersion');
  return {
    songId: b.songId, mode: b.mode, phraseFrom: b.phraseFrom, phraseTo: b.phraseTo, isFull: b.isFull ? 1 : 0,
    total: s.total, pitch: s.pitch, rhythm: s.rhythm, stability: s.stability,
    coverage: b.coverage, phrases, tips, engineVersion: b.engineVersion,
  };
}

export async function createAttempt(ctx) {
  const user = await requireSession(ctx);
  const a = validateAttempt(await readJson(ctx.request));
  const last = await ctx.db.prepare('SELECT created_at FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT 1').bind(user.id).first();
  if (last) {
    const wait = MIN_INTERVAL_MS - (ctx.now - new Date(last.created_at));
    if (wait > 0) throw new HttpError(429, 'too_fast', { retryAfter: Math.ceil(wait / 1000) });
  }
  const r = await ctx.db.prepare(`INSERT INTO attempts (user_id, song_id, mode, phrase_from, phrase_to, is_full, score_total, score_pitch, score_rhythm, score_stability, coverage, phrase_scores, tips, engine_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(user.id, a.songId, a.mode, a.phraseFrom, a.phraseTo, a.isFull, a.total, a.pitch, a.rhythm, a.stability,
      a.coverage, JSON.stringify(a.phrases), JSON.stringify(a.tips), a.engineVersion, ctx.now.toISOString())
    .run();
  return json(201, { id: r.meta.last_row_id });
}

export function rowToAttempt(row) {
  return {
    id: row.id,
    songId: row.song_id,
    mode: row.mode,
    phraseFrom: row.phrase_from,
    phraseTo: row.phrase_to,
    isFull: !!row.is_full,
    scores: { total: row.score_total, pitch: row.score_pitch, rhythm: row.score_rhythm, stability: row.score_stability },
    coverage: row.coverage,
    phrases: JSON.parse(row.phrase_scores),
    tips: JSON.parse(row.tips),
    engineVersion: row.engine_version,
    createdAt: row.created_at,
  };
}

function intParam(url, name, fallback, lo, hi) {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!isInt(n, lo, hi)) bad(name);
  return n;
}

export async function attemptsPage(db, userId, url) {
  const song = url.searchParams.get('song');
  if (song !== null && !SONG_IDS.includes(song)) bad('song');
  const limit = intParam(url, 'limit', 50, 1, 100);
  const before = intParam(url, 'before', null, 1, Number.MAX_SAFE_INTEGER);
  const where = ['user_id = ?'];
  const params = [userId];
  if (song) { where.push('song_id = ?'); params.push(song); }
  if (before) { where.push('id < ?'); params.push(before); }
  const { results } = await db.prepare(`SELECT * FROM attempts WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`)
    .bind(...params, limit + 1).all();
  const page = results.slice(0, limit);
  return { attempts: page.map(rowToAttempt), next: results.length > limit ? page[page.length - 1].id : null };
}

export function weakestMetric(rows) {
  let weakest = null;
  for (const [name, col] of [['pitch', 'score_pitch'], ['rhythm', 'score_rhythm'], ['stability', 'score_stability']]) {
    const values = rows.map(r => r[col]).filter(v => v != null);
    if (!values.length) continue;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (!weakest || avg < weakest.avg) weakest = { name, avg };
  }
  return weakest ? weakest.name : null;
}

export async function userSummary(db, userId) {
  const { results } = await db.prepare('SELECT song_id, score_total, score_pitch, score_rhythm, score_stability, created_at FROM attempts WHERE user_id = ? ORDER BY id DESC')
    .bind(userId).all();
  const bySong = new Map();
  for (const r of results) {
    if (!bySong.has(r.song_id)) bySong.set(r.song_id, []);
    bySong.get(r.song_id).push(r);
  }
  const songs = [...bySong].map(([songId, rows]) => ({
    songId,
    attempts: rows.length,
    best: Math.max(...rows.map(r => r.score_total)),
    last: rows[0].score_total,
    lastAt: rows[0].created_at,
    weakest: weakestMetric(rows.slice(0, 5)),
  }));
  return { songs };
}
