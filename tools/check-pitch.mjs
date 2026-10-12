// Uso: node tools/check-pitch.mjs — valida assets/pitch/*.json
import { readFileSync } from 'node:fs';

const dir = new URL('../assets/pitch/', import.meta.url);
const { songs } = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
let failed = false;
for (const id of songs) {
  const ref = JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'));
  const problems = [];
  if (ref.version !== 1) problems.push('version ≠ 1');
  if (ref.songId !== id) problems.push(`songId ${ref.songId}`);
  if (ref.hopMs !== 10) problems.push('hopMs ≠ 10');
  if (ref.frameCount !== ref.midi.length) problems.push('frameCount ≠ midi.length');
  if (!ref.notes.length) problems.push('sin notas');
  if (!ref.phrases.length) problems.push('sin frases');
  ref.phrases.forEach((p, i) => { if (p.index !== i + 1) problems.push(`frase ${i} con index ${p.index}`); });
  const last = ref.phrases.at(-1);
  if (last && last.noteTo !== ref.notes.length - 1) problems.push('las frases no cubren todas las notas');
  const warn = ref.phrases.length < 2 || ref.phrases.length > 40 ? ' ⚠ revisar número de frases' : '';
  console.log(`${problems.length ? '✗' : '✓'} ${id.padEnd(12)} ${String(ref.notes.length).padStart(4)} notas ${String(ref.phrases.length).padStart(3)} frases ${(ref.frameCount / 100).toFixed(0).padStart(4)} s${warn}${problems.length ? ' — ' + problems.join(', ') : ''}`);
  if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
