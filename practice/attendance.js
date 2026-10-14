// Utilidades de la asistencia en el panel (sin DOM): textos, fechas y cola de guardado automático.
export const STATUSES = ['present', 'late', 'absent', 'excused'];
export const STATUS_LABELS = { present: 'Presente', late: 'Tarde', absent: 'Ausente', excused: 'Justificado' };
const COUNT_WORDS = { present: ['presente', 'presentes'], late: ['tarde', 'tardes'], absent: ['ausente', 'ausentes'], excused: ['justificado', 'justificados'] };

export function countEntries(entries) {
  const c = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const e of entries) c[e.status]++;
  return c;
}

export const countsLabel = c => STATUSES.map(s => `${c[s]} ${COUNT_WORDS[s][c[s] === 1 ? 0 : 1]}`).join(' · ');

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function seasonOfDate(date) {
  const [y, m] = date.split('-').map(Number);
  return m >= 9 ? y : y - 1;
}

export const seasonLabel = season => `${season}–${season + 1}`;

export const formatRehearsalDate = date =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Guarda los cambios de estado agrupados: espera `delay` ms tras el último toque y envía el último estado de cada
// persona. Si el envío falla, los cambios vuelven a la cola (sin pisar uno más nuevo) hasta que se llame a flush().
export function createSaveQueue({ send, delay = 500, onState = () => {}, timers = { set: setTimeout, clear: clearTimeout } }) {
  const pending = new Map();
  let timer = null;
  let inflight = null;

  const schedule = () => {
    timers.clear(timer);
    timer = timers.set(() => { timer = null; flush().catch(() => {}); }, delay);
  };

  function flush() {
    timers.clear(timer);
    timer = null;
    if (inflight) return inflight;
    if (!pending.size) return Promise.resolve();
    const batch = [...pending].map(([userId, status]) => ({ userId, status }));
    pending.clear();
    onState('saving');
    inflight = (async () => {
      let ok = false;
      try {
        const result = await send(batch);
        ok = true;
        onState(pending.size ? 'pending' : 'saved');
        return result;
      } catch (err) {
        for (const e of batch) if (!pending.has(e.userId)) pending.set(e.userId, e.status);
        onState('error', err);
        throw err;
      } finally {
        inflight = null;
        if (ok && pending.size) schedule();
      }
    })();
    return inflight;
  }

  // Al cerrar: espera el envío en curso y manda lo que quede, hasta vaciar la cola. Si algo falla, rechaza y los
  // cambios siguen en `pendingCount` para poder avisar.
  async function drain() {
    do { await flush(); } while (pending.size);
  }

  return {
    set(userId, status) {
      pending.set(userId, status);
      onState('pending');
      if (!inflight) schedule();
    },
    flush,
    drain,
    get pendingCount() { return pending.size; },
  };
}

// Evita abrir dos veces lo mismo con un doble toque: mientras la primera llamada sigue en curso, las demás no hacen nada.
export function singleFlight(fn) {
  let busy = false;
  return async (...args) => {
    if (busy) return undefined;
    busy = true;
    try { return await fn(...args); } finally { busy = false; }
  };
}
