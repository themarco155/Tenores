import { noteName, deviationCents } from './live-pitch.js';

// Pista estilo karaoke del indicador en vivo: cálculos puros y dibujo en canvas.
export const TRACK = { pastSec: 1.5, futureSec: 3, minSpan: 7, margin: 1, ease: 0.2, gapSec: 0.25 };
const COLORS = { ok: '#0ffc7e', warn: '#ffc400', bad: '#ff5c5c', none: '#9ba3b1', bar: '#2a3a30', label: '#7f8b86',
  current: '#1f6b45', now: 'rgba(255,255,255,.7)' };

// Notas de la referencia (en segundos) que caen en la ventana alrededor de `te`, recortadas al fragmento.
export function visibleNotes(ref, te, endFrame = Infinity, startFrame = 0) {
  const hop = ref.hopMs / 1000;
  const from = te - TRACK.pastSec, to = te + TRACK.futureSec;
  return ref.notes
    .filter(n => n.start < endFrame && n.end > startFrame)
    .map(n => ({ start: Math.max(n.start, startFrame) * hop, end: Math.min(n.end, endFrame) * hop, midi: n.midi }))
    .filter(n => n.end > from && n.start < to)
    .map(n => ({ ...n, current: n.start <= te && te < n.end }));
}

export function foldToTarget(user, target) {
  if (user == null) return null;
  if (target == null) return user;
  return target + deviationCents(user, target) / 100;
}

// Lecturas recientes de la voz; entre notas se pliegan a la octava de la última nota para que la línea no salte.
export function createTrail() {
  const points = [];
  let lastTarget = null;
  return {
    points,
    push(te, user, target, state) {
      if (target != null) lastTarget = target;
      points.push({ te, midi: foldToTarget(user, target ?? lastTarget), state });
      while (points.length && points[0].te < te - TRACK.pastSec) points.shift();
    },
  };
}

export function targetScale(notes, prev) {
  if (!notes.length) return prev;
  const lo = Math.min(...notes.map(n => n.midi)) - TRACK.margin;
  const hi = Math.max(...notes.map(n => n.midi)) + TRACK.margin;
  return { center: (lo + hi) / 2, span: Math.max(TRACK.minSpan, hi - lo) };
}

export function stepScale(current, target, ease = TRACK.ease) {
  if (!current) return target;
  if (!target) return current;
  const r = x => Math.round(x * 1000) / 1000;
  return { center: r(current.center + (target.center - current.center) * ease), span: r(current.span + (target.span - current.span) * ease) };
}

export const timeToX = (t, te, width) => (width * (TRACK.pastSec + (t - te))) / (TRACK.pastSec + TRACK.futureSec);
export const midiToY = (midi, scale, height) => height * (0.5 - (midi - scale.center) / scale.span);

export function drawTrack(g, { width, height, te, notes, points, scale }) {
  g.clearRect(0, 0, width, height);
  const nowX = timeToX(te, te, width);
  g.font = '11px system-ui, sans-serif';
  for (const n of notes) {
    const x0 = Math.max(0, timeToX(n.start, te, width)), x1 = Math.min(width, timeToX(n.end, te, width));
    const y = midiToY(n.midi, scale, height);
    g.fillStyle = n.current ? COLORS.current : COLORS.bar;
    const w = Math.max(4, x1 - x0);
    if (g.roundRect) {
      g.beginPath();
      g.roundRect(x0, y - 5, w, 10, 5);
      g.fill();
      if (n.current) { g.strokeStyle = COLORS.ok; g.lineWidth = 1.5; g.stroke(); }
    } else { // Safari < 16
      g.fillRect(x0, y - 5, w, 10);
      if (n.current) { g.strokeStyle = COLORS.ok; g.lineWidth = 1.5; g.strokeRect(x0, y - 5, w, 10); }
    }
    g.fillStyle = n.current ? COLORS.ok : COLORS.label;
    g.fillText(noteName(n.midi), x0 + 2, y - 8);
  }
  g.strokeStyle = COLORS.now;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(nowX, 0); g.lineTo(nowX, height); g.stroke();
  g.setLineDash([]);
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.midi == null || b.midi == null || b.te - a.te > TRACK.gapSec) continue;
    g.strokeStyle = COLORS[b.state] || COLORS.none;
    g.beginPath();
    g.moveTo(timeToX(a.te, te, width), midiToY(a.midi, scale, height));
    g.lineTo(timeToX(b.te, te, width), midiToY(b.midi, scale, height));
    g.stroke();
  }
  const last = points[points.length - 1];
  if (last && last.midi != null && te - last.te < TRACK.gapSec) {
    g.fillStyle = COLORS[last.state] || COLORS.none;
    g.beginPath(); g.arc(timeToX(last.te, te, width), midiToY(last.midi, scale, height), 5, 0, Math.PI * 2); g.fill();
  }
}
