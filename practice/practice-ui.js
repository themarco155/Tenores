import { createRecorder } from './recorder.js';
import { playTone, playClick } from './tones.js';
import { runAnalysis } from './analysis-client.js';
import { renderChart } from './chart.js';
import { formatTime } from './util.js';
import { mountSaveStatus } from './save-status.js';
import { LIVE_PITCH } from './config.js';
import { LIVE, noteName, targetAt, livePitch, deviationCents, tuningState } from './live-pitch.js';

const PITCH_DIR = new URL('../assets/pitch/', import.meta.url);
const GUIDE_WARNING = 'Usa auriculares: si el micrófono capta la guía, la puntuación no será fiable.';
const GUIDE_TIMEOUT_MS = 3000; // si la guía no empieza a sonar en este tiempo, se avisa
const METRICS = [['pitch', 'Afinación'], ['rhythm', 'Ritmo y entradas', 'No cuenta en la nota'], ['stability', 'Estabilidad']];

let panel = null, sheet = null, body = null, titleEl = null, opener = null;
let s = null; // sesión de práctica abierta
let seq = 0; // contador global: los tokens nunca se reutilizan entre sesiones

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const band = v => (v == null ? 'none' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');
const stale = token => !s || s.token !== token;

function ensurePanel() {
  if (panel) return;
  const t = document.createElement('template');
  t.innerHTML = `<div id="practicePanel" class="practice-panel" hidden>
    <div class="practice-panel__backdrop" data-close></div>
    <section class="practice-panel__sheet" role="dialog" aria-modal="true" aria-labelledby="practiceTitle" tabindex="-1">
      <header class="practice-panel__header">
        <div><p class="practice-eyebrow">Práctica</p><h2 id="practiceTitle"></h2></div>
        <button class="practice-close" type="button" data-close aria-label="Cerrar práctica">&times;</button>
      </header>
      <div class="practice-body" aria-live="polite"></div>
    </section>
  </div>`;
  panel = t.content.firstElementChild;
  document.body.append(panel);
  sheet = panel.querySelector('.practice-panel__sheet');
  body = panel.querySelector('.practice-body');
  titleEl = panel.querySelector('#practiceTitle');
  panel.addEventListener('click', e => { if (e.target.closest('[data-close]')) closePractice(); });
}

const focusablesIn = root => [...root.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled])')]
  .filter(el => el.offsetParent !== null);

// Escucha en `document` mientras el panel está abierto: cada render reemplaza el
// contenido y el foco puede caer en <body>, donde el panel ya no recibiría teclas.
function onKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); closePractice(); return; }
  if (e.key !== 'Tab') return;
  const focusables = focusablesIn(sheet);
  if (!focusables.length) { e.preventDefault(); sheet.focus(); return; }
  const first = focusables[0], last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (!sheet.contains(active) || active === sheet) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

// Tras cada render: foco en el primer control del contenido o, si no hay, en el panel.
function focusBody() {
  const target = focusablesIn(body)[0] || sheet;
  target.focus({ preventScroll: true }); // sin saltar a mitad de los resultados
}

export async function openPractice(song) {
  ensurePanel();
  if (s) closePractice();
  opener = document.activeElement;
  document.getElementById('audio-track')?.pause();
  const audio = new Audio(song.track);
  audio.preload = 'auto';
  s = {
    song, audio, token: ++seq, ref: null, recorder: null, timers: new Set(), raf: 0,
    take: null, takeSource: null, refStop: null, finished: -1,
    settings: { mode: 'guide', range: 'full', phraseFrom: 1, phraseTo: 1 },
  };
  titleEl.textContent = song.title;
  panel.hidden = false;
  document.body.classList.add('practice-panel-open');
  document.addEventListener('keydown', onKeydown);
  sheet.focus();
  await loadReference();
}

export function closePractice() {
  if (!s) return;
  cancelFlow();
  s.recorder?.dispose();
  s.audio.pause();
  s.audio.removeAttribute('src');
  s.audio.load();
  s = null;
  panel.hidden = true;
  document.removeEventListener('keydown', onKeydown);
  body.innerHTML = '';
  document.body.classList.remove('practice-panel-open');
  if (opener && document.contains(opener)) opener.focus();
}

