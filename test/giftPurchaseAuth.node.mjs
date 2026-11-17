import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import User from '../bot/models/User.js';
import { createGiftPurchaseRouter } from '../bot/routes/giftPurchase.js';

// Execute the real registered middleware chain without opening a network socket or DB.
const previousToken=process.env.BOT_TOKEN, originalFind=User.findOne;
process.env.BOT_TOKEN='isolated-auth-fixture-not-a-real-secret';
after(()=>{User.findOne=originalFind;if(previousToken===undefined)delete process.env.BOT_TOKEN;else process.env.BOT_TOKEN=previousToken;});
const alice={_id:'alice-object-id',accountId:'alice',telegramId:111}, bob={_id:'bob-object-id',accountId:'bob',telegramId:222};
User.findOne=selector=>({select:()=>({lean:async()=>selector.telegramId===111?alice:selector.telegramId===222?bob:null})});
function signed(id) {
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id})});
  const secret=createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash',createHmac('sha256',secret).update([...params.entries()].map(([k,v])=>`${k}=${v}`).sort().join('\n')).digest('hex'));return params.toString();
}
async function invoke(headers={}, fromAccount='alice', method='post') {
  let calls=0, authorization;
  const router=createGiftPurchaseRouter(async(_body,authorize)=>{calls++;authorization=authorize;return {requestId:'fixture'};});
  const handlers=router.stack.find(layer=>layer.route?.methods?.[method]).route.stack.map(layer=>layer.handle);
  const req={body:{fromAccount,toAccount:'bob',gift:'fireworks',requestId:randomUUID()},get:name=>headers[name.toLowerCase()]};
  const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  let next=false;await handlers[0](req,res,()=>{next=true;});if(next)await handlers[1](req,res);
  return {res,calls,authorization};
}
test('unsigned account and google identity headers cannot debit',async()=>{for(const headers of [{'x-tpc-account-id':'alice'},{'x-google-id':'victim'},{authorization:'Bearer arbitrary'}]){const result=await invoke(headers);assert.equal(result.res.code,401);assert.equal(result.calls,0);}});
test('tampered signed credential cannot reach delivery',async()=>{const result=await invoke({'x-telegram-init-data':signed(111).replace('111','222')});assert.equal(result.res.code,401);assert.equal(result.calls,0);});
test('signed other user cannot forge body sender',async()=>{const result=await invoke({'x-telegram-init-data':signed(222)});assert.equal(result.res.code,403);assert.equal(result.calls,0);});
test('signed owner accepted and service authorization binds canonical DB id',async()=>{const result=await invoke({'x-telegram-init-data':signed(111),'x-tpc-account-id':'bob'});assert.equal(result.res.code,200);assert.equal(result.calls,1);assert.equal(result.authorization(alice),true);assert.equal(result.authorization({...alice,_id:'other'}),false);assert.equal(result.authorization({...alice,isBanned:true}),false);assert.equal(result.authorization(bob),false);});

test('gift session requires signed credentials and resolves canonical account',async()=>{const denied=await invoke({},'alice','get');assert.equal(denied.res.code,401);const valid=await invoke({'x-telegram-init-data':signed(111),'x-tpc-account-id':'bob'},'bob','get');assert.equal(valid.res.body.accountId,'alice');assert.equal(valid.res.body.purchasingEnabled,true);assert.equal(valid.calls,0);});
test('gift session explicitly reports configured provider unavailability',async()=>{process.env.NFT_API_BASE_URL='https://fixture.invalid';try{const r=await invoke({'x-telegram-init-data':signed(111)},'alice','get');assert.equal(r.res.body.purchasingEnabled,false);assert.match(r.res.body.error,/provider/);}finally{delete process.env.NFT_API_BASE_URL;}});
