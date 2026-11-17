import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPausedPaidGame, rejectPausedPaidAction } from '../../lib/paidPlayPause.js';
const fail = () => { throw new Error('Unexpected mutation or delivery'); };
mock.module('../models/User.js', { defaultExport: new Proxy({}, { get: fail }) });
mock.module('../bot.js', { defaultExport: {} });
mock.module('../utils/notifications.js', { namedExports: { sendTransferNotification: fail, sendTPCNotification: fail, sendDepositNotification: fail, sendGiftNotification: fail, sendStorePurchaseNotification: fail } });
const { default: account } = await import('../routes/account.js');
const { default: profile } = await import('../routes/profile.js');
const { default: store } = await import('../routes/store.js');
const handlers = (router, path) => router.stack.find((l) => l.route?.path === path).route.stack.map((l) => l.handle);
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} });
test('affected stake aliases block positive, negative and malformed stakes; explicit zero free play remains', () => {
  for (const game of ['snake', 'SnakeAndLadder', 'pool', 'poolroyale', 'poolroyale-online']) {
    for (const stake of [1, '100', -1, NaN, undefined, Infinity, null, false, '', [], {}]) assert.equal(isPausedPaidGame(game, stake), true);
    for (const stake of [0, '0', { token: 'TPC', amount: 0 }]) assert.equal(isPausedPaidGame(game, stake), false);
  }
  assert.equal(isPausedPaidGame('chess', 100), false);
});
test('actual debit and all three purchase routes terminate before persistence', () => {
  const cases = [[profile, '/addTransaction', { amount: -100, game: 'poolroyale-online', type: 'stake' }],
    ...[[account, '/store-purchase'], [store, '/purchase-v2'], [store, '/purchase']].map(([r,p]) => [r,p,{ bundle: { items: [{ type: 'pool-training-attempt', price: 100 }] } }])];
  for (const [router, path, body] of cases) {
    assert.equal(handlers(router,path)[1], rejectPausedPaidAction);
    const res = response(); handlers(router,path)[1]({ body },res,fail);
    assert.equal(res.code,503); assert.equal(res.body.code,'paid_play_temporarily_paused');
  }
});
test('refunds, zero-value practice and unrelated purchases proceed past pause guard', () => {
  for (const body of [{ amount: 100, game: 'poolroyale-online', type:'stake_refund' }, { amount:0,game:'snake' }, { bundle:{items:[{type:'cue',price:50}]} }]) {
    let next=false; rejectPausedPaidAction({body},response(),()=>{next=true;}); assert.equal(next,true);
  }
});
test('server entry, delayed start, reconnect and legacy HTTP adapters all retain pause guards', () => {
  const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const central=server.slice(server.indexOf('async function seatTableSocket('),server.indexOf('async function reserveChessStakeContract'));
  assert.ok(central.indexOf('isPausedPaidGame(gameType, stake)') < central.indexOf('cleanupSeats()'));
  assert.match(central,/isPausedPaidGame\(tableMap.get\(forcedTableId\)/);
  const start=server.slice(server.indexOf('function maybeStartGame('),server.indexOf('function unseatTableSocket('));
  assert.equal((start.match(/isPausedPaidGame\(table.gameType, table.stake\)/g)||[]).length,2);
  assert.match(server,/isPausedPaidGame\(validation.normalizedGameType, validation.normalizedStake\)/);
  assert.match(server,/isPausedPaidGame\(pausedTable.gameType, pausedTable.stake \?\? pausedTable.amount\)/);
  assert.match(server,/const seated = await seatTableSocket/);
  assert.match(server,/if \(!seated\) return res.status\(503\)/);
});

import vm from 'node:vm';
test('actual Pool join/sync/frame/shot handlers stop paid rooms before registration/state/relay', async () => {
  const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  for (const event of ['joinPoolTable','poolSyncRequest','poolFrame','poolShot']) {
    const start=source.indexOf(`  socket.on('${event}'`);
    const end=source.indexOf('\n  });',start)+6;
    for (const stake of [100, {amount:100}, 0, {amount:0}]) {
      let handler, emitted, reachedRegistration=false;
      const socket={on(name, fn){assert.equal(name,event);handler=fn;},emit(name,body){emitted={name,body};},rooms:new Set(['room'])};
      const context={socket,tableMap:new Map([['room',{gameType:'poolroyale',stake,players:[]}]]),resolveTpcIdentity:()=> 'account',
        isPausedPaidGame,PAID_PLAY_PAUSE_CODE:'paid_play_temporarily_paused',ensureRegistered(){reachedRegistration=true;return false;}};
      vm.runInNewContext(source.slice(start,end),context);
      let callback;
      await handler({tableId:'room',accountId:'account',layout:[],state:{}}, result=>{callback=result;});
      if (isPausedPaidGame('poolroyale',stake)) {
        assert.equal(reachedRegistration,false);
        assert.equal(emitted.body.error,'paid_play_temporarily_paused');
        if (event==='joinPoolTable'||event==='poolShot') assert.equal(callback.error,'paid_play_temporarily_paused');
      } else {
        assert.equal(reachedRegistration,true,'free tournament/practice must pass pause guard');
        assert.equal(emitted.body.error,'seat_required');
      }
    }
  }
});
