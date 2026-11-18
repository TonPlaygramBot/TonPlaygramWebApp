import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestnetSettlement, createMemoryTestRepository, normalizeIntent } from '../bot/settlement/testnetSettlement.mjs';
const a = `0:${'a'.repeat(64)}`, b = `0:${'b'.repeat(64)}`;
const h = 'c'.repeat(64);
const input = { network: 'testnet', kind: 'p2p', asset: 'native', source: a, destination: b, amountBaseUnits: '100', reference: 'order-1', idempotencyKey: 'p2p:1' };
function setup(transform = x => x) {
  const repository = createMemoryTestRepository();
  const service = createTestnetSettlement({ repository, verifier: async row => transform({ ...row.payload, intentId: row.id, submissionHash: row.submissionHash, finalized: true, delivered: true, recipientTransactionSucceeded: true, transactionHash: 'd'.repeat(64), messageHash: h }) });
  return { service, repository };
}
test('all five economy categories remain pending until verified delivery', async () => {
  for (const kind of ['p2p', 'game_payout', 'purchase', 'reward', 'balance_migration']) {
    const { service } = setup();
    const row = await service.createIntent({ ...input, kind });
    assert.equal(row.status, 'pending');
    assert.equal((await service.markSubmitted(row.id, h)).status, 'submitted');
    assert.equal((await service.reconcile(row.id)).status, 'confirmed');
    assert.equal((await service.reconcile(row.id)).revision, 2);
  }
});
test('concurrent create deduplicates; changed amount conflicts', async () => {
  const { service } = setup();
  const rows = await Promise.all(Array.from({ length: 20 }, () => service.createIntent(input)));
  assert.equal(new Set(rows.map(x => x.id)).size, 1);
  await assert.rejects(service.createIntent({ ...input, amountBaseUnits: '101' }), /idempotency conflict/);
});
test('reject mainnet, floats, numbers, negative amounts and unidentified assets', () => {
  for (const patch of [{ network: 'mainnet' }, { amountBaseUnits: 100 }, { amountBaseUnits: '1.5' }, { amountBaseUnits: '-1' }, { amountBaseUnits: '0' }, { asset: 'TPG' }, { amountBaseUnits: String(1n << 120n) }]) assert.throws(() => normalizeIntent({ ...input, ...patch }));
});
test('mismatch or incomplete evidence never confirms', async () => {
  for (const patch of [{ network: 'mainnet' }, { kind: 'purchase' }, { reference: 'wrong' }, { recipientTransactionSucceeded: false }, { finalized: false }, { delivered: false }, { destination: a }, { source: b }, { amountBaseUnits: '101' }, { asset: a }, { intentId: 'wrong' }, { submissionHash: 'e'.repeat(64) }, { messageHash: '' }]) {
    const { service } = setup(x => ({ ...x, ...patch }));
    const row = await service.createIntent(input);
    await service.markSubmitted(row.id, h);
    assert.equal((await service.reconcile(row.id)).status, 'reconciliation_required');
  }
});
test('timeout does not refund, retry payment, or confirm', async () => {
  const { service } = setup(() => { throw new Error('timeout'); });
  const row = await service.createIntent(input);
  await service.markSubmitted(row.id, h);
  assert.equal((await service.reconcile(row.id)).status, 'reconciliation_required');
  await assert.rejects(service.markSubmitted(row.id, 'f'.repeat(64)), /submission conflict/);
});
test('same canonical receipt cannot fulfill two intents', async () => {
  const { service } = setup();
  const first = await service.createIntent(input);
  const second = await service.createIntent({ ...input, idempotencyKey: 'p2p:2' });
  await service.markSubmitted(first.id, h);
  await service.markSubmitted(second.id, h);
  await service.reconcile(first.id);
  await assert.rejects(service.reconcile(second.id), /receipt already consumed/);
});
test('unsubmitted intents cannot confirm and repository copies cannot mutate state', async () => {
  const { service, repository } = setup();
  const row = await service.createIntent(input);
  row.status = 'confirmed';
  assert.equal((await repository.get(row.id)).status, 'pending');
  await assert.rejects(service.reconcile(row.id), /submission required/);
});
