import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameCallMembership, parseGameCallRoom } from '../services/gameCallMembership.js';
function setup() {
  let time=1000;
  const peer=(id,accountId)=>({id,connected:true,data:{socialAuth:{expiresAt:2000,auth:{socialVerified:true,accountId},user:{accountId}}}});
  const a=peer('a','account-a'),b=peer('b','account-b');
  const sockets=new Map([[a.id,a],[b.id,b]]);
  const table={gameType:'ludobattleroyal',players:[a,b].map(s=>({id:s.data.socialAuth.auth.accountId,socketId:s.id}))};
  const tableMap=new Map([['match-one',table]]);
  const guard=createGameCallMembership({tableMap,getSocket:id=>sockets.get(id),now:()=>time});
  return {a,b,table,tableMap,guard,expire:()=>{time=2000;},room:'live-ludobattleroyal-match-one'};
}
test('known exact prefixes including hyphens and aliases; unknown/default/noncanonical denied',()=>{
  assert.deepEqual(parseGameCallRoom('live-domino-royal-table-12'),{gameType:'domino-royal',tableId:'table-12'});
  assert.deepEqual(parseGameCallRoom('live-chessbattleroyal-table-12'),{gameType:'chess',tableId:'table-12'});
  for(const room of [null,{},'','room-id','live-unknown-a','live-snake-default','live-snake-',' live-snake-a','live-snake-a ','live-snake-'+'a'.repeat(257)]) assert.equal(parseGameCallRoom(room),null);
});
test('exact authenticated seat allowed; watcher and wrong game/match denied',()=>{
  const {guard,a,b,room}=setup();
  assert.equal(guard.allows(a,room),true);assert.equal(guard.allows(b,room),true);
  assert.equal(guard.allows(a,'live-ludobattleroyal-other'),false);
  assert.equal(guard.allows(a,'live-murlanroyale-match-one'),false);
  assert.equal(guard.allows({...a,id:'watcher',rooms:new Set(['match-one',room])},room),false);
});
test('legacy register and forged handshake account do not grant access',()=>{
  const {guard,a,room}=setup();a.data={playerId:'account-a'};a.handshake={auth:{accountId:'account-a',googleId:'forged'}};
  assert.equal(guard.allows(a,room),false);
});
for(const [name,mutate] of [
 ['unsigned auth',x=>{x.a.data.socialAuth.auth.socialVerified=false;}],
 ['identity change',x=>{x.a.data.socialAuth.auth.accountId='account-b';x.a.data.socialAuth.user.accountId='account-b';}],
 ['user identity mismatch',x=>{x.a.data.socialAuth.user.accountId='account-b';}],
 ['banned user',x=>{x.a.data.socialAuth.user.isBanned=true;}],
 ['expired credential',x=>x.expire()],
 ['disconnect',x=>{x.a.connected=false;}],
 ['removed seat',x=>x.table.players.shift()],
 ['replacement socket',x=>{x.table.players[0].socketId='replacement';}],
 ['deleted table',x=>x.tableMap.clear()],
 ['wrong authoritative game',x=>{x.table.gameType='snake';}],
 ['conflicting account alias',x=>{x.table.players[0].tpcAccountNumber='account-b';}]
])test(`revokes ${name}; prunes only invalid members`,()=>{
 const x=setup();const members=new Map([[x.a.id,{accountId:'account-a'}],[x.b.id,{accountId:'account-b'}]]);
 mutate(x);assert.equal(x.guard.allows(x.a,x.room),false);
 const removed=[];x.guard.prune(x.room,members,id=>removed.push(id));
 assert.ok(removed.includes(x.a.id));assert.equal(members.has(x.a.id),false);
 if(x.guard.allows(x.b,x.room))assert.equal(members.has(x.b.id),true);
});
test('pinned membership identity prevents switching to another valid seat',()=>{
 const x=setup();x.a.data.socialAuth.auth.accountId='account-b';x.a.data.socialAuth.user.accountId='account-b';x.table.players[1].socketId=x.a.id;
 assert.equal(x.guard.allows(x.a,x.room),true);assert.equal(x.guard.allows(x.a,x.room,'account-a'),false);
});
test('missing or alternate room-store roster fails closed',()=>{
 const x=setup();x.table.players=undefined;assert.equal(x.guard.allows(x.a,x.room),false);
});
