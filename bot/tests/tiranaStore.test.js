import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePurchase } from '../routes/tiranaStore.js';

test('Tirana store resolves price from authoritative catalog', () => {
  const result = validatePurchase({ itemId: 'tirana-ak47VolleyAttack', idempotencyKey: 'purchase_key_12345' });
  assert.equal(result.item.priceTPG, 2500);
  assert.equal(result.item.weaponId, 'ak47VolleyAttack');
  assert.equal(result.transactionId, 'tirana-weapon:purchase_key_12345');
});

test('Tirana store rejects client-defined and invalid items', () => {
  assert.equal(validatePurchase({ itemId: 'tirana-ak47VolleyAttack', priceTPG: 1 }).code, 'INVALID_REQUEST');
  assert.equal(validatePurchase({ itemId: 'not-real', idempotencyKey: 'purchase_key_12345' }).code, 'INVALID_ITEM');
});
