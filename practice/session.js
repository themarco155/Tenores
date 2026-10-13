const KEY = 'tenores.session';
const events = new EventTarget();
let storage = () => globalThis.localStorage;
let cache; // undefined = aún no leído

function read() {
  try {
    const raw = storage()?.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value.token === 'string' && value.user ? value : null;
  } catch {
    return null;
  }
}

const emit = () => events.dispatchEvent(new Event('change'));

export function configureStorage(store) {
  storage = () => store;
  cache = undefined;
}

export function getSession() {
  if (cache === undefined) cache = read();
  return cache;
}

export function setSession(session) {
  cache = session;
  try { storage()?.setItem(KEY, JSON.stringify(session)); } catch { /* sin almacenamiento: solo en memoria */ }
  emit();
}

export function updateUser(user) {
  const current = getSession();
  if (current) setSession({ ...current, user });
}

export function clearSession() {
  const had = getSession() !== null;
  cache = null;
  try { storage()?.removeItem(KEY); } catch { /* nada que borrar */ }
  if (had) emit();
}

export function onSessionChange(fn) {
  const handler = () => fn(getSession());
  events.addEventListener('change', handler);
  return () => events.removeEventListener('change', handler);
}
