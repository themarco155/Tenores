import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin, newSalt, newToken, sha256Hex, randomPin, timingSafeEqual, pinIterations, fromBase64 } from '../src/crypto.js';
import { validateUsername, validateDisplayName, validatePin, validateRole, validateId } from '../src/validate.js';
import { buildAdminInsert } from '../tools/create-admin.mjs';
import { createTestDb } from './helpers/d1.js';

test('hashPin es determinista por sal y distinto entre sales', async () => {
  const s1 = newSalt(), s2 = newSalt();
  assert.equal(fromBase64(s1).length, 16);
  assert.equal(await hashPin('123456', s1, 1000), await hashPin('123456', s1, 1000));
  assert.notEqual(await hashPin('123456', s1, 1000), await hashPin('123456', s2, 1000));
});

test('verifyPin acepta el PIN correcto y rechaza otro', async () => {
  const salt = newSalt();
  const user = { pin_hash: await hashPin('246810', salt, 1000), pin_salt: salt, pin_iterations: 1000 };
  assert.equal(await verifyPin('246810', user), true);
  assert.equal(await verifyPin('246811', user), false);
});

test('newToken es base64url de 32 bytes y sha256Hex coincide con el vector conocido', async () => {
  const t = newToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newToken(), t);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('randomPin produce 6 dígitos', () => {
  for (let i = 0; i < 200; i++) assert.match(randomPin(), /^\d{6}$/);
});

test('timingSafeEqual y pinIterations', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'abcd'), false);
  assert.equal(pinIterations({}), 20000);
  assert.equal(pinIterations({ PIN_ITERATIONS: '50000' }), 50000);
  assert.equal(pinIterations({ PIN_ITERATIONS: '10' }), 20000);
});

test('validadores normalizan y rechazan', () => {
  assert.equal(validateUsername('  Ana.Perez '), 'ana.perez');
  assert.throws(() => validateUsername('ab'), e => e.status === 400 && e.extra.field === 'username');
  assert.throws(() => validateUsername('con espacio'), e => e.extra.field === 'username');
  assert.equal(validateDisplayName('  Ana   Pérez '), 'Ana Pérez');
  assert.throws(() => validateDisplayName(''), e => e.extra.field === 'displayName');
  assert.throws(() => validateDisplayName('x'.repeat(41)), e => e.extra.field === 'displayName');
  assert.equal(validatePin('012345'), '012345');
  assert.throws(() => validatePin('12345'), e => e.extra.field === 'pin');
  assert.throws(() => validatePin(123456, 'newPin'), e => e.extra.field === 'newPin');
  assert.equal(validateRole('admin'), 'admin');
  assert.throws(() => validateRole('root'), e => e.extra.field === 'role');
  assert.equal(validateId('7'), 7);
  assert.throws(() => validateId('x'), e => e.status === 404);
});

test('buildAdminInsert genera un INSERT ejecutable con PIN temporal (y escapa comillas)', async () => {
  const { pin, sql } = await buildAdminInsert({ username: 'jefe.cuerda', displayName: "Jefe O'Brien", iterations: 1000, now: new Date('2026-10-01T00:00:00Z'), pin: '135790' });
  assert.equal(pin, '135790');
  assert.equal(sql.includes('135790'), false, 'el PIN no aparece en claro');
  const db = createTestDb();
  db.db.exec(sql);
  const row = await db.prepare('SELECT * FROM users').first();
  assert.equal(row.username, 'jefe.cuerda');
  assert.equal(row.display_name, "Jefe O'Brien");
  assert.equal(row.role, 'admin');
  assert.equal(row.must_change_pin, 1);
  assert.equal(row.created_at, '2026-10-01T00:00:00.000Z');
  assert.equal(await verifyPin('135790', row), true);
});

test('buildAdminInsert rechaza usuario inválido', async () => {
  await assert.rejects(buildAdminInsert({ username: 'a', displayName: 'A', iterations: 1000 }), e => e.extra?.field === 'username');
});
