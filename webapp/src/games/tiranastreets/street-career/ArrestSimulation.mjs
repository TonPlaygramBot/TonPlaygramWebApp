import {WORLD,nearestNode,route,emptyInput} from '../shared/engine.mjs';
import {roadsidePoint} from '../shared/streetSafety.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {exitPoint} from './vehicleCore.mjs';
import {cancelActions,MOTOR} from './playerCore.mjs';
import {steerNPC} from '../shared/npcNavigation.mjs';
import {nearestAvailableUnit} from '../shared/policeDispatch.mjs';
import {trafficLanePoints,vehicleSeparation,trafficDecision} from '../shared/trafficSimulation.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const station=WORLD.buildings.find(b=>String(b.id)==='361451879');
const centre=station?{x:station.p.reduce((n,p)=>n+p[0],0)/station.p.length,z:station.p.reduce((n,p)=>n+p[1],0)/station.p.length}:{x:-320,z:365};
const entrance=station?.p.flatMap((p,i)=>{const q=station.p[(i+1)%station.p.length];return [p,[(p[0]+q[0])/2,(p[1]+q[1])/2]];}).map(p=>roadsidePoint({x:p[0],z:p[1]},.5,true)).filter(Boolean).sort((a,b)=>distance(a,centre)-distance(b,centre))[0];
export const POLICE_STATION=Object.freeze({...(entrance||centre),name:'Drejtoria e Policisë Tiranë',buildingId:'361451879',street:'Rruga Sami Frashëri · pranë Myslym Shyrit'});
const notices={pursuit:'Policia po të ndjek · Ndalo!',spray:'Spërkatje me piper',down:'I ndaluar · Shtrihu',backup:'Përforcimet po vijnë',escort:'Drejt furgonit të policisë',transport:'Drejt Drejtorisë së Policisë Tiranë'};
/** Fictional non-lethal custody sequence, owned by the fixed simulation clock. */
export class ArrestSimulation {
  constructor(sim){this.sim=sim;this.van=null;this.path=[];this.pathIndex=0;this.escort=null;}
  get current(){return this.sim.player.arrest||null;}
  get locked(){return !!this.current&&this.current.phase!=='pursuit';}
  provoke(officer,kind){
    if(!['police','soldier','military'].includes(officer.kind)||officer.health<=0||this.current)return false;
    const p=this.sim.player;
    p.arrest={phase:'pursuit',at:this.sim.state.elapsed,started:this.sim.state.elapsed,officerId:officer.id,reason:kind};
    p.wanted=Math.max(p.wanted,65);p.lastCrime=this.sim.state.elapsed;
    officer.lastSeen={x:p.x,z:p.z};officer.lastSeenAt=this.sim.state.elapsed;
    this.sim.body.notice=notices.pursuit;return true;
  }
  phase(phase){
    const c=this.current;if(!c)return;c.phase=phase;c.at=this.sim.state.elapsed;
    this.sim.body.notice=notices[phase];this.sim.event(`arrest-${phase}`);
  }
  officer(n,p,dt,env){
    if(!this.current||p!==this.sim.player||!['police','soldier','military'].includes(n.kind))return false;
    const sim=this.sim,c=this.current,now=sim.state.elapsed;
    if(n.motion==='drive'&&!n.deployed)return false;
    if(c.phase==='pursuit'){
      if(env.clear(n,p)){n.lastSeen={x:p.x,z:p.z};n.lastSeenAt=now;}
      const goal=n.lastSeen;
      if(goal&&now-(n.lastSeenAt||0)<15){
        const path=steerNPC(n,goal,env.clear,now);env.along(n,path,3.8,dt);env.collide(n,.45);n.anim='run';
        if(distance(n,p)<2.3&&env.clear(n,p)&&Math.abs(sim.body.y-groundHeight(n.x,n.z))<1.8&&!p.carId&&!p.aircraftId){
          c.officerId=n.id;this.escort=n;cancelActions(p,sim.body);p.weapon='';p.input=emptyInput();
          this.phase('spray');sim.combat.emit('pepper-spray',{x:n.x,y:groundHeight(n.x,n.z)+1.35,z:n.z},{toX:p.x,toY:sim.eye().y,toZ:p.z});
        }
      }else{n.speed=0;n.anim='idle';}
    }else{
      n.speed=0;n.heading=Math.atan2(n.x-p.x,n.z-p.z);
      n.anim=n.id===c.officerId?(c.phase==='spray'?'spray':c.phase==='down'||c.phase==='backup'?'cover':'walk'):'idle';
    }
    return true;
  }
  dispatch(){
    const sim=this.sim,p=sim.player;
    const chosen=nearestAvailableUnit(sim.state.units.filter(u=>u.custodyCapable),p,{nearestNode,route},0);
    if(!chosen)return false;
    this.van=chosen.unit;
    Object.assign(this.van,{driver:'custody',duty:'custody',target:null,responding:true,custody:true});
    for(const n of sim.state.npcs.filter(n=>n.unit===this.van.id))n.custody=true;
    this.path=trafficLanePoints(chosen.route);this.pathIndex=0;
    while(this.path[this.pathIndex]&&distance(this.van,this.path[this.pathIndex])<3)this.pathIndex++;
    this.arrivalLimit=Math.min(180,Math.max(45,chosen.cost/5+30));return true;
  }

