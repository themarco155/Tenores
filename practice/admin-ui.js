import { api } from './api.js';
import { openSheet, focusFirst } from './sheet.js';
import { renderProgress } from './progress-ui.js';
import { getSession } from './session.js';
import { esc, trendSymbol, daysSince, sinceFor, formatDate } from './format.js';
import { getSongs, refreshSongs, moveInOrder } from './songs.js';
import { referenceFromUrl } from './reference-builder.js';

const TABS = [['team', 'Equipo'], ['ranking', 'Ranking'], ['users', 'Usuarios'], ['songs', 'Canciones']];
const INACTIVE_DAYS = 14;

// Estado del panel abierto. Cada vista se pinta en un contenedor nuevo (freshView) para que
// los listeners de una vista anterior no se acumulen ni reciban clics de la siguiente.
let state = null; // { sheet, tab, usersFilter, rankingSong, rankingPeriod }

function handleAuthError(err) {
  if (err.status !== 401 && err.status !== 403) return false;
  state?.sheet.close();
  const s = openSheet({ title: 'Administración', eyebrow: 'Práctica' });
  s.body.innerHTML = `<p class="practice-message">${esc(err.status === 401 ? 'Tu sesión ha caducado. Vuelve a entrar.' : 'Tu usuario no tiene permisos de administración.')}</p>`;
  return true;
}

function showError(container, err, retry) {
  if (handleAuthError(err)) return;
  container.innerHTML = `<div class="practice-error" role="alert"><p>${esc(err.message)}</p><button type="button" class="btn small" data-retry>Reintentar</button></div>`;
  container.querySelector('[data-retry]').addEventListener('click', retry);
}

export function openAdmin() {
  const sheet = openSheet({ title: 'Administración', eyebrow: 'Jefe de cuerda', wide: true, onClose: () => { state = null; } });
  state = { sheet, tab: 'team', usersFilter: '1', songsFilter: '1', focusSong: null, rankingSong: 'all', rankingPeriod: 'season' };
  sheet.body.innerHTML = `<div class="admin-tabs" role="tablist">${TABS.map(([id, label]) =>
    `<button type="button" role="tab" class="data-tab" data-tab="${id}" aria-selected="false">${label}</button>`).join('')}</div>
    <div class="admin-view" role="tabpanel"></div>`;
  sheet.body.querySelector('.admin-tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) showTab(tab.dataset.tab);
  });
  showTab('team');
}

function freshView() {
  const old = state.sheet.body.querySelector('.admin-view');
  const view = document.createElement('div');
  view.className = 'admin-view';
  view.setAttribute('role', 'tabpanel');
  old.replaceWith(view);
  return view;
}

function showTab(tab) {
  if (!state) return;
  state.tab = tab;
  state.sheet.body.querySelectorAll('[data-tab]').forEach(b => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.classList.toggle('is-active', on);
  });
  const view = freshView();
  if (tab === 'team') renderTeam(view);
  else if (tab === 'ranking') renderRanking(view);
  else if (tab === 'songs') renderSongs(view);
  else renderUsers(view);
}

const reloadTab = () => showTab(state?.tab);

function showDetail(user) {
  const view = freshView();
  view.innerHTML = `<button type="button" class="data-back" data-back>← Volver</button>
    <h3 class="progress-song">${esc(user.displayName)} <small>@${esc(user.username)}</small></h3><div data-progress></div>`;
  view.querySelector('[data-back]').addEventListener('click', reloadTab);
  renderProgress(view.querySelector('[data-progress]'), { userId: user.id });
}

