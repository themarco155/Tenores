// Uso: node tools/create-admin.mjs <usuario> "<Nombre visible>" [--iterations 20000] [--out admin-seed.sql]
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { hashPin, newSalt, randomPin } from '../src/crypto.js';
import { validateUsername, validateDisplayName } from '../src/validate.js';

const quote = s => `'${String(s).replace(/'/g, "''")}'`;

export async function buildAdminInsert({ username, displayName, iterations, now = new Date(), pin = randomPin(), salt = newSalt() }) {
  const u = validateUsername(username);
  const d = validateDisplayName(displayName);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 100000) throw new Error('--iterations debe estar entre 1000 y 100000');
  const hash = await hashPin(pin, salt, iterations);
  const ts = now.toISOString();
  const sql = `INSERT INTO users (username, display_name, pin_hash, pin_salt, pin_iterations, role, active, must_change_pin, created_at, updated_at)
VALUES (${quote(u)}, ${quote(d)}, ${quote(hash)}, ${quote(salt)}, ${iterations}, 'admin', 1, 1, ${quote(ts)}, ${quote(ts)});`;
  return { pin, sql };
}

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  let iterations = 20000, out = 'admin-seed.sql';
  while (args.length) {
    const a = args.shift();
    if (a === '--iterations') iterations = Number(args.shift());
    else if (a === '--out') out = args.shift();
    else positional.push(a);
  }
  return { username: positional[0], displayName: positional[1], iterations, out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { username, displayName, iterations, out } = parseArgs(process.argv.slice(2));
  if (!username || !displayName) {
    console.error('Uso: node tools/create-admin.mjs <usuario> "<Nombre visible>" [--iterations 20000] [--out admin-seed.sql]');
    process.exit(1);
  }
  try {
    const { pin, sql } = await buildAdminInsert({ username, displayName, iterations });
    writeFileSync(out, `${sql}\n`);
    console.log(`SQL escrito en ${out}`);
    console.log(`PIN temporal de ${username.trim().toLowerCase()}: ${pin}`);
    console.log('Se pedirá cambiarlo en el primer inicio de sesión. Borra el archivo SQL tras usarlo.');
  } catch (err) {
    console.error(err.extra?.field ? `Dato no válido: ${err.extra.field}` : err.message);
    process.exit(1);
  }
}
