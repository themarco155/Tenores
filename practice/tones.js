import { midiToHz } from './util.js';

export function playTone(ctx, midi, seconds = 1) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = midiToHz(midi);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
  gain.gain.setValueAtTime(0.25, t + seconds - 0.1);
  gain.gain.linearRampToValueAtTime(0, t + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + seconds);
  return new Promise(resolve => { osc.onended = () => resolve(); });
}

export function playClickAt(ctx, t, accent = false) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1500 : 1000;
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

export const playClick = (ctx, accent = false) => playClickAt(ctx, ctx.currentTime, accent);
