// Extrae { id, title, track } del objeto SONGS de app.js sin ejecutarlo.
export function parseSongs(source) {
  const re = /(\w+):\{\s*title:'((?:[^'\\]|\\.)*)',\s*track:'([^']+)'/g;
  const songs = [];
  let m;
  while ((m = re.exec(source))) songs.push({ id: m[1], title: m[2].replace(/\\'/g, "'"), track: m[3] });
  return songs;
}
