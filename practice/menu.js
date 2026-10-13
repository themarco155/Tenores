import { getSession, clearSession, onSessionChange } from './session.js';
import { api } from './api.js';
import { openLogin, openPinChange, greeting } from './login-ui.js';

function items(session) {
  if (!session) return [['login', 'Entrar']];
  if (session.user.mustChangePin) return [['pin', 'Elegir mi PIN'], ['logout', 'Salir']];
  const list = [['progress', 'Mi progreso']];
  if (session.user.role === 'admin') list.push(['admin', 'Administración']);
  list.push(['logout', 'Salir']);
  return list;
}

export function mountPracticeMenu({ onProgress, onAdmin }) {
  const menu = document.getElementById('quickMenu');
  if (!menu || document.getElementById('practiceMenu')) return;
  const folder = document.createElement('details');
  folder.className = 'quick-menu__folder';
  folder.id = 'practiceMenu';
  folder.innerHTML = '<summary>Práctica</summary><div class="quick-menu__contents"></div>';
  const contents = folder.querySelector('.quick-menu__contents');
  menu.append(folder);

  const render = session => {
    const note = session ? `<p class="quick-menu__note">${greeting(session.user)}</p>` : '';
    contents.innerHTML = note + items(session)
      .map(([action, label]) => `<button class="quick-menu__item" type="button" data-practice-action="${action}">${label}</button>`)
      .join('');
  };

  // app.js cierra el menú al pulsar cualquier .quick-menu__item; aquí solo se ejecuta la acción.
  // Se difiere con setTimeout: el handler de app.js sobre #quickMenu oculta el menú y devuelve el foco
  // al botón ☰ en este mismo clic; así el diálogo se abre después y su opener es #menuToggle.
  const run = async action => {
    if (action === 'login') { if (await openLogin()) onProgress(); }
    else if (action === 'pin') openPinChange();
    else if (action === 'progress') onProgress();
    else if (action === 'admin') onAdmin();
    else if (action === 'logout') {
      try { await api.logout(); } catch { /* la sesión se borra igualmente */ }
      clearSession();
    }
  };
  contents.addEventListener('click', e => {
    const btn = e.target.closest('[data-practice-action]');
    if (!btn) return;
    const action = btn.dataset.practiceAction;
    setTimeout(() => run(action), 0);
  });

  render(getSession());
  onSessionChange(render);
}
