// Uso: node tools/build-songs-migration.mjs — genera backend/migrations/0002_songs.sql a partir de
// SONGS (app.js) y del orden de las tarjetas de la portada (index.html). Se ejecuta una vez y el SQL
// se versiona; un test comprueba que siguen coincidiendo.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CREATED_AT = '2026-10-13T00:00:00.000Z';

const SCHEMA = `-- Generado por tools/build-songs-migration.mjs. No editar a mano.
CREATE TABLE songs (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  track            TEXT,
  lyrics           TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  legacy_reference INTEGER NOT NULL DEFAULT 0,
  reference        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX songs_title ON songs(title COLLATE NOCASE);
`;

export function extractSongs(appSource) {
  const source = appSource.replace(/\r\n/g, '\n');
  const marker = 'const SONGS=';
  const start = source.indexOf(marker);
  const end = source.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('No se encontró SONGS en app.js');
  // Código propio del repositorio: se evalúa el literal del objeto, sin ejecutar el resto de app.js.
  return new Function(`return ${source.slice(start + marker.length, end + 2)}`)();
}

export function cardOrder(html) {
  const grid = html.slice(html.indexOf('id="grid"'));
  return [...grid.slice(0, grid.indexOf('</div>')).matchAll(/data-song="([^"]+)"/g)].map(m => m[1]);
}

const sql = v => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

export function buildMigration(songs, order) {
  const noCard = Object.keys(songs).filter(id => !order.includes(id));
  if (noCard.length) throw new Error(`Canciones sin tarjeta: ${noCard.join(', ')}`);
  const noData = order.filter(id => !songs[id]);
  if (noData.length) throw new Error(`Tarjetas sin datos en SONGS: ${noData.join(', ')}`);
  const rows = order.map((id, i) => {
    const s = songs[id];
    return `INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES (${sql(id)}, ${sql(s.title)}, ${sql(s.track || null)}, ${sql(s.lyrics || '')}, ${i + 1}, 1, 1, NULL, ${sql(CREATED_AT)}, ${sql(CREATED_AT)});`;
  });
  return `${SCHEMA}${rows.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = p => readFileSync(new URL(p, ROOT), 'utf8');
  const out = new URL('backend/migrations/0002_songs.sql', ROOT);
  writeFileSync(out, buildMigration(extractSongs(read('app.js')), cardOrder(read('index.html'))));
  console.log(`Escrito ${fileURLToPath(out)}`);
}
