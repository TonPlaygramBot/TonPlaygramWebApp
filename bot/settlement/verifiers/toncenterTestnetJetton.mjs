import {Address,Cell,beginCell,contractAddress} from 'ton-core';
import {normalizeIntent} from '../testnetSettlement.mjs';
const URL_BASE='https://testnet.toncenter.com/api/v3/traces';
const fail=reason=>({finalized:false,delivered:false,settlementEligible:false,reason});
function hash(value){
 if(typeof value!=='string')throw Error('missing hash');
 if(/^[a-fA-F0-9]{64}$/.test(value))return value.toLowerCase();
 if(!/^[A-Za-z0-9+/_-]{43}=$/.test(value))throw Error('unsupported hash encoding');
 const bytes=Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64');if(bytes.length!==32)throw Error('invalid hash');return bytes.toString('hex');
}
function raw(value){return Address.parse(value).toRawString().toLowerCase();}
function good(tx){const d=tx?.description;return tx?.emulated===false&&(tx.finality==='finalized'||tx.finality===2)&&Number.isSafeInteger(tx.mc_block_seqno)&&tx.mc_block_seqno>0&&d?.aborted===false&&d.destroyed===false&&d.compute_ph?.skipped===false&&d.compute_ph.success===true&&[0,1].includes(d.compute_ph.exit_code)&&d.action?.success===true&&d.action.valid===true&&d.action.result_code===0&&d.action.skipped_actions===0;}
function body(message){if(message.bounced!==false)throw Error('bounced or ambiguous message');const content=message.message_content;const cell=Cell.fromBase64(content?.body);if(cell.hash().toString('hex')!==hash(content.hash))throw Error('body hash mismatch');return cell.beginParse();}
function walletAddress(owner,master,code){const data=beginCell().storeCoins(0).storeAddress(Address.parse(owner)).storeAddress(Address.parse(master)).storeRef(code).endCell();return contractAddress(0,{code,data}).toRawString();}
function pinned(tx,codeHash){return tx.end_status==='active'&&tx.account_state_after?.account_status==='active'&&hash(tx.account_state_after?.code_hash)===codeHash&&(!tx.account_state_before?.code_hash||hash(tx.account_state_before.code_hash)===codeHash);}
function requestMatches(message,p,sourceWallet){
 if(raw(message.source)!==p.source||raw(message.destination)!==sourceWallet)return null;
 const s=body(message);if(s.loadUint(32)!==0x0f8a7ea5)return null;
 const query=s.loadUintBig(64),amount=s.loadCoins(),destination=s.loadAddress();
 if(amount.toString()!==p.amountBaseUnits||destination.toRawString()!==p.destination)return null;
 return {query,hash:hash(message.hash)};
}
/** Validates provider-supplied message graph, NOT cryptographic block proofs.
 * Only standard-wallet storage/profile is supported. No production allowlist is supplied.
 * Success remains settlement-ineligible until the trust/approval gate is implemented.
 */
