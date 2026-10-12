import { median, round2, medianFilter } from './util.js';

export const SEGMENT = {
  jump: 0.5,          // semitonos para considerar cambio de nota
  persist: 3,         // frames que debe mantenerse el cambio
  refWindow: 10,      // frames recientes que definen la altura actual
  minNoteFrames: 6,   // 60 ms
  gapFrames: 30,      // silencio de 300 ms separa frases
  minPhraseFrames: 100, // frases de menos de 1 s se fusionan
};

export function segmentNotes(midi) {
  const s = medianFilter(midi, 5);
  const raw = [];
  let start = -1;
  const close = end => { if (start >= 0 && end > start) raw.push({ start, end }); start = -1; };

  for (let k = 0; k < s.length; k++) {
    if (s[k] == null) { close(k); continue; }
    if (start < 0) { start = k; continue; }
    const ref = median(s.slice(Math.max(start, k - SEGMENT.refWindow), k));
    let changed = true;
    for (let j = k; j < k + SEGMENT.persist; j++) {
      if (j >= s.length || s[j] == null || Math.abs(s[j] - ref) <= SEGMENT.jump) { changed = false; break; }
    }
    if (changed) { close(k); start = k; }
  }
  close(s.length);

  // Tramos cortos pegados a otro se absorben.
  const joined = [];
  for (const n of raw) {
    const prev = joined[joined.length - 1];
    const touching = prev && prev.end === n.start;
    if (touching && (n.end - n.start < SEGMENT.minNoteFrames || prev.end - prev.start < SEGMENT.minNoteFrames)) {
      prev.end = n.end;
      continue;
    }
    joined.push({ ...n });
  }

  // Se descartan los tramos cortos aislados y se fusionan notas contiguas de la misma altura.
  const out = [];
  for (const n of joined) {
    if (n.end - n.start < SEGMENT.minNoteFrames) continue;
    const pitch = median(midi.slice(n.start, n.end));
    const prev = out[out.length - 1];
    if (prev && prev.end === n.start && Math.abs(prev.midi - pitch) < SEGMENT.jump) {
      prev.end = n.end;
      prev.midi = median(midi.slice(prev.start, prev.end));
      continue;
    }
    out.push({ start: n.start, end: n.end, midi: pitch });
  }
  return out.map(n => ({ start: n.start, end: n.end, midi: round2(n.midi) }));
}

export function segmentPhrases(notes) {
  const groups = [];
  notes.forEach((n, i) => {
    const g = groups[groups.length - 1];
    if (g && n.start - notes[i - 1].end < SEGMENT.gapFrames) { g.end = n.end; g.noteTo = i; }
    else groups.push({ start: n.start, end: n.end, noteFrom: i, noteTo: i });
  });

  const merged = [];
  for (let i = 0; i < groups.length; i++) {
    const g = { ...groups[i] };
    while (g.end - g.start < SEGMENT.minPhraseFrames && i + 1 < groups.length) {
      const next = groups[++i];
      g.end = next.end;
      g.noteTo = next.noteTo;
    }
    if (g.end - g.start < SEGMENT.minPhraseFrames && merged.length) {
      const prev = merged[merged.length - 1];
      prev.end = g.end;
      prev.noteTo = g.noteTo;
      continue;
    }
    merged.push(g);
  }
  return merged.map((g, i) => ({ index: i + 1, start: g.start, end: g.end, noteFrom: g.noteFrom, noteTo: g.noteTo }));
}
