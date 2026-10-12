// Melodía de prueba: 3 frases separadas por silencios de 400 ms.
export const MELODY = [
  [57, 40], [59, 40], [60, 60], [62, 40], [null, 40],
  [64, 50], [62, 50], [60, 80], [null, 40],
  [59, 40], [57, 100], [null, 20],
];

export function curve(spec) {
  const out = [];
  for (const [m, n] of spec) for (let i = 0; i < n; i++) out.push(m);
  return out;
}
