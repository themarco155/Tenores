import { modeLabel, esc } from './format.js';

const W = 600, H = 180, PAD = 28;

export function renderProgressChart(attempts) {
  const points = attempts
    .map(a => ({ t: Date.parse(a.createdAt), v: a.scores?.total, mode: a.mode === 'test' ? 'test' : 'guide' }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((p, q) => p.t - q.t);
  if (!points.length) return '';
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = t => (t1 === t0 ? W / 2 : PAD + ((t - t0) / (t1 - t0)) * (W - 2 * PAD));
  const y = v => H - PAD - (v / 100) * (H - 2 * PAD);
  const grid = [0, 50, 80, 100].map(v =>
    `<line class="progress-grid" x1="${PAD}" x2="${W - PAD}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="progress-axis" x="4" y="${(y(v) + 4).toFixed(1)}">${v}</text>`).join('');
  const series = ['guide', 'test'].map(mode => {
    const pts = points.filter(p => p.mode === mode);
    const line = pts.length >= 2
      ? `<polyline class="progress-line--${mode}" points="${pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`
      : '';
    const dots = pts.map(p => `<circle class="progress-dot--${mode}" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4"><title>${esc(modeLabel(mode))}: ${esc(p.v)}</title></circle>`).join('');
    return line + dots;
  }).join('');
  return `<svg class="progress-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la puntuación">${grid}${series}</svg>`;
}
