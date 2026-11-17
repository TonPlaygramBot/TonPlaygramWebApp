import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../bot/models/User.js';
import GiftDelivery from '../bot/models/GiftDelivery.js';
import { deliverGift } from '../bot/utils/giftDelivery.js';

// This suite creates its own disposable replica set. It never reads a configured DB URL.
const mongoose = User.db.base;
let server;
const request = (extra = {}) => ({ fromAccount: 'alice', toAccount: 'bob', gift: 'fireworks', requestId: randomUUID(), ...extra });
const send = (data, options = {}) => deliverGift(data, user => user.accountId === 'alice', { externalMintConfigured: false, ...options });
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] }, instanceOpts: [{ storageEngine: 'wiredTiger' }] });
  await mongoose.connect(server.getUri(), { dbName: `gift_test_${randomUUID()}` });
  await Promise.all([User.init(), GiftDelivery.init()]);
});
after(async () => { await mongoose.disconnect(); await server?.stop(); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), GiftDelivery.deleteMany({})]); await User.create([{accountId:'alice',balance:1000,referralCode:'a'},{accountId:'bob',balance:0,referralCode:'b'}]); });
test('atomic debit, inventory and matching receipt; identical replay charges once', async () => {
  const input=request(), receipt=await send(input), replay=await send(input);
  assert.deepEqual(JSON.parse(JSON.stringify(receipt)),JSON.parse(JSON.stringify(replay)));
  assert.equal(receipt.balance,800);assert.equal(receipt.transaction.transactionId,input.requestId);
  assert.equal((await User.findOne({accountId:'alice'})).balance,800);
  const bob=await User.findOne({accountId:'bob'});assert.equal(bob.gifts.length,1);assert.equal(bob.gifts[0].nftTokenId,undefined);
  assert.equal(await GiftDelivery.countDocuments(),1);
});
test('concurrent duplicate request commits one delivery', async () => {
  const input=request();const receipts=await Promise.all(Array.from({length:6},()=>send(input)));
  assert.ok(receipts.every(r=>r.requestId===input.requestId));assert.equal((await User.findOne({accountId:'alice'})).balance,800);assert.equal((await User.findOne({accountId:'bob'})).gifts.length,1);
});
test('distinct concurrent sends cannot overspend', async () => {
  await User.updateOne({accountId:'alice'},{$set:{balance:200}});
  const results=await Promise.all([send(request()),send(request())]);
  assert.equal(results.filter(r=>r.requestStatus==='rejected').length,1);assert.equal((await User.findOne({accountId:'alice'})).balance,0);assert.equal((await User.findOne({accountId:'bob'})).gifts.length,1);
});
test('self gift does not overwrite debit or duplicate inventory', async () => {
  const input=request({toAccount:'alice'});await send(input);await send(input);
  const alice=await User.findOne({accountId:'alice'});assert.equal(alice.balance,800);assert.equal(alice.gifts.length,1);assert.equal(alice.transactions.length,2);
});
test('same key cannot change recipient or gift', async () => {
  const input=request();await send(input);
  await assert.rejects(send({...input,toAccount:'alice'}),e=>e.code==='REQUEST_CONFLICT');
  await assert.rejects(send({...input,gift:'royal_crown'}),e=>e.code==='REQUEST_CONFLICT');
  assert.equal((await User.findOne({accountId:'alice'})).balance,800);
});
test('missing recipient has durable rejection, no new account or charge',async()=>{
  const input=request({toAccount:'missing'}),outcome=await send(input);assert.equal(outcome.requestStatus,'rejected');
  await User.create({accountId:'missing',referralCode:'c'});
  assert.deepEqual(await send(input),outcome);assert.equal((await User.findOne({accountId:'alice'})).balance,1000);
});
test('insufficient balance rejection remains rejected even after top-up',async()=>{
  const input=request({gift:'royal_crown'}),outcome=await send(input);assert.equal(outcome.code,'INSUFFICIENT_BALANCE');
  await User.updateOne({accountId:'alice'},{$set:{balance:100000}});assert.deepEqual(await send(input),outcome);
});
test('recipient write failure aborts debit and receipt',async()=>{
  const original=User.updateOne;
  User.updateOne=()=>{throw new Error('injected recipient write failure');};
  try {await assert.rejects(send(request()),/injected/);} finally {User.updateOne=original;}
  assert.equal((await User.findOne({accountId:'alice'})).balance,1000);assert.equal(await GiftDelivery.countDocuments(),0);assert.equal((await User.findOne({accountId:'bob'})).gifts.length,0);
});
test('receipt insert failure aborts both account writes',async()=>{
  const original=GiftDelivery.create;GiftDelivery.create=()=>{throw new Error('injected receipt failure');};
  try {await assert.rejects(send(request()),/injected/);} finally {GiftDelivery.create=original;}
  assert.equal((await User.findOne({accountId:'alice'})).balance,1000);assert.equal((await User.findOne({accountId:'bob'})).gifts.length,0);
});
test('authorization is required even for replay',async()=>{const input=request();await send(input);await assert.rejects(deliverGift(input,()=>false),e=>e.code==='FORBIDDEN');});
test('old clients and invalid request IDs fail before charge',async()=>{for(const requestId of [undefined,'bad'])await assert.rejects(send(request({requestId})),e=>e.code==='REQUEST_ID_REQUIRED');assert.equal((await User.findOne({accountId:'alice'})).balance,1000);});
test('configured external provider is fail-closed, previously committed replay still available',async()=>{
  await assert.rejects(send(request(),{externalMintConfigured:true}),e=>e.code==='MINT_PROVIDER_UNAVAILABLE');assert.equal((await User.findOne({accountId:'alice'})).balance,1000);
  const input=request();await send(input);assert.equal((await send(input,{externalMintConfigured:true})).balance,800);
});
test('absent legacy arrays initialize, corrupt arrays fail closed',async()=>{
  await User.collection.updateOne({accountId:'bob'},{$unset:{transactions:'',gifts:''}});await send(request());assert.equal((await User.findOne({accountId:'bob'})).gifts.length,1);
  await User.collection.updateOne({accountId:'bob'},{$set:{gifts:null}});await assert.rejects(send(request()),e=>e.code==='ACCOUNT_HISTORY_INVALID');assert.equal((await User.findOne({accountId:'alice'})).balance,800);
});

