/** Synthetic state model ONLY: not a payment verifier, repository or signer. */
const exact = v => typeof v === 'string' && /^[1-9][0-9]*$/.test(v) && BigInt(v) < 2n ** 120n;
const id = v => typeof v === 'string' && /^fixture:[a-z0-9_-]+$/.test(v);
const copy = v => structuredClone(v);
export function createOfflineOrderModel() {
  const orders = new Map(), receipts = new Set();
  return {
    create(input) {
      const fields = ['id','buyer','recipient','paymentAsset','paymentDestination','tokenMaster'];
      if (fields.some(k=>!id(input[k])) || !exact(input.paymentUnits) || !exact(input.tokenUnits)) throw Error('synthetic exact order required');
      const order = Object.fromEntries([...fields,'paymentUnits','tokenUnits'].map(k=>[k,input[k]]));
      const prior = orders.get(order.id);
      const fingerprint = JSON.stringify(order);
      if (prior) { if (prior.fingerprint !== fingerprint) throw Error('idempotency conflict'); return copy(prior); }
      const row={...order,fingerprint,status:'awaiting_payment',revision:0};orders.set(row.id,row);return copy(row);
    },
    // Evidence here is a fabricated test event, NEVER an HTTP/client proof.
    observePayment(orderId,event) {
      const row=orders.get(orderId);if(!row) throw Error('unknown order');
      const matches=event?.fixtureVerified === true && id(event.receipt) &&
        ['buyer','paymentAsset','paymentDestination','paymentUnits'].every(k=>event[k]===row[k]) && event.orderId===row.id;
      if(!matches) throw Error('unverified or mismatched fixture payment');
      if(row.paymentReceipt===event.receipt) return copy(row);
      if(row.status!=='awaiting_payment' || receipts.has(event.receipt)) throw Error('duplicate or conflicting receipt');
      receipts.add(event.receipt);row.paymentReceipt=event.receipt;row.status='delivery_reserved';row.deliveryId=`${row.id}:delivery`;row.revision++;return copy(row);
    },
    beginAttempt(orderId,expectedRevision,messageHash) {
      const row=orders.get(orderId);
      if(!row || row.revision!==expectedRevision || row.status!=='delivery_reserved' || !id(messageHash)) throw Error('attempt refused');
      row.messageHash=messageHash;row.status='submission_unknown';row.revision++;return copy(row);
    },
    observeDelivery(orderId,event) {
      const row=orders.get(orderId);
      if(!row || !['submission_unknown','delivered'].includes(row.status) || event?.fixtureVerified!==true || !id(event.receipt) || event.messageHash!==row.messageHash || event.orderId!==row.id || ['recipient','tokenMaster','tokenUnits'].some(k=>event[k]!==row[k])) throw Error('unverified or mismatched fixture delivery');
      if(row.deliveryReceipt===event.receipt) return copy(row);
      if(row.status==='delivered' || receipts.has(event.receipt)) throw Error('receipt reused');
      receipts.add(event.receipt);row.deliveryReceipt=event.receipt;row.status='delivered';row.revision++;return copy(row);
    },
    get(orderId) {return copy(orders.get(orderId));}
  };
}
