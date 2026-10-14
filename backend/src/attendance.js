// Asistencia a ensayos: reglas (temporadas, fechas, reporte) y rutas de administración.
export const STATUSES = ['present', 'late', 'absent', 'excused'];
const DAY = 86_400_000;
const MAX_DAYS_AHEAD = 7;

export const currentSeason = now => (now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
export const seasonRange = season => ({ from: `${season}-09-01`, to: `${season + 1}-08-31` });

export function seasonOf(date) {
  const [y, m] = date.split('-').map(Number);
  return m >= 9 ? y : y - 1;
}

export function validDate(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const limit = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + MAX_DAYS_AHEAD * DAY;
  return d.getTime() <= limit;
}

const round1 = x => Math.round(x * 10) / 10;
const byName = (a, b) => a.user.displayName.localeCompare(b.user.displayName, 'es', { sensitivity: 'base' }) || a.user.id - b.user.id;

export function attendanceReport(rows, rehearsalCount) {
  const byUser = new Map();
  for (const r of rows) {
    let p = byUser.get(r.user_id);
    if (!p) {
      p = { user: { id: r.user_id, displayName: r.display_name, username: r.username, active: !!r.active },
        recorded: 0, present: 0, late: 0, absent: 0, excused: 0, lastAbsence: null, history: [] };
      byUser.set(r.user_id, p);
    }
    p.recorded++;
    p[r.status]++;
    p.history.push({ date: r.date, status: r.status });
    if (r.status === 'absent' && (!p.lastAbsence || r.date > p.lastAbsence)) p.lastAbsence = r.date;
  }
  const people = [...byUser.values()].map(p => {
    const attended = p.present + p.late;
    const counted = attended + p.absent;
    p.history.sort((a, b) => b.date.localeCompare(a.date));
    return { ...p, attendancePct: counted ? round1((attended / counted) * 100) : null, latePct: attended ? round1((p.late / attended) * 100) : null };
  }).sort(byName);
  const minimum = Math.ceil(rehearsalCount * 0.5);
  const active = people.filter(p => p.user.active);
  const ranked = active.filter(p => p.attendancePct !== null && p.recorded >= minimum)
    .sort((a, b) => b.attendancePct - a.attendancePct || (b.present + b.late) - (a.present + a.late) || a.late - b.late || byName(a, b));
  const pcts = active.map(p => p.attendancePct).filter(v => v !== null);
  return {
    rehearsals: rehearsalCount,
    minimum,
    teamAverage: pcts.length ? round1(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
    people,
    leaderboard: ranked.map((p, i) => ({ position: i + 1, userId: p.user.id })),
    belowMinimum: active.filter(p => !ranked.includes(p)).map(p => ({ userId: p.user.id })),
  };
}