function cancelFlow() {
  s.token = ++seq;
  for (const t of s.timers) clearTimeout(t);
  s.timers.clear();
  cancelAnimationFrame(s.raf);
  stopTake();
  stopRefSegment();
  s.audio.pause();
}

function wait(ms) {
  return new Promise(resolve => {
    const t = setTimeout(() => { s?.timers.delete(t); resolve(); }, ms);
    s.timers.add(t);
  });
}

// Coloca el audio en `time` sin reproducirlo. iOS ignora preload: load() fuerza la carga.
// Con readyState 0 el valor queda como posición inicial por defecto; al llegar los
// metadatos se vuelve a fijar por si el navegador no la respetó.
function seekAudio(token, time) {
  const audio = s.audio;
  if (audio.readyState === 0) audio.load();
  audio.currentTime = time;
  if (audio.readyState < 1) {
    audio.addEventListener('loadedmetadata', () => {
      if (!stale(token) && Math.abs(audio.currentTime - time) > 0.05) audio.currentTime = time;
    }, { once: true });
  }
}

function seekAndPlay(token, time) {
  seekAudio(token, time);
  const audio = s.audio;
  const go = () => { if (!stale(token)) audio.play().catch(() => {}); };
  if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
}

// Reproduce la guía y se resuelve cuando suena de verdad (evento `playing`): ese es
// el instante cero de la grabación. Se rechaza si play() falla o no suena en 3 s.
function playGuide() {
  const audio = s.audio, timers = s.timers;
  return new Promise((resolve, reject) => {
    let timer = 0;
    const settle = (ok, err) => {
      if (!timer) return;
      clearTimeout(timer);
      timers.delete(timer);
      timer = 0;
      audio.removeEventListener('playing', onPlaying);
      if (ok) resolve(); else reject(err);
    };
    const onPlaying = () => settle(true);
    timer = setTimeout(() => settle(false, new Error('La guía no empezó a sonar')), GUIDE_TIMEOUT_MS);
    timers.add(timer);
    audio.addEventListener('playing', onPlaying);
    audio.play().catch(err => settle(false, err));
  });
}

async function loadReference() {
  const token = s.token;
  renderMessage('Cargando referencia…');
  try {
    const res = await fetch(s.song.referenceUrl || new URL(`${encodeURIComponent(s.song.id)}.json`, PITCH_DIR));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ref = await res.json();
    if (stale(token)) return;
    s.ref = ref;
    s.settings.phraseTo = ref.phrases.length;
    renderSetup();
  } catch {
    if (!stale(token)) renderError('No se pudo cargar la referencia.', loadReference);
  }
}

function renderMessage(text) {
  body.innerHTML = `<p class="practice-message">${esc(text)}</p>`;
  focusBody();
}

function renderError(text, retry) {
  body.innerHTML = `<div class="practice-error" role="alert"><p>${esc(text)}</p>
    <button type="button" class="btn small" data-retry>Reintentar</button></div>`;
  body.querySelector('[data-retry]').addEventListener('click', retry);
  focusBody();
}

function micErrorMessage(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permiso de micrófono denegado. Actívalo en los ajustes del sitio (icono junto a la dirección web) y pulsa Reintentar.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró ningún micrófono. Conecta uno y pulsa Reintentar.';
  return 'No se pudo acceder al micrófono.';
}

function currentRange() {
  const n = s.ref.phrases.length;
  return s.settings.range === 'full' ? { from: 1, to: n } : { from: s.settings.phraseFrom, to: s.settings.phraseTo };
}

