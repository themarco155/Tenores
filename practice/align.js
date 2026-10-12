export const ALIGN = {
  nullCost: 1,       // un lado con voz y el otro no
  maxCost: 3,        // semitonos máximos por frame
  stepPenalty: 0.05, // penaliza deformar el tiempo para preferir la diagonal
  minRun: 5,         // frames seguidos con voz para detectar el inicio
};

export function downsample2(midi) {
  const out = new Array(Math.ceil(midi.length / 2));
  for (let i = 0; i < out.length; i++) {
    const a = midi[2 * i];
    const b = 2 * i + 1 < midi.length ? midi[2 * i + 1] : null;
    out[i] = a == null ? (b ?? null) : b == null ? a : (a + b) / 2;
  }
  return out;
}

export function frameCost(a, b) {
  if (a == null && b == null) return 0;
  if (a == null || b == null) return ALIGN.nullCost;
  const d = Math.abs(a - b);
  return Math.min(d, Math.abs(d - 12), ALIGN.maxCost);
}

export function firstVoicedRun(midi, minRun = ALIGN.minRun) {
  let run = 0;
  for (let i = 0; i < midi.length; i++) {
    run = midi[i] == null ? 0 : run + 1;
    if (run >= minRun) return i - minRun + 1;
  }
  return 0;
}

export function align(user, ref, { bandFrames }) {
  const u = downsample2(user), r = downsample2(ref);
  const N = u.length, M = r.length;
  if (!N || !M) return [];
  const band = Math.max(2, Math.ceil(bandFrames / 2));
  const lag = firstVoicedRun(u) - firstVoicedRun(r);
  const width = 2 * band + 1;
  const D = new Float32Array(N * width).fill(Infinity);
  const dir = new Uint8Array(N * width); // 0 inicio · 1 diagonal · 2 avanza usuario · 3 avanza referencia
  const at = (i, j) => {
    const k = j - (i - lag) + band;
    return k < 0 || k >= width ? -1 : i * width + k;
  };
  const P = ALIGN.stepPenalty;

  for (let i = 0; i < N; i++) {
    const lo = Math.max(0, i - lag - band), hi = Math.min(M - 1, i - lag + band);
    for (let j = lo; j <= hi; j++) {
      const idx = at(i, j);
      const c = frameCost(u[i], r[j]);
      if (j === 0) { D[idx] = c; dir[idx] = 0; continue; }
      let best = Infinity, d = 0, k;
      if (i > 0 && (k = at(i - 1, j - 1)) >= 0 && D[k] < best) { best = D[k]; d = 1; }
      if (i > 0 && (k = at(i - 1, j)) >= 0 && D[k] + P < best) { best = D[k] + P; d = 2; }
      if ((k = at(i, j - 1)) >= 0 && D[k] + P < best) { best = D[k] + P; d = 3; }
      D[idx] = best + c;
      dir[idx] = d;
    }
  }

  let endI = -1, endCost = Infinity;
  for (let i = 0; i < N; i++) {
    const k = at(i, M - 1);
    if (k >= 0 && D[k] < endCost) { endCost = D[k]; endI = i; }
  }
  if (endI < 0) return [];

  const cells = [];
  let i = endI, j = M - 1;
  for (;;) {
    cells.push([i, j]);
    const d = dir[at(i, j)];
    if (j === 0 || d === 0) break;
    if (d === 1) { i--; j--; } else if (d === 2) i--; else j--;
  }
  cells.reverse();

  const path = [];
  for (const [ci, cj] of cells) {
    for (let s = 0; s < 2; s++) {
      const uu = 2 * ci + s, rr = 2 * cj + s;
      if (uu < user.length && rr < ref.length) path.push([uu, rr]);
    }
  }
  return path;
}