export function inspectTestnetJettonTrace(row,trace,policy){
 try{
  const p=normalizeIntent(row.payload);if(p.asset==='native')return fail('jetton-only');
  if(policy?.network!=='testnet'||policy.master!==p.asset||policy.profile!=='standard-jetton-v1')return fail('unapproved-or-unsupported-master-profile');
  const code=Cell.fromBase64(policy.walletCodeBoc),codeHash=code.hash().toString('hex');
  if(codeHash!==policy.walletCodeHash)return fail('pinned-code-mismatch');
  const created=Date.parse(row.createdAt);if(!Number.isFinite(created))return fail('immutable-intent-time-required');
  if(trace?.is_incomplete!==false||trace.trace_info?.trace_state!=='complete'||trace.trace_info.pending_messages!==0)return fail('incomplete-trace');
  const transactions=Object.values(trace.transactions||{});
  if(!transactions.length||transactions.length!==trace.trace_info.transactions)return fail('incomplete-transactions');
  const originHash=hash(row.submissionHash);
  const roots=transactions.filter(tx=>tx.in_msg&&hash(tx.in_msg.hash)===originHash&&raw(tx.account)===p.source);
  if(roots.length!==1||!good(roots[0]))return fail('origin-not-successful-and-finalized');
  const origin=roots[0];if(!Number.isSafeInteger(origin.now)||origin.now<Math.floor(created/1000))return fail('historical-or-undated-origin');
  const sourceWallet=walletAddress(p.source,p.asset,code),receiverWallet=walletAddress(p.destination,p.asset,code);
  const requests=[];
  for(const msg of origin.out_msgs||[]){try{const r=requestMatches(msg,p,sourceWallet);if(r)requests.push(r);}catch{}}
  if(requests.length!==1)return fail('missing-or-ambiguous-request');
  const request=requests[0];
  const sends=transactions.filter(tx=>tx.in_msg&&hash(tx.in_msg.hash)===request.hash&&raw(tx.account)===sourceWallet);
  if(sends.length!==1||!good(sends[0])||!pinned(sends[0],codeHash))return fail('untrusted-or-failed-sender-wallet');
  const send=sends[0];
  const receivedRequest=requestMatches(send.in_msg,p,sourceWallet);
  if(!receivedRequest||receivedRequest.query!==request.query||hash(send.in_msg.message_content.hash)!==hash(origin.out_msgs.find(m=>hash(m.hash)===request.hash).message_content.hash))return fail('inconsistent-request-edge');
  if(BigInt(send.lt)<=BigInt(origin.lt))return fail('invalid-message-order');
  // Reparse the recipient's incoming body; do not trust decoded opcode metadata.
  const matched=[];
  for(const msg of send.out_msgs||[]){
   if(raw(msg.destination)!==receiverWallet||raw(msg.source)!==sourceWallet)continue;
   const s=body(msg);if(s.loadUint(32)!==0x178d4519)continue;
   if(s.loadUintBig(64)!==request.query||s.loadCoins().toString()!==p.amountBaseUnits||s.loadAddress().toRawString()!==p.source)continue;
   const incoming=transactions.filter(tx=>tx.in_msg&&hash(tx.in_msg.hash)===hash(msg.hash)&&raw(tx.account)===receiverWallet);
   if(incoming.length!==1)continue;const receiver=incoming[0];
   if(!good(receiver)||!pinned(receiver,codeHash)||BigInt(receiver.lt)<=BigInt(send.lt))continue;
   if(raw(receiver.in_msg.source)!==sourceWallet||raw(receiver.in_msg.destination)!==receiverWallet)continue;
   if(hash(receiver.in_msg.message_content.hash)!==hash(msg.message_content.hash))continue;
   body(receiver.in_msg); // Independently validates BOC content/hash and bounce flag.
   matched.push(receiver);
  }
  if(matched.length!==1)return fail('recipient-delivery-not-established');
  const receiver=matched[0];
  return {finalized:false,delivered:false,settlementEligible:false,providerObservedDelivery:true,providerFinalized:true,verificationTrust:'single-toncenter-indexer-no-block-proofs',reason:'verified-observation-only-trust-gate-not-enabled',network:'testnet',kind:p.kind,asset:p.asset,source:p.source,destination:p.destination,amountBaseUnits:p.amountBaseUnits,intentId:row.id,reference:p.reference,submissionHash:originHash,transactionHash:hash(receiver.hash),messageHash:hash(receiver.in_msg.hash),recipientTransactionSucceeded:true,traceId:hash(trace.trace_id)};
 }catch{return fail('malformed-or-unsupported-evidence');}
}
export function createReadOnlyTestnetJettonVerifier({policies=[],fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 const pinnedPolicies=structuredClone(policies);
 return async row=>{
  try{
   const p=normalizeIntent(row.payload);const policy=pinnedPolicies.find(x=>x.master===p.asset&&x.network==='testnet');
   if(!policy)return fail('master-not-allowlisted');
   const submissionHash=hash(row.submissionHash);
   const url=new URL(URL_BASE);url.searchParams.set('msg_hash',Buffer.from(submissionHash,'hex').toString('base64'));url.searchParams.set('include_actions','false');url.searchParams.set('limit','2');
   const response=await fetchImpl(url.href,{method:'GET',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{accept:'application/json'}});
   if(!response.ok)return fail('testnet-provider-unavailable');
   const text=await response.text();if(text.length>2_000_000)return fail('provider-response-too-large');
   const data=JSON.parse(text);if(!Array.isArray(data.traces)||data.traces.length!==1)return fail('trace-missing-or-ambiguous');
   return inspectTestnetJettonTrace(row,data.traces[0],policy);
  }catch{return fail('read-failed-reconciliation-required');}
 };
}
