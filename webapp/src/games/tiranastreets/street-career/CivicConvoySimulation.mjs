import {nearestNode,route} from '../shared/engine.mjs';
import {citySpatialGrids,trafficDecision,trafficLanePoints,vehicleSeparation} from '../shared/trafficSimulation.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {CIVIC_VEHICLES,itineraryStop,measuredPath,pathPose,pathTail} from './civicConvoyCore.mjs';

const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
/** Ten persistent vehicles, one path owner. Traffic sees real collision bodies;
 * it cannot independently dispatch these cars as ordinary police units. */
export class CivicConvoySimulation {
  constructor(sim,options={}) {
    this.sim=sim;this.leg=0;this.speed=0;this.wait=0;this.blocked=false;this.status='travelling';
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
  }
  get destination(){return itineraryStop(this.leg);}
  get principal(){return this.vehicles.find(c=>c.id==='civic-convoy:s-class');}
  get npc(){
    const car=this.principal;if(!car||this.status==='unavailable')return null;
    const stopPoint={x:car.x+Math.cos(car.heading)*2.05,z:car.z-Math.sin(car.heading)*2.05};
    const visiting=this.status==='visiting'&&(!this.sim.world||this.sim.world.clearance({...stopPoint,y:groundHeight(stopPoint.x,stopPoint.z)+.06},1.98,.38));
    const side=visiting?2.05:.42,back=visiting?0:1.05;
    return {id:'edi-rama-civic',name:'Edi Rama',kind:'civilian',health:100,weapon:null,
      x:car.x+Math.cos(car.heading)*side+Math.sin(car.heading)*back,
      z:car.z-Math.sin(car.heading)*side+Math.cos(car.heading)*back,
      heading:visiting?car.heading-Math.PI/2:car.heading,speed:0,motion:visiting?'idle':'drive',anim:visiting?'idle':'ride',seated:!visiting};
  }
  get riders(){return this.vehicles.filter(c=>c.forceVehicle==='shqiponja_bike'&&!c.destroyed).map(c=>({id:c.id+':rider',x:c.x,z:c.z,heading:c.heading,speed:c.speed,kind:'police',motion:'drive',anim:'ride',health:100,weapon:null,forceCharacter:'shqiponja_officer'}));}
  place(){
    for(const car of this.vehicles){
      const p=pathPose(this.path,this.distance-car.offset);if(!p)continue;
      const old=car.heading;car.x=p.x;car.z=p.z;car.heading=p.heading;
      car.speed=this.speed;car.vx=-Math.sin(p.heading)*this.speed;car.vz=-Math.cos(p.heading)*this.speed;
      car.steering=Math.max(-1,Math.min(1,angle(p.heading-old)*3));car.steerAngle=car.steering*.32;
      car.braking=this.status!=='travelling'||this.blocked;car.responding=!!car.forceVehicle&&this.status==='travelling';
    }
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
