import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameModule} from './helpers/loadGameModule.cjs';
import {createExploreRooms} from '../bot/services/exploreRooms.mjs';
const base='webapp/src/games/tirana-social/';
const neutral=()=>({x:0,y:0,yaw:0,seq:0,fire:false,brake:false,fast:false});
function fakeSocket() {
  const handlers=new Map(), calls=[];
  const s={id:'socket-a',connected:true,calls,
    on(e,fn){if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(fn);return s;},
    off(e,fn){handlers.get(e)?.delete(fn);return s;},timeout(){return s;},connect(){s.connected=true;s.trigger('connect');return s;},
    emit(event,p,ack){calls.push({event,p});queueMicrotask(()=>ack?.(null,event==='register'?{success:true}:{success:true,data:p.action==='join'?{version:1,id:'room',playerId:'me',members:[],state:{players:{}},messages:[]}:{accepted:true}}));return s;},
    trigger(e,...args){for(const fn of [...handlers.get(e)||[]])fn(...args);},listeners:e=>handlers.get(e)?.size||0};return s;
}
function connection(socket) {
  const {ExploreConnection}=loadGameModule(base+'ExploreConnection.ts',{'../../utils/socket.js':{socket,refreshSocketAuthIdentity(){}}});
  return new ExploreConnection('account',()=>{},()=>{});
}
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
test('Explore pause and resume send monotonically increasing movement sequences',()=>{
  const source=loadGameModule(base+'ExploreRuntime.ts',{
    three:{},'three/examples/jsm/loaders/GLTFLoader.js':{},'../tiranastreets/FpsCity':{},
    '../tirana-expansion/WorldEnhancements':{},'../tiranastreets/street-career/SharedHumans':{},
    '../tiranastreets/audio':{},'../tiranastreets/input':{},'../tiranastreets/shared/engine.mjs':{},'./FacePanels':{}
  },{document:{hidden:false}});
  let seq=1000;const sent=[];
  const input={clear(){},setEnabled(){},read(){return {...neutral(),seq:++seq};}};
  const runtime=Object.assign(Object.create(source.ExploreRuntime.prototype),{input,visibleReady:true,yaw:0,connection:{controls:p=>sent.push(p)},publish(){},humans:{has:()=>false},paused:false,connected:true,userPaused:false,overlay:false,blurred:false,measuredFPS:0});
  source.ExploreRuntime.prototype.pause.call(runtime,true);
  source.ExploreRuntime.prototype.pause.call(runtime,false);
  sent.push(input.read());
  assert.ok(sent.at(-1).seq>sent[0].seq,'pause must use the same input sequence, not Date.now()*1000');
});
test('Explore re-registers and rejoins after a socket reconnect without duplicate listeners',async()=>{
  const socket=fakeSocket(),c=connection(socket);try{
    await c.join('rpm-current');socket.connected=false;socket.trigger('disconnect','transport close');socket.id='socket-b';socket.connected=true;socket.trigger('connect');await flush();
    assert.equal(socket.calls.filter(c=>c.event==='register').length,2);
    assert.equal(socket.calls.filter(c=>c.p.action==='join').length,2);
    assert.equal(socket.listeners('explore:snapshot'),1);
  }finally{c.dispose();}
});
test('Explore does not buffer social actions while offline',async()=>{
  const socket=fakeSocket(),c=connection(socket);try{await c.join('rpm-current');socket.connected=false;socket.trigger('disconnect');const before=socket.calls.length;
    await assert.rejects(c.request('chat',{text:'not for later'}),/connect|offline/i);
    assert.equal(socket.calls.length,before);
  }finally{c.dispose();}
});
function serviceWithDelayedProfile() {
  let release;const profile=new Promise(r=>release=r);
  const engine={createState(){return {players:{},cars:[]};},addPlayer(s,m){s.players[m.id]={...m};},removePlayer(s,id){delete s.players[id];},publicState:structuredClone,advanceState(){}};
  const service=createExploreRooms({engine,resolveProfile:()=>profile,autoTick:false});
  const socket={id:'s',connected:true,data:{playerId:'account',auth:{accountId:'account'}},emit(){}};
  const payload={accountId:'account',clientId:'client-a'};
  return {service,socket,payload,release:()=>release({accountId:'account',nickname:'Player'})};
}
test('Unmounting during profile resolution cancels the join instead of leaking a room seat',async()=>{
  const {service,socket,payload,release}=serviceWithDelayedProfile();
  try{const join=service.request(socket,{...payload,action:'join'});const rejected=assert.rejects(join,/cancel/i);
    const left=service.request(socket,{...payload,action:'leave',roomId:''});
    release();await Promise.all([left,rejected]);assert.equal(service.rooms.size,0);
  }finally{service.close();}
});
test('a cancelled StrictMode join does not block the replacement client',async()=>{
  const {service,socket,payload,release}=serviceWithDelayedProfile();
  try{const first=service.request(socket,{...payload,action:'join'});const rejected=assert.rejects(first,/cancel/i);
    await service.request(socket,{...payload,action:'leave',roomId:''});
    const second=service.request(socket,{...payload,clientId:'replacement',action:'join'});release();
    const [snapshot]=await Promise.all([second,rejected]);assert.equal(snapshot.members.length,1);assert.equal(service.rooms.size,1);
    await assert.rejects(service.request(socket,{...payload,action:'leave',roomId:snapshot.id}),/Join/);
  }finally{service.close();}
});
test('disposal removes every owned listener without disconnecting the app socket',async()=>{
  const socket=fakeSocket(),c=connection(socket);await c.join('rpm-current');c.dispose();
  for(const e of ['connect','disconnect','explore:snapshot','explore:left'])assert.equal(socket.listeners(e),0);
  assert.equal(socket.connected,true);assert.equal(socket.calls.at(-1).p.action,'leave');
});
test('duplicate reconnect notifications produce one registration and one membership',async()=>{
  const socket=fakeSocket(),c=connection(socket);try{await c.join('rpm-current');socket.connected=false;socket.trigger('disconnect');socket.connected=true;socket.trigger('connect');socket.trigger('connect');await flush();assert.equal(socket.calls.filter(c=>c.event==='register').length,2);}finally{c.dispose();}
});
test('connection sequences never follow hostile or stale caller timestamps',async()=>{
  const socket=fakeSocket(),c=connection(socket);try{await c.join('rpm-current');c.controls({...neutral(),seq:Number.MAX_SAFE_INTEGER});const first=c.input.seq;c.controls({...neutral(),seq:1});assert.equal(c.input.seq,first+1);assert.equal(c.input.fire,false);}finally{c.dispose();}
});
test('pause reasons compose: closing a panel never overrides a manual pause',()=>{
  const source=loadGameModule(base+'ExploreRuntime.ts',{three:{},'three/examples/jsm/loaders/GLTFLoader.js':{},'../tiranastreets/FpsCity':{},'../tirana-expansion/WorldEnhancements':{},'../tiranastreets/street-career/SharedHumans':{},'../tiranastreets/audio':{},'../tiranastreets/input':{},'../tiranastreets/shared/engine.mjs':{},'./FacePanels':{}},{document:{hidden:false}});
  const r=Object.assign(Object.create(source.ExploreRuntime.prototype),{input:{clear(){},setEnabled(){},read:neutral},connection:{controls(){}},publish(){},visibleReady:true,connected:true,humans:{has:()=>false},userPaused:false,blurred:false,overlay:false});
  r.pause(true);r.setOverlay(true);r.setOverlay(false);assert.equal(r.paused,true);r.pause(false);assert.equal(r.paused,false);r.setConnectionReady(false);assert.equal(r.paused,true);r.setConnectionReady(true);assert.equal(r.paused,false);
});
