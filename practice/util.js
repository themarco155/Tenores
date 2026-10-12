export const hzToMidi = hz => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);

const isNum = v => v != null && !Number.isNaN(v);

export function median(values) {
  const a = values.filter(isNum).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function mean(values) {
  const a = values.filter(isNum);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

export function weightedMean(pairs) {
  let sum = 0, weight = 0;
  for (const [v, w] of pairs) if (isNum(v)) { sum += v * w; weight += w; }
  return weight ? sum / weight : null;
}

export function lin(x, ok, bad) {
  if (x <= ok) return 100;
  if (x >= bad) return 0;
  return (100 * (bad - x)) / (bad - ok);
}

export const round2 = x => Math.round(x * 100) / 100;

export function formatTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function medianFilter(values, size) {
  const h = size >> 1;
  return values.map((v, k) => (v == null ? null : median(values.slice(Math.max(0, k - h), k + h + 1))));
}
