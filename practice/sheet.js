const stack = [];
let counter = 0;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

export function focusFirst(root) {
  const el = [...root.querySelectorAll(FOCUSABLE)].find(e => e.offsetParent !== null);
  (el || root).focus({ preventScroll: true });
}

// Captura en document: el diálogo superior gestiona Esc/Tab antes que el panel de práctica.
function onKey(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    top.close();
    return;
  }
  if (e.key !== 'Tab') return;
  e.stopPropagation();
  const items = [...top.panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  if (!items.length) { e.preventDefault(); top.panel.focus(); return; }
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement;
  if (!top.panel.contains(active) || active === top.panel) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

export function openSheet({ title, eyebrow = '', wide = false, onClose } = {}) {
  const opener = document.activeElement;
  const id = `tsheet-title-${++counter}`;
  const root = document.createElement('div');
  root.className = 'tsheet';
  root.innerHTML = `<div class="tsheet__backdrop" data-close></div>
    <section class="tsheet__panel${wide ? ' tsheet__panel--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1">
      <header class="tsheet__header">
        <div><p class="tsheet__eyebrow"></p><h2 class="tsheet__title" id="${id}"></h2></div>
        <button type="button" class="tsheet__close" data-close aria-label="Cerrar">&times;</button>
      </header>
      <div class="tsheet__body"></div>
    </section>`;
  const panel = root.querySelector('.tsheet__panel');
  const titleEl = root.querySelector('.tsheet__title');
  const eyebrowEl = root.querySelector('.tsheet__eyebrow');
  titleEl.textContent = title;
  eyebrowEl.textContent = eyebrow;
  eyebrowEl.hidden = !eyebrow;
  let closed = false;
  const sheet = {
    root,
    panel,
    body: root.querySelector('.tsheet__body'),
    setTitle(t) { titleEl.textContent = t; },
    close() {
      if (closed) return;
      closed = true;
      root.remove();
      stack.splice(stack.indexOf(sheet), 1);
      if (!stack.length) {
        document.removeEventListener('keydown', onKey, true);
        document.body.classList.remove('tsheet-open');
      }
      if (onClose) onClose();
      if (opener && document.contains(opener)) opener.focus();
    },
  };
  root.addEventListener('click', e => { if (e.target.closest('[data-close]')) sheet.close(); });
  if (!stack.length) {
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('tsheet-open');
  }
  stack.push(sheet);
  document.body.append(root);
  panel.focus();
  return sheet;
}