function renderSetup() {
  cancelFlow();
  const { mode, range, phraseFrom, phraseTo } = s.settings;
  const hop = s.ref.hopMs / 1000;
  const options = selected => s.ref.phrases
    .map(p => `<option value="${p.index}"${p.index === selected ? ' selected' : ''}>Frase ${p.index} · ${formatTime(p.start * hop)}</option>`)
    .join('');
  body.innerHTML = `<form class="practice-setup">
    <fieldset><legend>Modo</legend>
      <label class="practice-choice"><input type="radio" name="mode" value="guide"${mode === 'guide' ? ' checked' : ''}>
        <span><strong>Practicar con guía</strong><small>La voz original suena mientras cantas.</small></span></label>
      <label class="practice-choice"><input type="radio" name="mode" value="test"${mode === 'test' ? ' checked' : ''}>
        <span><strong>Ponerme a prueba</strong><small>Escuchas la nota de partida y cantas solo.</small></span></label>
    </fieldset>
    <p class="practice-warning" data-guide-warning${mode === 'guide' ? '' : ' hidden'}>${GUIDE_WARNING}</p>
    <fieldset><legend>Qué cantar</legend>
      <label class="practice-choice"><input type="radio" name="range" value="full"${range === 'full' ? ' checked' : ''}>
        <span><strong>Canción completa</strong></span></label>
      <label class="practice-choice"><input type="radio" name="range" value="phrases"${range === 'phrases' ? ' checked' : ''}>
        <span><strong>Un fragmento</strong></span></label>
      <div class="practice-range" data-range${range === 'phrases' ? '' : ' hidden'}>
        <label>Desde <select name="from">${options(phraseFrom)}</select></label>
        <label>Hasta <select name="to">${options(phraseTo)}</select></label>
      </div>
    </fieldset>
    <button type="submit" class="btn practice-start">Empezar</button>
  </form>`;
  const form = body.querySelector('form');
  form.addEventListener('change', () => {
    const fd = new FormData(form);
    s.settings.mode = fd.get('mode');
    s.settings.range = fd.get('range');
    const from = Number(fd.get('from'));
    let to = Number(fd.get('to'));
    if (to < from) { to = from; form.elements.to.value = String(to); }
    s.settings.phraseFrom = from;
    s.settings.phraseTo = to;
    form.querySelector('[data-guide-warning]').hidden = s.settings.mode !== 'guide';
    form.querySelector('[data-range]').hidden = s.settings.range !== 'phrases';
  });
  form.addEventListener('submit', e => { e.preventDefault(); startTake(); });
  focusBody();
}

function renderCountdown(big, hint) {
  body.innerHTML = `<div class="practice-countdown"><p class="practice-countdown__big">${esc(big)}</p><p>${esc(hint)}</p></div>`;
  focusBody();
}

async function startTake() {
  cancelFlow();
  const token = s.token;
  const { mode } = s.settings;
  const { from, to } = currentRange();
  const hop = s.ref.hopMs / 1000;
  const first = s.ref.phrases[from - 1], last = s.ref.phrases[to - 1];
  const startSec = first.start * hop, durSec = (last.end - first.start) * hop;

  if (!s.recorder) {
    let rec;
    try { rec = await createRecorder(); }
    catch (err) { if (!stale(token)) renderError(micErrorMessage(err), startTake); return; }
    if (stale(token)) { rec.dispose(); return; }
    s.recorder = rec;
  }
  const ctx = s.recorder.context;
  await ctx.resume();
  if (stale(token)) return;

  if (mode === 'guide') {
    s.audio.pause();
    seekAudio(token, startSec); // la búsqueda termina durante la cuenta atrás
  } else {
    renderCountdown('Nota de partida', 'Escucha tu primera nota');
    await playTone(ctx, s.ref.notes[first.noteFrom].midi, 1);
    if (stale(token)) return;
  }
  for (const n of [3, 2, 1]) {
    renderCountdown(String(n), mode === 'guide' ? 'La guía empieza al terminar la cuenta' : 'Canta cuando termine la cuenta');
    if (mode === 'test') playClick(ctx, n === 1);
    await wait(1000);
    if (stale(token)) return;
  }

  if (mode === 'guide') {
    renderCountdown('¡Ya!', 'Empieza la guía');
    try { await playGuide(); }
    catch {
      if (stale(token)) return;
      s.audio.pause();
      renderError('No se pudo reproducir la guía.', startTake);
      return;
    }
    if (stale(token)) return;
  }
  // En guía, la grabación y el límite de tiempo cuentan desde que la guía suena.
  s.recorder.start();
  const limitSec = mode === 'guide' ? durSec + 1 : durSec * 1.3 + 2;
  renderRecording(limitSec, token, { mode, from, to });
}

