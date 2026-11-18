import test from 'node:test';
import assert from 'node:assert/strict';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {MongoClient} from 'mongodb';
import {openIsolatedPresaleOrders as open} from '../bot/presale/isolatedMongoOrders.mjs';
const input={buyerId:'buyer',idempotencyKey:'one',offerVersion:'draft',recipientBindingId:'not-verified',paymentPolicyId:'disabled',deliveryPolicyId:'disabled',paymentUnits:'100',tokenUnits:'250'};
test('real replica-set atomic idempotency, restart and permanently blocked outbox',async()=>{
 const repl=await MongoMemoryReplSet.create({replSet:{count:1},binary:{version:'7.0.14'}});
 let client;
 try{
  client=await MongoClient.connect(repl.getUri());
  const params={client,databaseName:'tpg_presale_isolated_test',purpose:'isolated-presale-preparation'};
  const repo=await open(params);
  const rows=await Promise.all(Array.from({length:8},()=>repo.create(input)));
  assert.equal(new Set(rows.map(r=>r._id)).size,1);
  assert.equal(await client.db(params.databaseName).collection('presale_outbox').countDocuments(),1);
  await assert.rejects(repo.create({...input,tokenUnits:'251'}));
  const obs={network:'mainnet',receiptHash:'a'.repeat(64),provider:'fixture',finalized:true,delivered:true};
  await repo.recordObservation(rows[0]._id,obs);
  assert.equal((await repo.getOutbox(rows[0]._id)).status,'blocked');
  await assert.rejects(repo.claimForDelivery());
  const second=await repo.create({...input,idempotencyKey:'two'});
  await assert.rejects(repo.recordObservation(second._id,obs));
  await client.close();client=await MongoClient.connect(repl.getUri());
  const reopened=await open({...params,client});
  assert.equal((await reopened.get(rows[0]._id)).status,'payment_observed_unverified');
  assert.equal((await reopened.getOutbox(rows[0]._id)).status,'blocked');
  await assert.rejects(open({...params,client,databaseName:'production'}));
  await client.db('tpg_presale_isolated_unrelated').collection('users').insertOne({fake:true});
  await assert.rejects(open({...params,client,databaseName:'tpg_presale_isolated_unrelated'}));
 }finally{await client?.close();await repl.stop();}
});
