import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../models/User.js';
import { createCheckinRouter } from '../routes/checkin.js';
let mongo, server, base, beforeCas;
let clock = 1800000000000;
const DAY = 86400000;
const oldToken = process.env.BOT_TOKEN;
function signed(id, age = 0) {
  const p = new URLSearchParams({ auth_date: String(Math.floor((clock-age)/1000)), user: JSON.stringify({id}) });
  const key = crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
  p.set('hash', crypto.createHmac('sha256',key).update([...p.entries()].map(([k,v])=>`${k}=${v}`).sort().join('\n')).digest('hex'));
  return p.toString();
}
async function claim(id, headers = {'x-telegram-init-data': signed(id)}) {
  const r = await fetch(`${base}/check-in`, {method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({telegramId:id})});
  return {status:r.status,body:await r.json()};
}
before(async()=>{
  process.env.BOT_TOKEN='offline-checkin-test-token';
  mongo=await MongoMemoryReplSet.create({replSet:{count:1,args:['--nounixsocket']}});
  await mongoose.connect(mongo.getUri()); await User.init();
  const app=express();app.use(express.json());app.use(createCheckinRouter({now:()=>clock,UserModel:{updateOne:(...args)=>User.updateOne(...args),findOne:(...args)=>User.findOne(...args),findOneAndUpdate:async(...args)=>{if(beforeCas){const hook=beforeCas;beforeCas=null;await hook();}return User.findOneAndUpdate(...args);}}}));
  server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(async()=>{ await User.deleteMany({}); clock=1800000000000; beforeCas=null; });
after(async()=>{await new Promise(r=>server?.close(r));await mongoose.disconnect();await mongo?.stop(); if(oldToken===undefined)delete process.env.BOT_TOKEN;else process.env.BOT_TOKEN=oldToken;});
test('signed existing client shape creates first user and credits exact reward once',async()=>{
  const result=await claim(101);assert.equal(result.status,200);assert.deepEqual(result.body,{streak:1,reward:100,balance:100});
  const user=await User.findOne({telegramId:101}).lean();assert.equal(user.tpcAccountNumber,user.accountId);assert(user.accountId);assert.equal(user.transactions.length,1);assert.match(user.transactions[0].transactionId,/^checkin:/);assert.equal(user.transactions[0].status,'delivered');
});
test('concurrent first claims and retries cannot duplicate receipt or reward',async()=>{
  const results=await Promise.all(Array.from({length:12},()=>claim(102)));
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert(results.every(r=>[200,400].includes(r.status)));
  const user=await User.findOne({telegramId:102}).lean();assert.equal(user.balance,100);assert.equal(user.transactions.length,1);
  assert.equal((await claim(102)).body.error,'already checked in');
});
test('unsigned hints, wrong owner, forged or expired credentials cannot create or alter user',async()=>{
  for(const headers of [{},{'x-tpc-account-id':'fake'},{'x-google-id':'fake'},{authorization:'Bearer fake'},{'x-telegram-init-data':signed(104)},{'x-telegram-init-data':signed(103,DAY+1000)},{'x-telegram-init-data':signed(103)+'bad'}]) {
    assert([401,403].includes((await claim(103,headers)).status));
  }
  assert.equal(await User.countDocuments(),0);
});
test('rolling 24h boundary, streak increment, 48h reset preserve existing rules',async()=>{
  await claim(105);clock+=DAY-1;assert.equal((await claim(105)).status,400);clock++;
  assert.deepEqual((await claim(105)).body,{streak:2,reward:120,balance:220});clock+=2*DAY;
  assert.deepEqual((await claim(105)).body,{streak:1,reward:100,balance:320});
});
test('30 day cap persists until existing reset interval',async()=>{
  await User.create({telegramId:106,balance:500,lastCheckIn:new Date(clock-DAY),dailyStreak:30});
  assert.equal((await claim(106)).body.error,'max days reached');clock+=DAY;
  assert.equal((await claim(106)).body.reward,100);
});
test('banned and invalid wallet amount fail without financial mutation',async()=>{
  for(const [id,data] of [[107,{isBanned:true}],[108,{balance:0.5}],[109,{balance:Number.MAX_SAFE_INTEGER}],[110,{dailyStreak:-1}]]) {
    await User.create({telegramId:id,...data});const before=await User.findOne({telegramId:id}).lean();
    assert([403,409].includes((await claim(id)).status));const after=await User.findOne({telegramId:id}).lean();assert.deepEqual(after,before);
  }
});
test('atomic failure cannot leave credited balance or consumed entitlement',async()=>{
  // A preexisting receipt collision triggers the unique multikey index.
  const target=await User.create({telegramId:111,balance:0});
  await User.create({telegramId:112,transactions:[{transactionId:`checkin:${target._id}:${clock}`,amount:1}]});
  const before=await User.findOne({telegramId:111}).lean();assert.equal((await claim(111)).status,500);
  assert.deepEqual(await User.findOne({telegramId:111}).lean(),before);
});

test('concurrent balance delta is preserved through CAS retry',async()=>{
  await User.create({telegramId:113,balance:20});
  beforeCas=()=>User.updateOne({telegramId:113},{$inc:{balance:7}});
  assert.equal((await claim(113)).body.balance,127);
  assert.equal((await User.findOne({telegramId:113})).transactions.length,1);
});
test('ban between read and atomic update prevents reward',async()=>{
  await User.create({telegramId:114,balance:20});
  beforeCas=()=>User.updateOne({telegramId:114},{$set:{isBanned:true}});
  assert.equal((await claim(114)).status,403);
  const user=await User.findOne({telegramId:114});assert.equal(user.balance,20);assert.equal(user.transactions.length,0);
});
test('missing bot secret rejects valid-looking credential before account creation',async()=>{
  const credential=signed(115);const token=process.env.BOT_TOKEN;delete process.env.BOT_TOKEN;
  try{assert.equal((await claim(115,{'x-telegram-init-data':credential})).status,401);assert.equal(await User.countDocuments(),0);}
  finally{process.env.BOT_TOKEN=token;}
});
test('malformed or missing legacy ledger state is not normalized into funds',async()=>{
  for(const [id,transactions] of [[116,'[]'],[117,null]]){
    const user=await User.create({telegramId:id});await User.collection.updateOne({_id:user._id},{$set:{transactions}});
    const before=await User.collection.findOne({_id:user._id});assert.equal((await claim(id)).status,409);
    assert.deepEqual(await User.collection.findOne({_id:user._id}),before);
  }
});
