import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/app.js';
import { currentSeason, seasonRange, seasonOf, validDate, attendanceReport } from '../src/attendance.js';

test('la migración crea las tablas de asistencia', async () => {
  const t = setup();
  const { results } = await t.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('rehearsals', 'attendance') ORDER BY name").all();
  assert.deepEqual(results.map(r => r.name), ['attendance', 'rehearsals']);
});

test('temporadas: 1 de septiembre a 31 de agosto', () => {
  assert.equal(currentSeason(new Date('2026-10-14T12:00:00Z')), 2026);
  assert.equal(currentSeason(new Date('2027-08-31T23:00:00Z')), 2026);
  assert.equal(currentSeason(new Date('2027-09-01T00:00:00Z')), 2027);
  assert.deepEqual(seasonRange(2026), { from: '2026-09-01', to: '2027-08-31' });
  assert.equal(seasonOf('2026-09-01'), 2026);
  assert.equal(seasonOf('2027-08-31'), 2026);
  assert.equal(seasonOf('2026-08-31'), 2025);
});

test('validDate: días reales y como mucho 7 días en el futuro', () => {
  const now = new Date('2026-10-14T02:00:00Z'); // 13 de octubre por la noche en El Salvador
  assert.equal(validDate('2026-10-14', now), true);
  assert.equal(validDate('2026-10-21', now), true);
  assert.equal(validDate('2026-10-22', now), false);
  assert.equal(validDate('2024-02-29', now), true);
  assert.equal(validDate('2026-02-29', now), false);
  assert.equal(validDate('2026-13-01', now), false);
  assert.equal(validDate('14/10/2026', now), false);
  assert.equal(validDate(20261014, now), false);
});

const row = (user, date, status, extra = {}) => ({ user_id: user.id, display_name: user.name, username: user.name.toLowerCase(), active: 1, date, status, ...extra });
const U = { ana: { id: 1, name: 'Ana' }, beto: { id: 2, name: 'Beto' }, caro: { id: 3, name: 'Caro' }, dani: { id: 4, name: 'Dani' }, eva: { id: 5, name: 'Eva' }, fito: { id: 6, name: 'Fito' } };
const D = ['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24'];

test('reporte: %, tardanzas, mínimo, desempates e inactivos (números hechos a mano)', () => {
  const rows = [
    ...['present', 'late', 'absent', 'excused'].map((s, i) => row(U.ana, D[i], s)),
    ...D.map(d => row(U.beto, d, 'present')),
    ...['late', 'late', 'present', 'present'].map((s, i) => row(U.caro, D[i], s)),
    row(U.dani, D[3], 'present'),
    ...D.map(d => row(U.eva, d, 'present', { active: 0 })),
    row(U.fito, D[0], 'excused'), row(U.fito, D[1], 'excused'),
  ];
  const r = attendanceReport(rows, 4);
  assert.equal(r.rehearsals, 4);
  assert.equal(r.minimum, 2);
  const ana = r.people.find(p => p.user.id === 1);
  assert.deepEqual({ recorded: ana.recorded, present: ana.present, late: ana.late, absent: ana.absent, excused: ana.excused, pct: ana.attendancePct, latePct: ana.latePct, last: ana.lastAbsence },
    { recorded: 4, present: 1, late: 1, absent: 1, excused: 1, pct: 66.7, latePct: 50, last: '2026-09-17' });
  assert.deepEqual(ana.history.map(h => h.date), [...D].reverse());
  assert.equal(r.people.find(p => p.user.id === 6).attendancePct, null);
  assert.equal(r.people.find(p => p.user.id === 5).user.active, false);
  assert.deepEqual(r.people.map(p => p.user.displayName), ['Ana', 'Beto', 'Caro', 'Dani', 'Eva', 'Fito']);
  assert.deepEqual(r.leaderboard, [{ position: 1, userId: 2 }, { position: 2, userId: 3 }, { position: 3, userId: 1 }]);
  assert.deepEqual(r.belowMinimum, [{ userId: 4 }, { userId: 6 }]);
  assert.equal(r.teamAverage, 91.7);
});

test('reporte de una temporada vacía', () => {
  assert.deepEqual(attendanceReport([], 0), { rehearsals: 0, minimum: 0, teamAverage: null, people: [], leaderboard: [], belowMinimum: [] });
});

