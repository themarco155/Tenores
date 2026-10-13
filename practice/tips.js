import { SCORING } from './scoring-config.js';
import { lin, median, mean, formatTime } from './util.js';

const round5 = x => Math.round(x / 5) * 5;
const seconds = ms => (Math.abs(ms) / 1000).toFixed(1).replace('.', ',');

export function buildTips({ notes, phrases, phraseResults, scores, hopMs, mode }) {
  const T = SCORING.tips;
  const sec = frames => (frames * hopMs) / 1000;
  const candidates = [];

  phrases.forEach((p, i) => {
    const pr = phraseResults[i];
    const pn = notes.slice(p.noteFrom, p.noteTo + 1);
    const sung = pn.filter(n => n.sung);
    const durSec = pr.end - pr.start;
    const label = `Frase ${pr.index} (${formatTime(pr.start)}–${formatTime(pr.end)})`;

    const octaveNotes = sung.filter(n => n.octave);
    if (octaveNotes.length) {
      const below = median(octaveNotes.map(n => n.dev)) < 0;
      candidates.push({
        kind: 'octave', phrase: pr.index,
        priority: 100 * sec(octaveNotes.reduce((s, n) => s + n.duration, 0)),
        text: `Frase ${pr.index}: estás cantando una octava por ${below ? 'debajo' : 'encima'}.`,
      });
    }

    const bias = median(sung.filter(n => !n.octave).map(n => n.dev));
    if (bias != null && Math.abs(bias) > T.biasCents) {
      candidates.push({
        kind: 'pitch-bias', phrase: pr.index,
        priority: (100 - lin(Math.abs(bias), ...SCORING.pitchCents)) * durSec,
        text: `${label}: tiendes a quedarte ~${round5(Math.abs(bias))} cents ${bias < 0 ? 'bajo' : 'alto'}.`,
      });
    }

    const first = pn[0];
    if (first && first.sung && first.offsetMs != null && Math.abs(first.offsetMs) > T.entryMs) {
      candidates.push({
        kind: 'entry', phrase: pr.index,
        priority: (100 - lin(Math.abs(first.offsetMs), ...SCORING.rhythmMs)) * durSec,
        text: `Entras ${seconds(first.offsetMs)} s ${first.offsetMs > 0 ? 'tarde' : 'antes de tiempo'} en la frase ${pr.index}.`,
      });
    }

    if (pr.coverage < T.missedCoverage) {
      candidates.push({
        kind: 'missed', phrase: pr.index,
        priority: (1 - pr.coverage) * 100 * durSec,
        text: `Frase ${pr.index}: faltan notas; repásala con la guía.`,
      });
    }
  });

  const drifting = notes.filter(n => n.drift != null && Math.abs(n.drift) > T.driftCents);
  const down = drifting.filter(n => n.drift < 0), up = drifting.filter(n => n.drift > 0);
  const group = down.length >= up.length ? down : up;
  if (group.length >= T.driftNotes) {
    const avg = mean(group.map(n => Math.abs(n.drift)));
    candidates.push({
      kind: 'drift', phrase: null,
      priority: (100 - lin(avg, ...SCORING.stabilityCents)) * sec(group.reduce((s, n) => s + n.duration, 0)),
      text: `En las notas largas ${group === down ? 'caes' : 'subes'} ~${round5(avg)} cents al final.`,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const tips = candidates.slice(0, T.max).map(({ kind, phrase, text }) => ({ kind, phrase, text }));
  if (!tips.length && scores.total >= T.praiseTotal) {
    const text = mode === 'guide' ? "¡Muy bien! Prueba el modo 'Ponerme a prueba'." : '¡Muy bien! Sigue así.';
    tips.push({ kind: 'praise', phrase: null, text });
  }
  return tips;
}
