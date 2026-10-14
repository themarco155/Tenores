import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { esc } from './format.js';
import { STATUSES, STATUS_LABELS, countEntries, countsLabel, localToday, seasonOfDate, seasonLabel, formatRehearsalDate, createSaveQueue, singleFlight } from './attendance.js';

// Pestaña "Asistencia" del panel de administración. `ui` trae utilidades de admin-ui.js:
// { state, reloadTab, showError, handleAuthError, alertSheet, confirmSheet, formError }.
export async function renderAttendance(view, ui) {
  const { state } = ui;
  view.innerHTML = `<div class="admin-filters">
      <button type="button" class="btn small" data-today>Tomar asistencia de hoy</button>
      <button type="button" class="btn small quiet" data-other>Otra fecha…</button>
      <label>Temporada <select data-season></select></label>
      <button type="button" class="btn small quiet" data-report>Reporte</button>
    </div><div data-list><p class="practice-message">Cargando…</p></div>`;
  const list = view.querySelector('[data-list]');
  let seasons;
  try { seasons = await api.admin.attendanceSeasons(); } catch (err) { ui.showError(list, err, ui.reloadTab); return; }
  if (!state.attendanceSeason) state.attendanceSeason = seasons.current;
  const sel = view.querySelector('[data-season]');
  const options = seasons.seasons.includes(state.attendanceSeason) ? seasons.seasons : [state.attendanceSeason, ...seasons.seasons];
  sel.innerHTML = options.map(y => `<option value="${y}">${esc(seasonLabel(y))}</option>`).join('');
  sel.value = String(state.attendanceSeason);
  sel.addEventListener('change', () => { state.attendanceSeason = Number(sel.value); ui.reloadTab(); });
  view.querySelector('[data-today]').addEventListener('click', e => openForDateOnce(localToday(), '', ui, e.currentTarget));
  view.querySelector('[data-other]').addEventListener('click', () => otherDateForm(ui));
  view.querySelector('[data-report]').addEventListener('click', () => openReport(state.attendanceSeason, ui));
  let data;
  try { data = await api.admin.rehearsals(state.attendanceSeason); } catch (err) { ui.showError(list, err, ui.reloadTab); return; }
  if (!data.rehearsals.length) {
    list.innerHTML = '<p class="practice-message">Todavía no hay ensayos registrados en esta temporada.</p>';
    focusFirst(view);
    return;
  }
  list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Fecha</th><th>Nota</th><th>Asistencia</th></tr></thead>
    <tbody>${data.rehearsals.map(r => `<tr>
      <td><button type="button" class="admin-link" data-rehearsal="${r.id}">${esc(formatRehearsalDate(r.date))}</button></td>
      <td>${esc(r.note) || '—'}</td>
      <td>${esc(countsLabel(r))}</td></tr>`).join('')}</tbody></table></div>`;
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-rehearsal]');
    if (b) openRehearsalOnce(Number(b.dataset.rehearsal), ui);
  });
  focusFirst(view);
}

// Un doble toque con la red lenta no debe abrir dos listas del mismo ensayo (la de abajo quedaría desfasada).
const openRehearsalOnce = singleFlight((id, ui) => openRehearsal(id, ui));
const openForDateOnce = singleFlight((date, note, ui, button) => openForDate(date, note, ui, button));

// Crea el ensayo de esa fecha o, si ya existe, abre el existente.
async function openForDate(date, note, ui, button) {
  if (button) button.disabled = true;
  try {
    const created = await api.admin.createRehearsal({ date, note });
    attendanceSheet(created, ui);
  } catch (err) {
    if (err.code === 'rehearsal_exists') {
      try {
        const { rehearsals } = await api.admin.rehearsals(seasonOfDate(date));
        const found = rehearsals.find(r => r.date === date);
        if (found) { await openRehearsal(found.id, ui); return; }
      } catch (err2) { ui.alertSheet(err2); return; }
    }
    ui.alertSheet(err);
  } finally {
    if (button) button.disabled = false;
  }
}

async function openRehearsal(id, ui) {
  try { attendanceSheet(await api.admin.rehearsal(id), ui); } catch (err) { ui.alertSheet(err); }
}

function otherDateForm(ui) {
  const s = openSheet({ title: 'Registrar ensayo', eyebrow: 'Asistencia' });
  s.body.innerHTML = `<form class="account-form" novalidate>
    <label>Fecha<input name="date" type="date" required value="${esc(localToday())}"></label>
    <label>Nota (opcional)<input name="note" maxlength="200" placeholder="Ensayo general"></label>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">Abrir lista</button>
  </form>`;
  const form = s.body.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const date = form.elements.date.value;
    try {
      const created = await api.admin.createRehearsal({ date, note: form.elements.note.value });
      s.close();
      attendanceSheet(created, ui);
    } catch (err) {
      if (err.code === 'rehearsal_exists') { s.close(); await openForDate(date, '', ui); return; }
      if (ui.handleAuthError(err)) return;
      ui.formError(form, err);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

const SAVE_TEXT = { pending: 'Guardando…', saving: 'Guardando…', saved: 'Guardado ✓' };

function attendanceSheet(initial, ui) {
  let rehearsal = initial.rehearsal;
  let entries = initial.entries;
  const status = new Map(entries.map(e => [e.user.id, e.status]));
  const queue = createSaveQueue({
    send: async batch => {
      const r = await api.admin.saveAttendance(rehearsal.id, batch);
      if (r.entries.length !== entries.length) { entries = r.entries; for (const e of r.entries) if (!status.has(e.user.id)) status.set(e.user.id, e.status); renderList(); }
      return r;
    },
    onState: (st, err) => showSave(st, err),
  });
  // Al cerrar: se espera a que se guarde todo antes de recargar la lista; si algo no se pudo guardar, se avisa.
  const s = openSheet({ title: formatRehearsalDate(rehearsal.date), eyebrow: 'Asistencia', wide: true,
    onClose: () => {
      queue.drain().then(ui.reloadTab, err => {
        ui.reloadTab();
        if (ui.handleAuthError(err)) return;
        const n = queue.pendingCount;
        ui.alertSheet({ message: `No se ${n === 1 ? 'guardó 1 cambio' : `guardaron ${n} cambios`} de asistencia (${err.message}) Vuelve a abrir el ensayo y revísalo.` });
      });
    } });
  s.body.innerHTML = `<div class="attendance-head">
      <p class="admin-note" data-note></p>
      <button type="button" class="btn small quiet" data-edit>Editar</button>
    </div>
    <p class="attendance-counts" data-counts aria-live="polite"></p>
    <button type="button" class="btn small" data-all>Marcar todos presentes</button>
    <ul class="attendance-list" data-rows></ul>
    <p class="attendance-save" data-save aria-live="polite"></p>
    <button type="button" class="btn small quiet admin-danger" data-delete>Borrar ensayo</button>`;
  const $rows = s.body.querySelector('[data-rows]');
  const $counts = s.body.querySelector('[data-counts]');
  const $save = s.body.querySelector('[data-save]');

  const current = () => entries.map(e => ({ ...e, status: status.get(e.user.id) }));
  const showHead = () => {
    s.setTitle(formatRehearsalDate(rehearsal.date));
    s.body.querySelector('[data-note]').textContent = rehearsal.note || 'Sin nota';
  };
  const showCounts = () => { $counts.textContent = countsLabel(countEntries(current())); };

  function renderList() {
    $rows.innerHTML = current().map(e => `<li class="attendance-row" data-user="${e.user.id}">
      <span class="attendance-name">${esc(e.user.displayName)}${e.user.active ? '' : ' <small>(inactivo)</small>'}</span>
      <div class="attendance-options" role="radiogroup" aria-label="Asistencia de ${esc(e.user.displayName)}">
        ${STATUSES.map(st => `<button type="button" role="radio" class="attendance-option attendance-option--${st}" data-status="${st}"
          aria-checked="${st === e.status}" tabindex="${st === e.status ? 0 : -1}">${STATUS_LABELS[st]}</button>`).join('')}
      </div></li>`).join('');
    showCounts();
  }

  function choose(userId, st, focus = false) {
    status.set(userId, st);
    const row = $rows.querySelector(`[data-user="${userId}"]`);
    row.querySelectorAll('[data-status]').forEach(b => {
      const on = b.dataset.status === st;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    showCounts();
    queue.set(userId, st);
  }

  function showSave(st, err) {
    if (st === 'error') {
      if (ui.handleAuthError(err)) return;
      $save.innerHTML = 'No se pudo guardar. <button type="button" class="btn small" data-retry>Reintentar</button>';
      $save.querySelector('[data-retry]').addEventListener('click', () => queue.flush().catch(() => {}));
      return;
    }
    $save.textContent = SAVE_TEXT[st] || '';
  }

  $rows.addEventListener('click', e => {
    const b = e.target.closest('[data-status]');
    if (b) choose(Number(b.closest('[data-user]').dataset.user), b.dataset.status);
  });
  $rows.addEventListener('keydown', e => {
    const b = e.target.closest('[data-status]');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!b || !step) return;
    e.preventDefault();
    const next = STATUSES[(STATUSES.indexOf(b.dataset.status) + step + STATUSES.length) % STATUSES.length];
    choose(Number(b.closest('[data-user]').dataset.user), next, true);
  });
  s.body.querySelector('[data-all]').addEventListener('click', () => {
    for (const e of current()) if (e.status === 'absent') choose(e.user.id, 'present');
  });
  s.body.querySelector('[data-edit]').addEventListener('click', () => editForm());
  s.body.querySelector('[data-delete]').addEventListener('click', () => ui.confirmSheet({
    title: 'Borrar ensayo',
    danger: true,
    html: `<p>Se borrará el ensayo del <strong>${esc(formatRehearsalDate(rehearsal.date))}</strong> y toda su asistencia. No se puede deshacer.</p>
      <label>Escribe <strong>${esc(rehearsal.date)}</strong> para confirmar<input name="confirmDate" autocomplete="off" required></label>`,
    confirmLabel: 'Borrar definitivamente',
    onConfirm: async (form, c) => {
      await api.admin.deleteRehearsal(rehearsal.id, form.elements.confirmDate.value.trim());
      c.close();
      s.close();
    },
  }));

  function editForm() {
    const f = openSheet({ title: 'Editar ensayo', eyebrow: 'Asistencia' });
    f.body.innerHTML = `<form class="account-form" novalidate>
      <label>Fecha<input name="date" type="date" required value="${esc(rehearsal.date)}"></label>
      <label>Nota (opcional)<input name="note" maxlength="200" value="${esc(rehearsal.note)}"></label>
      <p class="account-form__error" role="alert" data-error hidden></p>
      <button type="submit" class="btn">Guardar cambios</button>
    </form>`;
    const form = f.body.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      try {
        rehearsal = (await api.admin.updateRehearsal(rehearsal.id, { date: form.elements.date.value, note: form.elements.note.value })).rehearsal;
        showHead();
        f.close();
      } catch (err) {
        if (ui.handleAuthError(err)) return;
        ui.formError(form, err);
        button.disabled = false;
      }
    });
    focusFirst(form);
  }

  showHead();
  renderList();
  focusFirst(s.body);
}

async function openReport(season, ui) {
  const s = openSheet({ title: 'Reporte de asistencia', eyebrow: `Temporada ${seasonLabel(season)}`, wide: true });
  s.body.innerHTML = '<p class="practice-message">Cargando…</p>';
  let r;
  try { r = await api.admin.attendanceReport(season); } catch (err) {
    if (ui.handleAuthError(err)) return;
    s.body.innerHTML = `<div class="practice-error" role="alert"><p>${esc(err.message)}</p></div>`;
    return;
  }
  const byId = new Map(r.people.map(p => [p.user.id, p]));
  const pct = v => (v == null ? '—' : `${String(v).replace('.', ',')} %`);
  const date = d => (d ? esc(formatRehearsalDate(d)) : '—');

  function summary() {
    if (!r.rehearsals) {
      s.body.innerHTML = '<p class="practice-message">Todavía no hay ensayos registrados en esta temporada.</p>';
      return;
    }
    const medal = i => (i < 3 ? ` <span class="attendance-medal attendance-medal--${i + 1}" aria-label="Puesto ${i + 1}">${['🥇', '🥈', '🥉'][i]}</span>` : '');
    s.body.innerHTML = `<div class="attendance-cards">
        <div class="attendance-card"><strong>${r.rehearsals}</strong><span>Ensayos realizados</span></div>
        <div class="attendance-card"><strong>${pct(r.teamAverage)}</strong><span>Asistencia media del equipo</span></div>
        <div class="attendance-card"><strong>${r.minimum} de ${r.rehearsals}</strong><span>Mínimo para el leaderboard</span></div>
      </div>
      <h3 class="progress-song">Leaderboard</h3>
      ${r.leaderboard.length ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>#</th><th>Integrante</th><th>Asistencia</th><th>Asistidos</th><th>Tardanzas</th></tr></thead>
        <tbody>${r.leaderboard.map((l, i) => { const p = byId.get(l.userId); return `<tr>
          <td>${l.position}${medal(i)}</td><td>${esc(p.user.displayName)}</td><td><strong>${pct(p.attendancePct)}</strong></td>
          <td>${p.present + p.late} de ${p.recorded - p.excused}</td><td>${p.late}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<p class="practice-message">Nadie llega todavía al mínimo de ensayos.</p>'}
      ${r.belowMinimum.length ? `<p class="admin-note attendance-below">Sin mínimo: ${r.belowMinimum.map(b => { const p = byId.get(b.userId);
        return `${esc(p.user.displayName)} (${pct(p.attendancePct)})`; }).join(', ')}</p>` : ''}
      <h3 class="progress-song">Detalle por integrante</h3>
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Integrante</th><th>Presente</th><th>Tarde</th><th>Ausente</th><th>Justificado</th><th>% asistencia</th><th>% tardanzas</th><th>Última falta</th></tr></thead>
        <tbody>${r.people.map(p => `<tr>
          <td><button type="button" class="admin-link" data-person="${p.user.id}">${esc(p.user.displayName)}</button>${p.user.active ? '' : ' <small>(inactivo)</small>'}</td>
          <td>${p.present}</td><td>${p.late}</td><td>${p.absent}</td><td>${p.excused}</td>
          <td>${pct(p.attendancePct)}</td><td>${pct(p.latePct)}</td><td>${date(p.lastAbsence)}</td></tr>`).join('')}</tbody></table></div>`;
    s.body.querySelectorAll('[data-person]').forEach(b => b.addEventListener('click', () => history(byId.get(Number(b.dataset.person)))));
    focusFirst(s.body);
  }

  function history(p) {
    s.body.innerHTML = `<button type="button" class="data-back" data-back>← Volver</button>
      <h3 class="progress-song">${esc(p.user.displayName)}</h3>
      <ul class="attendance-history">${p.history.map(h => `<li><span>${date(h.date)}</span>
        <span class="attendance-tag attendance-tag--${h.status}">${STATUS_LABELS[h.status]}</span></li>`).join('')}</ul>`;
    s.body.querySelector('[data-back]').addEventListener('click', summary);
    focusFirst(s.body);
  }

  summary();
}
