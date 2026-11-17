// Execute the actual registered handler block without booting Mongo/Telegram.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGameCallMembership } from '../services/gameCallMembership.js';
import { emitDirectSocket, emitLiveChatMembers } from '../services/socialSocketRegistry.js';
const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf("  socket.on('liveChat:join'"),source.indexOf("  socket.on('friendCall:invite'"));
const pruning=source.slice(source.indexOf('function pruneGameCallRoom('),source.indexOf('// End stale established peer sessions'));
function fixture(){
 const sockets=new Map(),liveChatRooms=new Map(),tableMap=new Map();
 const io={sockets:{sockets}},roomId='live-ludobattleroyal-match-one';
 const guard=createGameCallMembership({tableMap,getSocket:id=>sockets.get(id),now:()=>1000});
 const normalizeLiveChatRoomId=id=>`livechat:${String(id||'').trim()}`;
 const sendLiveChatPeers=(id,excluded,event,data)=>emitLiveChatMembers(io,liveChatRooms.get(id),excluded,event,data);
 const ensureLiveChatRoom=id=>{if(!liveChatRooms.has(id))liveChatRooms.set(id,new Map());return liveChatRooms.get(id);};
 const privateCalls={canJoin:(id,accountId)=>id==='friend-call-ok'&&['account-a','account-b'].includes(accountId),get:()=>({state:'accepted'})};
 const requireSocialSocket=async socket=>{if(!socket.data.socialAuth?.auth.socialVerified)throw Error('unsigned');return socket.data.socialAuth.user;};
 const bind=new Function('socket','io','liveChatRooms','gameCallMembership','requireSocialSocket','privateCalls','normalizeLiveChatRoomId','sendLiveChatPeers','ensureLiveChatRoom','emitDirectSocket',pruning+handlers+';return pruneGameCallRoom;');
 function add(id,accountId,verified=true){
  const callbacks={},events=[];
  const socket={id,connected:true,events,data:{playerId:accountId,...(verified?{socialAuth:{expiresAt:Date.now()+100000,auth:{socialVerified:true,accountId},user:{accountId}}}:{})},on:(event,fn)=>callbacks[event]=fn,emit:(event,payload)=>events.push({event,payload}),leave:()=>{},join:()=>{throw Error('Must not join broadcast rooms');}};
  sockets.set(id,socket);
  socket.prune=bind(socket,io,liveChatRooms,guard,requireSocialSocket,privateCalls,normalizeLiveChatRoomId,sendLiveChatPeers,ensureLiveChatRoom,emitDirectSocket);
  socket.receive=(event,payload)=>callbacks[event](payload);return socket;
 }
 const a=add('a','account-a'),b=add('b','account-b');
 const table={gameType:'ludobattleroyal',players:[{id:'account-a',socketId:'a'},{id:'account-b',socketId:'b'}]};tableMap.set('match-one',table);
 return {a,b,add,table,tableMap,roomId,liveChatRooms};
}
const join=(s,roomId)=>s.receive('liveChat:join',{roomId,participant:{displayName:'forged'}});
test('actual handlers: authenticated seats join and signals reach exact socket only',async()=>{
 const x=fixture();await join(x.a,x.roomId);await join(x.b,x.roomId);
 const spy=x.add('watcher','other');
 await x.a.receive('liveChat:signal',{roomId:x.roomId,targetSocketId:'b',data:{type:'offer'}});
 assert.ok(x.b.events.some(e=>e.event==='liveChat:signal'));
 assert.equal(spy.events.length,0);
 assert.equal(x.liveChatRooms.get(`livechat:${x.roomId}`).get('a').displayName,'forged');
});
test('actual handlers: unsigned/spoofed/watcher/unknown game join denied',async()=>{
 const x=fixture();
 for(const s of [x.add('spoof','account-a',false),x.add('watcher','account-a'),x.add('stranger','other')]){
  await join(s,x.roomId);assert.equal(s.events.at(-1).payload.reason,'membership_required');
 }
 await join(x.a,'live-unknown-match-one');assert.equal(x.a.events.at(-1).payload.reason,'membership_required');
 assert.equal(x.liveChatRooms.size,0);
});
test('actual handlers: cross-match signal denied despite valid callers',async()=>{
 const x=fixture();await join(x.a,x.roomId);await join(x.b,x.roomId);
 await x.a.receive('liveChat:signal',{roomId:'live-ludobattleroyal-other',targetSocketId:'b',data:{type:'offer'}});
 assert.equal(x.b.events.some(e=>e.event==='liveChat:signal'),false);
});
test('actual handlers: removed target pruned before signal, receives stop notice',async()=>{
 const x=fixture();await join(x.a,x.roomId);await join(x.b,x.roomId);x.table.players.pop();
 await x.a.receive('liveChat:signal',{roomId:x.roomId,targetSocketId:'b',data:{type:'offer'}});
 assert.equal(x.b.events.some(e=>e.event==='liveChat:signal'),false);
 assert.ok(x.b.events.some(e=>e.payload.reason==='membership_required'));
 assert.ok(x.a.events.some(e=>e.event==='liveChat:peer-left'));
 assert.equal(x.b.data.liveChatRooms.size,0);
});
test('actual sweep: deleted table ends every member and releases map',async()=>{
 const x=fixture();await join(x.a,x.roomId);await join(x.b,x.roomId);x.tableMap.clear();x.a.prune(`livechat:${x.roomId}`);
 assert.equal(x.liveChatRooms.size,0);assert.equal(x.a.data.liveChatRooms.size,0);assert.equal(x.b.data.liveChatRooms.size,0);
});
test('actual handlers: unknown leaver cannot spoof peer-left',async()=>{
 const x=fixture();await join(x.a,x.roomId);const spy=x.add('spy','other');
 await spy.receive('liveChat:leave',{roomId:x.roomId});assert.equal(x.a.events.some(e=>e.event==='liveChat:peer-left'),false);
});
test('actual handlers: accepted private friend call remains supported',async()=>{
 const x=fixture();await join(x.a,'friend-call-ok');await join(x.b,'friend-call-ok');
 await x.a.receive('liveChat:signal',{roomId:'friend-call-ok',targetSocketId:'b',data:{type:'offer'}});
 assert.ok(x.b.events.some(e=>e.event==='liveChat:signal'));
});
test('actual authentication expiry callback tells game client to stop before removal',()=>{
 const start=source.indexOf('onExpire: (socket) => {')+'onExpire: '.length;
 const end=source.indexOf('\n});\nconst socialSockets',start);
 const x=fixture();x.a.data.liveChatRooms=new Set([`livechat:${x.roomId}`]);
 let removed=false;
 const expire=new Function('privateCalls','removeSocketFromLiveChat',`return ${source.slice(start,end)}`)({},()=>{removed=true;assert.ok(x.a.events.some(e=>e.payload.reason==='membership_required'));});
 expire(x.a);assert.equal(removed,true);
});
