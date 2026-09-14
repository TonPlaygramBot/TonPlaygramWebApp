// Execute production classes with controlled external dependencies. These are
// lifecycle and touch-input regressions; WebGL/network coverage is separate.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const web=createRequire(path.resolve(__dirname,'../webapp/package.json'));
const ts=web('typescript');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function load(file,deps={},globals={}){
  const module={exports:{}};
  const source=fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
  const code=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:key=>deps[key]||{},console,Map,Set,performance,...globals},{filename:file});
  return module.exports;
}
const street='webapp/src/games/tiranastreets/';
function runtimeFixture(){
  const character=deferred(),weapon=deferred(),document=new EventTarget(),window=new EventTarget();
  document.hidden=false;
  const queued=[],renders=[],optionalWork=[],published=[],prepared=[];
  const player={id:'local',weapon:'selected-gun',inventory:{'selected-gun':{ammo:10,reserve:30}},x:0,z:0,carId:null,speed:0};
  const state={players:{local:player},missionId:'free-roam',phase:'active',cars:[],npcs:[]};
  class Renderer{
    constructor(){
      this.renderer={domElement:new EventTarget()};
      this.collectionFleet={errors:new Map()};this.humans={errors:[]};
      this.bodyRig={errors:[],prepare:id=>{prepared.push(id);return weapon.promise;}};
      this.details={civic:{errors:[]},dajti:{errors:[]}};this.metrics={};
      this.yaw=0;this.pitch=0;this.fps=60;
    }
    setQuality(){}setRoute(){}orbit(){}
    load(){return character.promise;}
    render(...args){renders.push(args);optionalWork.push('scene streaming requested');}
  }
  class Simulation{
    constructor(){this.body={grounded:true,y:0};this.settings={};this.events=[];}
    pause(){}resume(){}setIntent(){}step(){}resolve(){return [];}objective(){return {title:'Test',detail:'',training:false};}
  }
  class Input{setEnabled(){}readStreet(){return {};}releaseAll(){}}
  class Audio{update(){}city(){}suspend(){}unlock(){return Promise.resolve();}}
  const profile={active:null,completed:['first-shift'],loadout:{weapon:player.weapon,inventory:{...player.inventory}}};
  const campaign={load:()=>profile,apply(){},saveExplore:p=>p,save:()=>true};
  const renderSettings=load(street+'renderSettings.ts');
  const {StreetCareerRuntime}=load(street+'street-career/StreetCareerRuntime.ts',{
    '../shared/engine.mjs':{createState:()=>state,FREE_ROAM:{id:'free-roam'},MISSIONS:[],navigation:()=>[]},
    '../shared/weapons.mjs':{WEAPONS:[],WEAPON_BY_ID:new Map(),STARTER_WEAPON:'starter',ensureStarterWeapons(){}},
    '../weaponStoreApi':{loadWeaponStoreAccount:async()=>({ownedWeaponIds:[]})},
    '../startingLoadout.mjs':{applyStartingLoadout(){},selectedStartingLoadout:()=>null},
    '../audio':{CityAudio:Audio},'./StreetRenderer':{StreetRenderer:Renderer},'./StreetInput':{StreetInput:Input},
    './StreetSimulation.mjs':{StreetSimulation:Simulation},'./campaignCore.mjs':{createCampaign:()=>campaign},
    './settings':{loadSettings:()=>({volume:0,targetFps:60,quality:'auto',shake:0})},'../renderSettings':renderSettings
  },{window,document,requestAnimationFrame:callback=>{queued.push(callback);return queued.length;}});
  // Construct the real class, including its instance-bound loop field. Only its
  // expensive graphics/network dependencies above are substituted.
  const runtime=new StreetCareerRuntime({},view=>published.push(view));
  const tick=now=>{const callback=queued.shift();assert.equal(typeof callback,'function');callback(now);};
  return {runtime,document,character,weapon,renders,optionalWork,published,prepared,queued,tick};
}

for(const first of ['character','weapon'])test(`runtime waits for both core assets when ${first} finishes first`,async()=>{
  const f=runtimeFixture(),loading=f.runtime.load(()=>{});
  assert.deepEqual(f.prepared,['selected-gun']);
  f.tick(16);assert.equal(f.renders.length,0);assert.equal(f.optionalWork.length,0);
  f[first].resolve();await flush();f.tick(48);
  assert.equal(f.runtime.ready,false);assert.equal(f.renders.length,0);assert.equal(f.optionalWork.length,0);
  f[first==='character'?'weapon':'character'].resolve();await loading;
  assert.equal(f.runtime.ready,true);assert.equal(f.runtime.paused,true);
  f.tick(80);assert.equal(f.renders.length,1);assert.equal(f.renders[0][2],0,'paused scene must stay static');
  assert.equal(f.optionalWork.length,1);
});

