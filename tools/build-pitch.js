import { buildReference } from '../practice/reference.js';
import { renderChart } from '../practice/chart.js';
import { parseSongs } from './songs-parser.js';

const results = new Map();
const $rows = document.getElementById('rows');
const $all = document.getElementById('all');
const $save = document.getElementById('save');
const $preview = document.getElementById('preview');
let songs = [];

function mixDown(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buffer.numberOfChannels;
  }
  return out;
}

function download(name, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function preview(ref) {
  const hop = ref.hopMs / 1000;
  $preview.innerHTML = `<h2>${ref.songId}: ${ref.notes.length} notas, ${ref.phrases.length} frases</h2>` +
    renderChart({ ref: ref.midi, user: null, hopMs: ref.hopMs, startSec: 0 },
      ref.phrases.map(p => ({ index: p.index, start: p.start * hop, end: p.end * hop, pitch: p.index % 2 ? 90 : 70 })));
}

async function analyzeSong(song, row) {
  const status = row.querySelector('[data-status]');
  status.className = '';
  status.textContent = 'Descargando…';
  try {
    const res = await fetch(song.track);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    status.textContent = 'Analizando…';
    await new Promise(r => setTimeout(r));
    const ref = buildReference({ songId: song.id, source: song.track, samples: mixDown(buffer), sampleRate: buffer.sampleRate });
    if (!ref.phrases.length) throw new Error('no se detectaron frases');
    results.set(song.id, ref);
    status.className = 'ok';
    status.textContent = `${ref.notes.length} notas · ${ref.phrases.length} frases · ${(ref.frameCount / 100).toFixed(0)} s`;
    row.querySelectorAll('[data-view],[data-download]').forEach(b => { b.disabled = false; });
    $save.disabled = false;
  } catch (err) {
    status.className = 'err';
    status.textContent = `Error: ${err.message}`;
  }
}

function indexData() {
  return { songs: songs.map(s => s.id).filter(id => results.has(id)) };
}

async function saveAll() {
  if (!('showDirectoryPicker' in window)) {
    for (const [id, ref] of results) download(`${id}.json`, ref);
    download('index.json', indexData());
    return;
  }
  const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
  const write = async (name, data) => {
    const handle = await dir.getFileHandle(name, { create: true });
    const w = await handle.createWritable();
    await w.write(JSON.stringify(data));
    await w.close();
  };
  for (const [id, ref] of results) await write(`${id}.json`, ref);
  await write('index.json', indexData());
  $save.textContent = `Guardado (${results.size} canciones)`;
}

async function init() {
  songs = parseSongs(await (await fetch('../app.js')).text());
  for (const song of songs) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${song.id}</td><td>${song.title}</td><td data-status>Pendiente</td>
      <td><button type="button" data-run>Analizar</button> <button type="button" data-view disabled>Ver</button> <button type="button" data-download disabled>Descargar</button></td>`;
    row.querySelector('[data-run]').addEventListener('click', () => analyzeSong(song, row));
    row.querySelector('[data-view]').addEventListener('click', () => preview(results.get(song.id)));
    row.querySelector('[data-download]').addEventListener('click', () => download(`${song.id}.json`, results.get(song.id)));
    $rows.append(row);
  }
  $all.addEventListener('click', async () => {
    $all.disabled = true;
    for (const [i, song] of songs.entries()) await analyzeSong(song, $rows.children[i]);
    $all.disabled = false;
  });
  $save.addEventListener('click', () => saveAll().catch(err => alert(err.message)));
}

init();
