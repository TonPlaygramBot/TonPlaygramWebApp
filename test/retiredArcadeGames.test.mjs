import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateSeatTableRequest, buildReadinessSnapshot } from '../bot/config/onlineGamePolicy.js';
import { getTpgGameContract } from '../bot/config/tpgGameContracts.js';
const retired = ['2048royale', 'hextrisbattle', 'underrunarena'];
test('retired games cannot acquire seats or advertise online/contracts', () => {
  for (const gameType of retired) {
    assert.deepEqual(validateSeatTableRequest({gameType,stake:0,maxPlayers:2}),{ok:false,error:'unsupported_game_type'});
    assert.equal(buildReadinessSnapshot()[gameType],undefined);
    assert.equal(getTpgGameContract(gameType),null);
  }
  assert.ok(buildReadinessSnapshot().poolroyale);
  assert.ok(buildReadinessSnapshot().snookerroyale);
  assert.ok(buildReadinessSnapshot().kartroyale);
});
test('legacy socket messages receive terminal response without creating state', () => {
  const source=fs.readFileSync(new URL('../bot/server.js',import.meta.url),'utf8');
  const start=source.indexOf("  for (const event of ['joinArcadeRace'");
  const end=source.indexOf("  socket.on('joinFourInRow'",start);
  const handlers=new Map();
  vm.runInNewContext(source.slice(start,end),{socket:{on:(event,callback)=>handlers.set(event,callback)}});
  assert.equal(handlers.size,4);
  for(const handler of handlers.values()) {
    let response;
    handler({tableId:'old-table',accountId:'old-user',score:900},value=>{response=value;});
    assert.equal(response.success,false);
    assert.equal(response.error,'game_retired');
    handler({});
  }
  assert.ok(!source.includes('arcadeRaceStates'));
});
test('retired bundles and asset/readiness registrations are removed',()=>{
  const app=fs.readFileSync(new URL('../webapp/src/App.jsx',import.meta.url),'utf8');
  for(const name of ['Game2048Royale','HextrisBattle','UnderrunArena','ArcadeRaceLobby']) assert.ok(!app.includes(name));
  for(const file of ['gameAssets.js','onlineContract.js']) {
    const source=fs.readFileSync(new URL('../webapp/src/config/'+file,import.meta.url),'utf8');
    for(const slug of retired) assert.ok(!source.includes(slug));
  }
});
