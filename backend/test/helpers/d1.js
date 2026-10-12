// Imitación mínima de la API de Cloudflare D1 sobre node:sqlite (solo para tests).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../../migrations/', import.meta.url);

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    for (const p of params) {
      if (p === undefined || typeof p === 'boolean') throw new Error(`D1_TYPE_ERROR: tipo no admitido (${p})`);
    }
    return new Statement(this.db, this.sql, params);
  }

  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (row == null) return null;
    const plain = { ...row };
    return column ? plain[column] : plain;
  }

  async all() {
    const results = this.db.prepare(this.sql).all(...this.params).map(r => ({ ...r }));
    return { success: true, results, meta: {} };
  }

  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export class D1Shim {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function createTestDb() {
  const d1 = new D1Shim();
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    d1.db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  return d1;
}
