import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { renderProgressChart } from './progress-chart.js';
import { esc, METRIC_LABELS, modeLabel, rangeLabel, formatDateTime, formatDate, songTitle } from './format.js';

const band = v => (v == null ? 'none' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');

function source(userId) {
  return userId
    ? { summary: () => api.admin.userSummary(userId), attempts: opts => api.admin.userAttempts(userId, opts) }
    : { summary: () => api.mySummary(), attempts: opts => api.myAttempts(opts) };
}

function renderError(container, err, retry) {
  container.innerHTML = `<div class="practice-error" role="alert"><p>${esc(err.message)}</p><button type="button" class="btn small" data-retry>Reintentar</button></div>`;
  container.querySelector('[data-retry]').addEventListener('click', retry);
}

export async function renderProgress(container, { userId } = {}) {
  const src = source(userId);
  container.innerHTML = '<p class="practice-message">Cargando…</p>';
  let data;
  try { data = await src.summary(); } catch (err) { renderError(container, err, () => renderProgress(container, { userId })); return; }
  if (!data.songs.length) {
    container.innerHTML = `<p class="practice-message">Aún no hay intentos guardados. Practica una canción con la sesión iniciada para empezar.</p>`;
    return;
  }
  container.innerHTML = `<ul class="progress-cards">${data.songs.map(s => `
    <li><button type="button" class="progress-card" data-song="${esc(s.songId)}">
      <span class="progress-card__title">${esc(songTitle(s.songId))}</span>
      <span class="progress-card__scores"><span class="score--${band(s.best)}">Mejor <strong>${esc(s.best)}</strong></span><span>Última <strong>${esc(s.last)}</strong></span><span>${esc(s.attempts)} intento${s.attempts === 1 ? '' : 's'}</span></span>
      <span class="progress-card__meta">${s.weakest ? `A mejorar: ${esc(METRIC_LABELS[s.weakest] ?? s.weakest)}` : ''} · ${esc(formatDate(s.lastAt))}</span>
    </button></li>`).join('')}</ul>`;
  container.querySelector('.progress-cards').addEventListener('click', e => {
    const card = e.target.closest('[data-song]');
    if (card) renderSongDetail(container, src, card.dataset.song, () => renderProgress(container, { userId }));
  });
  focusFirst(container);
}

function attemptItem(a) {
  const metrics = ['pitch', 'rhythm', 'stability'].map(k => `${METRIC_LABELS[k]} ${esc(a.scores[k] ?? '—')}`).join(' · ');
  const phrases = (a.phrases ?? []).map(p => `<li>Frase ${esc(p.index)}: afinación ${esc(p.pitch)}, ritmo ${esc(p.rhythm)}${p.stability == null ? '' : `, estabilidad ${esc(p.stability)}`}</li>`).join('');
  const tips = (a.tips ?? []).map(t => `<li>${esc(t.text)}</li>`).join('');
  return `<li class="progress-attempt">
    <button type="button" class="progress-attempt__head" aria-expanded="false">
      <span class="score--${band(a.scores.total)}"><strong>${esc(a.scores.total)}</strong></span>
      <span>${esc(formatDateTime(a.createdAt))} · ${esc(modeLabel(a.mode))} · ${esc(rangeLabel(a))}</span>
    </button>
    <div class="progress-attempt__body" hidden>
      <p>${metrics}</p>
      ${tips ? `<p class="practice-subtitle">Consejos</p><ul>${tips}</ul>` : ''}
      ${phrases ? `<p class="practice-subtitle">Frases</p><ul>${phrases}</ul>` : ''}
    </div></li>`;
}

async function renderSongDetail(container, src, songId, back) {
  container.innerHTML = '<p class="practice-message">Cargando…</p>';
  let attempts = [], next = null;
  const load = async before => {
    const page = await src.attempts({ song: songId, before });
    attempts = attempts.concat(page.attempts);
    next = page.next;
  };
  try { await load(); } catch (err) { renderError(container, err, () => renderSongDetail(container, src, songId, back)); return; }

  const draw = () => {
    container.innerHTML = `<button type="button" class="data-back progress-back">← Todas las canciones</button>
      <h3 class="progress-song">${esc(songTitle(songId))}</h3>
      <div class="progress-chart-wrap">${renderProgressChart(attempts)}
        <p class="practice-legend"><span class="legend-guide">Con guía</span><span class="legend-test">A prueba</span></p></div>
      <ul class="progress-attempts">${attempts.map(attemptItem).join('')}</ul>
      ${next ? '<button type="button" class="btn small quiet" data-more>Cargar más</button>' : ''}`;
    container.querySelector('.progress-back').addEventListener('click', back);
    container.querySelector('.progress-attempts').addEventListener('click', e => {
      const head = e.target.closest('.progress-attempt__head');
      if (!head) return;
      const open = head.getAttribute('aria-expanded') !== 'true';
      head.setAttribute('aria-expanded', String(open));
      head.nextElementSibling.hidden = !open;
    });
    container.querySelector('[data-more]')?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { await load(next); draw(); } catch (err) { e.target.disabled = false; e.target.textContent = `${err.message} Reintentar`; }
    });
    focusFirst(container);
  };
  draw();
}

export function openMyProgress() {
  const sheet = openSheet({ title: 'Mi progreso', eyebrow: 'Práctica', wide: true });
  renderProgress(sheet.body);
}
