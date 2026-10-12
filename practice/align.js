export const ALIGN = {
  nullCost: 1,       // un lado con voz y el otro no
  maxCost: 3,        // semitonos máximos por frame
  stepPenalty: 0.4, // penaliza deformar el tiempo para preferir la diagonal
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
  // Solo se guardan dos filas de costes (anterior y actual); las direcciones sí
  // ocupan N × width bytes para reconstruir el camino.
  let prev = new Float32Array(width), cur = new Float32Array(width);
  const dir = new Uint8Array(N * width); // 0 inicio · 1 diagonal · 2 avanza usuario · 3 avanza referencia
  const at = (i, j) => {
    const k = j - (i - lag) + band;
    return k < 0 || k >= width ? -1 : i * width + k;
  };
  const P = ALIGN.stepPenalty;

  // Fin del camino. Candidato A: el mejor (i, M−1), la toma llega al final de la
  // referencia. Candidato B: el mejor (N−1, j), la toma se detuvo antes (Detener o
  // corte del modo prueba). La cola de referencia que B deja sin emparejar se cobra
  // como si se cantara en silencio: frameCost(null, r[j]) por frame, lo mismo que
  // cuesta en el DTW un frame de referencia sin voz del usuario. Se elige B solo si
  // es estrictamente más barato; así, cuando la toma cubre el rango, el resultado
  // no cambia, y cuando se cortó no se comprimen las notas no cantadas sobre los
  // últimos frames del usuario. Las notas tras el final quedan sin cantar.
  const tail = new Float64Array(M); // tail[j] = coste de dejar sin emparejar r[j+1..M−1]
  for (let j = M - 2; j >= 0; j--) tail[j] = tail[j + 1] + frameCost(null, r[j + 1]);
  let endI = -1, endJ = M - 1, endCost = Infinity;

  prev.fill(Infinity);
  for (let i = 0; i < N; i++) {
    cur.fill(Infinity);
    const off = band - (i - lag); // columna en la fila = j + off
    const lo = Math.max(0, i - lag - band), hi = Math.min(M - 1, i - lag + band);
    for (let j = lo; j <= hi; j++) {
      const k = j + off, idx = i * width + k;
      const c = frameCost(u[i], r[j]);
      if (j === 0) { cur[k] = c; dir[idx] = 0; continue; }
      let best = Infinity, d = 0;
      // (i−1, j−1) → misma columna; (i−1, j) → k+1; (i, j−1) → k−1
      if (i > 0 && prev[k] < best) { best = prev[k]; d = 1; }
      if (i > 0 && k + 1 < width && prev[k + 1] + P < best) { best = prev[k + 1] + P; d = 2; }
      if (k > 0 && cur[k - 1] + P < best) { best = cur[k - 1] + P; d = 3; }
      cur[k] = best + c;
      dir[idx] = d;
    }
    const kEnd = M - 1 + off;
    if (kEnd >= 0 && kEnd < width && cur[kEnd] < endCost) { endCost = cur[kEnd]; endI = i; }
    if (i < N - 1) [prev, cur] = [cur, prev];
  }
  for (let j = 0; j < M - 1; j++) {
    const k = j + band - (N - 1 - lag);
    if (k >= 0 && k < width && cur[k] + tail[j] < endCost) { endCost = cur[k] + tail[j]; endI = N - 1; endJ = j; }
  }
  if (endI < 0) return [];

  const cells = [];
  let i = endI, j = endJ;
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
