import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureStorage, getSession, setSession, updateUser, clearSession, onSessionChange } from '../practice/session.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

test('guarda, lee, actualiza y borra la sesión con aviso de cambio', () => {
  const store = memoryStorage();
  configureStorage(store);
  const seen = [];
  const off = onSessionChange(s => seen.push(s?.user?.displayName ?? null));
  assert.equal(getSession(), null);
  setSession({ token: 't', user: { id: 1, displayName: 'Ana' } });
  assert.equal(getSession().token, 't');
  assert.match(store.m.get('tenores.session'), /"token":"t"/);
  updateUser({ id: 1, displayName: 'Ana P.' });
  clearSession();
  assert.equal(getSession(), null);
  off();
  setSession({ token: 'x', user: { id: 2, displayName: 'Luis' } });
  assert.deepEqual(seen, ['Ana', 'Ana P.', null]);
  clearSession();
});

test('almacenamiento corrupto o que lanza no rompe', () => {
  configureStorage({ getItem: () => '{no json', setItem() { throw new Error('lleno'); }, removeItem() { throw new Error('x'); } });
  assert.equal(getSession(), null);
  setSession({ token: 't', user: { id: 1 } });
  assert.equal(getSession().token, 't');
  clearSession();
  assert.equal(getSession(), null);
});
