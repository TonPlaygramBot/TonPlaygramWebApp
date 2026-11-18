import { createHash } from 'node:crypto';

const key = v => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,120}$/.test(v);
const amount = v => typeof v === 'string' && /^[1-9][0-9]{0,35}$/.test(v) && BigInt(v) < 2n ** 120n;
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const options = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };
/** Isolated durable preparation ONLY. No signer, dispatcher or authoritative payment verifier.
 * Caller owns connection; never pass a production client/database. All outbox rows blocked.
 */
export async function openIsolatedPresaleOrders({ client, databaseName, purpose }) {
  if (purpose !== 'isolated-presale-preparation' || !/^tpg_presale_isolated_[a-z0-9_]+$/.test(databaseName || '')) throw Error('isolated database required');
  const hello = await client.db('admin').command({ hello: 1 });
  if (!hello.setName || !hello.logicalSessionTimeoutMinutes) throw Error('replica set with transactions required');
  const db = client.db(databaseName);
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name);
  const allowed = ['presale_meta','presale_orders','presale_outbox','presale_receipts'];
  if (names.some(n => !allowed.includes(n))) throw Error('unrelated database refused');
  const meta = db.collection('presale_meta');
  const existing = await meta.findOne({ _id: 'scope' });
  if (names.length && (!existing || existing.purpose !== purpose || existing.version !== 1)) throw Error('unknown database scope');
  await meta.updateOne({ _id: 'scope' }, { $setOnInsert: { purpose, version: 1 } }, { upsert: true, writeConcern: { w: 'majority' } });
  const orders=db.collection('presale_orders'), outbox=db.collection('presale_outbox'), receipts=db.collection('presale_receipts');
  await orders.createIndex({ buyerId: 1, idempotencyKey: 1 }, { unique: true });
  await outbox.createIndex({ orderId: 1 }, { unique: true });
  await receipts.createIndex({ network: 1, receiptHash: 1 }, { unique: true });
  async function transaction(fn) {
    const session=client.startSession();
    try { return await session.withTransaction(()=>fn(session), options); }
    finally { await session.endSession(); }
  }
  return {
    async create(input) {
      const fields=['buyerId','idempotencyKey','offerVersion','recipientBindingId','paymentPolicyId','deliveryPolicyId'];
      if(fields.some(k=>!key(input[k])) || !amount(input.paymentUnits) || !amount(input.tokenUnits)) throw Error('server-owned exact order required');
      const data=Object.fromEntries([...fields,'paymentUnits','tokenUnits'].map(k=>[k,input[k]]));
      const fingerprint=digest(data), id=digest([data.buyerId,data.idempotencyKey]);
      const create=()=>transaction(async session=>{
        const prior=await orders.findOne({_id:id},{session});
        if(prior){if(prior.fingerprint!==fingerprint)throw Error('idempotency conflict');return prior;}
        const row={_id:id,...data,fingerprint,status:'awaiting_verified_payment',revision:0,createdAt:new Date()};
        await orders.insertOne(row,{session});
        await outbox.insertOne({_id:id,orderId:id,status:'blocked',reason:'payment-verifier-and-delivery-policy-not-enabled',createdAt:row.createdAt},{session});
        return row;
      });
      try{return await create();}catch(error){
        if(error.code!==11000)throw error;
        const prior=await orders.findOne({_id:id});
        if(!prior || prior.fingerprint!==fingerprint)throw Error('idempotency conflict');return prior;
      }
    },
    async recordObservation(orderId, observation) {
      // Store observation only. Even an injected finalized=true can never activate delivery.
      if(!/^[a-f0-9]{64}$/.test(orderId) || observation?.network!=='mainnet' || !/^[a-f0-9]{64}$/.test(observation.receiptHash) || !key(observation.provider))throw Error('invalid observation');
      return transaction(async session=>{
        const row=await orders.findOne({_id:orderId},{session});if(!row)throw Error('unknown order');
        const receipt={network:'mainnet',receiptHash:observation.receiptHash};
        const prior=await receipts.findOne(receipt,{session});
        if(prior){if(prior.orderId!==orderId)throw Error('receipt assigned to another order');return row;}
        await receipts.insertOne({...receipt,orderId,provider:observation.provider,trust:'unverified-observation-only',createdAt:new Date()},{session});
        const changed=await orders.findOneAndUpdate({_id:orderId,revision:row.revision},{$set:{status:'payment_observed_unverified'},$inc:{revision:1}},{session,returnDocument:'after',includeResultMetadata:true});
        return changed.value;
      });
    },
    async get(id){return orders.findOne({_id:id});},
    async getOutbox(id){return outbox.findOne({_id:id});},
    async claimForDelivery(){throw Error('delivery-disabled-no-approved-token-or-verifier');}
  };
}
