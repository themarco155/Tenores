import { buildReference } from './reference.js';

// Calcula en el navegador la referencia de notas de un audio (mismo motor que tools/build-pitch.html).
export class ReferenceBuildError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function mixDown(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

const decodeAudio = data => new OfflineAudioContext(1, 1, 48000).decodeAudioData(data);

export async function referenceFromUrl(songId, url, { onStage = () => {}, fetchImpl = globalThis.fetch, decode = decodeAudio } = {}) {
  onStage('download');
  let data;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.arrayBuffer();
  } catch {
    throw new ReferenceBuildError('download', 'No se pudo descargar el audio. Revisa el enlace.');
  }
  onStage('analyze');
  await new Promise(r => setTimeout(r)); // deja pintar el aviso antes del análisis, que bloquea un momento
  let buffer;
  try { buffer = await decode(data); } catch { throw new ReferenceBuildError('decode', 'El enlace no contiene un audio válido.'); }
  const ref = buildReference({ songId, source: url, samples: mixDown(buffer), sampleRate: buffer.sampleRate });
  if (!ref.phrases.length) throw new ReferenceBuildError('no_phrases', 'No se detectaron notas en el audio.');
  return ref;
}
