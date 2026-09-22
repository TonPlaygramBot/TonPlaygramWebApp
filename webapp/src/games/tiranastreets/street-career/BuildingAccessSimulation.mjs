import { buildingAccessSites, CAFE_REVOLUTION_SECONDS } from '../shared/buildingAccess.mjs';
import { cancelActions, MOTOR } from './playerCore.mjs';
import { direction3 } from './spatialCore.mjs';
import { groundHeight } from '../../tirana-east/terrainCore.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const descriptor=(targetId,label,kind,score=95)=>({id:'interact',targetId,label,kind,visible:true,enabled:true,disabledReason:'',priority:score,score,mode:'tap'});
/** Height-aware access, physical roof support and a bounded guided canopy motor.
 * The ordinary player capsule handles walkable interior stairs and roof edges. */
export class BuildingAccessSimulation {
 constructor(sim,sites=buildingAccessSites()){
  this.sim=sim;this.sites=sites;this.travel=null;this.binoculars=false;
  this.parachute={packed:false,open:false};this.collected=new Set();
  const cafe=sites.find(s=>s.kind==='cafe');
  if(cafe&&!sim.state.pickups.some(p=>p.id==='sky-cafe-sniper'))sim.state.pickups.push({id:'sky-cafe-sniper',...cafe.restroom,y:cafe.roofY+.55,weapon:'sniperShotAttack',ammo:10,source:'authored-cafe-restroom'});
 }
 candidates(){
  const {player:p,body:b}=this.sim;
  if(p.carId||p.aircraftId||this.travel||this.parachute.open||!b.grounded||b.interaction!=='free')return [];
  const out=[];
  const add=(site,point,kind,label,range=3.1)=>{
   if(distance(p,point)>range||Math.abs(b.y-point.y)>1.65)return;
   // Access portals are explicit interactions; all equipment still needs line of sight.
   if(kind==='access-equipment'&&!this.sim.world.clear(this.sim.eye(),{...point,y:point.y+.65}))return;
   out.push(descriptor(site.id+':'+kind,label,kind,95-distance(p,point)));
  };
  for(const site of this.sites){
   add(site,site.entrance,'access-enter',site.kind==='cafe'?'HYR · SKY TOWER':'HYR · '+site.name,4);
   add(site,site.lobbyPoint,'access-leave','DALJE NË RRUGË');
   if(!site.stairs){
    // Separate controls leave room to enter and explore the lobby first.
    add(site,{...site.lobbyPoint,x:site.center.x-site.half+1},'access-up',site.kind==='cafe'?'ASHENSOR · SKY CLUB 360°':'ASHENSOR · TARRACA',3.6);
    add(site,site.roof,'access-down','ASHENSOR · POSHTË',3.6);
   }
   add(site,site.equipment,'access-equipment',this.parachute.packed?'DYLBITË · SHIKO QYTETIN':'MERR PARASHUTË + DYLBITË',3);
  }
  return out;
 }
 actions(){
  const {player:p,body:b}=this.sim;if(p.carId||p.aircraftId)return [];
  const result=[];
  if(this.parachute.packed&&!this.parachute.open&&!b.grounded&&!this.travel&&b.y-this.sim.world.surface(p.x,p.z,b.y-.2)>3)
   result.push({...descriptor(null,'HAP PARASHUTËN','access-parachute'),id:'parachute',priority:120});
  if(this.binoculars)result.push({...descriptor(null,'MBYLL DYLBITË','access-binoculars'),id:'binoculars',mode:'toggle'});
  return result;
 }
 execute(action){
  const {player:p,body:b}=this.sim;
  if(action.id==='parachute'){
   if(!this.actions().some(a=>a.id==='parachute'))return false;
   this.parachute={packed:false,open:true};this.binoculars=false;b.aim=false;b.sprint=false;
   b.vy=Math.max(b.vy,-5.2);this.sim.event('parachute-open');return true;
  }
  if(action.id==='binoculars'){this.binoculars=false;return true;}
  if(!this.candidates().some(c=>c.targetId===action.targetId))return false;
  const site=this.sites.find(s=>action.targetId.startsWith(s.id+':'));if(!site)return false;
  if(action.kind==='access-equipment'){
   if(!this.parachute.packed){this.parachute.packed=true;this.collected.add(site.id);b.notice='Parashuta gati · hidhu dhe prek HAP PARASHUTËN';this.sim.event('parachute-packed');}
   else {this.binoculars=!this.binoculars;b.aim=false;b.notice='Dylbitë · zvarrit për të parë qytetin';}
   return true;
  }
  const destination=action.kind==='access-enter'?site.lobbyPoint:action.kind==='access-leave'?site.entrance:action.kind==='access-up'?site.roof:site.lobbyPoint;
  if(!this.sim.world.clearance(destination,MOTOR.standing)){b.notice='Dalja është e bllokuar';return false;}
  cancelActions(p,b);this.binoculars=false;
  const from={x:p.x,y:b.y,z:p.z};
  this.travel={siteId:site.id,kind:action.kind,from,to:{...destination},elapsed:0,duration:action.kind==='access-up'||action.kind==='access-down'?Math.max(2.5,Math.min(14,Math.abs(destination.y-b.y)/10)):1};
  b.interaction='building-access';b.notice=action.kind==='access-up'?'Ashensori po ngjitet…':action.kind==='access-down'?'Ashensori po zbret…':'';
  this.sim.event('building-access',{targetId:site.id});return true;
 }
 reset(){this.travel=null;this.parachute.open=false;this.binoculars=false;}
 step(dt){
  const {player:p,body:b,world}=this.sim;
  if(this.travel){
   const t=this.travel;t.elapsed=Math.min(t.duration,t.elapsed+dt);const f=t.elapsed/t.duration,smooth=f*f*(3-2*f);
   p.x=t.from.x+(t.to.x-t.from.x)*smooth;p.z=t.from.z+(t.to.z-t.from.z)*smooth;b.y=t.from.y+(t.to.y-t.from.y)*smooth;
   p.speed=0;b.vx=b.vz=b.vy=0;b.grounded=false;b.locomotion='idle';
   if(f===1){
    const destination=world.clearance(t.to,MOTOR.standing)?t.to:t.from;
    p.x=destination.x;p.z=destination.z;b.y=destination.y;b.interaction='free';b.grounded=true;b.groundAt=this.sim.state.elapsed;
    this.travel=null;b.notice='';this.sim.event('building-arrival',{targetId:t.siteId});
   }
   return true;
  }
  if(this.binoculars&&(Math.hypot(this.sim.intent.x,this.sim.intent.y)>.05||this.sim.intent.fire||!b.grounded))this.binoculars=false;
  if(this.parachute.open){
   const intent=this.sim.intent,forward=direction3(intent.yaw,0),side={x:Math.cos(intent.yaw),z:-Math.sin(intent.yaw)};
   const forwardSpeed=6+intent.y*3,sideSpeed=intent.x*3;
   const q={x:p.x,y:b.y,z:p.z};
   world.move(q,(forward.x*forwardSpeed+side.x*sideSpeed)*dt,(forward.z*forwardSpeed+side.z*sideSpeed)*dt,MOTOR.standing,0);
   p.x=q.x;p.z=q.z;p.heading=intent.yaw;b.yaw=intent.yaw;
   b.vy=Math.max(-5.2,b.vy-9*dt);const floor=world.surface(p.x,p.z,b.y+.02);
   b.y+=b.vy*dt;b.grounded=false;b.locomotion='fall';p.speed=forwardSpeed;
   if(b.y<=floor){b.y=floor;b.vy=0;b.grounded=true;b.groundAt=this.sim.state.elapsed;this.parachute.open=false;p.speed=0;this.sim.event('parachute-land');}
   return true;
  }
  // The rotating annular dining platform carries standing players with it.
  const cafe=this.sites.find(s=>s.kind==='cafe');
  if(cafe&&b.grounded&&Math.abs(b.y-cafe.roofY)<.2){
   const dx=p.x-cafe.center.x,dz=p.z-cafe.center.z,r=Math.hypot(dx,dz);
   if(r>9.2&&r<11.1){const a=2*Math.PI*dt/CAFE_REVOLUTION_SECONDS,cos=Math.cos(a),sin=Math.sin(a),q={x:p.x,y:b.y,z:p.z};
    world.move(q,dx*cos-dz*sin-dx,dx*sin+dz*cos-dz,b.height,0);p.x=q.x;p.z=q.z;}
  }
  return false;
 }
 objective(){
  if(this.travel)return {title:this.travel.kind==='access-up'?'Ashensor · Tarraca':this.travel.kind==='access-down'?'Ashensor · Hyrja':'Hyrje në godinë',detail:'Prit hapjen e derës',training:false};
  if(this.parachute.open)return {title:'Parashuta e hapur',detail:'Drejto me levën · ulje e kontrolluar',training:false};
  return null;
 }
}
