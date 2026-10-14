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