test('notification enqueue commits with gift and receipt replay never requeues',async()=>{
 await User.updateOne({accountId:'bob'},{$set:{telegramId:222}});
 const input=request();await send(input);await send(input);
 const record=await GiftDelivery.findOne().lean();assert.equal(record.notification.state,'pending');assert.equal(record.notification.telegramId,'222');
 const {drainGiftNotifications}=await import('../bot/utils/giftNotifications.js');let calls=0;
 await Promise.all([drainGiftNotifications(async()=>{calls++;return{message_id:99};}),drainGiftNotifications(async()=>{calls++;return{message_id:100};})]);
 assert.equal(calls,1);assert.equal((await GiftDelivery.findOne().lean()).notification.state,'sent');
 await send(input);await drainGiftNotifications(async()=>{calls++;});assert.equal(calls,1);
});
test('ambiguous Telegram result is held without retry or rolling back delivered gift',async()=>{
 await User.updateOne({accountId:'bob'},{$set:{telegramId:222}});await send(request());
 const {drainGiftNotifications}=await import('../bot/utils/giftNotifications.js');let calls=0;
 await drainGiftNotifications(async()=>{calls++;throw Error('response lost');});
 await drainGiftNotifications(async()=>{calls++;});
 assert.equal(calls,1);assert.equal((await GiftDelivery.findOne().lean()).notification.state,'uncertain');
 assert.equal((await User.findOne({accountId:'alice'})).balance,800);assert.equal((await User.findOne({accountId:'bob'})).gifts.length,1);
});
test('crashed claimed notification is not automatically replayed',async()=>{
 await User.updateOne({accountId:'bob'},{$set:{telegramId:222}});await send(request());await GiftDelivery.updateOne({},{$set:{'notification.state':'attempting'}});
 const {drainGiftNotifications}=await import('../bot/utils/giftNotifications.js');let calls=0;await drainGiftNotifications(async()=>{calls++;});assert.equal(calls,0);
});
