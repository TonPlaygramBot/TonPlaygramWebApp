import {WORLD,nearestNode,route,emptyInput} from '../shared/engine.mjs';
import {roadsidePoint} from '../shared/streetSafety.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {cancelActions,MOTOR} from './playerCore.mjs';
import {steerNPC} from '../shared/npcNavigation.mjs';
import {forceWeaponFor} from '../shared/uploadedWeapons.mjs';
import {trafficLaneRoute,vehicleSeparation} from '../shared/trafficSimulation.mjs';
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
    const sim=this.sim,p=sim.player,target=nearestNode(p.x,p.z);
    let chosen=[],cost=Infinity;
    for(const [dx,dz] of [[50,0],[-50,0],[0,50],[0,-50],[40,40],[-40,40],[40,-40],[-40,-40]]){
      const start=nearestNode(p.x+dx,p.z+dz),candidate=route(start,target);
      const length=candidate.slice(1).reduce((sum,q,i)=>sum+distance(q,candidate[i]),0);
      if(candidate.length>1&&distance(candidate[0],p)>25&&length<cost){chosen=candidate;cost=length;}
    }
    if(!chosen.length)return false;
    chosen=trafficLaneRoute(chosen.map(q=>nearestNode(q.x,q.z)));
    const a=chosen[0];
    this.van={id:'custody-van',model:'police',forceVehicle:'police_van',forceCharacter:'patrol_officer',...a,heading:0,speed:0,vx:0,vz:0,steering:0,driver:'custody',health:180,responding:true,custody:true};
    sim.state.cars.push(this.van);this.path=chosen;this.pathIndex=1;this.arrivalLimit=Math.min(90,Math.max(35,cost/9+30));return true;
  }
  drive(dt){
    const van=this.van,goal=this.path[this.pathIndex];if(!van||!goal){if(van)van.speed=0;return true;}
    const d=distance(van,goal),travel=Math.min(d,9*dt),dx=goal.x-van.x,dz=goal.z-van.z;
    // Respect traffic ahead instead of driving the backup van through a stopped car.
    const proposed={...van,heading:Math.atan2(-dx,-dz),x:van.x+(d?dx/d*travel:0),z:van.z+(d?dz/d*travel:0)};
    const blocked=this.sim.cars().some(c=>c!==van&&distance(c,van)<18&&vehicleSeparation(proposed,c));
    if(blocked){van.speed=0;return false;}
    van.heading=Math.atan2(-dx,-dz);van.speed=travel/Math.max(dt,.001);
    if(d){van.vx=dx/d*van.speed;van.vz=dz/d*van.speed;van.x+=dx/d*travel;van.z+=dz/d*travel;}
    if(d<=travel+.05)this.pathIndex++;
    return this.pathIndex>=this.path.length;
  }
  backupOfficers(){
    if(!this.van)return;
    for(const side of [-1,1]){
      const point=roadsidePoint({x:this.van.x+Math.cos(this.van.heading)*side*2,z:this.van.z-Math.sin(this.van.heading)*side*2},.45,true);
      if(!point)continue;
      this.sim.state.npcs.push({id:`custody-backup-${side}`,kind:'police',forceCharacter:'patrol_officer',weapon:forceWeaponFor('patrol_officer',side+1),...point,heading:this.van.heading,speed:0,motion:'walk',health:100,anim:'idle',nextShot:0,downUntil:0,custody:true});
    }
  }
  release(message){
    const sim=this.sim,p=sim.player;
    delete p.arrest;sim.body.interaction='free';sim.body.notice=message;sim.body.eye=MOTOR.eye;
    if(this.van)sim.state.cars=sim.state.cars.filter(c=>c!==this.van);
    sim.state.npcs=sim.state.npcs.filter(n=>!n.custody);
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
      if(this.drive(dt)&&t>1.5){this.backupOfficers();this.phase('escort');}
      else if(t>this.arrivalLimit)this.release('Rruga e bllokuar · Je liruar');
    }else if(c.phase==='escort'&&this.van){
      const van=this.van,target={x:van.x+Math.cos(van.heading)*1.9,z:van.z-Math.sin(van.heading)*1.9};
      const goal=steerNPC(p,target,(a,b)=>sim.world.clear({...a,y:sim.body.y+1},{...b,y:sim.body.y+1},sim.cars()),now);
      const d=distance(p,goal),step=Math.min(d,dt*1.6),q={x:p.x,y:sim.body.y,z:p.z};
      if(d)sim.world.move(q,(goal.x-p.x)/d*step,(goal.z-p.z)/d*step,sim.body.height,0);
      p.x=q.x;p.z=q.z;p.speed=step/Math.max(dt,.001);
      if(this.escort){this.escort.x=p.x+.75;this.escort.z=p.z;this.escort.speed=p.speed;}
      if(distance(p,target)<.65)this.phase('transport');
      else if(t>45)this.release('Rruga e mbyllur · Je liruar');
    }else if(c.phase==='transport'){
      if(this.van){p.x=this.van.x;p.z=this.van.z;sim.body.y=groundHeight(p.x,p.z)+.45;}
      if(t>3){sim.event('arrest-complete',{x:POLICE_STATION.x,z:POLICE_STATION.z});this.release('Drejtoria e Policisë Tiranë');}
    }
  }
}
