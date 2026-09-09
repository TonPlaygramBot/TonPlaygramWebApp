// Execute the actual TypeScript class methods. Graphics/socket dependencies are
// stubs: these are lifecycle/input unit tests, not a WebGL or network E2E claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const { webcrypto } = require('node:crypto');
const fromWebapp = createRequire(path.resolve(__dirname, '../webapp/package.json'));
let ts;
try { ts = fromWebapp('typescript'); } catch { ts = require('typescript'); }
function load(file, deps = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: key => deps[key] || {},
    Date, console, crypto: webcrypto, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, ...globals }, { filename: file });
  return module.exports;
}
function runtimeFixture() {
  const { ExploreRuntime } = load('webapp/src/games/tirana-social/ExploreRuntime.ts');
  const runtime = Object.create(ExploreRuntime.prototype);
  let seq = 10;
  const sent = [], reports = [];
  runtime.visibleReady = true; runtime.paused = false; runtime.dead = false;
  runtime.pauseReasons = new Set(); runtime.yaw = 0; runtime.fps = 60;
  runtime.input = { clear() {}, setEnabled() {}, read() { return { x: 0, y: 0, yaw: 0, seq: ++seq, fire: false, fast: false, brake: false }; } };
  runtime.connection = { controls(p) { sent.push(p); } };
  runtime.publish = p => reports.push(p);
  return { runtime, sent, reports };
}
test('Explore pause cannot poison the input sequence: immediate next movement is newer', () => {
  const { runtime, sent } = runtimeFixture();
  runtime.pause(true);
  const paused = sent.at(-1);
  runtime.pause(false);
  const resumed = runtime.input.read();
  assert.ok(resumed.seq > paused.seq, `pause seq ${paused.seq} rejected subsequent seq ${resumed.seq}`);
  assert.equal(paused.brake, true);
});
test('Explore reports pause/resume immediately so blur and Escape cannot desynchronise the button', () => {
  const { runtime, reports } = runtimeFixture();
  runtime.pause(true); runtime.pause(false);
  assert.deepEqual(reports.map(r => r.paused), [true, false]);
});
test('Explore transport owns ordering instead of trusting mixed UI clock counters', () => {
  const { ExploreConnection } = load('webapp/src/games/tirana-social/ExploreConnection.ts');
  const c = new ExploreConnection('account', () => {}, () => {});
  c.controls({x:0,y:0,yaw:0,seq:999999999999,fire:true,brake:true,fast:false});
  const first = c.input.seq;
  c.controls({x:0,y:1,yaw:0,seq:1,fire:true,brake:false,fast:false});
  assert.ok(c.input.seq > first);
  assert.equal(c.input.fire, false);
});
const {EventEmitter}=require('node:events');
class FakeSocket extends EventEmitter {
  connected=true; calls=[]; gate=null;
  timeout(){return this;}
  connect(){this.connected=true;queueMicrotask(()=>super.emit('connect'));return this;}
  emit(event,...args){
    if(event==='register'){args[1](null,{success:true});return true;}
    if(event==='explore:request'){
      const [payload,ack]=args;this.calls.push(payload);
      const data=payload.action==='join'?{version:1,id:'room',playerId:'me',members:[],state:{players:{me:{}}}}:{accepted:true};
      if(payload.action==='join'&&this.gate)this.gate(()=>ack(null,{success:true,data}));
      else ack?.(null,{success:true,data});return true;
    }
    return super.emit(event,...args);
  }
}
function connectionFixture(){
 const socket=new FakeSocket(),timers=new Set(),statuses=[],errors=[];
 const {ExploreConnection}=load('webapp/src/games/tirana-social/ExploreConnection.ts',{'../../utils/socket.js':{socket,refreshSocketAuthIdentity(){}}},{
   setInterval(fn){timers.add(fn);return fn;},clearInterval(fn){timers.delete(fn);}
 });
 return {socket,timers,statuses,errors,c:new ExploreConnection('account',()=>{},e=>errors.push(e),s=>statuses.push(s))};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('Explore join is coalesced and installs one heartbeat/listener set',async()=>{
 const {c,socket,timers}=connectionFixture();await Promise.all([c.join('rpm-current'),c.join('rpm-current')]);assert.equal(socket.calls.filter(p=>p.action==='join').length,1);assert.equal(timers.size,1);assert.equal(socket.listenerCount('connect'),1);c.dispose();assert.equal(timers.size,0);assert.equal(socket.listenerCount('connect'),0);
});
test('Explore network reconnect re-registers/rejoins without mounting a second render loop',async()=>{
 const {c,socket,timers,statuses}=connectionFixture();await c.join('rpm-current');socket.connected=false;socket.emit('disconnect');assert.equal(timers.size,0);assert.equal(statuses.at(-1),'reconnecting');socket.connect();await settle();await settle();assert.equal(socket.calls.filter(p=>p.action==='join').length,2);assert.equal(timers.size,1);assert.equal(statuses.at(-1),'connected');c.dispose();
});
test('a late join acknowledgment after disposal leaves only its own server session',async()=>{
 const {c,socket,timers}=connectionFixture();let respond;socket.gate=fn=>{respond=fn;};const join=c.join('rpm-current');await settle();assert.equal(typeof respond,'function');c.dispose();respond();await join;assert.equal(timers.size,0);assert.equal(socket.calls.filter(p=>p.action==='leave').length,1);assert.equal(socket.calls.at(-1).clientId,socket.calls.find(p=>p.action==='join').clientId);
});
test('People panel is a separate input block and cannot permanently set user-pause',()=>{
 const {runtime}=runtimeFixture();runtime.networkAvailable=true;runtime.setOverlay(true);assert.equal(runtime.paused,false);runtime.setOverlay(false);assert.equal(runtime.paused,false);runtime.pause(true);runtime.setOverlay(true);runtime.setOverlay(false);assert.equal(runtime.paused,true);
});

test('a valid same-room snapshot recovers movement after a transient input timeout',async()=>{
 const {c,socket,statuses}=connectionFixture();await c.join('rpm-current');c.report(Error('temporary timeout'));assert.equal(statuses.at(-1),'error');
 socket.emit('explore:snapshot',{version:1,id:'room',playerId:'me',members:[],state:{players:{me:{}}}});
 assert.equal(statuses.at(-1),'connected');c.dispose();
});
function humanFixture(){
 const remote={id:'rpm-remote',url:'https://models.readyplayer.me/example.glb',roles:['civilian','police']};
 const chess={id:'rpm-current',url:'/assets/table-tennis/chess-human.glb',roles:['civilian','police']};
 const male={id:'athlete-male',url:'/assets/table-tennis/athlete-male.glb',roles:['civilian','police']};
 const female={id:'athlete-female',url:'/assets/table-tennis/athlete-female.glb',roles:['civilian','police']};
 const soldier={id:'mixamo-soldier',url:'/assets/tirana-streets/living/human.glb',roles:['soldier']};
 const {SharedHumans}=load('webapp/src/games/tiranastreets/street-career/SharedHumans.ts',{
   three:{Quaternion:class{},Euler:class{}},
   './humanRoster.mjs':{nearbyHumans:n=>n,actorRole:kind=>kind},
   './sharedCastCore.mjs':{chooseSharedHuman:()=>remote}
 });
 const humans=Object.create(SharedHumans.prototype);humans.dead=false;humans.cast=[remote,chess,male,female,soldier];humans.sources=new Map();humans.actors=new Map();humans.bikes=new Map();humans.held={pose(){}};
 const requested=[];humans.request=a=>requested.push(a);humans.pose=()=>{};humans.create=(n,asset)=>{const a={asset:asset.id,role:n.kind,root:{position:{set(){}},rotation:{set(){}}},label:{}};humans.actors.set(n.id,a);return a;};
 return {humans,requested,chess,male,female,soldier};
}
test('bundled existing humans are requested before optional remote Chess variants',()=>{
 const {humans,requested}=humanFixture();humans.primeLocalHumans();assert.deepEqual(requested.map(a=>a.id),['rpm-current','athlete-male','athlete-female','mixamo-soldier']);assert.ok(requested.every(a=>a.url.startsWith('/')));
});
test('a failed Chess download can fall back to an already loaded compatible game human',()=>{
 const {humans,male}=humanFixture();humans.sources.set(male.url,{});humans.update([{id:'me',kind:'civilian',x:0,z:0,heading:0,health:100,motion:'walk'}],{x:0,z:0},0,0.016);
 assert.equal(humans.actors.get('me').asset,male.id);
});
test('fallback selection never changes a soldier into a civilian',()=>{
 const {humans,soldier}=humanFixture();humans.sources.set(soldier.url,{});humans.update([{id:'me',kind:'civilian',x:0,z:0,heading:0,health:100,motion:'walk'}],{x:0,z:0},0,0.016);assert.equal(humans.actors.size,0);
});
