import {POLICE_UNITS,POLICE_MISSIONS,policeStage,interactPoliceMission,stepPoliceMission,failPoliceMission} from './policeCareerCore.mjs';
import {POLICE_STATION} from './ArrestSimulation.mjs';
import {WORLD} from '../shared/world.mjs';
import {WEAPON_BY_ID} from '../shared/weapons.mjs';
import {roadsidePoint} from '../shared/streetSafety.mjs';
import {steerNPC} from '../shared/npcNavigation.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {FORCE_VEHICLE_BOUNDS} from '../shared/albanianForces.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const actorKeys=['witness','suspect','protected','neighbor-1','neighbor-2','partner'];
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<15000&&Math.abs(p.z)<15000;
const places={station:POLICE_STATION,tabake:{x:620,z:225},petro:{x:1098,z:159},ali:{x:1215,z:6},
  rinia:{x:-37,z:277},pyramid:{x:220,z:494},mother:{x:238,z:1059},square:{x:0,z:0},
  safeAli:{x:1270,z:40},safePetro:{x:1140,z:210},safeSquare:{x:-60,z:85}};
/** A bounded local mission adapter. Existing fixed-step simulation owns damage,
 * collision and vehicles; this module only owns its six mission pedestrians. */
export class PoliceCareerController {
  constructor(sim,profile){
    this.sim=sim;this.profile=profile;this.run=profile.active;this.unit=POLICE_UNITS.find(u=>u.id===profile.unit);
    this.mission=POLICE_MISSIONS.find(m=>m.id===this.run?.id);this.actors=new Map();this.civilianHarmed=false;
    this.lastHealth=sim.player.health;this.lastDamage=sim.player.lastDamage;this.lastEvent=sim.eventSeq;this.notice='';
    if(!this.mission)return;
    this.anchors=Object.fromEntries(Object.entries(places).map(([key,p])=>[key,this.safePoint(p)]));
    const saved=this.run.snapshot;
    const p=sim.player;Object.assign(p,{policeUnit:this.unit.id,forceCharacter:this.unit.character,armor:this.unit.armor,wanted:0,weapon:''});
    const w=WEAPON_BY_ID.get(this.unit.weapon);if(w)p.inventory[w.id]={ammo:w.magazine,reserve:w.magazine*3};
    const start=validPoint(saved?.player)?this.safePoint(saved.player):this.anchors.station;
    p.x=start.x;p.z=start.z;p.carId=null;p.aircraftId=null;p.health=Number.isFinite(saved?.player?.health)?Math.max(1,Math.min(100,saved.player.health)):100;
    sim.body.y=groundHeight(p.x,p.z)+.08;sim.body.combat='unarmed';
    this.lastHealth=p.health;
    this.spawnActors(saved);
    const parking=this.parkVehicle({x:this.anchors.station.x+7,z:this.anchors.station.z+6});
    const carSaved=validPoint(saved?.vehicle)?saved.vehicle:null;
    this.vehicle={id:'police-duty-vehicle',x:parking.x,z:parking.z,heading:parking.heading,speed:0,vx:0,vz:0,steering:0,model:'police',
      forceVehicle:this.unit.vehicle,forceCharacter:this.unit.character,driver:null,health:180};
    if(carSaved){const pos=this.parkVehicle(carSaved);Object.assign(this.vehicle,pos,{health:Math.max(1,Math.min(180,carSaved.health||180))});}
    sim.state.cars.push(this.vehicle);
    if(saved?.player?.inDutyCar){p.carId=this.vehicle.id;this.vehicle.driver=p.id;p.x=this.vehicle.x;p.z=this.vehicle.z;sim.body.interaction='driving';}
    const original=sim.hooks.life.onDamage;
    sim.hooks.life.onDamage=(target,attacker)=>{
      original?.(target,attacker);
      if(attacker?.id!==p.id||target===p||target.kind==='gang'&&!target.custody)return;
      // All missions use de-escalation. Bystanders, colleagues and surrendered
      // suspects remain protected, including damage through the vehicle system.
      if(target.kind)this.civilianHarmed=true;
    };
    this.updateActorStates();
  }
  safePoint(p,radius=.5){
    for(const offset of [[0,0],[4,0],[-4,0],[0,4],[0,-4],[12,0],[-12,0],[0,12],[0,-12],[22,0],[-22,0]]){
      const candidate=roadsidePoint({x:p.x+offset[0],z:p.z+offset[1]},radius,true);
      if(candidate&&this.sim.world.clearance({...candidate,y:groundHeight(candidate.x,candidate.z)+.08},1.8,radius))return candidate;
    }
    const node=[...WORLD.graph.nodes].sort((a,b)=>(a[0]-p.x)**2+(a[1]-p.z)**2-(b[0]-p.x)**2-(b[1]-p.z)**2)
      .slice(0,100).find(n=>this.sim.world.clearance({x:n[0],z:n[1],y:groundHeight(n[0],n[1])+.08},1.8,radius));
    if(!node)throw Error('Nuk u gjet vend i sigurt për operacionin.');
    return {x:node[0],z:node[1]};
  }
  parkVehicle(p){
    const bounds=FORCE_VEHICLE_BOUNDS.find(v=>v.id===this.unit.vehicle)||{w:2.4,d:7,h:3};
    const occupied=this.sim.cars(),candidates=[];
    for(const [dx,dz] of [[0,0],[10,0],[-10,0],[0,10],[0,-10],[20,0],[-20,0],[0,20],[0,-20],[30,10],[-30,-10]]){
      const point=this.safePoint({x:p.x+dx,z:p.z+dz},bounds.w/2+.35);
      if(occupied.some(c=>distance(c,point)<(bounds.d/2+4)))continue;
      for(const heading of [p.heading||0,Math.PI/2,Math.PI/4,-Math.PI/4]){
        const probes=[point,...[-1,1].flatMap(side=>[-1,1].map(end=>({x:point.x+Math.cos(heading)*side*bounds.w/2+Math.sin(heading)*end*bounds.d/2,
          z:point.z-Math.sin(heading)*side*bounds.w/2+Math.cos(heading)*end*bounds.d/2})))];
        if(probes.every(q=>this.sim.world.clearance({...q,y:groundHeight(q.x,q.z)+.08},bounds.h,.3)))candidates.push({...point,heading});
      }
      if(candidates.length)return candidates[0];
    }
    // Keep the start recoverable if a dense traffic snapshot occupied every
    // nearby bay: the player can still enter this clear, stationary vehicle.
    return {...this.safePoint({x:p.x+45,z:p.z},bounds.d/2),heading:0};
  }
  spawnActors(saved){
    const site=this.anchors[this.mission.site],used=[];
    for(const [i,key] of actorKeys.entries()){
      if(key.startsWith('neighbor')&&this.mission.id!=='fnsh-evacuation'&&this.mission.id!=='fnsh-protest')continue;
      if(key==='suspect'&&!this.mission.steps.some(s=>s.actor==='suspect'))continue;
      const old=saved?.actors?.[key];let pos=this.safePoint({x:site.x+(i-1)*5,z:site.z+(i%2?5:-4)});
      for(let j=0;j<8&&used.some(p=>distance(p,pos)<1.7);j++)pos=this.safePoint({x:site.x+i*4+j*3,z:site.z+8+j*2});
      if(validPoint(old))pos=this.safePoint(old);used.push(pos);
      const actor={id:`police-duty-${key}`,x:pos.x,z:pos.z,y:groundHeight(pos.x,pos.z)+.08,heading:0,speed:0,health:Math.max(1,Math.min(100,old?.health||100)),
        kind:key==='partner'?'police':'civilian',forceCharacter:key==='partner'?this.unit.character:undefined,weapon:null,
        role:key==='suspect'?'suspect':key==='partner'?'duty-partner':'mission-civilian',motion:'walk',anim:'idle',
        custody:true,downUntil:Infinity,panicUntil:0,nextShot:Infinity,policeMission:true,inCustodyVehicle:old?.inCustodyVehicle===true};
      this.actors.set(key,actor);this.sim.state.npcs.push(actor);
    }
  }
  get stage(){return policeStage(this.run);}
  target(){const s=this.stage;return s?(s.actor&&['talk','warn','arrest','rescue','board'].includes(s.kind)?this.actors.get(s.actor):this.anchors[s.anchor]):null;}
  eligible(){
    const s=this.stage,p=this.sim.player,target=this.target();
    if(!s||!target||this.run.status!=='active'||p.health<=0||this.sim.arrest.locked)return false;
    const inCar=p.carId===this.vehicle.id,onFoot=!p.carId&&!p.aircraftId&&!this.sim.cableRide&&this.sim.body.grounded;
    if(s.kind==='drive')return inCar&&distance(p,target)<14&&Math.abs(p.speed)<2.5&&this.vehicle.health>0;
    if(s.kind==='board')return inCar&&distance(p,target)<9&&Math.abs(p.speed)<.6;
    if(!onFoot||Math.abs(p.speed)>1.3)return false;
    const range=s.kind==='warn'?9:s.kind==='hold'?8:s.kind==='escort'?7:s.kind==='report'?5:3;
    if(distance(p,target)>range)return false;
    const point={x:target.x,z:target.z,y:(target.y??groundHeight(target.x,target.z))+1};
    if(!this.sim.world.clear(this.sim.eye(),point))return false;
    if(s.kind==='report'&&this.run.arrested){const suspect=this.actors.get('suspect');if(!suspect||distance(suspect,target)>12)return false;}
    if(s.kind==='escort')return [...this.actors].filter(([k])=>k==='protected'||this.mission.id==='fnsh-evacuation'&&k.startsWith('neighbor')).every(([,n])=>n.health>0&&distance(n,target)<9);
    return true;
  }
  action(){
    if(!this.stage||this.run.status!=='active')return null;
    const enabled=this.eligible(),d=Math.round(distance(this.sim.player,this.target()));
    return {id:'police:interact',label:this.run.channel?`PO KRYHET · ${Math.ceil(this.stage.seconds-this.run.hold)}s`:this.stage.title,
      visible:true,enabled:enabled&&!this.run.channel,disabledReason:this.run.channel?'Qëndro në pozicion':enabled?'':
        this.stage.kind==='board'?'Afro mjetin e njësisë te pasagjeri':this.stage.kind==='drive'?'Drejto mjetin e njësisë dhe ndalo te pika':
        this.stage.kind==='escort'?'Qëndro afër grupit dhe çoje te pika e sigurt':this.stage.kind==='report'&&this.run.arrested?'Sill të ndaluarin në drejtori':`${d} m · afrohu në këmbë dhe ndalo`,
      targetId:this.target()?.id||null,priority:120,mode:'tap',kind:'police'};
  }
  interact(){return interactPoliceMission(this.run,{eligible:this.eligible()});}
  moveActor(n,goal,speed,dt){
    if(!n||n.health<=0)return;
    const clear=(a,b)=>this.sim.world.clear({...a,y:groundHeight(a.x,a.z)+1},{...b,y:groundHeight(b.x,b.z)+1});
    const to=steerNPC(n,goal,clear,this.sim.state.elapsed),d=distance(n,to),before={x:n.x,z:n.z};
    if(d>.2){const step=Math.min(d,speed*dt);n.heading=Math.atan2(n.x-to.x,n.z-to.z);
      this.sim.world.move(n,(to.x-n.x)/d*step,(to.z-n.z)/d*step,1.75,0);}
    n.y=groundHeight(n.x,n.z)+.08;n.speed=Math.min(speed,distance(before,n)/dt);n.anim=n.speed>.1?(speed>2.2?'run':'walk'):'idle';
  }
  updateActorStates(){
    const s=this.stage,suspect=this.actors.get('suspect'),person=this.actors.get('protected');
    if(suspect){suspect.surrendered=this.run.arrested||s?.kind==='arrest';suspect.anim=suspect.surrendered?'idle':'walk';suspect.weapon=null;}
    if(person&&this.run.boarded){person.motion='drive';person.speed=0;}
  }
  step(dt){
    if(!this.run||this.run.status!=='active'||this.sim.paused)return false;
    const p=this.sim.player,s=this.stage;let firing=false;
    for(const e of this.sim.events)if(e.id>this.lastEvent){this.lastEvent=e.id;if(e.kind==='shot')firing=true;}
    if(firing&&this.mission.id==='fnsh-protest')failPoliceMission(this.run,'Armët u përdorën në protestën paqësore. Operacioni dështoi.');
    const suspect=this.actors.get('suspect');
    if(suspect&&s?.kind==='warn'&&!this.run.channel&&distance(p,suspect)<17&&distance(p,suspect)>5){
      const home=this.anchors[this.mission.site],angle=this.run.elapsed*.28;
      this.moveActor(suspect,this.safeFlee??={x:home.x+Math.cos(angle)*9,z:home.z+Math.sin(angle)*9},2.4,dt);
      if(distance(suspect,this.safeFlee)<1)this.safeFlee=null;
    }
    for(const [key,n] of this.actors){
      if(n.health<=0)continue;
      const follower=this.run.arrested&&key==='suspect'||this.run.rescued&&(key==='protected'||this.mission.id==='fnsh-evacuation'&&key.startsWith('neighbor'));
      if(key==='suspect'&&this.run.arrested&&p.carId===this.vehicle.id&&distance(n,p)<9)n.inCustodyVehicle=true;
      if(n.inCustodyVehicle){n.x=this.vehicle.x;n.z=this.vehicle.z;n.motion='drive';continue;}
      if(this.run.boarded&&key==='protected'){n.x=this.vehicle.x;n.z=this.vehicle.z;n.motion='drive';continue;}
      if((follower||key==='partner')&&!p.carId&&distance(n,p)>2.2&&distance(n,p)<35){
        this.moveActor(n,{x:p.x+Math.cos(p.heading)*1.4,z:p.z-Math.sin(p.heading)*1.4},follower?2:2.8,dt);
      }else if(follower||key==='partner'){n.speed=0;n.anim='idle';}
    }
    const hurt=p.health<this.lastHealth||p.lastDamage>this.lastDamage;
    this.lastHealth=p.health;this.lastDamage=p.lastDamage;
    const changed=stepPoliceMission(this.run,{health:p.health,arrested:!!p.arrest,eligible:this.eligible(),hurt,firing,
      civilianHarmed:this.civilianHarmed,protectedLost:[...this.actors.values()].some(n=>n.health<=0),
      vehicleDestroyed:this.vehicle.destroyed||this.vehicle.health<=0},dt);
    if(changed){
      if(s?.kind==='drive'&&this.stage?.kind==='report'){
        this.run.boarded=false;const passenger=this.actors.get('protected');
        if(passenger){Object.assign(passenger,this.safePoint({x:this.vehicle.x+4,z:this.vehicle.z+3}));passenger.motion='walk';passenger.anim='idle';}
      }
      this.updateActorStates();this.sim.body.notice=this.run.status==='completed'?'Operacioni u përfundua':this.run.failure||this.stage?.title||'';
    }
    return changed||this.run.status!=='active';
  }
  objective(){
    const s=this.stage,p=this.sim.player,target=this.target(),distanceText=target?`${Math.round(distance(p,target))} m · `:'';
    return {title:s?.kind==='report'&&this.run.arrested?'Sill të ndaluarin dhe dorëzo raportin':s?.title||this.run.failure||'Operacioni u përfundua',training:false,phase:'police',
      detail:distanceText+(this.run.channel?'Qëndro në pozicion; lëvizja ose dëmtimi e ndërpret veprimin.':
        s?.kind==='escort'?'Ec ngadalë; grupi ndalon nëse largohesh shumë.':s?.kind==='drive'?'Mjeti i njësisë · mbro pasagjerin, ndalo te pika dhe konfirmo.':
        s?.kind==='board'?'Afro mjetin e njësisë dhe ndalo pranë pasagjerit.':s?.kind==='report'&&this.run.arrested?'I ndaluari të ndjek. Afro mjetin e njësisë për transport; dil në drejtori.':'Ndiq itinerarin, afrohu dhe përdor butonin e operacionit.'),
      progress:(this.run.stage+(this.run.hold/(s?.seconds||1)))/this.mission.steps.length,
      remaining:this.run.channel?Math.max(0,s.seconds-this.run.hold):undefined,
      optionalObjective:'Mbro civilët. Përfundo me komunikim dhe pa lëndime.'};
  }
  snapshot(){
    const p=this.sim.player;this.run.snapshot={player:{x:p.x,z:p.z,health:p.health,inDutyCar:p.carId===this.vehicle.id},
      vehicle:{x:this.vehicle.x,z:this.vehicle.z,heading:this.vehicle.heading,health:this.vehicle.health},
      actors:Object.fromEntries([...this.actors].map(([k,n])=>[k,{x:n.x,z:n.z,health:n.health,inCustodyVehicle:n.inCustodyVehicle===true}]))};
  }
  view(){return {unit:this.unit,mission:this.mission,run:this.run,objective:this.objective(),context:this.action(),target:this.target()};}
}
