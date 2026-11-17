// Real loopback Socket.IO, real signed Telegram verification and production
// register/seat/call functions. No server boot, external DB, bot or money effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { createRequire } from 'node:module';
// Both bot and webapp dependencies must be installed for this transport test.
const { io: client } = createRequire(new URL('../../webapp/package.json', import.meta.url))('socket.io-client');
import { resolveSocialUser, verifySocialCredentials } from '../middleware/socialAuth.js';
import { createSocialSocketRegistry, emitDirectSocket, emitLiveChatMembers } from '../services/socialSocketRegistry.js';
import { createGameCallMembership } from '../services/gameCallMembership.js';
import { GAME_ONLINE_POLICY, validateSeatTableRequest, normalizeOnlineGameType } from '../config/onlineGamePolicy.js';
import { resolvePrimaryTpcAccountNumber, hasConflictingPrimaryTpcIdentities } from '../utils/dominoRoyalOnline.js';
const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
const between=(a,b)=>{const start=source.indexOf(a);assert.ok(start>=0);const end=source.indexOf(b,start);assert.ok(end>start);return source.slice(start,end);};
const helpers=between('function normalizeTableSizeMeta(', 'function getChessState(')+
 between('function normalizeSidePreference(', 'function assignCheckersSides(')+
 between('async function seatTableSocket(', 'async function reserveChessStakeContract(')+
 between('function unseatTableSocket(', "app.get('/api/stats'");
const authHandler=between("  socket.on('social:authenticate'", '  racingExplore.attach(socket);');
const register=between("  socket.on('register'", "  socket.on('createLobby'");
const seat=between("  socket.on(\n    'seatTable'", "  socket.on('confirmReady'");
const calls=between("  socket.on('liveChat:join'", "  socket.on('friendCall:invite'");
const prune=between('function pruneGameCallRoom(', '// End stale established peer sessions');
const token='isolated-test-token-not-a-real-secret';
function signed(id){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id})});
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 p.set('hash',createHmac('sha256',secret).update([...p.entries()].map(([k,v])=>`${k}=${v}`).sort().join('\n')).digest('hex'));return p.toString();
}
const once=(socket,event)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(event,done);reject(Error(`timeout: ${event}`));},2000);function done(data){clearTimeout(timer);resolve(data);}socket.once(event,done);});
const ack=(socket,event,payload)=>socket.timeout(2000).emitWithAck(event,payload);