function renderRecording(limitSec, token, take) {
  const live = LIVE_PITCH && take.mode === 'guide';
  body.innerHTML = `<div class="practice-recording">
    <p class="practice-rec"><span class="practice-rec__dot" aria-hidden="true"></span>Grabando…</p>
    <div class="practice-meter" aria-hidden="true"><div class="practice-meter__fill"></div></div>
    ${live ? `<div class="practice-live" aria-hidden="true" data-state="none">
      <p class="practice-live__notes">Objetivo: <strong data-live-target>—</strong> · Tú: <strong data-live-user>—</strong> <span data-live-cents></span></p>
      <div class="practice-live__scale"><span class="practice-live__ok"></span><span class="practice-live__needle" data-live-needle hidden></span></div>
      <p class="practice-live__state" data-live-state></p>
    </div>` : ''}
    <div class="practice-progress" role="progressbar" aria-label="Progreso de la grabación" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="practice-progress__fill"></div></div>
    <p class="practice-time"><span data-elapsed>0:00</span> / ${formatTime(limitSec)}</p>
    <button type="button" class="btn practice-stop">Detener</button>
  </div>`;
  const meter = body.querySelector('.practice-meter__fill');
  const bar = body.querySelector('.practice-progress');
  const fill = body.querySelector('.practice-progress__fill');
  const elapsedEl = body.querySelector('[data-elapsed]');
  const stopBtn = body.querySelector('.practice-stop');
  const liveEl = live ? body.querySelector('.practice-live') : null;
  let lastLive = 0;
  const updateLive = () => {
    const { samples, sampleRate } = s.recorder.recent(LIVE.windowMs);
    const user = livePitch(samples, sampleRate, s.recorder.level);
    const target = targetAt(s.ref, s.audio.currentTime);
    const cents = deviationCents(user, target);
    const st = tuningState(cents);
    liveEl.dataset.state = st.key;
    liveEl.querySelector('[data-live-target]').textContent = target == null ? '—' : noteName(target);
    liveEl.querySelector('[data-live-user]').textContent = user == null ? '—' : noteName(user);
    liveEl.querySelector('[data-live-cents]').textContent = cents == null ? '' : `${cents > 0 ? '+' : ''}${cents} cents`;
    liveEl.querySelector('[data-live-state]').textContent = st.text;
    const needle = liveEl.querySelector('[data-live-needle]');
    needle.hidden = cents == null;
    if (cents != null) needle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
  };
  const t0 = performance.now();
  const tick = () => {
    if (stale(token)) return;
    const elapsed = (performance.now() - t0) / 1000;
    meter.style.width = `${Math.min(100, s.recorder.level * 400)}%`;
    const pct = Math.min(100, (elapsed / limitSec) * 100);
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    elapsedEl.textContent = formatTime(elapsed);
    const now = performance.now();
    if (liveEl && now - lastLive >= 100) { lastLive = now; updateLive(); }
    s.raf = requestAnimationFrame(tick);
  };
  s.raf = requestAnimationFrame(tick);
  const limit = setTimeout(() => finishTake(token, take), limitSec * 1000);
  s.timers.add(limit);
  stopBtn.addEventListener('click', () => finishTake(token, take));
  stopBtn.focus();
}

async function finishTake(token, take) {
  if (stale(token) || s.finished === token) return;
  s.finished = token;
  cancelAnimationFrame(s.raf);
  s.audio.pause();
  s.take = { ...s.recorder.stop(), ...take };
  await analyzeTake(token);
}

async function analyzeTake(token) {
  renderMessage('Analizando tu toma…');
  const { samples, sampleRate, mode, from, to } = s.take;
  try {
    const result = await runAnalysis({ samples: samples.slice(), sampleRate, refData: s.ref, mode, phraseFrom: from, phraseTo: to });
    if (stale(token)) return;
    renderResults(result);
  } catch {
    if (!stale(token)) renderError('No se pudo analizar la toma.', () => analyzeTake(s.token));
  }
}

