import { createRecorder, isRecordingSupported } from '../practice/recorder.js';
import { detectPitch } from '../practice/pitch.js';
import { median } from '../practice/util.js';

const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const out = document.getElementById('out');
const btn = document.getElementById('go');

if (!isRecordingSupported()) { out.textContent = 'Tu navegador no permite grabar.'; btn.disabled = true; }

btn.addEventListener('click', async () => {
  btn.disabled = true;
  let rec;
  try {
    rec = await createRecorder();
    await rec.context.resume();
    rec.start();
    out.textContent = 'Grabando…';
    await new Promise(r => setTimeout(r, 3000));
    const { samples, sampleRate } = rec.stop();
    const { midi } = detectPitch(samples, sampleRate);
    const m = median(midi);
    const voiced = midi.filter(v => v != null).length;
    out.textContent = m == null
      ? `No se detectó voz (${sampleRate} Hz).`
      : `${NAMES[Math.round(m) % 12]}${Math.floor(Math.round(m) / 12) - 1} (${((m - Math.round(m)) * 100).toFixed(0)} cents) · ${sampleRate} Hz · ${voiced}/${midi.length} frames con voz`;
  } catch (err) {
    out.textContent = `Error: ${err.name || ''} ${err.message}`;
  } finally {
    rec?.dispose();
    btn.disabled = false;
  }
});
