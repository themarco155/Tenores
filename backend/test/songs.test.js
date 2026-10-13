import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/app.js';

const ORDER = ['fum', 'campanas', 'adeste', 'dona', 'fuentecilla', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];

test('la migración deja las 12 canciones en el orden de la portada', async () => {
  const t = setup();
  const { results } = await t.db.prepare('SELECT id, title, position, active, legacy_reference, reference, lyrics FROM songs ORDER BY position').all();
  assert.deepEqual(results.map(r => r.id), ORDER);
  assert.deepEqual(results.map(r => r.position), ORDER.map((_, i) => i + 1));
  assert.ok(results.every(r => r.active === 1 && r.legacy_reference === 1 && r.reference === null));
  assert.equal(results.find(r => r.id === 'kling').title, 'Kling Glöckchen, klingelingeling');
  assert.match(results.find(r => r.id === 'adeste').lyrics, /;/);
});