function renderResults(r) {
  if (!r.valid) {
    body.innerHTML = `<div class="practice-error" role="alert">
      <p>No se detectó suficiente voz. Acércate al micrófono o canta más fuerte.</p>
      <div class="practice-actions">
        <button type="button" class="btn small" data-act="repeat">Repetir</button>
        <button type="button" class="btn small quiet" data-act="setup">Cambiar ajustes</button>
      </div></div>`;
  } else {
    body.innerHTML = `<div class="practice-results">
      <div class="practice-score score--${band(r.scores.total)}">
        <span class="practice-score__value">${r.scores.total}</span><span class="practice-score__label">Puntuación</span></div>
      <ul class="practice-metrics">${METRICS.map(([k, label, note]) =>
        `<li class="score--${band(r.scores[k])}"><span>${label}</span><strong>${r.scores[k] ?? '—'}</strong>${note ? `<small class="practice-metric__note">${note}</small>` : ''}</li>`).join('')}</ul>
      <p class="practice-save" data-save aria-live="polite"></p>
      ${r.tips.length ? `<h3 class="practice-subtitle">Qué mejorar</h3><ul class="practice-tips">${r.tips.map(t => `<li>${esc(t.text)}</li>`).join('')}</ul>` : ''}
      <div class="practice-chart-wrap">${renderChart(r.curves, r.phrases)}
        <p class="practice-legend"><span class="legend-ref">Referencia</span><span class="legend-user">Tu voz</span></p></div>
      <h3 class="practice-subtitle">Frases</h3>
      <div class="practice-phrases">${r.phrases.map(p =>
        `<button type="button" class="practice-phrase score--${band(p.pitch)}" data-phrase="${p.index}" aria-expanded="false">Frase ${p.index}<small>${formatTime(p.start)}–${formatTime(p.end)}</small></button>`).join('')}</div>
      <div class="practice-phrase-actions" hidden>
        <button type="button" class="btn small quiet" data-act="listen">Escuchar referencia</button>
        <button type="button" class="btn small" data-act="drill">Practicar esta frase</button>
      </div>
      <div class="practice-actions">
        <button type="button" class="btn small quiet" data-act="take">Escuchar mi toma</button>
        <button type="button" class="btn small" data-act="repeat">Repetir</button>
        <button type="button" class="btn small quiet" data-act="setup">Cambiar ajustes</button>
      </div></div>`;
  }
  let selected = null;
  if (r.valid) mountSaveStatus(body.querySelector('[data-save]'), r);
  body.firstElementChild.addEventListener('click', e => {
    const phrase = e.target.closest('[data-phrase]');
    if (phrase) {
      selected = Number(phrase.dataset.phrase);
      body.querySelectorAll('[data-phrase]').forEach(b => b.setAttribute('aria-expanded', String(b === phrase)));
      body.querySelector('.practice-phrase-actions').hidden = false;
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'repeat') startTake();
    else if (act === 'setup') renderSetup();
    else if (act === 'take') toggleTake(btn);
    else if (act === 'listen' && selected) playRefPhrase(selected);
    else if (act === 'drill' && selected) {
      Object.assign(s.settings, { range: 'phrases', phraseFrom: selected, phraseTo: selected });
      renderSetup();
    }
  });
  focusBody();
}

function toggleTake(btn) {
  if (s.takeSource) { stopTake(); btn.textContent = 'Escuchar mi toma'; return; }
  stopRefSegment();
  const ctx = s.recorder.context;
  const { samples, sampleRate } = s.take;
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.onended = () => { if (s && s.takeSource === src) { s.takeSource = null; btn.textContent = 'Escuchar mi toma'; } };
  src.start();
  s.takeSource = src;
  btn.textContent = 'Detener mi toma';
}

function stopTake() {
  if (!s || !s.takeSource) return;
  const src = s.takeSource;
  s.takeSource = null;
  try { src.stop(); } catch { /* ya detenida */ }
}

function playRefPhrase(index) {
  stopRefSegment();
  stopTake();
  const p = s.ref.phrases[index - 1], hop = s.ref.hopMs / 1000;
  const end = p.end * hop;
  const onTime = () => { if (s.audio.currentTime >= end) stopRefSegment(); };
  s.refStop = () => { s.audio.pause(); s.audio.removeEventListener('timeupdate', onTime); s.refStop = null; };
  s.audio.addEventListener('timeupdate', onTime);
  seekAndPlay(s.token, p.start * hop);
}

function stopRefSegment() {
  if (s && s.refStop) s.refStop();
}
