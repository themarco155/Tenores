import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSongs } from '../tools/songs-parser.js';

test('extrae las 12 canciones de app.js en orden', () => {
  const songs = parseSongs(readFileSync('app.js', 'utf8'));
  assert.deepEqual(songs.map(s => s.id), ['fum', 'adeste', 'dona', 'fuentecilla', 'campanas', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle']);
  assert.equal(songs[0].title, 'Fum Fum Fum');
  assert.match(songs[0].track, /^https:\/\/res\.cloudinary\.com\/.+\.m4a$/);
  assert.ok(songs.every(s => s.track.startsWith('https://')));
});
