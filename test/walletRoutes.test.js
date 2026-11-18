import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {walletRouterUnderTest} from './legacyTokenPayoutRoutes.node.mjs';

test('HTTP payout requests return explicit retirement, never mutate or attempt rollback',async t=>{
 const priorMobile=process.env.MOBILE_STORE_MODE,priorWithdraw=process.env.WITHDRAW_ENABLED;
 process.env.MOBILE_STORE_MODE='false';process.env.WITHDRAW_ENABLED='true';
 globalThis.walletForbiddenEffects=0;
 const app=express();app.use(express.json());app.use('/api/wallet',walletRouterUnderTest);
 const server=app.listen(0,'127.0.0.1');
 await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 t.after(async()=>{await new Promise(r=>server.close(r));for(const[k,v]of[['MOBILE_STORE_MODE',priorMobile],['WITHDRAW_ENABLED',priorWithdraw]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}delete globalThis.walletForbiddenEffects;delete globalThis.walletTransferFixture;});
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['withdraw','claim-external']){
  const payload={accountId:'fixture-account',address:'untrusted-address',amount:50};
  for(let retry=0;retry<2;retry++){
   const r=await fetch(`${base}/api/wallet/${path}`,{method:'POST',headers:{'content-type':'application/json','x-tpc-account-id':'fixture-account'},body:JSON.stringify(payload)});
   assert.equal(r.status,403);assert.equal((await r.json()).code,'legacy_token_retired');
  }
  const unauth=await fetch(`${base}/api/wallet/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(unauth.status,401);
 }
 assert.equal(globalThis.walletForbiddenEffects,0,'No balance read/write, transaction insert, rollback, notification or TON call');
 // Preserve the legacy off-chain transfer scenario, but seed the test model
 // directly rather than manufacturing a credit through an insecure deposit.
 const sender={accountId:'sender',googleId:'google-sender',balance:75,transactions:[],async save(){}},receiver={accountId:'receiver',googleId:'google-receiver',balance:0,transactions:[],async save(){}};
 const users={sender,receiver};
 globalThis.walletTransferFixture={model:{findOne:async q=>users[q.accountId],findOneAndUpdate:async(q,update)=>{const u=users[q.accountId];u.balance+=update.$inc.balance;return u;}}};
 const sent=await fetch(`${base}/api/wallet/send`,{method:'POST',headers:{'content-type':'application/json','x-google-id':'google-sender'},body:JSON.stringify({fromAccountId:'sender',toAccountId:'receiver',amount:25,note:'fixture transfer'})});
 assert.equal(sent.status,200);assert.equal((await sent.json()).balance,50);
 assert.equal(sender.balance,50);assert.equal(receiver.balance,25);
 assert.equal(sender.transactions[0].type,'send');assert.equal(receiver.transactions[0].type,'receive');
 delete globalThis.walletTransferFixture;

});
