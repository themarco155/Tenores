import { detectPitch, PITCH } from './pitch.js';
import { segmentNotes, segmentPhrases } from './segment.js';
import { round2 } from './util.js';

export function referenceFromCurve({ songId, source = '', midi }) {
  const rounded = midi.map(v => (v == null ? null : round2(v)));
  const notes = segmentNotes(rounded);
  return {
    version: 1,
    songId,
    source,
    hopMs: PITCH.hopMs,
    frameCount: rounded.length,
    midi: rounded,
    notes,
    phrases: segmentPhrases(notes),
  };
}

export function buildReference({ songId, source, samples, sampleRate }) {
  return referenceFromCurve({ songId, source, midi: detectPitch(samples, sampleRate).midi });
}

export function sliceReference(ref, phraseFrom, phraseTo) {
  const count = ref.phrases.length;
  if (!count) throw new Error('La referencia no tiene frases');
  const from = Math.min(Math.max(1, Math.trunc(phraseFrom) || 1), count);
  const to = Math.min(Math.max(from, Math.trunc(phraseTo) || from), count);
  const first = ref.phrases[from - 1];
  const last = ref.phrases[to - 1];
  const offset = first.start;
  const notes = ref.notes
    .slice(first.noteFrom, last.noteTo + 1)
    .map(n => ({ start: n.start - offset, end: n.end - offset, midi: n.midi }));
  const phrases = ref.phrases.slice(from - 1, to).map(p => ({
    index: p.index,
    start: p.start - offset,
    end: p.end - offset,
    noteFrom: p.noteFrom - first.noteFrom,
    noteTo: p.noteTo - first.noteFrom,
  }));
  return {
    songId: ref.songId,
    hopMs: ref.hopMs,
    offsetFrames: offset,
    startSec: (offset * ref.hopMs) / 1000,
    endSec: (last.end * ref.hopMs) / 1000,
    phraseFrom: from,
    phraseTo: to,
    isFull: from === 1 && to === count,
    midi: ref.midi.slice(offset, last.end),
    notes,
    phrases,
  };
}
