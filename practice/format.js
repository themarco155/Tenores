const DAY = 86_400_000;

export const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const METRIC_LABELS = { pitch: 'Afinación', rhythm: 'Ritmo y entradas', stability: 'Estabilidad' };

export const modeLabel = mode => (mode === 'test' ? 'A prueba' : 'Con guía');

export function rangeLabel(a) {
  if (a.isFull) return 'Completa';
  return a.phraseFrom === a.phraseTo ? `Frase ${a.phraseFrom}` : `Frases ${a.phraseFrom}–${a.phraseTo}`;
}

export function trendSymbol(t) {
  if (t == null) return '–';
  if (t > 0) return `↑ ${t}`;
  if (t < 0) return `↓ ${Math.abs(t)}`;
  return '= 0';
}

export function seasonStart(now = new Date()) {
  const year = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 8, 1));
}

export function sinceFor(period, now = new Date()) {
  if (period === '7d') return new Date(now.getTime() - 7 * DAY).toISOString();
  if (period === '30d') return new Date(now.getTime() - 30 * DAY).toISOString();
  return seasonStart(now).toISOString();
}

export function daysSince(iso, now = new Date()) {
  return iso ? Math.floor((now.getTime() - Date.parse(iso)) / DAY) : null;
}

export const formatDateTime = iso => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatDate = iso => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

export function songTitle(id) {
  return (typeof SONGS !== 'undefined' && SONGS[id] && SONGS[id].title) || id;
}
