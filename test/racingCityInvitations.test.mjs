import test from 'node:test';
import assert from 'node:assert/strict';
import {createExploreRooms} from '../bot/services/exploreRooms.mjs';
import {MALL_GAMES} from '../webapp/src/games/tirana-mall/mallCatalog.mjs';

function fixture() {
  let clock=100000;
  const engine={
    createState:()=>({players:{},elapsed:0}),
    addPlayer(state,member){state.players[member.id]={...member,x:0,z:0};},
    removePlayer(state,id){delete state.players[id];},
    control(){},interact(){},advanceState(){},publicState:state=>structuredClone(state)
  };
  const service=createExploreRooms({engine,autoTick:false,now:()=>clock,resolveProfile:async accountId=>({accountId,nickname:`Person ${accountId}`})});
  const socket=id=>({id,connected:true,data:{playerId:id,auth:{accountId:id}},emit(){},on(){}});
  const ask=(client,action,payload={})=>service.request(client,{accountId:client.id,clientId:client.id,action,...payload});
  async function join(id,options={}) {const client=socket(id),snapshot=await ask(client,'join',options);return {client,snapshot};}
  return {service,ask,join,advance(ms){clock+=ms;}};
}
const game=MALL_GAMES.find(game=>game.slug==='ludobattleroyal');
async function invite(f,a,b,extras={}) {
  return (await f.ask(a.client,'game-invite',{roomId:a.snapshot.id,to:b.snapshot.playerId,gameId:game.slug,...extras})).invitation;
}
const snap=(f,person)=>f.ask(person.client,'snapshot',{roomId:person.snapshot.id});
const answer=(f,person,invitation,accept)=>f.ask(person.client,'game-invite-response',{roomId:person.snapshot.id,id:invitation.id,accept});

test('city invitations resolve the game and both identities on the server and are private to the pair',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b'),c=await f.join('c');
  const invitation=await invite(f,a,b,{path:'https://attacker.example',from:c.snapshot.playerId,fromName:'Forged',gameName:'Fake'});
  assert.equal(invitation.path,game.route);assert.equal(invitation.gameName,game.name);
  assert.equal(invitation.from,a.snapshot.playerId);assert.equal(invitation.fromName,'Person a');
  assert.equal(invitation.toName,'Person b');assert.equal(invitation.status,'pending');
  assert.equal(invitation.expiresAt-invitation.createdAt,120000);
  assert.deepEqual((await snap(f,a)).invitations,[invitation]);
  assert.deepEqual((await snap(f,b)).invitations,[invitation]);
  assert.deepEqual((await snap(f,c)).invitations,[]);
});

test('unknown games, self invites, outsiders and other room members are rejected',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b',{private:true});
  await assert.rejects(invite(f,a,a),/Player unavailable/);
  await assert.rejects(invite(f,a,b),/Player unavailable/);
  const c=await f.join('c');
  await assert.rejects(invite(f,a,c,{gameId:'https://attacker.example'}),/Choose a game/);
  await assert.rejects(f.ask(b.client,'game-invite',{roomId:a.snapshot.id,to:c.snapshot.playerId,gameId:game.slug}),/Join/);
});

test('only the invited player can accept or decline, and an invitation can only be answered once',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b'),c=await f.join('c');
  const invitation=await invite(f,a,b);
  await assert.rejects(answer(f,a,invitation,true),/unavailable/);
  await assert.rejects(answer(f,c,invitation,true),/unavailable/);
  await assert.rejects(answer(f,b,invitation,'yes'),/Accept or decline/);
  const accepted=(await answer(f,b,invitation,true)).invitation;
  assert.equal(accepted.status,'accepted');assert.equal((await snap(f,a)).invitations[0].status,'accepted');
  await assert.rejects(answer(f,b,invitation,false),/already answered/);
});

test('accepted invitations survive the recipient entering the lobby, then expire for the waiting sender',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b');
  const invitation=await invite(f,a,b);await answer(f,b,invitation,true);
  await f.ask(b.client,'leave',{roomId:b.snapshot.id});
  assert.equal((await snap(f,a)).invitations[0].path,game.route);
  f.advance(120001);
  assert.deepEqual((await snap(f,a)).invitations,[]);
});

test('pending and declined invitations are removed when a participant leaves',async()=>{
  for(const decline of [false,true]) {
    const f=fixture(),a=await f.join('a'),b=await f.join('b'),invitation=await invite(f,a,b);
    if(decline)assert.equal((await answer(f,b,invitation,false)).invitation.status,'declined');
    await f.ask(b.client,'leave',{roomId:b.snapshot.id});
    assert.deepEqual((await snap(f,a)).invitations,[]);
  }
});

test('expired pending invitations cannot be accepted',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b'),invitation=await invite(f,a,b);
  f.advance(120001);
  await assert.rejects(answer(f,b,invitation,true),/expired/);
  assert.deepEqual((await snap(f,a)).invitations,[]);
});

test('blocking removes invitations on both sides and prevents new ones in either direction',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b'),invitation=await invite(f,a,b);
  await answer(f,b,invitation,true);
  await f.ask(a.client,'block',{roomId:a.snapshot.id,to:b.snapshot.playerId});
  assert.deepEqual((await snap(f,a)).invitations,[]);assert.deepEqual((await snap(f,b)).invitations,[]);
  await assert.rejects(invite(f,a,b),/Player unavailable/);await assert.rejects(invite(f,b,a),/Player unavailable/);
});

test('duplicate pending invitations are idempotent and repeated requests are rate-limited',async()=>{
  const f=fixture(),a=await f.join('a'),b=await f.join('b'),invitation=await invite(f,a,b);
  for(let i=0;i<3;i++)assert.equal((await invite(f,a,b)).id,invitation.id);
  assert.equal((await snap(f,a)).invitations.length,1);
  await assert.rejects(invite(f,a,b),/Too many/);
});
