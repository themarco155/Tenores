import { openPractice, closePractice } from './practice-ui.js';
import { isRecordingSupported } from './recorder.js';

const INDEX_URL = new URL('../assets/pitch/index.json', import.meta.url);
let available = new Set();

function songFromHash() {
  let id;
  try { id = decodeURIComponent((location.hash || '').slice(1)).trim(); }
  catch { return null; } // hash mal formado (p. ej. #%E0): sin canción
  // SONGS es una constante global de app.js (script clásico, accesible desde módulos).
  if (typeof SONGS === 'undefined' || !Object.prototype.hasOwnProperty.call(SONGS, id)) return null;
  return { id, title: SONGS[id].title, track: SONGS[id].track };
}

function syncButton() {
  const header = document.querySelector('#song-view .audio-card-header');
  const view = document.getElementById('song-view');
  if (!header || !view) return;
  let btn = document.getElementById('practiceOpen');
  const song = songFromHash();
  if (!song || !available.has(song.id) || view.hidden) {
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

fetch(INDEX_URL)
  .then(r => (r.ok ? r.json() : { songs: [] }))
  .catch(() => ({ songs: [] }))
  .then(data => { available = new Set(data.songs || []); syncButton(); });