async function adminSetup() {
  const t = setup(); // reloj en 2026-10-01T10:00:00Z (temporada 2026)
  const adminId = await t.seedUser({ username: 'jefe', displayName: 'Jefe', role: 'admin' });
  const anaId = await t.seedUser({ username: 'ana', displayName: 'Ana' });
  await t.seedUser({ username: 'baja', displayName: 'Baja', active: 0 });
  const admin = await t.loginAs('jefe');
  return { ...t, adminId, anaId, admin };
}

test('crear ensayo: activos como Ausente, desactivados fuera, fecha única y válida', async () => {
  const t = await adminSetup();
  const r = await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30', note: '  Ensayo general ' } });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.rehearsal.date, r.body.rehearsal.note], ['2026-09-30', 'Ensayo general']);
  assert.deepEqual(r.body.entries.map(e => [e.user.displayName, e.status]), [['Ana', 'absent'], ['Jefe', 'absent']]);
  assert.deepEqual(Object.keys(r.body.entries[0].user).sort(), ['active', 'displayName', 'id', 'username']);
  assert.deepEqual((await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } })).body, { error: 'rehearsal_exists' });
  for (const [body, field] of [[{ date: '2026-10-09' }, 'date'], [{ date: '2026-02-30' }, 'date'], [{}, 'date'], [{ date: '2026-09-29', note: 'x'.repeat(201) }, 'note']]) {
    assert.deepEqual((await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body })).body, { error: 'invalid', field });
  }
  assert.equal((await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-10-08' } })).status, 201, 'hasta 7 días en el futuro');
});

test('listar con recuentos por temporada, de más reciente a más antiguo', async () => {
  const t = await adminSetup();
  const a = (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-10' } })).body.rehearsal.id;
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-17' } });
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-08-20' } }); // temporada 2025
  await t.call('PUT', `/api/admin/rehearsals/${a}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'late' }] } });
  const list = await t.call('GET', '/api/admin/rehearsals?season=2026', { token: t.admin });
  assert.deepEqual(list.body.rehearsals.map(r => [r.date, r.present, r.late, r.absent, r.excused]), [['2026-09-17', 0, 0, 2, 0], ['2026-09-10', 0, 1, 1, 0]]);
  assert.deepEqual((await t.call('GET', '/api/admin/rehearsals', { token: t.admin })).body.rehearsals.length, 2, 'sin season → temporada actual');
  assert.deepEqual((await t.call('GET', '/api/admin/rehearsals?season=2025', { token: t.admin })).body.rehearsals.map(r => r.date), ['2026-08-20']);
  assert.deepEqual((await t.call('GET', '/api/admin/rehearsals?season=abc', { token: t.admin })).body, { error: 'invalid', field: 'season' });
});

test('guardar estados en lote; altas posteriores entran como Ausente; validación', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } })).body.rehearsal.id;
  const nuevoId = await t.seedUser({ username: 'nuevo', displayName: 'Nuevo' });
  const r = await t.call('PUT', `/api/admin/rehearsals/${id}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }, { userId: t.adminId, status: 'excused' }] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.entries.map(e => [e.user.displayName, e.status]), [['Ana', 'present'], ['Jefe', 'excused'], ['Nuevo', 'absent']]);
  assert.equal((await t.call('PUT', `/api/admin/rehearsals/${id}/attendance`, { token: t.admin, body: { entries: [{ userId: nuevoId, status: 'late' }] } })).status, 200);
  const detail = await t.call('GET', `/api/admin/rehearsals/${id}`, { token: t.admin });
  assert.deepEqual(detail.body.entries.map(e => e.status), ['present', 'excused', 'late']);
  const bajaId = (await t.db.prepare("SELECT id FROM users WHERE username = 'baja'").first()).id;
  for (const entries of [[], [{ userId: t.anaId, status: 'tarde' }], [{ userId: 999, status: 'present' }], [{ userId: bajaId, status: 'present' }], 'x', [{ userId: String(t.anaId), status: 'present' }]]) {
    assert.deepEqual((await t.call('PUT', `/api/admin/rehearsals/${id}/attendance`, { token: t.admin, body: { entries } })).body, { error: 'invalid', field: 'entries' }, JSON.stringify(entries));
  }
  assert.equal((await t.call('PUT', '/api/admin/rehearsals/999/attendance', { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }] } })).status, 404);
});

