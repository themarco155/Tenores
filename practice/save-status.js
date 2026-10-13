import { apiEnabled } from './config.js';
import { getSession } from './session.js';
import { api } from './api.js';
import { openLogin, openPinChange } from './login-ui.js';
import { esc } from './format.js';

export function mountSaveStatus(el, result) {
  if (!el) return;
  if (!apiEnabled || !result.valid) { el.hidden = true; return; }
  const show = html => { el.innerHTML = html; };
  const ask = (text, action, label) =>
    show(`<span>${esc(text)}</span> <button type="button" class="btn small quiet" data-save-act="${action}">${label}</button>`);

  async function save() {
    show('<span>Guardando…</span>');
    try {
      await api.saveAttempt(result);
      show('<span class="practice-save__ok">Guardado ✓</span>');
    } catch (err) {
      if (err.code === 'pin_change_required') ask('Elige tu PIN para guardar este intento.', 'pin', 'Elegir PIN');
      else if (err.status === 401) ask('Tu sesión caducó. Entra de nuevo para guardar.', 'login', 'Entrar');
      else show(`<span class="practice-save__err">No se pudo guardar: ${esc(err.message)}</span> <button type="button" class="btn small quiet" data-save-act="retry">Reintentar</button>`);
    }
  }

  el.addEventListener('click', async e => {
    const action = e.target.closest('[data-save-act]')?.dataset.saveAct;
    if (action === 'retry') save();
    else if (action === 'login' && await openLogin()) save();
    else if (action === 'pin' && await openPinChange()) save();
  });

  if (getSession()) save();
  else ask('Inicia sesión para guardar tu progreso.', 'login', 'Entrar');
}
