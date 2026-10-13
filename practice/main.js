import { openPractice, closePractice } from './practice-ui.js';
import { isRecordingSupported } from './recorder.js';
import { apiEnabled } from './config.js';
import { mountPracticeMenu } from './menu.js';
import { openMyProgress } from './progress-ui.js';
import { openAdmin } from './admin-ui.js';
import { initSongs, getSongs, getSong, onSongsChange, canPractice, referenceUrl } from './songs.js';

// Canciones incluidas en el sitio: SONGS de app.js (script clásico, global) en el orden de las tarjetas
// de index.html. Se usan hasta que llega la lista del backend, o siempre si no hay backend.
function builtInSongs() {
  const all = typeof SONGS === 'undefined' ? {} : SONGS;
  const order = [...document.querySelectorAll('#grid [data-song]')].map(a => a.dataset.song);
  return order.filter(id => all[id]).map((id, i) => ({
    id, title: all[id].title, track: all[id].track || null, lyrics: all[id].lyrics || '',
    position: i + 1, active: true, hasReference: false, legacyReference: true,
  }));
}

function songFromHash() {
  let id;
  try { id = decodeURIComponent((location.hash || '').slice(1)).trim(); }
  catch { return null; } // hash mal formado (p. ej. #%E0): sin canción
  const song = getSong(id);
  if (!canPractice(song)) return null;
  return { id: song.id, title: song.title, track: song.track, referenceUrl: referenceUrl(song) };
}

function syncButton() {
  const header = document.querySelector('#song-view .audio-card-header');
  const view = document.getElementById('song-view');
  if (!header || !view) return;
  let btn = document.getElementById('practiceOpen');
  const song = songFromHash();
  if (!song || view.hidden) {
    if (btn) btn.hidden = true;
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'practiceOpen';
    btn.type = 'button';
    btn.className = 'btn small practice-open-btn';
    btn.addEventListener('click', () => {
      const current = songFromHash();
      if (current) openPractice(current);
    });
    header.append(btn);
  }
  const supported = isRecordingSupported();
  btn.hidden = false;
  btn.disabled = !supported;
  btn.textContent = supported ? 'Practicar' : 'Tu navegador no permite grabar';
  btn.title = supported ? 'Grábate y compárate con la referencia' : 'Tu navegador no permite grabar';
}

window.addEventListener('hashchange', () => { closePractice(); syncButton(); });

onSongsChange(() => {
  if (typeof window.applySongList === 'function') window.applySongList(getSongs());
  syncButton();
});
initSongs({ builtIn: builtInSongs() });

// Login y progreso: solo si hay backend configurado (ver practice/config.js).
// openMyProgress y openAdmin llegan en las tareas de "Mi progreso" y administración.
const practiceHandlers = { onProgress: openMyProgress, onAdmin: openAdmin };
if (apiEnabled) mountPracticeMenu({ onProgress: () => practiceHandlers.onProgress(), onAdmin: () => practiceHandlers.onAdmin() });
export { practiceHandlers };
