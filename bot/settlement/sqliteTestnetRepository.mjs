import { DatabaseSync } from 'node:sqlite';
import { resolve, basename } from 'node:path';
import { existsSync, lstatSync } from 'node:fs';

/** Durable single-host testnet repository. Not suitable for network filesystems
 * or multiple machines. No application DB or environment-variable fallback. */
export function openSqliteTestnetRepository({ filename, network, purpose }) {
  if (network !== 'testnet' || purpose !== 'isolated-testnet-settlement') throw new Error('explicit isolated testnet configuration required');
  if (typeof filename !== 'string' || !filename || filename === ':memory:' || !basename(filename).endsWith('.testnet.sqlite')) throw new Error('dedicated .testnet.sqlite file required');
  const path = resolve(filename);
  if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())) throw new Error('regular database file required');
  const db = new DatabaseSync(path);
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
    if (tables.some(name => !['settlement_meta', 'settlement_intents'].includes(name))) throw new Error('unrelated database refused');
    if (tables.length && !tables.includes('settlement_meta')) throw new Error('unidentified database refused');
    if (tables.includes('settlement_meta')) {
      const existing = db.prepare('SELECT network,version FROM settlement_meta WHERE id=1').get();
      if (existing?.network !== 'testnet' || existing?.version !== 2) throw new Error('incompatible database identity');
    }
    db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS settlement_meta (id INTEGER PRIMARY KEY CHECK(id=1), network TEXT NOT NULL, version INTEGER NOT NULL);
      INSERT OR IGNORE INTO settlement_meta VALUES (1, 'testnet', 2);
      CREATE TABLE IF NOT EXISTS settlement_intents (
        id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','submitted','reconciliation_required','confirmed')),
        revision INTEGER NOT NULL CHECK(revision>=0), submission_hash TEXT, created_at TEXT NOT NULL, submitted_at TEXT,
        receipt_key TEXT UNIQUE, receipt TEXT,
        CHECK((status='confirmed') = (receipt_key IS NOT NULL AND receipt IS NOT NULL))
      ); COMMIT;`);
    const meta = db.prepare('SELECT network,version FROM settlement_meta WHERE id=1').get();
    if (meta.network !== 'testnet' || meta.version !== 2) throw new Error('incompatible database identity');
    const mode = db.prepare('PRAGMA journal_mode').get().journal_mode;
    if (mode !== 'wal' || db.prepare('PRAGMA synchronous').get().synchronous !== 2) throw new Error('durability requirements unavailable');
  } catch (error) { db.close(); throw error; }
  const decode = row => row && ({ id: row.id, fingerprint: row.fingerprint, payload: JSON.parse(row.payload), status: row.status, revision: row.revision, createdAt: row.created_at, ...(row.submitted_at ? { submittedAt: row.submitted_at } : {}),
    ...(row.submission_hash ? { submissionHash: row.submission_hash } : {}),
    ...(row.receipt_key ? { receiptKey: row.receipt_key, receipt: JSON.parse(row.receipt) } : {}),
  });
  const get = id => decode(db.prepare('SELECT * FROM settlement_intents WHERE id=?').get(id));
  return {
    async get(id) { return get(id); },
    async createUnique(row) {
      if (row.payload?.network !== 'testnet' || row.status !== 'pending' || row.revision !== 0) throw new Error('invalid initial intent');
      db.prepare('INSERT OR IGNORE INTO settlement_intents(id,fingerprint,payload,status,revision,created_at) VALUES(?,?,?,?,0,?)').run(row.id, row.fingerprint, JSON.stringify(row.payload), 'pending', new Date().toISOString());
      return get(row.id);
    },
    async compareAndSwap(id, revision, patch) {
      const keys = Object.keys(patch);
      if (keys.some(k => !['status', 'submissionHash', 'submittedAt'].includes(k))) throw new Error('invalid patch');
      let result;
      if (patch.status === 'submitted' && /^[a-f0-9]{64}$/.test(patch.submissionHash)) {
        result = db.prepare("UPDATE settlement_intents SET status='submitted',submission_hash=?,submitted_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending' AND submission_hash IS NULL").run(patch.submissionHash, new Date().toISOString(), id, revision);
      } else if (patch.status === 'reconciliation_required' && !patch.submissionHash) {
        result = db.prepare("UPDATE settlement_intents SET status='reconciliation_required',revision=revision+1 WHERE id=? AND revision=? AND status IN ('submitted','reconciliation_required') AND submission_hash IS NOT NULL").run(id, revision);
      } else throw new Error('invalid transition');
      if (result.changes !== 1) throw new Error('revision or transition conflict');
      return get(id);
    },
    async confirmUnique(id, revision, receiptKey, receipt) {
      if (!/^[a-f0-9]{64}$/.test(receiptKey) || !/^[a-f0-9]{64}$/.test(receipt?.transactionHash) || !/^[a-f0-9]{64}$/.test(receipt?.messageHash)) throw new Error('invalid receipt');
      // One atomic statement reserves globally unique receipt and confirms intent.
      // No durable intermediate state exists between these two effects.
      const result = db.prepare("UPDATE settlement_intents SET status='confirmed',receipt_key=?,receipt=?,revision=revision+1 WHERE id=? AND revision=? AND status IN ('submitted','reconciliation_required') AND submission_hash IS NOT NULL").run(receiptKey, JSON.stringify(receipt), id, revision);
      if (result.changes !== 1) throw new Error('revision or transition conflict');
      return get(id);
    },
    close() { db.close(); },
  };
}
