import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSongs, cardOrder, buildMigration } from '../tools/build-songs-migration.mjs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ORDER = ['fum', 'campanas', 'adeste', 'dona', 'fuentecilla', 'estrella', 'paz', 'merry', 'kling', 'tannenbaum', 'mundo', 'stelle'];

test('extrae las 12 canciones de app.js con título, audio y letra', () => {
  const songs = extractSongs(read('app.js'));
  assert.deepEqual(Object.keys(songs).sort(), [...ORDER].sort());
  assert.equal(songs.fum.title, 'Fum Fum Fum');
  assert.match(songs.fum.track, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(songs.fum.lyrics, /^Veinticinco de diciembre\n/);
});

test('el orden sale de las tarjetas de la portada', () => {
  assert.deepEqual(cardOrder(read('index.html')), ORDER);
});

test('escapa comillas simples y numera posiciones', () => {
  const sql = buildMigration({ a: { title: "O'Holy", track: 'https://x.test/a.m4a', lyrics: "it's\nok; yes" } }, ['a']);
  assert.match(sql, /CREATE TABLE songs/);
  assert.match(sql, /VALUES \('a', 'O''Holy', 'https:\/\/x\.test\/a\.m4a', 'it''s\nok; yes', 1, 1, 1, NULL, '2026-10-13T00:00:00\.000Z', '2026-10-13T00:00:00\.000Z'\);/);
});

test('falla si una canción no tiene tarjeta', () => {
  assert.throws(() => buildMigration({ a: { title: 'A' } }, []), /sin tarjeta: a/);
  assert.throws(() => buildMigration({}, ['b']), /sin datos en SONGS: b/);
});

test('el SQL versionado coincide con el generado', () => {
  const expected = buildMigration(extractSongs(read('app.js')), cardOrder(read('index.html')));
  assert.equal(read('backend/migrations/0002_songs.sql'), expected);
});