// ---------- Equipo ----------
async function renderTeam(view) {
  view.innerHTML = '<p class="practice-message">Cargando…</p>';
  let data;
  try { data = await api.admin.team(); } catch (err) { showError(view, err, reloadTab); return; }
  if (!data.team.length) { view.innerHTML = '<p class="practice-message">No hay usuarios activos.</p>'; return; }
  const users = new Map(data.team.map(r => [String(r.user.id), r.user]));
  view.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Tenor</th><th>Último intento</th><th>7 días</th><th>30 días</th><th>Media 30 d</th><th>Tendencia</th></tr></thead>
    <tbody>${data.team.map(r => {
      const days = daysSince(r.lastAttemptAt);
      const idle = days == null || days > INACTIVE_DAYS;
      return `<tr>
        <td><button type="button" class="admin-link" data-user="${r.user.id}">${esc(r.user.displayName)}</button>${idle ? ' <span class="admin-badge">Sin practicar</span>' : ''}</td>
        <td>${r.lastAttemptAt ? esc(formatDate(r.lastAttemptAt)) : '—'}</td>
        <td>${r.attempts7d}</td><td>${r.attempts30d}</td><td>${r.avg30d ?? '—'}</td><td>${trendSymbol(r.trend)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  view.addEventListener('click', e => {
    const btn = e.target.closest('[data-user]');
    if (btn) showDetail(users.get(btn.dataset.user));
  });
  focusFirst(view);
}

// ---------- Ranking ----------
async function renderRanking(view) {
  const { rankingSong: song, rankingPeriod: period } = state;
  view.innerHTML = `<div class="admin-filters">
      <label>Canción <select data-song><option value="all">General</option>${getSongs().map(s => `<option value="${esc(s.id)}">${esc(s.title)}${s.active ? '' : ' (inactiva)'}</option>`).join('')}</select></label>
      <label>Periodo <select data-period><option value="7d">7 días</option><option value="30d">30 días</option><option value="season">Temporada</option></select></label>
    </div>
    <p class="admin-note">Solo cuentan canciones completas en modo "Ponerme a prueba".</p>
    <div data-results><p class="practice-message">Cargando…</p></div>`;
  const songSel = view.querySelector('[data-song]');
  const periodSel = view.querySelector('[data-period]');
  songSel.value = song;
  periodSel.value = period;
  songSel.addEventListener('change', () => { state.rankingSong = songSel.value; reloadTab(); });
  periodSel.addEventListener('change', () => { state.rankingPeriod = periodSel.value; reloadTab(); });
  const results = view.querySelector('[data-results]');
  let data;
  try { data = await api.admin.ranking(song, sinceFor(period)); } catch (err) { showError(results, err, reloadTab); return; }
  if (!data.rows.length) { results.innerHTML = '<p class="practice-message">Todavía no hay intentos que cuenten en este periodo.</p>'; return; }
  const general = song === 'all';
  results.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>#</th><th>Tenor</th>${general ? '<th>Media</th><th>Canciones</th>' : '<th>Mejor</th><th>Afinación</th><th>Ritmo</th><th>Estabilidad</th>'}<th>Intentos</th></tr></thead>
    <tbody>${data.rows.map(r => `<tr><td>${r.position}</td><td>${esc(r.user.displayName)}</td>${general
      ? `<td><strong>${r.average}</strong></td><td>${r.songs}</td>`
      : `<td><strong>${r.best}</strong></td><td>${r.pitch}</td><td>${r.rhythm}</td><td>${r.stability ?? '—'}</td>`}<td>${r.attempts}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Usuarios ----------
async function renderUsers(view) {
  view.innerHTML = `<div class="admin-filters">
      <label>Mostrar <select data-filter><option value="1">Activos</option><option value="0">Inactivos</option><option value="all">Todos</option></select></label>
      <button type="button" class="btn small" data-new>Nuevo usuario</button>
    </div><div data-list><p class="practice-message">Cargando…</p></div>`;
  const filterSel = view.querySelector('[data-filter]');
  filterSel.value = state.usersFilter;
  filterSel.addEventListener('change', () => { state.usersFilter = filterSel.value; reloadTab(); });
  view.querySelector('[data-new]').addEventListener('click', () => userForm(null));
  const list = view.querySelector('[data-list]');
  let data;
  try { data = await api.admin.users(state.usersFilter); } catch (err) { showError(list, err, reloadTab); return; }
  if (!data.users.length) { list.innerHTML = '<p class="practice-message">No hay usuarios en esta lista.</p>'; return; }
  const me = getSession()?.user?.id;
  list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${data.users.map(u => `<tr data-id="${u.id}">
      <td><button type="button" class="admin-link" data-act="detail">${esc(u.displayName)}</button></td>
      <td>@${esc(u.username)}</td>
      <td>${u.role === 'admin' ? 'Administrador' : 'Tenor'}</td>
      <td>${u.active ? 'Activo' : `Inactivo${u.deactivatedAt ? ` desde ${esc(formatDate(u.deactivatedAt))}` : ''}`}${u.mustChangePin ? ' · PIN temporal' : ''}</td>
      <td class="admin-actions">
        <button type="button" class="btn small quiet" data-act="edit">Editar</button>
        ${u.id === me ? '' : `<button type="button" class="btn small quiet" data-act="reset">Restablecer PIN</button>
        <button type="button" class="btn small quiet" data-act="${u.active ? 'deactivate' : 'reactivate'}">${u.active ? 'Desactivar' : 'Reactivar'}</button>
        <button type="button" class="btn small quiet admin-danger" data-act="delete">Eliminar</button>`}
      </td></tr>`).join('')}</tbody></table></div>`;
  const byId = new Map(data.users.map(u => [String(u.id), u]));
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const user = byId.get(btn.closest('tr').dataset.id);
    const act = btn.dataset.act;
    if (act === 'detail') showDetail(user);
    else if (act === 'edit') userForm(user);
    else if (act === 'reset') confirmReset(user);
    else if (act === 'deactivate') confirmDeactivate(user);
    else if (act === 'reactivate') api.admin.updateUser(user.id, { active: true }).then(reloadTab, alertSheet);
    else if (act === 'delete') confirmDelete(user);
  });
  focusFirst(view);
}

function alertSheet(err) {
  if (handleAuthError(err)) return;
  const s = openSheet({ title: 'No se pudo completar', eyebrow: 'Administración' });
  s.body.innerHTML = `<p role="alert">${esc(err.message)}</p><button type="button" class="btn small" data-close>Entendido</button>`;
  focusFirst(s.body);
}

const FIELD_NAMES = { username: 'el usuario', displayName: 'el nombre', role: 'el rol', confirmUsername: 'la confirmación', title: 'el título', track: 'el enlace del audio', lyrics: 'la letra' };

function showFormError(form, message, field) {
  const el = form.querySelector('[data-error]');
  el.textContent = message;
  el.hidden = false;
  if (field && form.elements[field]) form.elements[field].focus();
}

function formError(form, err) {
  const field = err.code === 'username_taken' ? 'username' : err.code === 'title_taken' ? 'title' : err.field;
  showFormError(form, err.code === 'invalid' && err.field ? `Revisa ${FIELD_NAMES[err.field] || 'los datos'}.` : err.message, field);
}

function showPin(user, pin, intro) {
  const s = openSheet({ title: 'PIN temporal', eyebrow: 'Administración' });
  s.body.innerHTML = `<div class="account-form">
    <p>${esc(intro)}</p>
    <p class="admin-pin" aria-label="PIN temporal">${esc(pin)}</p>
    <p>Compártelo con ${esc(user.displayName)} (usuario <strong>@${esc(user.username)}</strong>); tendrá que cambiarlo al entrar. No se volverá a mostrar.</p>
    <div class="practice-actions"><button type="button" class="btn small" data-copy>Copiar</button><button type="button" class="btn small quiet" data-close>Hecho</button></div>
  </div>`;
  s.body.querySelector('[data-copy]').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(pin); e.target.textContent = 'Copiado ✓'; } catch { e.target.textContent = 'Cópialo a mano'; }
  });
  focusFirst(s.body);
}

function userForm(user) {
  const editing = !!user;
  const s = openSheet({ title: editing ? 'Editar usuario' : 'Nuevo usuario', eyebrow: 'Administración' });
  s.body.innerHTML = `<form class="account-form" novalidate>
    <label>Nombre visible<input name="displayName" maxlength="40" required value="${editing ? esc(user.displayName) : ''}"></label>
    <label>Usuario<input name="username" maxlength="24" autocapitalize="none" spellcheck="false" required value="${editing ? esc(user.username) : ''}"></label>
    <p class="admin-note">3–24 caracteres: letras, números, punto, guion o guion bajo.</p>
    <label>Rol<select name="role"><option value="tenor">Tenor</option><option value="admin">Administrador</option></select></label>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">${editing ? 'Guardar cambios' : 'Crear usuario'}</button>
  </form>`;
  const form = s.body.querySelector('form');
  form.elements.role.value = editing ? user.role : 'tenor';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { displayName: form.elements.displayName.value, username: form.elements.username.value, role: form.elements.role.value };
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      if (editing) {
        const changes = {};
        if (data.displayName.trim() !== user.displayName) changes.displayName = data.displayName;
        if (data.username.trim().toLowerCase() !== user.username) changes.username = data.username;
        if (data.role !== user.role) changes.role = data.role;
        if (Object.keys(changes).length) await api.admin.updateUser(user.id, changes);
        s.close();
        reloadTab();
      } else {
        const r = await api.admin.createUser(data);
        s.close();
        reloadTab();
        showPin(r.user, r.temporaryPin, 'Usuario creado.');
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      formError(form, err);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

function confirmSheet({ title, html, confirmLabel, danger = false, onConfirm }) {
  const s = openSheet({ title, eyebrow: 'Administración' });
  s.body.innerHTML = `<form class="account-form" novalidate>${html}
    <p class="account-form__error" role="alert" data-error hidden></p>
    <div class="practice-actions"><button type="submit" class="btn small${danger ? ' admin-danger' : ''}">${confirmLabel}</button><button type="button" class="btn small quiet" data-close>Cancelar</button></div>
  </form>`;
  const form = s.body.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await onConfirm(form, s);
    } catch (err) {
      if (handleAuthError(err)) return;
      formError(form, err);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

function confirmReset(user) {
  confirmSheet({
    title: 'Restablecer PIN',
    html: `<p>Se generará un PIN temporal nuevo para <strong>${esc(user.displayName)}</strong> y se cerrarán sus sesiones abiertas.</p>`,
    confirmLabel: 'Restablecer',
    onConfirm: async (form, s) => {
      const { temporaryPin } = await api.admin.resetPin(user.id);
      s.close();
      reloadTab();
      showPin(user, temporaryPin, 'PIN restablecido.');
    },
  });
}

function confirmDeactivate(user) {
  confirmSheet({
    title: 'Desactivar usuario',
    html: `<p><strong>${esc(user.displayName)}</strong> no podrá entrar ni aparecerá en el equipo ni en el ranking. Su historial se conserva y puedes reactivarlo cuando quieras.</p>`,
    confirmLabel: 'Desactivar',
    onConfirm: async (form, s) => {
      await api.admin.updateUser(user.id, { active: false });
      s.close();
      reloadTab();
    },
  });
}

function confirmDelete(user) {
  confirmSheet({
    title: 'Eliminar usuario',
    danger: true,
    html: `<p>Se borrará <strong>${esc(user.displayName)}</strong> y <strong>todo su historial de intentos</strong>. No se puede deshacer. Si solo ha dejado el coro, mejor desactívalo.</p>
      <label>Escribe <strong>${esc(user.username)}</strong> para confirmar<input name="confirmUsername" autocapitalize="none" spellcheck="false" autocomplete="off" required></label>`,
    confirmLabel: 'Eliminar definitivamente',
    onConfirm: async (form, s) => {
      await api.admin.deleteUser(user.id, form.elements.confirmUsername.value);
      s.close();
      reloadTab();
    },
  });
}

// ---------- Canciones ----------
const afterSongChange = () => { refreshSongs(); reloadTab(); };

async function renderSongs(view) {
  view.innerHTML = `<div class="admin-filters">
      <label>Mostrar <select data-filter><option value="1">Activas</option><option value="0">Inactivas</option><option value="all">Todas</option></select></label>
      <button type="button" class="btn small" data-new>Nueva canción</button>
    </div><div data-list><p class="practice-message">Cargando…</p></div>`;
  const filterSel = view.querySelector('[data-filter]');
  filterSel.value = state.songsFilter;
  filterSel.addEventListener('change', () => { state.songsFilter = filterSel.value; reloadTab(); });
  view.querySelector('[data-new]').addEventListener('click', () => songForm(null));
  const list = view.querySelector('[data-list]');
  let data;
  try { data = await api.admin.songs('all'); } catch (err) { showError(list, err, reloadTab); return; }
  const all = data.songs; // en orden de portada
  const shown = all.filter(s => state.songsFilter === 'all' || String(Number(s.active)) === state.songsFilter);
  if (!shown.length) { list.innerHTML = '<p class="practice-message">No hay canciones en esta lista.</p>'; return; }
  const number = new Map(all.filter(s => s.active).map((s, i) => [s.id, String(i + 1).padStart(2, '0')]));
  list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
    <thead><tr><th>#</th><th>Título</th><th>Audio</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${shown.map((s, k) => `<tr data-id="${esc(s.id)}">
      <td>${number.get(s.id) || '—'}</td>
      <td>${esc(s.title)}</td>
      <td>${s.track ? 'Sí' : 'No'}</td>
      <td>${s.active ? 'Activa' : 'Inactiva'}</td>
      <td class="admin-actions">
        <button type="button" class="btn small quiet" data-act="up" aria-label="Subir ${esc(s.title)}"${k === 0 ? ' disabled' : ''}>Subir</button>
        <button type="button" class="btn small quiet" data-act="down" aria-label="Bajar ${esc(s.title)}"${k === shown.length - 1 ? ' disabled' : ''}>Bajar</button>
        <button type="button" class="btn small quiet" data-act="edit">Editar</button>
        <button type="button" class="btn small quiet" data-act="${s.active ? 'deactivate' : 'reactivate'}">${s.active ? 'Desactivar' : 'Reactivar'}</button>
      </td></tr>`).join('')}</tbody></table></div>`;
  const byId = new Map(all.map(s => [s.id, s]));
  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const song = byId.get(btn.closest('tr').dataset.id);
    const act = btn.dataset.act;
    if (act === 'up' || act === 'down') {
      btn.disabled = true;
      const ids = moveInOrder(all.map(s => s.id), shown.map(s => s.id), song.id, act === 'up' ? -1 : 1);
      try {
        await api.admin.reorderSongs(ids);
        state.focusSong = { id: song.id, act };
        afterSongChange();
      } catch (err) { btn.disabled = false; alertSheet(err); }
    } else if (act === 'edit') songForm(song);
    else if (act === 'deactivate') confirmDeactivateSong(song);
    else if (act === 'reactivate') api.admin.updateSong(song.id, { active: true }).then(afterSongChange, alertSheet);
  });
  // Tras Subir/Bajar se repinta la tabla: el foco vuelve al mismo botón de la misma canción.
  const focus = state.focusSong;
  state.focusSong = null;
  const target = focus && [...list.querySelectorAll('tr[data-id]')].find(tr => tr.dataset.id === focus.id)?.querySelector(`[data-act="${focus.act}"]`);
  if (target && !target.disabled) target.focus(); else focusFirst(view);
}

function songForm(song) {
  let current = song; // tras crear, el formulario pasa a editar esa canción (para reintentar sin duplicar)
  let pendingRef = null; // referencia calculada que no se pudo subir
  const s = openSheet({ title: song ? 'Editar canción' : 'Nueva canción', eyebrow: 'Administración', wide: true });
  s.body.innerHTML = `<form class="account-form" novalidate>
    <label>Título<input name="title" maxlength="80" required value="${song ? esc(song.title) : ''}"></label>
    <label>Enlace del audio<input name="track" type="url" inputmode="url" maxlength="500" autocapitalize="none" spellcheck="false" placeholder="https://res.cloudinary.com/…" value="${song && song.track ? esc(song.track) : ''}"></label>
    <p class="admin-note">Opcional. Sin audio, la canción muestra solo la letra y no se puede practicar.</p>
    <label>Letra<textarea name="lyrics" rows="12" maxlength="20000">${song ? esc(song.lyrics) : ''}</textarea></label>
    <p class="admin-note" data-stage aria-live="polite" hidden></p>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">${song ? 'Guardar cambios' : 'Crear canción'}</button>
  </form>`;
  const form = s.body.querySelector('form');
  const stage = form.querySelector('[data-stage]');
  const button = form.querySelector('button[type=submit]');
  const say = text => { stage.textContent = text; stage.hidden = !text; };
  const fail = (message, field) => { say(''); showFormError(form, message, field); button.disabled = false; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    form.querySelector('[data-error]').hidden = true;
    const title = form.elements.title.value.trim();
    const track = form.elements.track.value.trim() || null;
    const lyrics = form.elements.lyrics.value;
    if (!title) return showFormError(form, 'Escribe el título.', 'title');
    if (track && !/^https:\/\//i.test(track)) return showFormError(form, 'El enlace debe empezar por https://', 'track');
    button.disabled = true;

    // 1. Si el audio es nuevo, se analiza antes de guardar nada.
    const oldTrack = current?.track || null;
    let ref = null;
    if (track && (track !== oldTrack || (pendingRef && pendingRef.source === track))) {
      if (pendingRef && pendingRef.source === track) ref = pendingRef;
      else {
        try {
          ref = await referenceFromUrl(current?.id || 'nueva', track, { onStage: st => say(st === 'download' ? 'Descargando audio…' : 'Analizando audio…') });
        } catch (err) { return fail(err.message, 'track'); }
      }
    }

    // 2. Datos de la canción.
    say('Guardando…');
    try {
      if (current) {
        const changes = {};
        if (title !== current.title) changes.title = title;
        if (track !== oldTrack) changes.track = track;
        if (lyrics !== current.lyrics) changes.lyrics = lyrics;
        if (Object.keys(changes).length) current = (await api.admin.updateSong(current.id, changes)).song;
      } else {
        current = (await api.admin.createSong({ title, track, lyrics })).song;
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      say('');
      formError(form, err);
      button.disabled = false;
      return;
    }

    // 3. Referencia de notas.
    if (ref) {
      try {
        await api.admin.putSongReference(current.id, { ...ref, songId: current.id });
        pendingRef = null;
      } catch (err) {
        if (handleAuthError(err)) return;
        pendingRef = ref;
        refreshSongs();
        return fail('Se guardó la canción pero no su referencia. Vuelve a guardar para reintentarlo.', 'track');
      }
    }
    s.close();
    afterSongChange();
  });
  focusFirst(form);
}

function confirmDeactivateSong(song) {
  confirmSheet({
    title: 'Desactivar canción',
    html: `<p><strong>${esc(song.title)}</strong> no aparecerá en el sitio ni en práctica. Su historial se conserva y puedes reactivarla cuando quieras.</p>`,
    confirmLabel: 'Desactivar',
    onConfirm: async (form, s) => {
      await api.admin.updateSong(song.id, { active: false });
      s.close();
      afterSongChange();
    },
  });
}
