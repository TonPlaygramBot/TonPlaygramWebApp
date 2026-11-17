import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.API_AUTH_TOKEN = 'isolated-containment-integration';
process.env.WITHDRAW_ENABLED = 'true';
process.env.MOBILE_STORE_MODE = 'false';
process.env.BOT_TOKEN = '123456:isolated-test';
const forbidden = () => { throw new Error('No notification or chain transmission allowed'); };
mock.module('../bot.js', { defaultExport: {} });
mock.module('../utils/tonClaim.js', { defaultExport: forbidden });
mock.module('../utils/notifications.js', { namedExports: { sendTransferNotification: forbidden, sendTPCNotification: forbidden, sendDepositNotification: forbidden, sendGiftNotification: forbidden, sendStorePurchaseNotification: forbidden } });
const { default: User } = await import('../models/User.js');
const { default: accounts } = await import('../routes/account.js');
const { default: wallet } = await import('../routes/wallet.js');
const { default: profile } = await import('../routes/profile.js');
const { default: store } = await import('../routes/store.js');

test('isolated HTTP routes + real Mongo preserve balances under containment and allow zero-value practice ledger', { timeout: 60000 }, async () => {
  let replica, server;
  try {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } });
    await mongoose.connect(replica.getUri());
    await User.create({ accountId:'isolated-player', telegramId:910001, referralCode:'isolated-player', balance:100,
      transactions:[{amount:100,type:'fixture',token:'TPG',status:'delivered'}] });
    const app=express(); app.use(express.json());
    app.use('/api/account',accounts); app.use('/api/wallet',wallet); app.use('/api/profile',profile); app.use('/api/store',store);
    server=app.listen(0,'127.0.0.1'); await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    const base=`http://127.0.0.1:${server.address().port}`;
    const post=async(path,body,authenticated=true)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(authenticated?{authorization:`Bearer ${process.env.API_AUTH_TOKEN}`}:{})},body:JSON.stringify(body)});
    const original=await User.findOne({accountId:'isolated-player'}).lean();
    const common={accountId:'isolated-player',telegramId:910001,amount:1000000,address:'not-a-real-address',transactionHash:'fake-proof'};
    const cases=[['/api/wallet/deposit',common],['/api/account/deposit',common],['/api/wallet/withdraw',common],['/api/wallet/claim-external',common],
      ['/api/profile/addTransaction',{...common,amount:-100,type:'stake',game:'poolroyale-online'}],
      ...['/api/account/store-purchase','/api/store/purchase','/api/store/purchase-v2'].map(path=>[path,{accountId:'isolated-player',bundle:{items:[{type:'pool-training-attempt',price:50,optionId:'5'}]}}])];
    for (const [path,body] of cases) {
      for(let replay=0;replay<2;replay++) {
        const response=await post(path,body);assert.equal(response.status,503,path);await response.json();
        assert.deepEqual(await User.findOne({accountId:'isolated-player'}).lean(),original,path+' mutated account');
        assert.equal(await User.countDocuments({}),1);
      }
    }
    assert.equal((await post('/api/wallet/deposit',{accountId:'unknown-account',amount:100})).status,503);
    assert.equal(await User.countDocuments({}),1,'no deposit upsert');
    assert.equal((await post('/api/wallet/deposit',common,false)).status,401);
    const address=await fetch(base+'/api/wallet/deposit-address');assert.equal(address.status,503);assert.equal((await address.json()).address,undefined);
    const practice=await post('/api/profile/addTransaction',{accountId:'isolated-player',telegramId:910001,amount:0,type:'practice',game:'poolroyale-online'});
    assert.equal(practice.status,200); await practice.json();
    const after=await User.findOne({accountId:'isolated-player'}).lean();
    assert.equal(after.balance,100);assert.equal(after.transactions.length,2);assert.equal(after.transactions.at(-1).amount,0);
    const balance=await post('/api/account/balance',{accountId:'isolated-player'});assert.equal(balance.status,200);assert.equal((await balance.json()).balance,100);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await mongoose.disconnect();
    if(replica) await replica.stop();
  }
});
