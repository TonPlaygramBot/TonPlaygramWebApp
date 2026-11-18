import { createHash } from 'node:crypto';

const kinds = new Set(['p2p', 'game_payout', 'purchase', 'reward', 'balance_migration']);
const address = /^0:[a-f0-9]{64}$/;
const hash = /^[a-f0-9]{64}$/;
function required(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error(`invalid ${name}`);
  return value;
}
export function normalizeIntent(input) {
  if (input.network !== 'testnet') throw new Error('testnet required');
  if (!kinds.has(input.kind)) throw new Error('invalid kind');
  if (!address.test(input.source) || !address.test(input.destination)) throw new Error('canonical raw addresses required');
  if (input.source === input.destination) throw new Error('self transfer rejected');
  if (typeof input.amountBaseUnits !== 'string' || !/^[1-9][0-9]{0,38}$/.test(input.amountBaseUnits)) throw new Error('positive integer base units required');
  if (BigInt(input.amountBaseUnits) >= (1n << 120n)) throw new Error('amount exceeds TON Coins encoding');
  if (input.asset !== 'native' && !address.test(input.asset)) throw new Error('asset must be native or canonical jetton master address');
  return {
    network: 'testnet', kind: input.kind, asset: input.asset,
    source: input.source, destination: input.destination, amountBaseUnits: input.amountBaseUnits,
    reference: required(input.reference, 'reference'),
    idempotencyKey: required(input.idempotencyKey, 'idempotencyKey'),
  };
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** No signer, RPC, environment secrets or application balance mutation.
 * repository must implement atomic createUnique/get/compareAndSwap plus
 * confirmUnique (atomic status update AND unique receipt reservation).
 * verifier is trusted server code, never a request body or wallet callback.
 */
export function createTestnetSettlement({ repository, verifier }) {
  if (!repository || typeof verifier !== 'function') throw new Error('repository and verifier required');
  return {
    async createIntent(input) {
      const payload = normalizeIntent(input);
      const id = digest(['testnet', payload.idempotencyKey]);
      const fingerprint = digest(payload);
      const row = await repository.createUnique({ id, fingerprint, payload, status: 'pending', revision: 0, createdAt: new Date().toISOString() });
      if (row.fingerprint !== fingerprint) throw new Error('idempotency conflict');
      return row;
    },
    async markSubmitted(id, submissionHash) {
      if (!hash.test(submissionHash)) throw new Error('invalid submission hash');
      const row = await repository.get(id);
      if (!row) throw new Error('intent not found');
      if (row.submissionHash) {
        if (row.submissionHash !== submissionHash) throw new Error('submission conflict; reconcile before retry');
        return row;
      }
      if (row.status !== 'pending') throw new Error('intent not pending');
      return repository.compareAndSwap(id, row.revision, { status: 'submitted', submissionHash, submittedAt: new Date().toISOString() });
    },
    async reconcile(id) {
      const row = await repository.get(id);
      if (!row) throw new Error('intent not found');
      if (row.status === 'confirmed') return row;
      if (!row.submissionHash) throw new Error('submission required');
      let evidence;
      try { evidence = await verifier(structuredClone(row)); }
      catch { return repository.compareAndSwap(id, row.revision, { status: 'reconciliation_required' }); }
      const p = row.payload;
      const matches = evidence?.finalized === true && evidence?.delivered === true &&
        evidence.network === 'testnet' && evidence.kind === p.kind && evidence.submissionHash === row.submissionHash &&
        evidence.intentId === id && evidence.reference === p.reference &&
        evidence.recipientTransactionSucceeded === true && evidence.asset === p.asset && evidence.source === p.source &&
        evidence.destination === p.destination && evidence.amountBaseUnits === p.amountBaseUnits &&
        hash.test(evidence.transactionHash) && hash.test(evidence.messageHash);
      if (!matches) return repository.compareAndSwap(id, row.revision, { status: 'reconciliation_required' });
      const receiptKey = digest(['testnet', p.asset, evidence.messageHash]);
      return repository.confirmUnique(id, row.revision, receiptKey, {
        transactionHash: evidence.transactionHash, messageHash: evidence.messageHash,
      });
    },
  };
}

/** Explicit OFFLINE TEST FIXTURE. Not durable, not a production repository. */
export function createMemoryTestRepository() {
  const rows = new Map();
  const receipts = new Map();
  const copy = value => value && structuredClone(value);
  const update = (id, revision, patch) => {
    const row = rows.get(id);
    if (!row || row.revision !== revision) throw new Error('revision conflict');
    const next = { ...row, ...patch, revision: revision + 1 };
    rows.set(id, next);
    return copy(next);
  };
  return {
    async createUnique(row) { if (!rows.has(row.id)) rows.set(row.id, copy(row)); return copy(rows.get(row.id)); },
    async get(id) { return copy(rows.get(id)); },
    async compareAndSwap(id, revision, patch) { return update(id, revision, patch); },
    async confirmUnique(id, revision, receiptKey, receipt) {
      if (receipts.has(receiptKey) && receipts.get(receiptKey) !== id) throw new Error('receipt already consumed');
      const next = update(id, revision, { status: 'confirmed', receiptKey, receipt });
      receipts.set(receiptKey, id);
      return next;
    },
  };
}
