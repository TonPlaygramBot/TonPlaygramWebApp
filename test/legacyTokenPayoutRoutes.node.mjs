import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const dir=await mkdtemp(join(tmpdir(),'wallet-closed-'));
let api;
try{
 const file=join(dir,'router.mjs');
 await build({stdin:{contents:`export {default as wallet} from './bot/routes/wallet.js';`,resolveDir:new URL('../',import.meta.url).pathname},bundle:true,platform:'node',format:'cjs',outfile:file.replace('.mjs','.cjs'),plugins:[{name:'no-external-effects',setup(b){
  b.onResolve({filter:/.*/},a=>{
   if(!/bot\/routes\/(wallet|account)\.js$/.test(a.importer))return;
   if(a.path==='express'||a.path==='crypto'||/middleware\/auth\.js|mobileStorePolicy/.test(a.path))return;
   return {path:a.path,namespace:'fake'};
  });
  b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`
   const forbidden=()=>{globalThis.walletForbiddenEffects++;throw Error('Unexpected side effect');};
   export default new Proxy({}, {get:()=>forbidden});
   export const withProxy=forbidden,ensureTransactionArray=forbidden,calculateBalance=forbidden,resolveAccountBalance=forbidden,
    sendTransferNotification=forbidden,sendTPCNotification=forbidden,sendGiftNotification=forbidden,sendStorePurchaseNotification=forbidden,
    verifyRequestedIdentity=forbidden,identityOwnsUser=forbidden,sendIdentityError=forbidden,mintGiftNFT=forbidden,generateWalletAddress=forbidden,
    fetchTelegramInfo=forbidden,applyStoreItemDelivery=forbidden,createMemoryUser=forbidden,findMemoryUser=forbidden,saveMemoryUser=forbidden,
    shouldUseMemoryUserStore=forbidden,v4=forbidden;
   export const POOL_ROYALE_STORE_ITEMS=[],SNOOKER_ROYALE_STORE_ITEMS=[];
  `,loader:'js'}));
 }}]});
 api=(await import(pathToFileURL(file.replace('.mjs','.cjs')))).default;
}finally{await rm(dir,{recursive:true,force:true});}
async function invoke(router,path,body,authenticated=true){
 const route=router.stack.find(l=>l.route?.path===path&&l.route.methods.post).route;
 const req={body,get:n=>authenticated&&n==='x-tpc-account-id'?'fixture-account':undefined};
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 for(const layer of route.stack){let next=false;await layer.handle(req,res,()=>{next=true;});if(!next)break;}
 return res;
}
test('both external payout routes reject before DB effects; reward routes remain separately registered',async()=>{
 const old={mobile:process.env.MOBILE_STORE_MODE,withdraw:process.env.WITHDRAW_ENABLED};globalThis.walletForbiddenEffects=0;
 try{
  for(const mobile of ['false','true'])for(const withdraw of ['false','true']){
   process.env.MOBILE_STORE_MODE=mobile;process.env.WITHDRAW_ENABLED=withdraw;
   for(const [router,path,code] of [[api.wallet,'/claim-external','legacy_token_retired'],[api.wallet,'/withdraw','legacy_token_retired']]){
    for(const body of [{},{accountId:'fixture-account',amount:100,address:'arbitrary',game:'pool'},{telegramId:99,amount:1e30,address:'arbitrary',network:'testnet'}]){
     for(let retry=0;retry<2;retry++){
      const res=await invoke(router,path,body);assert.equal(res.statusCode,403);
      assert.equal(res.body.code,mobile==='true'&&router===api.wallet?'mobile_store_free_play':code);
     }
    }
    assert.equal((await invoke(router,path,{},false)).statusCode,401);
   }
  }
  assert.ok(api.wallet.stack.some(l=>l.route?.path==='/deposit'&&l.route.methods.post));
  assert.equal(globalThis.walletForbiddenEffects,0,'no model, balance, transaction, notification or external API call');
 }finally{
  for(const [key,v] of [['MOBILE_STORE_MODE',old.mobile],['WITHDRAW_ENABLED',old.withdraw]]){if(v===undefined)delete process.env[key];else process.env[key]=v;}
  delete globalThis.walletForbiddenEffects;
 }
});
