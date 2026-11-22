import test from 'node:test';
import assert from 'node:assert/strict';
import {openIsolatedPresaleOrders as open} from '../bot/presale/isolatedMongoOrders.mjs';
const input={buyerId:'buyer',idempotencyKey:'one',offerVersion:'draft',recipientBindingId:'not-verified',paymentPolicyId:'disabled',deliveryPolicyId:'disabled',paymentUnits:'100',tokenUnits:'250'};
const observation={network:'mainnet',receiptHash:'a'.repeat(64),provider:'fixture'};
const copy=structuredClone;
// Contract fake, NOT evidence of Mongo transaction correctness or disk durability.
async function fixture(){
 let data={};let calls=0;let conflict=false;
 const collection=name=>({
  async findOne(q){calls++;return copy((data[name]??[]).find(r=>Object.entries(q).every(([k,v])=>r[k]===v))??null);},
  async createIndex(){},
  async updateOne(q,u){data[name]??=[];if(!data[name].length)data[name].push({...q,...u.$setOnInsert});},
  async insertOne(row){(data[name]??=[]).push(copy(row));},
  async findOneAndUpdate(q,u){
   if(conflict)return {value:null};
   const r=(data[name]??[]).find(r=>Object.entries(q).every(([k,v])=>r[k]===v));
   if(!r)return {value:null};
   Object.assign(r,u.$set);r.revision+=u.$inc.revision;return {value:copy(r)};
  }
 });
 const client={
  db:()=>({command:async()=>({setName:'fixture',logicalSessionTimeoutMinutes:30}),listCollections:()=>({toArray:async()=>[]}),collection}),
  startSession:()=>({async withTransaction(fn){const before=copy(data);try{return await fn();}catch(e){data=before;throw e;}},async endSession(){}})
 };
 const repo=await open({client,databaseName:'tpg_presale_isolated_contract',purpose:'isolated-presale-preparation'});
 const row=await repo.create(input);
 return {repo,row,rows:n=>data[n],calls:()=>calls,conflict:()=>{conflict=true;}};
}
test('reject scalar coercion and selectors before querying',async()=>{
 const f=await fixture();const before=f.calls();
 for(const id of [null,undefined,{$ne:null},['a'.repeat(64)],{toString:()=>'a'.repeat(64)},42]){
  await assert.rejects(f.repo.get(id),/invalid/);await assert.rejects(f.repo.getOutbox(id),/invalid/);
  await assert.rejects(f.repo.recordObservation(id,observation),/invalid/);
 }
 for(const receiptHash of [{$ne:null},['a'.repeat(64)],{toString:()=>'a'.repeat(64)}])
  await assert.rejects(f.repo.recordObservation(f.row._id,{...observation,receiptHash}),/invalid/);
 assert.equal(f.calls(),before);await assert.rejects(f.repo.create(null),/server-owned/);
});
test('observations cannot downgrade progressed orders or corrupt revisions',async()=>{
 for(const status of ['delivery_reserved','delivered','submission_unknown','cancelled']){
  const f=await fixture();f.rows('presale_orders')[0].status=status;
  await assert.rejects(f.repo.recordObservation(f.row._id,observation),/state/);
  assert.equal(f.rows('presale_receipts'),undefined);assert.equal((await f.repo.get(f.row._id)).status,status);
 }
 for(const revision of [-1,1.2,'0',Number.MAX_SAFE_INTEGER]){
  const f=await fixture();f.rows('presale_orders')[0].revision=revision;
  await assert.rejects(f.repo.recordObservation(f.row._id,observation),/state/);
 }
});
test('missing mismatched or unblocked outbox refuses receipt writes',async()=>{
 for(const change of [rows=>rows.pop(),rows=>rows[0].status='ready',rows=>rows[0].orderId='wrong']){
  const f=await fixture();change(f.rows('presale_outbox'));
  await assert.rejects(f.repo.recordObservation(f.row._id,observation),/blocked outbox/);
  assert.equal(f.rows('presale_receipts'),undefined);
 }
});
test('CAS conflict throws and asks transaction to abort receipt insertion',async()=>{
 const f=await fixture();f.conflict();
 await assert.rejects(f.repo.recordObservation(f.row._id,observation),/revision conflict/);
 assert.equal(f.rows('presale_receipts'),undefined);
 assert.equal((await f.repo.get(f.row._id)).revision,0);
});
test('replays stay unverified, receipt reuse refused and delivery always disabled',async()=>{
 const f=await fixture();
 const row=await f.repo.recordObservation(f.row._id,{...observation,finalized:true,delivered:true,verified:true,status:'delivered'});
 assert.equal(row.status,'payment_observed_unverified');assert.equal(row.verified,undefined);
 assert.deepEqual(await f.repo.recordObservation(f.row._id,observation),row);
 const second=await f.repo.create({...input,idempotencyKey:'two'});
 await assert.rejects(f.repo.recordObservation(second._id,observation),/another order/);
 assert.equal((await f.repo.getOutbox(f.row._id)).status,'blocked');
 await assert.rejects(f.repo.claimForDelivery(),/delivery-disabled/);
 f.rows('presale_orders')[0].status='delivered';
 await assert.rejects(f.repo.recordObservation(f.row._id,observation),/state/);
});
