import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Address,Cell,beginCell,contractAddress} from 'ton-core';
import {inspectTestnetJettonTrace,createReadOnlyTestnetJettonVerifier} from '../bot/settlement/verifiers/toncenterTestnetJetton.mjs';
const codeFixture=JSON.parse(readFileSync(new URL('./fixtures/ton/standard-jetton-wallet-code.json',import.meta.url)));
const a=`0:${'11'.repeat(32)}`,b=`0:${'22'.repeat(32)}`,master=`0:${'33'.repeat(32)}`;
const code=Cell.fromBase64(codeFixture.walletCodeBoc),wallet=owner=>contractAddress(0,{code,data:beginCell().storeCoins(0).storeAddress(Address.parse(owner)).storeAddress(Address.parse(master)).storeRef(code).endCell()}).toRawString();
const source=wallet(a),destination=wallet(b),h=n=>n.toString(16).padStart(64,'0');
function fixture(){
 const row={id:h(9),createdAt:'2026-01-01T00:00:00.000Z',submissionHash:h(1),payload:{network:'testnet',kind:'p2p',asset:master,source:a,destination:b,amountBaseUnits:'123',reference:'fixture-only',idempotencyKey:'fixture'}};
 const policy={network:'testnet',master,profile:'standard-jetton-v1',...codeFixture};
 const request=beginCell().storeUint(0xf8a7ea5,32).storeUint(42,64).storeCoins(123).storeAddress(Address.parse(b)).storeAddress(Address.parse(a)).storeBit(false).storeCoins(1).storeBit(false).endCell();
 const transfer=beginCell().storeUint(0x178d4519,32).storeUint(42,64).storeCoins(123).storeAddress(Address.parse(a)).storeAddress(Address.parse(a)).storeCoins(1).storeBit(false).endCell();
 const msg=(id,from,to,body)=>({hash:h(id),source:from,destination:to,bounced:false,message_content:{hash:body.hash().toString('base64'),body:body.toBoc().toString('base64')}});
 const req=msg(2,a,source,request),delivery=msg(3,source,destination,transfer);
 const tx=(account,in_msg,out_msgs,lt)=>({hash:h(10+lt),account,in_msg,out_msgs,lt:String(lt),now:1767225601,mc_block_seqno:100,emulated:false,finality:'finalized',end_status:'active',account_state_before:{code_hash:codeFixture.walletCodeHash,account_status:'active'},account_state_after:{code_hash:codeFixture.walletCodeHash,account_status:'active'},description:{aborted:false,destroyed:false,compute_ph:{skipped:false,success:true,exit_code:0},action:{success:true,valid:true,result_code:0,skipped_actions:0}}});
 const origin=tx(a,{hash:h(1)},[req],1),sender=tx(source,structuredClone(req),[delivery],2),receiver=tx(destination,structuredClone(delivery),[],3);
 const trace={trace_id:h(20),is_incomplete:false,trace_info:{trace_state:'complete',pending_messages:0,transactions:3},transactions:{origin,sender,receiver}};
 return {row,policy,trace};
}
test('decodes actual BoCs and deterministic wallets: complete matching observation never authorizes settlement',()=>{const f=fixture();const r=inspectTestnetJettonTrace(f.row,f.trace,f.policy);assert.equal(r.providerObservedDelivery,true);assert.equal(r.providerFinalized,true);assert.equal(r.messageHash,h(3));assert.equal(r.amountBaseUnits,'123');assert.equal(r.finalized,false);assert.equal(r.delivered,false);assert.equal(r.settlementEligible,false);});
test('adversarial incomplete, fake, failed, mismatched or historical evidence stays closed',()=>{
 const changes=[f=>f.row.payload.network='mainnet',f=>f.row.payload.asset='native',f=>delete f.row.createdAt,f=>f.row.createdAt='2030-01-01',f=>f.row.submissionHash=h(90),f=>f.row.payload.amountBaseUnits='124',f=>f.row.payload.source=b,f=>f.policy.walletCodeHash=h(99),f=>f.trace.is_incomplete=true,f=>f.trace.trace_info.pending_messages=1,f=>f.trace.trace_info.transactions=9,f=>f.trace.transactions.receiver.emulated=true,f=>f.trace.transactions.receiver.finality='confirmed',f=>f.trace.transactions.receiver.description.aborted=true,f=>f.trace.transactions.receiver.description.action.success=false,f=>f.trace.transactions.receiver.description.action.skipped_actions=1,f=>f.trace.transactions.receiver.account_state_after.code_hash=h(99),f=>f.trace.transactions.sender.description.compute_ph.success=false,f=>f.trace.transactions.sender.in_msg.source=b,f=>f.trace.transactions.receiver.account_state_after.account_status='frozen',f=>f.trace.transactions.receiver.in_msg.hash=h(99),f=>f.trace.transactions.receiver.in_msg.bounced=true,f=>f.trace.transactions.receiver.in_msg.message_content.body=beginCell().storeUint(5,32).endCell().toBoc().toString('base64'),f=>f.trace.transactions.receiver.lt='1',f=>f.trace.transactions.origin.out_msgs.push(structuredClone(f.trace.transactions.origin.out_msgs[0])),f=>f.trace.transactions.extra=structuredClone(f.trace.transactions.receiver)];
 for(const change of changes){const f=fixture();change(f);const result=inspectTestnetJettonTrace(f.row,f.trace,f.policy);assert.notEqual(result.providerObservedDelivery,true,change.toString());assert.equal(result.finalized,false);}
});
test('fixed testnet read transport uses no caller endpoint, no default master and no supplied evidence',async()=>{
 const f=fixture();let calls=0;const read=createReadOnlyTestnetJettonVerifier({policies:[f.policy],fetchImpl:async(url,options)=>{calls++;assert.ok(url.startsWith('https://testnet.toncenter.com/api/v3/traces?'));assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(new URL(url).searchParams.get('msg_hash'),Buffer.from(h(1),'hex').toString('base64'));return {ok:true,text:async()=>JSON.stringify({traces:[f.trace]})};}});
 assert.equal((await read(f.row)).providerObservedDelivery,true);assert.equal(calls,1);
 assert.equal((await createReadOnlyTestnetJettonVerifier({fetchImpl:()=>{throw Error('must not fetch');}})(f.row)).reason,'master-not-allowlisted');
});
test('provider failures, ambiguity and schema omissions cannot become success',async()=>{const f=fixture();for(const reply of [{ok:false},{ok:true,text:async()=>'{bad'},{ok:true,text:async()=>JSON.stringify({traces:[]})},{ok:true,text:async()=>JSON.stringify({traces:[f.trace,f.trace]})},{ok:true,text:async()=>JSON.stringify({traces:[{}]})}])assert.notEqual((await createReadOnlyTestnetJettonVerifier({policies:[f.policy],fetchImpl:async()=>reply})(f.row)).providerObservedDelivery,true);});
test('positive provider observation cannot confirm a settlement intent through the real adapter',async()=>{
 const {createTestnetSettlement,createMemoryTestRepository}=await import('../bot/settlement/testnetSettlement.mjs');
 const f=fixture();for(const tx of Object.values(f.trace.transactions))tx.now=Math.floor(Date.now()/1000)+1;
 let observed=false;
 const service=createTestnetSettlement({repository:createMemoryTestRepository(),verifier:async row=>{const evidence=inspectTestnetJettonTrace(row,f.trace,f.policy);observed=evidence.providerObservedDelivery===true;return evidence;}});
 const row=await service.createIntent(f.row.payload);await service.markSubmitted(row.id,f.row.submissionHash);
 const outcome=await service.reconcile(row.id);assert.equal(observed,true);assert.equal(outcome.status,'reconciliation_required');
});