test('ready runtime suppresses hidden/context-error frames and stops scheduling after disposal',async()=>{
  const f=runtimeFixture(),loading=f.runtime.load(()=>{});f.character.resolve();f.weapon.resolve();await loading;
  f.tick(16);assert.equal(f.renders.length,1);
  f.document.hidden=true;f.tick(48);assert.equal(f.renders.length,1);
  f.document.hidden=false;f.runtime.graphicsError='context lost';f.tick(80);assert.equal(f.renders.length,1);
  f.runtime.graphicsError='';f.tick(112);assert.equal(f.renders.length,2);assert.equal(f.renders[1][2],0);
  f.runtime.disposed=true;f.tick(144);assert.equal(f.renders.length,2);assert.equal(f.queued.length,0);
});

test('selected-weapon failure and context loss during loading never enable scene work',async()=>{
  for(const reason of ['weapon','context']){
    const f=runtimeFixture(),loading=f.runtime.load(()=>{});
    if(reason==='weapon')f.runtime.renderer.bodyRig.errors.push('selected gun failed');
    else f.runtime.graphicsError='context lost';
    f.character.resolve();f.weapon.resolve();
    if(reason==='weapon')await assert.rejects(loading,/weapon could not load/);else await loading;
    f.tick(16);assert.equal(f.runtime.ready,false);assert.equal(f.renders.length,0);assert.equal(f.optionalWork.length,0);
  }
});

function touchFixture(){
  const window=new EventTarget(),document=new EventTarget();document.hidden=false;
  const globals={window,document,HTMLInputElement:class{},HTMLSelectElement:class{},HTMLTextAreaElement:class{}};
  const inputModule=load(street+'input.ts',{'./shared/engine.mjs':{emptyInput:()=>({x:0,y:0,fast:false,brake:false,fire:false,seq:0})}},globals);
  const {StreetInput}=load(street+'street-career/StreetInput.ts',{'../input':inputModule},globals);
  return {input:new StreetInput(()=>{},()=>{}),window,document};
}

for(const kind of ['jet','helicopter'])test(`${kind}: independent movement, UP, DOWN and fire touches reach actual flight controls`,async()=>{
  const {FlightSimulation}=await import('../webapp/src/games/tiranastreets/street-career/FlightSimulation.mjs');
  const {input,window}=touchFixture();
  const aircraft={id:kind,kind,x:0,z:0,y:30,heading:0,speed:0,verticalSpeed:0,pilot:'local',airborne:true,health:240,missiles:10,roll:0,pitch:0};
  const player={id:'local',aircraftId:kind,health:100};
  let shots=0;
  const sim={player,body:{yaw:0,pitch:0},state:{elapsed:1},intent:{},event(){},
    world:{surface:()=>0,cast:()=>({kind:'air',distance:Infinity}),clearance:()=>true},combat:{launch(){shots++;}},damage(){}};
  const flight=Object.create(FlightSimulation.prototype);flight.sim=sim;flight.aircraft=[aircraft];
  const tick=()=>{sim.intent=input.readStreet(0,0,false);flight.step(.1);};
  try{
    input.pointerDown(1,'move',35,700);input.touch.y=.8;
    input.pointerDown(2,'ascend',330,540);input.pointerDown(3,'fire',330,690);
    let before=aircraft.y;tick();assert.equal(sim.intent.y,.8);assert.equal(sim.intent.fast,true);
    assert.ok(aircraft.y>before,'UP must lift the aircraft');assert.ok(shots>0);
    input.pointerUp(2);before=aircraft.y;tick();assert.equal(aircraft.y,before);
    assert.equal(sim.intent.y,.8);assert.equal(sim.intent.fire,true,'releasing UP cannot release fire');
    input.pointerDown(4,'brake',330,600);before=aircraft.y;tick();
    assert.ok(aircraft.y<before,'DOWN must lower the aircraft');assert.equal(sim.intent.y,.8);
    input.pointerDown(5,'ascend',330,540);before=aircraft.y;tick();
    assert.ok(aircraft.y<before,'simultaneous UP and DOWN uses the controlled descent');
    input.pointerUp(4);before=aircraft.y;tick();assert.ok(aircraft.y>before,'remaining UP finger remains active');
    window.dispatchEvent(new Event('blur'));before=aircraft.y;tick();
    assert.equal(sim.intent.fast,false);assert.equal(sim.intent.brake,false);assert.equal(sim.intent.fire,false);assert.equal(sim.intent.y,0);
    assert.equal(aircraft.y,before,'blur releases altitude controls');
  }finally{input.destroy();}
});
