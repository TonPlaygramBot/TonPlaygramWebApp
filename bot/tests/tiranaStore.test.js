import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePurchase, createPurchaseHandler } from '../routes/tiranaStore.js';

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

// An atomic document adapter exercises handler races without contacting a real
// account. It implements the same balance, ownership and receipt predicates.
function account(balance=5000) {
  const user={accountId:'test-account',balance,tiranaStreetsInventory:{weapons:[]},transactions:[]};
  const matches=q=>q.accountId===user.accountId&&(!q['transactions.transactionId']||user.transactions.some(t=>t.transactionId===q['transactions.transactionId']));
  const Model={
    async findOne(q){return matches(q)?structuredClone(user):null;},
    async findOneAndUpdate(q,update,options){
      assert.equal(options.new,true);
      assert.equal(q.accountId,user.accountId);
      assert.equal(q.balance.$gte,-update.$inc.balance);
      assert.equal(q['tiranaStreetsInventory.weapons'].$ne,update.$addToSet['tiranaStreetsInventory.weapons']);
      assert.equal(q['transactions.transactionId'].$ne,update.$push.transactions.transactionId);
      if(user.balance<q.balance.$gte||user.tiranaStreetsInventory.weapons.includes(q['tiranaStreetsInventory.weapons'].$ne)||user.transactions.some(t=>t.transactionId===q['transactions.transactionId'].$ne))return null;
      user.balance+=update.$inc.balance;user.tiranaStreetsInventory.weapons.push(update.$addToSet['tiranaStreetsInventory.weapons']);user.transactions.push(update.$push.transactions);
      return structuredClone(user);
    }
  };
  const handler=createPurchaseHandler(Model);
  async function buy(key='purchase_key_12345',itemId='tirana-ak47VolleyAttack',extras={}) {
    const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await handler({auth:{accountId:user.accountId},body:{itemId,idempotencyKey:key,...extras}},res,e=>{throw e;});
    return res;
  }
  return {user,buy,handler};
}

test('simultaneous duplicate purchases debit TPG and deliver exactly once',async()=>{
  const {user,buy}=account();const results=await Promise.all([buy(),buy(),buy()]);
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,200,201]);
  assert.equal(user.balance,2500);assert.equal(user.transactions.length,1);assert.deepEqual(user.tiranaStreetsInventory.weapons,['ak47VolleyAttack']);
  for(const r of results){assert.equal(r.body.balanceTPG,2500);assert.ok(r.body.ownedWeaponIds.includes('glockSidearmAttack'));assert.ok(r.body.ownedWeaponIds.includes('combatKnife'));}
  assert.equal(user.transactions[0].token,'TPG');assert.equal(user.transactions[0].amount,-2500);
});
test('lost response can replay the same receipt, but a key cannot purchase another item',async()=>{
  const {user,buy}=account();await buy();const retry=await buy();assert.equal(retry.statusCode,200);
  const other=await buy('purchase_key_12345','tirana-uziSprayAttack');assert.equal(other.statusCode,409);assert.equal(other.body.code,'IDEMPOTENCY_CONFLICT');
  assert.equal(user.balance,2500);assert.equal(user.transactions.length,1);
});
test('concurrent distinct references cannot buy the same unlock twice',async()=>{
  const {user,buy}=account();const results=await Promise.all([buy('reference_number_a'),buy('reference_number_b')]);
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[201,409]);assert.equal(user.balance,2500);assert.equal(user.transactions.length,1);
});
test('funds cannot go negative when different weapons race',async()=>{
  const {user,buy}=account(3000);const results=await Promise.all([buy(),buy('purchase_second_key','tirana-uziSprayAttack')]);
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[201,402]);assert.equal(user.balance,500);assert.equal(user.transactions.length,1);
});
test('client prices are ignored and starter equipment is never charged',async()=>{
  const {user,buy}=account();const result=await buy(undefined,undefined,{priceTPG:1,weaponId:'free-hack'});
  assert.equal(result.statusCode,201);assert.equal(user.balance,2500);
  const starter=await buy('purchase_starter_key','tirana-glockSidearmAttack');assert.equal(starter.statusCode,400);assert.equal(user.balance,2500);
});
test('insufficient balance and missing identity do not mutate an account',async()=>{
  const {user,buy,handler}=account(10);assert.equal((await buy()).statusCode,402);
  const res={status(n){this.code=n;return this;},json(){return this;}};await handler({auth:{},body:{}},res,e=>{throw e;});assert.equal(res.code,401);
  assert.equal(user.balance,10);assert.equal(user.transactions.length,0);
});