  drive(dt){
    const van=this.van,goal=this.path[this.pathIndex];if(!van||!goal){if(van)van.speed=0;return true;}
    const d=distance(van,goal),dx=goal.x-van.x,dz=goal.z-van.z;
    van.heading=Math.atan2(-dx,-dz);van.cruise=9;
    const decision=trafficDecision(van,this.sim.cars().filter(c=>distance(c,van)<45),this.sim.state.npcs.filter(n=>!n.custody&&distance(n,van)<25),this.sim.state.elapsed);
    van.speed=Math.max(0,(van.speed||0)+Math.max(-6*dt,Math.min(2.4*dt,decision.target-(van.speed||0))));
    const travel=Math.min(d,van.speed*dt,Math.max(0,decision.gap));
    // Respect traffic ahead instead of driving the backup van through a stopped car.
    const proposed={...van,heading:Math.atan2(-dx,-dz),x:van.x+(d?dx/d*travel:0),z:van.z+(d?dz/d*travel:0)};
    const blocked=this.sim.cars().some(c=>c!==van&&distance(c,van)<18&&vehicleSeparation(proposed,c));
    if(blocked){van.speed=0;return false;}
    van.heading=Math.atan2(-dx,-dz);van.speed=travel/Math.max(dt,.001);
    if(d){van.vx=dx/d*van.speed;van.vz=dz/d*van.speed;van.x+=dx/d*travel;van.z+=dz/d*travel;}
    for(const n of this.sim.state.npcs.filter(n=>n.custody&&n.unit===van.id&&!n.deployed))Object.assign(n,{x:van.x,z:van.z,heading:van.heading,speed:van.speed,motion:'drive'});
    if(d<=travel+.05)this.pathIndex++;
    return this.pathIndex>=this.path.length;
  }
  backupOfficers(){
    if(!this.van)return;
    for(const [i,n] of this.sim.state.npcs.filter(n=>n.unit===this.van.id&&n.health>0).entries()){
      const side=i%2?1:-1,point=roadsidePoint({x:this.van.x+Math.cos(this.van.heading)*side*2,z:this.van.z-Math.sin(this.van.heading)*side*2},.45,true);
      if(point)Object.assign(n,point,{heading:this.van.heading,speed:0,motion:'walk',anim:'idle',deployed:true,custody:true});
    }
  }

  release(message){
    const sim=this.sim,p=sim.player;
    delete p.arrest;sim.body.interaction='free';sim.body.notice=message;sim.body.eye=MOTOR.eye;
    if(this.van)Object.assign(this.van,{driver:'npc',duty:'returning',target:null,responding:false,custody:false,regroup:true,path:[],pathIndex:0,nextRoute:0});
    for(const n of sim.state.npcs)if(n.custody)n.custody=false;
    this.van=null;this.escort=null;
  }
  step(dt){
    const sim=this.sim,p=sim.player,c=this.current;if(!c)return;
    const now=sim.state.elapsed,t=now-c.at;
    if(p.health<=0||p.failed||this.van?.destroyed){this.release('');return;}
    if(c.phase==='pursuit'){
      if(now-c.started>35&&!sim.state.npcs.some(n=>['police','soldier'].includes(n.kind)&&n.health>0&&distance(n,p)<45&&sim.hooks.life.clear(n,p)))this.release('Ai u largua nga ndjekja');
      return;
    }
    p.speed=0;p.wanted=Math.max(p.wanted,65);p.input=emptyInput();sim.body.interaction='custody';
    const eye=c.phase==='down'||c.phase==='backup'?.36:c.phase==='transport'?1.05:1.58;
    sim.body.eye+=(eye-sim.body.eye)*(1-Math.exp(-dt*8));
    if(c.phase==='spray'&&t>1.2)this.phase('down');
    else if(c.phase==='down'&&t>1.6){if(this.dispatch())this.phase('backup');else this.release('Përforcimet nuk arritën · Je liruar');}
    else if(c.phase==='backup'){
      if(this.drive(dt)&&t>1.5){this.boarding=exitPoint(sim.state,this.van,sim.world);if(!this.boarding){this.release('Rruga e mbyllur · Je liruar');return;}this.backupOfficers();this.phase('escort');}
      else if(t>this.arrivalLimit)this.release('Rruga e bllokuar · Je liruar');
    }else if(c.phase==='escort'&&this.van){
      const van=this.van,target=this.boarding;
      const goal=steerNPC(p,target,(a,b)=>sim.world.clear({...a,y:sim.body.y+1},{...b,y:sim.body.y+1},sim.cars()),now);
      const d=distance(p,goal),step=Math.min(d,dt*1.6),q={x:p.x,y:sim.body.y,z:p.z};
      if(d)sim.world.move(q,(goal.x-p.x)/d*step,(goal.z-p.z)/d*step,sim.body.height,0);
      p.x=q.x;p.z=q.z;p.speed=step/Math.max(dt,.001);
      if(this.escort){this.escort.x=p.x+.75;this.escort.z=p.z;this.escort.speed=p.speed;}
      if(distance(p,target)<.65){
        this.path=trafficLanePoints(route(nearestNode(van.x,van.z),nearestNode(POLICE_STATION.x,POLICE_STATION.z)));this.pathIndex=0;
        if(!this.path.length){this.release('Rruga e mbyllur · Je liruar');return;}
        if(this.escort)Object.assign(this.escort,{unit:van.id,squadId:van.squadId,seat:2,custody:true});
        for(const n of sim.state.npcs.filter(n=>n.unit===van.id))Object.assign(n,{deployed:false,motion:'drive'});
        this.phase('transport');
      }
      else if(t>45)this.release('Rruga e mbyllur · Je liruar');
    }else if(c.phase==='transport'){
      if(this.van){p.x=this.van.x;p.z=this.van.z;sim.body.y=groundHeight(p.x,p.z)+.45;}
      if(this.drive(dt)){sim.event('arrest-complete',{x:POLICE_STATION.x,z:POLICE_STATION.z});p.wanted=0;this.release('Drejtoria e Policisë Tiranë');}
    }
  }
}
