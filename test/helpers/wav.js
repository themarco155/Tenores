import { readFileSync } from 'node:fs';

export function readWav(path) {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('No es un WAV');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = { format: dv.getUint16(off + 8, true), channels: dv.getUint16(off + 10, true), sampleRate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
    }
    if (id === 'data') data = { start: off + 8, size: Math.min(size, buf.length - off - 8) };
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data || ![1, 0xfffe].includes(fmt.format) || fmt.bits !== 16) throw new Error('Solo se admite PCM de 16 bits');
  const frames = Math.floor(data.size / (2 * fmt.channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += dv.getInt16(data.start + 2 * (i * fmt.channels + c), true);
    samples[i] = s / fmt.channels / 32768;
  }
  return { samples, sampleRate: fmt.sampleRate };
}
