import { openSheet, focusFirst } from './sheet.js';
import { api } from './api.js';
import { setSession, updateUser, getSession } from './session.js';
import { esc } from './format.js';

const PIN_INPUT = 'inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="off" required';

function showError(form, message) {
  const el = form.querySelector('[data-error]');
  el.textContent = message;
  el.hidden = !message;
}

function renderPinForm(sheet, { askCurrent, currentPin, resolve }) {
  sheet.setTitle('Elige tu PIN');
  sheet.body.innerHTML = `<form class="account-form" novalidate>
    <p>Tu PIN es temporal. Elige uno nuevo de 6 cifras que solo conozcas tú.</p>
    ${askCurrent ? `<label>PIN actual<input name="current" type="password" ${PIN_INPUT}></label>` : ''}
    <label>PIN nuevo<input name="pin" type="password" ${PIN_INPUT}></label>
    <label>Repite el PIN<input name="repeat" type="password" ${PIN_INPUT}></label>
    <p class="account-form__error" role="alert" data-error hidden></p>
    <button type="submit" class="btn">Guardar PIN</button>
  </form>`;
  const form = sheet.body.querySelector('form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const current = askCurrent ? form.elements.current.value : currentPin;
    const pin = form.elements.pin.value, repeat = form.elements.repeat.value;
    if (!/^\d{6}$/.test(pin)) return showError(form, 'El PIN debe tener exactamente 6 cifras.');
    if (pin !== repeat) return showError(form, 'Los dos PIN no coinciden.');
    if (pin === current) return showError(form, 'El PIN nuevo debe ser distinto del actual.');
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    showError(form, '');
    try {
      await api.changePin(current, pin);
      const session = getSession();
      if (session) updateUser({ ...session.user, mustChangePin: false });
      resolve(true);
      sheet.close();
    } catch (err) {
      showError(form, err.field === 'currentPin' ? 'El PIN actual no es correcto.' : err.message);
      button.disabled = false;
    }
  });
  focusFirst(form);
}

export function openPinChange() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sheet = openSheet({ title: 'Elige tu PIN', eyebrow: 'Cuenta', onClose: () => finish(false) });
    renderPinForm(sheet, { askCurrent: true, resolve: finish });
  });
}

export function openLogin() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const sheet = openSheet({ title: 'Entrar', eyebrow: 'Cuenta', onClose: () => finish(false) });
    sheet.body.innerHTML = `<form class="account-form" novalidate>
      <p>Entra con el usuario y el PIN que te dio el jefe de cuerda para guardar tu progreso.</p>
      <label>Usuario<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label>PIN<input name="pin" type="password" ${PIN_INPUT}></label>
      <p class="account-form__error" role="alert" data-error hidden></p>
      <button type="submit" class="btn">Entrar</button>
    </form>`;
    const form = sheet.body.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const username = form.elements.username.value.trim();
      const pin = form.elements.pin.value;
      if (!username) return showError(form, 'Escribe tu usuario.');
      if (!/^\d{6}$/.test(pin)) return showError(form, 'El PIN debe tener exactamente 6 cifras.');
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      showError(form, '');
      try {
        const { token, user } = await api.login(username, pin);
        setSession({ token, user });
        if (user.mustChangePin) renderPinForm(sheet, { askCurrent: false, currentPin: pin, resolve: finish });
        else { finish(true); sheet.close(); }
      } catch (err) {
        showError(form, err.message);
        button.disabled = false;
      }
    });
    focusFirst(form);
  });
}

export const greeting = user => `Sesión: ${esc(user.displayName)}`;
