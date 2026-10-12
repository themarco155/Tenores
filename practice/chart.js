export function toSegments(values, step = 1) {
  const segments = [];
  let current = null;
  for (let i = 0; i < values.length; i += step) {
    const v = values[i];
    if (v == null) { current = null; continue; }
    if (!current) { current = []; segments.push(current); }
    current.push([i, v]);
  }
  return segments;
}

function fill(score) {
  if (score == null) return 'var(--chart-neutral)';
  if (score >= 80) return 'var(--chart-good)';
  if (score >= 60) return 'var(--chart-warn)';
  return 'var(--chart-bad)';
}

export function renderChart(curves, phrases = []) {
  const { ref, user, hopMs, startSec } = curves;
  const n = ref.length;
  if (!n) return '';
  let lo = Infinity, hi = -Infinity;
  for (const v of user ? ref.concat(user) : ref) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (lo === Infinity) { lo = 48; hi = 72; }
  lo = Math.floor(lo) - 1;
  hi = Math.ceil(hi) + 1;

  const W = 1000, H = 220;
  const x = i => (i / Math.max(1, n - 1)) * W;
  const y = v => H - ((v - lo) / (hi - lo)) * H;
  const lines = (values, cls) => toSegments(values, 2)
    .map(seg => `<polyline class="${cls}" points="${seg.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`)
    .join('');
  const bands = phrases.map(p => {
    const a = x(((p.start - startSec) * 1000) / hopMs);
    const b = x(((p.end - startSec) * 1000) / hopMs);
    return `<rect class="chart-phrase" x="${a.toFixed(1)}" y="0" width="${Math.max(0, b - a).toFixed(1)}" height="${H}" style="fill:${fill(p.pitch)}"/>`;
  }).join('');

  return `<svg class="practice-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Curva de afinación: referencia y tu voz">${bands}${lines(ref, 'chart-ref')}${user ? lines(user, 'chart-user') : ''}</svg>`;
}