test('editar fecha y nota; borrar exige escribir la fecha', async () => {
  const t = await adminSetup();
  const id = (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } })).body.rehearsal.id;
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-23' } });
  const e = await t.call('PATCH', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { date: '2026-09-29', note: 'Cambio de día' } });
  assert.deepEqual(e.body.rehearsal, { id, date: '2026-09-29', note: 'Cambio de día' });
  assert.deepEqual((await t.call('PATCH', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { date: '2026-09-23' } })).body, { error: 'rehearsal_exists' });
  assert.deepEqual((await t.call('PATCH', `/api/admin/rehearsals/${id}`, { token: t.admin, body: {} })).body, { error: 'invalid', field: 'body' });
  assert.deepEqual((await t.call('DELETE', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { confirmDate: '2026-09-30' } })).body, { error: 'invalid', field: 'confirmDate' });
  assert.equal((await t.call('DELETE', `/api/admin/rehearsals/${id}`, { token: t.admin, body: { confirmDate: '2026-09-29' } })).status, 204);
  assert.equal((await t.db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE rehearsal_id = ?').bind(id).first('n')), 0);
  assert.equal((await t.call('GET', `/api/admin/rehearsals/${id}`, { token: t.admin })).status, 404);
});

test('borrar un usuario borra sus registros de asistencia', async () => {
  const t = await adminSetup();
  await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date: '2026-09-30' } });
  assert.equal((await t.call('DELETE', `/api/admin/users/${t.anaId}`, { token: t.admin, body: { confirmUsername: 'ana' } })).status, 204);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE user_id = ?').bind(t.anaId).first('n'), 0);
});

test('las rutas de asistencia rechazan a un tenor (403) y sin sesión (401)', async () => {
  const t = await adminSetup();
  const tenor = await t.loginAs('ana');
  const routes = [['GET', '/api/admin/rehearsals'], ['POST', '/api/admin/rehearsals'], ['GET', '/api/admin/rehearsals/1'], ['PATCH', '/api/admin/rehearsals/1'],
    ['DELETE', '/api/admin/rehearsals/1'], ['PUT', '/api/admin/rehearsals/1/attendance'], ['GET', '/api/admin/attendance/report'], ['GET', '/api/admin/attendance/seasons']];
  for (const [method, path] of routes) {
    const body = method === 'GET' ? undefined : {};
    assert.deepEqual((await t.call(method, path, { token: tenor, body })).body, { error: 'forbidden' }, `${method} ${path}`);
    assert.equal((await t.call(method, path, { body })).status, 401, `${method} ${path} sin sesión`);
  }
});

test('reporte por API: solo ensayos de la temporada, límites de fecha y temporadas disponibles', async () => {
  const t = await adminSetup();
  const mk = async date => (await t.call('POST', '/api/admin/rehearsals', { token: t.admin, body: { date } })).body.rehearsal.id;
  const sep1 = await mk('2026-09-01');
  await mk('2026-09-08');
  const aug31 = await mk('2026-08-31'); // temporada 2025
  await t.call('PUT', `/api/admin/rehearsals/${sep1}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }, { userId: t.adminId, status: 'late' }] } });
  await t.call('PUT', `/api/admin/rehearsals/${aug31}/attendance`, { token: t.admin, body: { entries: [{ userId: t.anaId, status: 'present' }] } });
  const r = await t.call('GET', '/api/admin/attendance/report?season=2026', { token: t.admin });
  assert.deepEqual([r.body.season, r.body.from, r.body.to, r.body.rehearsals, r.body.minimum], [2026, '2026-09-01', '2027-08-31', 2, 1]);
  const ana = r.body.people.find(p => p.user.id === t.anaId);
  assert.deepEqual([ana.recorded, ana.present, ana.absent, ana.attendancePct, ana.lastAbsence], [2, 1, 1, 50, '2026-09-08']);
  assert.deepEqual(r.body.leaderboard.map(l => l.userId), [t.anaId, t.adminId], 'empate en % y asistidos → menos tardanzas primero');
  const r25 = await t.call('GET', '/api/admin/attendance/report?season=2025', { token: t.admin });
  assert.deepEqual([r25.body.rehearsals, r25.body.people.find(p => p.user.id === t.anaId).attendancePct], [1, 100]);
  const empty = await t.call('GET', '/api/admin/attendance/report?season=2030', { token: t.admin });
  assert.deepEqual([empty.body.rehearsals, empty.body.teamAverage, empty.body.people], [0, null, []]);
  assert.deepEqual((await t.call('GET', '/api/admin/attendance/report?season=1999', { token: t.admin })).body, { error: 'invalid', field: 'season' });
  assert.deepEqual((await t.call('GET', '/api/admin/attendance/seasons', { token: t.admin })).body, { seasons: [2026, 2025], current: 2026 });
});
