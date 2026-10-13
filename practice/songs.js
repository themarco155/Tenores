import { API_BASE, apiEnabled } from './config.js';

// Canciones del sitio. Orden de preferencia: copia guardada → incluidas en app.js → backend.
// El backend se pide en segundo plano; si falla, se sigue con lo que hay.
const KEY = 'tenores.songs.v1';
const events = new EventTarget();
let storage = () => globalThis.localStorage;
let list = [];

export function configureSongsStorage(store) {
  storage = () => store;
  list = [];
}

export function normalizeSongs(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const s of raw) {
    if (!s || typeof s.id !== 'string' || !s.id || typeof s.title !== 'string') return null;
    out.push({
      id: s.id,
      title: s.title,
      track: typeof s.track === 'string' && s.track ? s.track : null,
      lyrics: typeof s.lyrics === 'string' ? s.lyrics : '',
      position: Number.isFinite(s.position) ? s.position : out.length + 1,
      active: s.active !== false,
      hasReference: s.hasReference === true,
      legacyReference: s.legacyReference === true,
    });
  }
  return out.sort((a, b) => a.position - b.position);
}

function readCache() {
  try { return normalizeSongs(JSON.parse(storage()?.getItem(KEY) ?? 'null')); } catch { return null; }
}

function writeCache(songs) {
  try { storage()?.setItem(KEY, JSON.stringify(songs)); } catch { /* sin almacenamiento: solo en memoria */ }
}

function setList(next) {
  if (JSON.stringify(next) === JSON.stringify(list)) return;
  list = next;
  events.dispatchEvent(new Event('change'));
}

export const getSongs = () => list;
export const getSong = id => list.find(s => s.id === id) || null;

export function onSongsChange(fn) {
  events.addEventListener('change', fn);
  return () => events.removeEventListener('change', fn);
}

export async function refreshSongs({ fetchImpl = globalThis.fetch, base = API_BASE, enabled = apiEnabled } = {}) {
  if (!enabled) return list;
  try {
    const res = await fetchImpl(`${base}/api/songs`, { cache: 'no-store' });
    if (!res.ok) return list;
    const fresh = normalizeSongs((await res.json())?.songs);
    if (fresh && fresh.length) {
      writeCache(fresh);
      setList(fresh);
    }
  } catch { /* backend caído o lento: se sigue con la copia o las incluidas */ }
  return list;
}

export function initSongs({ builtIn = [], ...options } = {}) {
  setList(readCache() || normalizeSongs(builtIn) || []);
  return refreshSongs(options);
}

export function canPractice(song) {
  return !!song && song.active && !!song.track && (song.hasReference || song.legacyReference);
}

export function referenceUrl(song, base = API_BASE) {
  return song.hasReference
    ? `${base}/api/songs/${encodeURIComponent(song.id)}/reference`
    : new URL(`../assets/pitch/${encodeURIComponent(song.id)}.json`, import.meta.url).href;
}

// Nuevo orden completo tras mover `id` una posición (dir −1 sube, +1 baja) respecto a la canción
// vecina dentro de la lista visible (p. ej. solo las activas).
export function moveInOrder(allIds, visibleIds, id, dir) {
  const neighbour = visibleIds[visibleIds.indexOf(id) + dir];
  if (neighbour === undefined) return allIds.slice();
  const ids = allIds.filter(x => x !== id);
  const at = ids.indexOf(neighbour);
  ids.splice(dir < 0 ? at : at + 1, 0, id);
  return ids;
}
