import test from 'node:test';
import assert from 'node:assert/strict';
import {drainGiftNotifications} from '../bot/utils/giftNotifications.js';
test('notification claim requires majority acknowledgement before transport',async()=>{
 let calls=0,updates=0;
 const model={findOneAndUpdate(_q,_u,options){assert.deepEqual(options.writeConcern,{w:'majority'});return{lean:async()=>{throw Error('majority unavailable');}};},updateOne(){updates++;}};
 await assert.rejects(drainGiftNotifications(async()=>{calls++;},{DeliveryModel:model}),/majority unavailable/);
 assert.equal(calls,0);assert.equal(updates,0);
});
test('only pending jobs are claimed and state acknowledgements use majority',async()=>{
 let scans=0,sends=0;
 const model={findOneAndUpdate(query,_u,options){assert.deepEqual(query,{'notification.state':'pending'});assert.equal(options.writeConcern.w,'majority');return{lean:async()=>++scans===1?{_id:'id',notification:{telegramId:'123',giftName:'Gift',price:1,senderName:'Sender'}}:null};},async updateOne(_q,update,options){assert.equal(options.writeConcern.w,'majority');assert.equal(update.$set['notification.state'],'sent');}};
 assert.equal(await drainGiftNotifications(async()=>{sends++;return{message_id:99};},{DeliveryModel:model}),1);assert.equal(sends,1);
});
