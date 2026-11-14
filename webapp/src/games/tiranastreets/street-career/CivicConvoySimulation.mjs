import {nearestNode,route} from '../shared/engine.mjs';
import {citySpatialGrids,trafficDecision,trafficLanePoints,vehicleSeparation} from '../shared/trafficSimulation.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {CIVIC_VEHICLES,itineraryStop,measuredPath,pathPose,pathTail} from './civicConvoyCore.mjs';
import {reportCrime} from '../shared/cityLife.mjs';
import {forceWeaponFor} from '../shared/uploadedWeapons.mjs';
import {friendlyInFiringLane} from '../shared/npcNavigation.mjs';

const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
/** Ten persistent vehicles, one path owner. Traffic sees real collision bodies;
 * it cannot independently dispatch these cars as ordinary police units. */
export class CivicConvoySimulation {
  constructor(sim,options={}) {
    this.sim=sim;this.leg=0;this.speed=0;this.wait=0;this.blocked=false;this.status='travelling';
    this.escorts=[];this.threat=null;this.lastAttack=-Infinity;
    this.pathfinder=options.pathfinder||((a,b)=>trafficLanePoints(route(nearestNode(a.x,a.z),nearestNode(b.x,b.z))));
    this.awareness=options.awareness||((car)=>{
      const grids=citySpatialGrids(sim.state);
      return trafficDecision(car,grids.vehicles.near(car.x,car.z,55).filter(c=>!c.civicConvoy),grids.people.near(car.x,car.z,55),sim.state.elapsed,sim.state.cityEvent).target;
    });
    const existing=new Set(sim.state.cars.map(c=>c.id));
    this.vehicles=CIVIC_VEHICLES.map(spec=>{
      const id='civic-convoy:'+spec.id;
      const found=sim.state.cars.find(c=>c.id===id);
      if(found)return found;
      const car={...spec,id,civicConvoy:true,x:0,z:0,heading:0,speed:0,vx:0,vz:0,steering:0,steerAngle:0,
        model:spec.forceVehicle?'police':'sedan',driver:'civic-driver:'+spec.id,npcDriver:true,
        responding:!!spec.forceVehicle,health:180,cruise:13.5};
      return car;
    });
    const initial=this.pathfinder({x:110,z:690},itineraryStop(0));
    this.path=measuredPath(initial);this.distance=Math.min(90,this.path.length);
    this.status=this.path.length>=100?'travelling':'unavailable';
    if(this.status==='unavailable')return;
    const occupied=citySpatialGrids(sim.state).vehicles;
    const clear=options.spawnClear||((car)=>occupied.near(car.x,car.z,15).every(other=>other.id===car.id||!vehicleSeparation(car,other)));
    let placed=false;
    for(let at=90;at<=Math.min(this.path.length-5,600);at+=6){
      this.distance=at;this.place();if(this.vehicles.every(clear)){placed=true;break;}
    }
    if(!placed){this.status='unavailable';return;}
    for(const car of this.vehicles){if(!existing.has(car.id))sim.state.cars.push(car);}
    this.place();
    this.principalNpc={id:'edi-rama-civic',name:'Edi Rama',kind:'civilian',civicPrincipal:true,health:100,weapon:null,
      downUntil:Infinity,panicUntil:0,heading:0,speed:0,x:0,z:0,motion:'drive',anim:'ride',seated:true};
    sim.state.npcs.push(this.npc);
  }
  get destination(){return itineraryStop(this.leg);}
  get principal(){return this.vehicles.find(c=>c.id==='civic-convoy:s-class');}
  get npc(){
    const car=this.principal;if(!car||this.status==='unavailable')return null;
    if(this.principalNpc?.health<=0){Object.assign(this.principalNpc,{seated:false,motion:'idle',anim:'down'});return this.principalNpc;}
    const stopPoint={x:car.x+Math.cos(car.heading)*2.05,z:car.z-Math.sin(car.heading)*2.05};
    const visiting=this.status==='visiting'&&(!this.sim.world||this.sim.world.clearance({...stopPoint,y:groundHeight(stopPoint.x,stopPoint.z)+.06},1.98,.38));
    const side=visiting?2.05:.42,back=visiting?0:1.05;
    return Object.assign(this.principalNpc||{}, {id:'edi-rama-civic',name:'Edi Rama',kind:'civilian',civicPrincipal:true,health:this.principalNpc?.health??100,weapon:null,
      x:car.x+Math.cos(car.heading)*side+Math.sin(car.heading)*back,
      z:car.z-Math.sin(car.heading)*side+Math.cos(car.heading)*back,
      heading:visiting?car.heading-Math.PI/2:car.heading,speed:0,motion:visiting?'idle':'drive',anim:visiting?'idle':'ride',seated:!visiting});
  }
  get riders(){return this.vehicles.filter(c=>c.forceVehicle==='shqiponja_bike'&&!c.destroyed).map(c=>({id:c.id+':rider',x:c.x,z:c.z,heading:c.heading,speed:c.speed,kind:'police',motion:'drive',anim:'ride',health:100,weapon:null,forceCharacter:'shqiponja_officer'}));}
  /** Fictional encounter behaviour: escorts stay near their principal instead
   * of abandoning the procession to join the city's general pursuit. */
  onAttack(car,attacker,cause='bullet',amount=1){
    if(!car?.civicConvoy||!attacker||this.status==='unavailable'||cause==='heat'||cause==='collision'&&amount<5)return false;
    if(attacker.kind==='police'||attacker.kind==='soldier'||attacker.civicEscort)return false;
    this.threat=attacker;this.lastAttack=this.sim.state.elapsed;this.status='protecting';this.speed=0;
    if(this.sim.state.players[attacker.id])reportCrime(this.sim.state,attacker,Math.max(0,220-(attacker.wanted||0)));
    for(const vehicle of this.vehicles){vehicle.braking=true;vehicle.responding=!!vehicle.forceVehicle;if(!vehicle.destroyed&&!vehicle.burning&&this.sim.state.elapsed>=(vehicle.impactUntil||0))vehicle.speed=vehicle.vx=vehicle.vz=0;}
    if(!this.escorts.length)this.deployEscorts();
    for(const n of this.escorts)if(n.health>0)n.civicEscort=true;
    if(this.sim.body)this.sim.body.notice='Convoy security responding · principal protected';
    this.sim.event?.('convoy-alert',{vehicleId:car.id});
    return true;
  }
  deployEscorts(){
    const principal=this.principal;if(!principal)return;
    const sources=this.vehicles.filter(c=>['lead-police','rear-police','suv-1'].some(id=>c.id.endsWith(':'+id))&&!c.destroyed&&!c.burning);
    for(const source of sources)for(const side of [-1,1]){
      let position;
      for(const offset of [2.2,3.2,4.2]){
        const q={x:source.x+Math.cos(source.heading)*side*offset,z:source.z-Math.sin(source.heading)*side*offset};q.y=groundHeight(q.x,q.z)+.08;
        if((!this.sim.world||this.sim.world.clearance(q,1.78,.4))&&this.escorts.every(n=>Math.hypot(n.x-q.x,n.z-q.z)>1)){position=q;break;}
      }
      if(!position)continue;
      const i=this.escorts.length,character=source.forceVehicle?'shqiponja_officer':'renea_officer';
      const n={...position,id:'civic-escort:'+i,civicEscort:true,squadId:'civic-protection',kind:'police',forceCharacter:character,
        heading:source.heading,speed:0,health:120,weapon:forceWeaponFor(character,i),nextShot:this.sim.state.elapsed+.8,
        downUntil:0,panicUntil:0,motion:'walk',anim:'idle',guardSide:side,guardSlot:i,sourceId:source.id};
      this.escorts.push(n);this.sim.state.npcs.push(n);
    }
  }
  protect(dt){
    const principal=this.principal,target=this.threat,now=this.sim.state.elapsed;if(!principal)return;
    const people=citySpatialGrids(this.sim.state).people;
    const active=target&&target.health>0&&!target.arrest&&(!this.sim.state.players[target.id]||target.wanted>0)&&Math.hypot(target.x-principal.x,target.z-principal.z)<100;
    if(!active&&(this.principalNpc?.health??100)>0&&now-this.lastAttack>35&&this.vehicles.every(c=>!c.destroyed&&!c.burning&&c.driver==='civic-driver:'+c.id.split(':').at(-1))){
      this.status='regrouping';let ready=true;
      for(const n of this.escorts){
        if(n.health<=0)continue;
        const source=this.vehicles.find(c=>c.id===n.sourceId),goal={x:source.x+Math.cos(source.heading)*n.guardSide*2.2,z:source.z-Math.sin(source.heading)*n.guardSide*2.2};
        const dx=goal.x-n.x,dz=goal.z-n.z,length=Math.hypot(dx,dz);
        n.anim='idle';n.speed=0;
        if(length>.5&&this.sim.world){
          ready=false;const q={x:n.x,y:n.y??groundHeight(n.x,n.z)+.08,z:n.z},step=Math.min(length,dt*3.2);
          this.sim.world.move(q,dx/length*step,dz/length*step,1.78,0);
          n.speed=Math.hypot(q.x-n.x,q.z-n.z)/Math.max(dt,.001);n.heading=Math.atan2(-dx,-dz);n.x=q.x;n.z=q.z;n.y=groundHeight(q.x,q.z)+.08;n.anim=n.speed>.1?'run':'idle';
        }
      }
      if(ready){
        const boarded=new Set(this.escorts);this.sim.state.npcs=this.sim.state.npcs.filter(n=>!boarded.has(n));
        this.escorts=[];this.status='travelling';this.threat=null;
      }
      return;
    }
    this.status='protecting';
    for(const n of this.escorts){
      if(n.health<=0)continue;
      n.speed=0;n.anim='idle';if(now<(n.hitUntil||0)){n.anim='hit';continue;}
      const side=n.guardSide*3.5,back=(Math.floor(n.guardSlot/2)-1)*4;
      const goal={x:principal.x+Math.cos(principal.heading)*side+Math.sin(principal.heading)*back,z:principal.z-Math.sin(principal.heading)*side+Math.cos(principal.heading)*back};
      const dx=goal.x-n.x,dz=goal.z-n.z,length=Math.hypot(dx,dz);
      if(length>.6&&this.sim.world){
        const q={x:n.x,y:n.y??groundHeight(n.x,n.z)+.08,z:n.z},step=Math.min(length,dt*3.6);
        this.sim.world.move(q,dx/length*step,dz/length*step,1.78,0);
        n.speed=Math.hypot(q.x-n.x,q.z-n.z)/Math.max(dt,.001);n.heading=Math.atan2(-dx,-dz);n.x=q.x;n.z=q.z;n.y=groundHeight(q.x,q.z)+.08;n.anim=n.speed>.1?'run':'idle';
      }
      if(active&&Math.hypot(target.x-n.x,target.z-n.z)<46){
        const from={x:n.x,y:(n.y??0)+1.4,z:n.z},to={x:target.x,y:target===this.sim.player?this.sim.body.y+1.2:(target.y??groundHeight(target.x,target.z))+1.2,z:target.z};
        if(!this.sim.world||this.sim.world.clear(from,to,this.sim.cars?.()||[])){
          n.heading=Math.atan2(n.x-target.x,n.z-target.z);n.aimPitch=Math.atan2(to.y-from.y,Math.max(.1,Math.hypot(to.x-from.x,to.z-from.z)));n.anim='aim';
          if(!friendlyInFiringLane(n,target,people.near(n.x,n.z,50).filter(other=>other!==target&&other.health>0)))this.sim.fireNPC?.(n,target,.8);
        }
      }
    }
  }
  place(){
    for(const car of this.vehicles){
      const p=pathPose(this.path,this.distance-car.offset);if(!p)continue;
      const old=car.heading;car.x=p.x;car.z=p.z;car.heading=p.heading;
      car.speed=this.speed;car.vx=-Math.sin(p.heading)*this.speed;car.vz=-Math.cos(p.heading)*this.speed;
      car.steering=Math.max(-1,Math.min(1,angle(p.heading-old)*3));car.steerAngle=car.steering*.32;
      car.braking=this.status!=='travelling'||this.blocked;car.responding=!!car.forceVehicle&&this.status==='travelling';
    }
    if(this.principalNpc)void this.npc;
  }
  nextLeg(){
    const from=pathPose(this.path,this.distance),next=itineraryStop(this.leg+1);
    if(!from)return false;
    const route=this.pathfinder(from,next);
    if(route.length<2){this.wait=15;this.status='route-unavailable';return false;}
    const tail=pathTail(this.path,this.distance,100),tailPath=measuredPath(tail);
    this.path=measuredPath([...tail,...route.slice(1)]);this.distance=tailPath.length;
    this.leg++;this.status='travelling';return true;
  }
  step(dt){
    if(this.status==='unavailable'||!(dt>0)||!Number.isFinite(dt))return;
    dt=Math.min(.1,dt);
    // Keep the real combat actor synchronized even when presentation is culled.
    void this.npc;
    if(this.status==='protecting'||this.status==='regrouping'){this.protect(dt);return;}
    // A collision/disabled vehicle halts the formation. Never overwrite wreck
    // impulses or teleport a stolen vehicle back into the scripted procession.
    if(this.vehicles.some(c=>c.destroyed||c.burning||c.driver!=='civic-driver:'+c.id.split(':').at(-1)||this.sim.state.elapsed<(c.impactUntil||0))){
      this.status='halted';this.speed=0;for(const c of this.vehicles){if(!c.destroyed&&!c.burning&&this.sim.state.elapsed>=(c.impactUntil||0))c.speed=c.vx=c.vz=0;c.braking=true;}return;
    }
    if(this.status==='halted')return;
    if(this.status==='visiting'||this.status==='route-unavailable'){
      this.wait-=dt;if(this.wait<=0)this.nextLeg();return;
    }
    const remaining=this.path.length-this.distance;
    if(remaining<.02){this.status='visiting';this.wait=this.destination.wait;this.speed=0;this.place();return;}
    const current=pathPose(this.path,this.distance),ahead=pathPose(this.path,this.distance+14);
    const turn=current&&ahead?Math.abs(angle(ahead.heading-current.heading)):0;
    let target=Math.min(13.5,turn>.5?4.5:turn>.2?8:13.5,Math.sqrt(remaining*4));
    this.blocked=false;
    for(const car of this.vehicles){const safe=this.awareness(car);if(safe<target){target=Math.max(0,safe);this.blocked=true;}}
    const acceleration=target<this.speed?7:2.2;
    this.speed+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-this.speed));
    this.distance=Math.min(this.path.length,this.distance+this.speed*dt);
    this.place();
  }
}