test('signed login -> actual register/seat -> isolated calls, spoof denial and reconnect', {timeout:15000}, async t=>{
 const http=createServer();const io=new Server(http,{serveClient:false});
 const clients=[],tableMap=new Map(),tableSeats=new Map(),liveChatRooms=new Map();
 const users=new Map([101,102,103].map(id=>[id,{telegramId:id,accountId:`account-${id}`,nickname:`Player ${id}`} ]));
 // Only external persistence is replaced: signed verification and canonical
 // account mapping still execute the production resolveSocialUser code.
 const registry=createSocialSocketRegistry({io,resolveUser:credentials=>resolveSocialUser(credentials,{
  verify:c=>verifySocialCredentials(c,{botToken:token}),findUser:async query=>users.get(query.telegramId)
 })});
 const guard=createGameCallMembership({tableMap,getSocket:id=>io.sockets.sockets.get(id)});
 const sendLiveChatPeers=(id,except,event,data)=>emitLiveChatMembers(io,liveChatRooms.get(id),except,event,data);
 const context={io,tableMap,tableSeats,liveChatRooms,gameCallMembership:guard,
  authenticateSocialSocket:registry.authenticate,removeSocialSocket:registry.remove,
  requireSocialSocket:registry.requireUser,privateCalls:{canJoin:()=>false},emitDirectSocket,sendLiveChatPeers,
  ensureLiveChatRoom:id=>{if(!liveChatRooms.has(id))liveChatRooms.set(id,new Map());return liveChatRooms.get(id);},
  normalizeLiveChatRoomId:id=>`livechat:${String(id||'').trim()}`,
  GAME_ONLINE_POLICY,validateSeatTableRequest,normalizeOnlineGameType,resolvePrimaryTpcAccountNumber,hasConflictingPrimaryTpcIdentities,
  MATCH_META_KEYS:[...new Set(Object.values(GAME_ONLINE_POLICY).flatMap(p=>p.allowMatchMeta))],
  lobbyTables:{},userSockets:new Map(),lastActionBySocket:new Map(),seatTableRateLimitMs:0,lobbySeatTtlMs:60000,
  ludoBattleStates:new Map(),randomUUID,
  // Never run database writes, invitations, game simulation or settlement.
  User:{updateOne:async()=>({})},registerConnection:async()=>{},deliverPendingInvites:()=>{},maybeStartGame:()=>{}
 };
 const bind=new Function(...Object.keys(context),helpers+prune+`return socket=>{${authHandler}${register}${seat}${calls};return {pruneGameCallRoom,unseatTableSocket};};`)(...Object.values(context));
 let serverActions;
 io.on('connection',socket=>{
  serverActions=bind(socket);
  socket.on('disconnect',()=>registry.remove(socket));
 });
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const c of clients)c.disconnect();for(const s of io.sockets.sockets.values())registry.remove(s);await new Promise(resolve=>io.close(resolve));});
 async function connect(id){const c=client(`http://127.0.0.1:${http.address().port}`,{forceNew:true,reconnection:false,transports:['websocket'],auth:{initData:signed(id)}});clients.push(c);await once(c,'connect');return c;}
 async function login(c,id){return ack(c,'social:authenticate',{initData:signed(id),accountId:'forged-victim'});}
 async function registerAndSeat(c,accountId,tableId){
  assert.equal((await ack(c,'register',{accountId})).success,true);
  return ack(c,'seatTable',{accountId,gameType:'ludobattleroyal',stake:1,maxPlayers:4,tableId});
 }
 async function join(c,roomId,event='liveChat:participants'){const reply=once(c,event);c.emit('liveChat:join',{roomId});return reply;}
 const a=await connect(101),b=await connect(102),attacker=await connect(103);
 assert.deepEqual(await login(a,101),{success:true,accountId:'account-101'});
 assert.equal((await login(b,102)).success,true);assert.equal((await login(attacker,103)).success,true);
 const seated=await registerAndSeat(a,'account-101');assert.equal(seated.success,true,JSON.stringify(seated));
 const tableId=seated.tableId,roomId=`live-ludobattleroyal-${tableId}`;
 assert.equal((await registerAndSeat(b,'account-102',tableId)).tableId,tableId);
 // Game simulation is not run; exercise the production started-table rejoin branch.
 tableMap.get(tableId).started=true;
 await join(a,roomId);assert.equal((await join(b,roomId)).participants.length,1);
 const offer=once(b,'liveChat:signal');a.emit('liveChat:signal',{roomId,targetSocketId:b.id,data:{type:'offer',sdp:'loopback-test'}});
 assert.equal((await offer).fromSocketId,a.id);
 // Legacy seating can be impersonated, but signed identity must still match.
 assert.equal((await registerAndSeat(attacker,'account-101',tableId)).success,true);
 assert.equal((await join(attacker,roomId,'liveChat:room-full')).reason,'membership_required');
 // Restore authentic owner via actual register/seat on new transport.
 const reconnected=await connect(101);await login(reconnected,101);
 assert.equal((await join(reconnected,roomId,'liveChat:room-full')).reason,'membership_required');
 assert.equal((await registerAndSeat(reconnected,'account-101',tableId)).success,true);
 await join(reconnected,roomId);
 // Late old-socket cleanup must not remove the restored seat.
 serverActions.unseatTableSocket('account-101',tableId,a.id);
 assert.equal(tableMap.get(tableId).players.find(p=>p.id==='account-101').socketId,reconnected.id);
 // Distinct authoritative table cannot receive this table's SDP.
 const other=await connect(103);await login(other,103);
 const otherSeat=await ack(other,'seatTable',{accountId:'account-103',gameType:'ludobattleroyal',stake:2,maxPlayers:4});
 assert.notEqual(otherSeat.tableId,tableId);const otherRoom=`live-ludobattleroyal-${otherSeat.tableId}`;await join(other,otherRoom);
 let leaked=false;other.on('liveChat:signal',()=>{leaked=true;});
 reconnected.emit('liveChat:signal',{roomId,targetSocketId:other.id,data:{type:'offer'}});
 await new Promise(resolve=>setTimeout(resolve,50));assert.equal(leaked,false);
 const stopped=once(reconnected,'liveChat:room-full');serverActions.unseatTableSocket('account-101',tableId,reconnected.id);serverActions.pruneGameCallRoom(`livechat:${roomId}`);
 assert.equal((await stopped).reason,'membership_required');
 // Tampering is rejected by real HMAC verification, not a mock verifier.
 const tampered=await ack(other,'social:authenticate',{initData:signed(103).replace('103','999')});assert.equal(tampered.success,false);
 assert.equal(io.sockets.sockets.get(other.id).data.socialAuth,undefined);
 const revoked=once(other,'liveChat:room-full');serverActions.pruneGameCallRoom(`livechat:${otherRoom}`);
 assert.equal((await revoked).reason,'membership_required');
});
