import { SCORING } from './scoring-config.js';
import { buildTips } from './tips.js';
import { lin, median, mean, weightedMean, round2 } from './util.js';

export { SCORING };

function analyzeNote(note, user, ref, byRef, hopMs) {
  let a = note.start + SCORING.coreStartFrames, b = note.end - SCORING.coreEndFrames;
  if (b <= a) { a = note.start; b = note.end; }
  let pairs = 0, voiced = 0;
  const diffs = [];
  for (let r = a; r < b; r++) {
    for (const u of byRef[r] || []) {
      pairs++;
      if (user[u] != null) {
        voiced++;
        if (ref[r] != null) diffs.push((user[u] - ref[r]) * 100);
      }
    }
  }
  const out = {
    note, duration: note.end - note.start, sung: pairs > 0 && voiced / pairs >= SCORING.voicedRatio && diffs.length > 0,
    dev: null, octave: false, pitch: null, onsetRefMs: null, onsetUserMs: null, offsetMs: null, rhythm: null,
    sd: null, drift: null, stability: null,
  };
  if (!out.sung) return out;

  out.dev = median(diffs);
  out.octave = Math.abs(out.dev) > SCORING.octaveCents;
  out.pitch = out.octave ? 0 : lin(Math.abs(out.dev), ...SCORING.pitchCents);

  let r0 = note.start;
  while (r0 < note.end && !(byRef[r0] && byRef[r0].length)) r0++;
  if (r0 < note.end) { out.onsetRefMs = r0 * hopMs; out.onsetUserMs = byRef[r0][0] * hopMs; }

  if (b - a >= SCORING.longNoteFrames && diffs.length >= 8) {
    const avg = mean(diffs);
    const sd = Math.sqrt(mean(diffs.map(d => (d - avg) ** 2)));
    const q = Math.max(1, Math.floor(diffs.length / 4));
    const drift = mean(diffs.slice(-q)) - mean(diffs.slice(0, q));
    out.sd = sd;
    out.drift = drift;
    out.stability = Math.min(lin(sd, ...SCORING.stabilityCents), lin(Math.abs(drift), ...SCORING.stabilityCents));
  }
  return out;
}

function rhythmOffsets(notes, mode) {
  const timed = notes.filter(n => n.sung && n.onsetRefMs != null);
  if (mode === 'guide') {
    const lim = SCORING.guideLatencyMs;
    const latency = Math.max(-lim, Math.min(lim, median(timed.map(n => n.onsetUserMs - n.onsetRefMs)) ?? 0));
    for (const n of timed) n.offsetMs = n.onsetUserMs - n.onsetRefMs - latency;
  } else if (timed.length < 2) {
    for (const n of timed) n.offsetMs = 0;
  } else {
    // Ajuste t_usuario = a·t_ref + b; el residuo es el error de ritmo.
    const xs = timed.map(n => n.onsetRefMs), ys = timed.map(n => n.onsetUserMs);
    const mx = mean(xs), my = mean(ys);
    let sxx = 0, sxy = 0;
    xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
    const slope = sxx ? sxy / sxx : 1, icpt = my - slope * mx;
    for (const n of timed) n.offsetMs = n.onsetUserMs - (slope * n.onsetRefMs + icpt);
  }
  for (const n of timed) n.rhythm = lin(Math.abs(n.offsetMs), ...SCORING.rhythmMs);
}

function aggregate(notes) {
  const total = notes.reduce((s, n) => s + n.duration, 0);
  const sung = notes.filter(n => n.sung);
  return {
    coverage: total ? sung.reduce((s, n) => s + n.duration, 0) / total : 0,
    pitch: weightedMean(sung.map(n => [n.pitch, n.duration])) ?? 0,
    rhythm: mean(sung.map(n => n.rhythm)) ?? 0,
    stability: mean(sung.map(n => n.stability)),
  };
}

// Media ponderada de las métricas disponibles (sin estabilidad si no hay notas largas).
function totalScore({ coverage, pitch, rhythm, stability }) {
  const w = SCORING.weights;
  const parts = [[w.pitch, pitch], [w.rhythm, rhythm]];
  if (stability != null) parts.push([w.stability, stability]);
  const weight = parts.reduce((s, [wi]) => s + wi, 0);
  const base = parts.reduce((s, [wi, v]) => s + wi * v, 0) / weight;
  return base * Math.min(1, coverage / SCORING.fullCoverage);
}

const roundOrNull = v => (v == null ? null : Math.round(v));

export function score(user, slice, path, mode) {
  const hopMs = slice.hopMs;
  const byRef = Array.from({ length: slice.midi.length }, () => []);
  for (const [u, r] of path) if (r < byRef.length) byRef[r].push(u);

  const notes = slice.notes.map(n => analyzeNote(n, user, slice.midi, byRef, hopMs));
  rhythmOffsets(notes, mode);
  const agg = aggregate(notes);

  const phrases = slice.phrases.map(p => {
    const a = aggregate(notes.slice(p.noteFrom, p.noteTo + 1));
    return {
      index: p.index,
      start: round2(slice.startSec + (p.start * hopMs) / 1000),
      end: round2(slice.startSec + (p.end * hopMs) / 1000),
      pitch: Math.round(a.pitch),
      rhythm: Math.round(a.rhythm),
      stability: roundOrNull(a.stability),
      coverage: round2(a.coverage),
    };
  });

  const scores = {
    total: Math.round(totalScore(agg)),
    pitch: Math.round(agg.pitch),
    rhythm: Math.round(agg.rhythm),
    stability: roundOrNull(agg.stability),
  };
  const valid = agg.coverage >= SCORING.minCoverage;
  const tips = valid ? buildTips({ notes, phrases: slice.phrases, phraseResults: phrases, scores, hopMs, mode }) : [];
  const userCurve = byRef.map(us => {
    const m = median(us.map(u => user[u]));
    return m == null ? null : round2(m);
  });

  return {
    valid,
    coverage: round2(agg.coverage),
    scores,
    phrases,
    tips,
    curves: { hopMs, startSec: slice.startSec, ref: slice.midi, user: userCurve },
  };
}
