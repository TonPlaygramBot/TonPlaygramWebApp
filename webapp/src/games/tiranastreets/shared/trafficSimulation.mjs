import {cornerSpeed} from './drivingScale.mjs';
import { WORLD } from './world.mjs';
import { VEHICLE_COLLECTION, collectionVehicleFor } from './vehicleCollection.mjs';
import { FORCE_VEHICLE_BOUNDS } from './albanianForces.mjs';
import { CITY_POPULATION } from './cityPopulation.mjs';
import { signalsNear, signalPhase } from './streetLayout.mjs';
const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));
const key=(x,z)=>`${Math.floor(x/32)},${Math.floor(z/32)}`;
export class TrafficGrid {
  cells=new Map();
  constructor(actors=[]){for(const a of actors){const k=key(a.x,a.z);let c=this.cells.get(k);if(!c)this.cells.set(k,c=[]);c.push(a);}}
  near(x,z,r=48){const result=[];for(let ix=Math.floor((x-r)/32);ix<=Math.floor((x+r)/32);ix++)for(let iz=Math.floor((z-r)/32);iz<=Math.floor((z+r)/32);iz++){const c=this.cells.get(`${ix},${iz}`);if(c)for(const a of c)result.push(a);}return result;}
}
const sizeCache=new WeakMap();
export function vehicleSize(car){
  let size=sizeCache.get(car);if(size)return size;size=measureVehicle(car);sizeCache.set(car,size);return size;
}
function measureVehicle(car){
  if(car.model==='tirana-bus')return {length:18,width:2.55};
  const collection=collectionVehicleFor(car),force=FORCE_VEHICLE_BOUNDS.find(v=>v.id===car.forceVehicle);
  if(collection)return {length:collection.length,width:collection.width};
  if(force)return {length:force.d,width:force.w};
  return /bike/.test(car.model)?{length:2.25,width:.85}:{length:4.5,width:1.9};
}
/** Minimum separation for oriented vehicle bodies, including the bus's full length. */
export function vehicleSeparation(a,b){
 const sa=vehicleSize(a),sb=vehicleSize(b),dx=a.x-b.x,dz=a.z-b.z;
 if(Math.hypot(dx,dz)>Math.hypot(sa.length,sa.width)/2+Math.hypot(sb.length,sb.width)/2)return null;
 const axes=c=>[{x:Math.cos(c.heading),z:-Math.sin(c.heading)},{x:Math.sin(c.heading),z:Math.cos(c.heading)}],aa=axes(a),bb=axes(b);
 let depth=Infinity,normal;
 for(const n of [...aa,...bb]){
  const dot=(u,v)=>u.x*v.x+u.z*v.z,extent=(s,ax)=>(Math.abs(dot(n,ax[0]))*s.width+Math.abs(dot(n,ax[1]))*s.length)/2;
  const projection=dx*n.x+dz*n.z,overlap=extent(sa,aa)+extent(sb,bb)-Math.abs(projection);
  if(overlap<=0)return null;if(overlap<depth){depth=overlap;normal={x:n.x*(projection<0?-1:1),z:n.z*(projection<0?-1:1)};}
 }
 return {x:normal.x*(depth+.01),z:normal.z*(depth+.01)};
}
let graph;
function roadGraph(){
  if(graph)return graph;
  const nodes=WORLD.graph.nodes,at=new Map(nodes.map((p,i)=>[`${p[0].toFixed(2)},${p[1].toFixed(2)}`,i]));
  const widths=new Map();
  for(const r of WORLD.roads){if(r.walk)continue;const a=at.get(`${r.a[0].toFixed(2)},${r.a[1].toFixed(2)}`),b=at.get(`${r.b[0].toFixed(2)},${r.b[1].toFixed(2)}`);if(a!=null&&b!=null)widths.set(a<b?`${a}:${b}`:`${b}:${a}`,r.w);}
  const links=nodes.map(()=>[]),edges=[];
  WORLD.graph.edges.forEach(([a,b],i)=>{
    const w=widths.get(a<b?`${a}:${b}`:`${b}:${a}`)||5.5,len=Math.hypot(nodes[b][0]-nodes[a][0],nodes[b][1]-nodes[a][1]),direction=WORLD.graph.directions?.[i]||0;
    if(len<.01)return;
    const add=(from,to)=>{const e={from,to,w,len,lane:direction?0:Math.min(1.65,Math.max(.5,w*.24))};links[from].push(e);if(len>18&&w>=5.5)edges.push(e);};
    if(direction!==-1)add(a,b);if(direction!==1)add(b,a);
  });
  return graph={nodes,links,edges};
}
export function lanePoint(e,t=1){const {nodes}=roadGraph(),a=nodes[e.from],b=nodes[e.to],dx=(b[0]-a[0])/e.len,dz=(b[1]-a[1])/e.len;return {x:a[0]+(b[0]-a[0])*t-dz*e.lane,z:a[1]+(b[1]-a[1])*t+dx*e.lane};}
const nextRandom=c=>c.seed=(Math.imul(c.seed,1664525)+1013904223)>>>0;
export function populateTraffic(state,spawn){
  const g=roadGraph(),occupied=new TrafficGrid([...state.cars,...state.traffic]);
  const local=[...g.edges].sort((a,b)=>Math.hypot(g.nodes[a.from][0]-spawn.x,g.nodes[a.from][1]-spawn.z)-Math.hypot(g.nodes[b.from][0]-spawn.x,g.nodes[b.from][1]-spawn.z));
  const ids=new Set([...state.traffic,...state.cars].map(c=>c.id));
  const make=(i,bus)=>{
    const id=bus?`tirana-bus-${i}`:`traffic-${i}`;
    if(ids.has(id))return;
    const pool=bus?local.filter(e=>e.w>=7&&e.len>=28):local;
    if(!pool.length)throw Error(`No eligible traffic roads for ${id}`);
    let edge,p;
    for(let attempt=0;attempt<Math.max(600,bus?pool.length*3:0);attempt++){
      p=null;
      const n=i<96&&!bus?(i*9+attempt*17)%Math.min(pool.length,500):bus?(i*37+attempt)%pool.length:(i*7919+attempt*193)%pool.length;
      edge=pool[n];
      p=lanePoint(edge,.2+((i*37+attempt*13)%60)/100);
      if(occupied.near(p.x,p.z,22).some(c=>Math.hypot(c.x-p.x,c.z-p.z)<(vehicleSize(c).length+(bus?18:4.5))*.5+2)){p=null;continue;}break;
    }
    if(!p)throw Error(`No safe traffic spawn for ${id}`);
    const heading=Math.atan2(g.nodes[edge.from][0]-g.nodes[edge.to][0],g.nodes[edge.from][1]-g.nodes[edge.to][1]);
    const model=bus?'tirana-bus':i%17===0?'motorbike':i%19===0?'police':i%23===0?'military-suv':i%5===0?'taxi':i%7===0?'sedan-sports':'sedan';
    const c={id,...p,heading,model,speed:0,vx:0,vz:0,steering:0,driver:null,npcDriver:true,node:edge.from,next:edge.to,seed:11+i*29,cruise:bus?7:5+(i%6),lane:edge.lane,edgeWidth:edge.w};
    if(['sedan','sedan-sports','taxi'].includes(model)&&i%10===1)c.collectionVehicle=VEHICLE_COLLECTION[Math.floor(i/10)%VEHICLE_COLLECTION.length].id;
    if(model==='police'){c.forceVehicle=i%2?'traffic_bike':'patrol_sedan';c.forceCharacter=i%2?'traffic_officer':'patrol_officer';}
    if(bus){c.passengers=Array.from({length:12+i%9},(_,seat)=>({seat,face:(i+seat*3)%8,shirt:(i+seat)%6}));c.routeName=['UNAZA','KOMBINAT – KINOSTUDIO','TIRANË – KAMËZ'][i%3];c.livery=i%3;c.busStopAt=20+i*3;c.trailerHeading=heading;}
    state.traffic.push(c);ids.add(id);const k=key(c.x,c.z);if(!occupied.cells.has(k))occupied.cells.set(k,[]);occupied.cells.get(k).push(c);
  };
  // Reserve articulated-bus clearance before filling ordinary traffic lanes.
  for(let i=0;i<CITY_POPULATION.buses;i++)make(i,true);
  for(let i=0;i<CITY_POPULATION.vehicles-3;i++)make(i,false);
}
export function redSignalGap(car,time){
  const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading),length=vehicleSize(car).length;
  let gap=Infinity;const seen=new Set();
  for(let ahead=0;ahead<=48;ahead+=16)for(const s of signalsNear(car.x+fx*ahead,car.z+fz*ahead)){
    if(seen.has(s.id))continue;seen.add(s.id);if(signalPhase(s,time)==='green')continue;
    const ux=Math.sin(s.yaw),uz=Math.cos(s.yaw);if(fx*ux+fz*uz>-.72)continue;
    const dx=car.x-s.x,dz=car.z-s.z,forward=dx*ux+dz*uz,lateral=Math.abs(dx*uz-dz*ux);
    // An axle already across the line must clear the intersection.
    if(forward>length*.5-.3&&lateral<s.width*.5+.3)gap=Math.min(gap,forward-length*.5-.6);
  }
  return gap;
}
export function trafficDecision(car,vehicles,pedestrians,time){
  const shape=vehicleSize(car),fx=-Math.sin(car.heading),fz=-Math.cos(car.heading);
  let gap=redSignalGap(car,time),reason=Number.isFinite(gap)?'signal':'';
  for(const o of vehicles){if(o.id===car.id)continue;const dx=o.x-car.x,dz=o.z-car.z,f=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx),other=vehicleSize(o);
    if(f>0&&side<(shape.width+other.width)*.5+.25){const d=f-(shape.length+other.length)*.5-1.8;if(d<gap){gap=d;reason='vehicle';}}
  }
  for(const n of pedestrians){if(n.health<=0||n.carId||n.aircraftId||n.motion==='drive')continue;const dx=n.x-car.x,dz=n.z-car.z,f=dx*fx+dz*fz;
    if(f>0&&Math.abs(dx*fz-dz*fx)<shape.width*.5+.7){const d=f-shape.length*.5-.8;if(d<gap){gap=d;reason='pedestrian';}}
  }
  return {gap,reason,target:Math.min(car.cruise,Math.sqrt(Math.max(0,gap)*6))};
}
/** 20 Hz fixed traffic integration. World actors persist; expensive render rigs do not. */
export function updateTraffic(state,dt,onImpact){
  state.trafficAccumulator=(state.trafficAccumulator||0)+dt;
  if(state.trafficAccumulator<.05-1e-8)return;
  const step=.05;state.trafficAccumulator-=step;
  const g=roadGraph(),vehicles=new TrafficGrid([...state.cars,...state.traffic,...state.units]);
  const people=new TrafficGrid([...state.npcs,...Object.values(state.players)]);
  const viewers=Object.values(state.players);
  for(const car of state.traffic){
    if(car.destroyed||car.burning){car.speed=car.vx=car.vz=0;continue;}
    if(car.service&&car.responsePhase!=='patrol')continue;
    let e=g.links[car.node]?.find(e=>e.to===car.next);
    if(!e){e=g.links[car.node]?.[0];if(!e){car.speed=0;continue;}car.next=e.to;}
    const goal=lanePoint(e),dx=goal.x-car.x,dz=goal.z-car.z,d=Math.hypot(dx,dz);
    if(d<.35){
      const old=car.node;car.node=car.next;
      let options=g.links[car.node].filter(e=>e.to!==old&&(car.model!=='tirana-bus'||e.w>=6.5));
      if(!options.length)options=g.links[car.node].filter(e=>car.model!=='tirana-bus'||e.w>=6.5);
      const next=options[nextRandom(car)%Math.max(1,options.length)];
      if(next){car.next=next.to;car.lane=next.lane;car.edgeWidth=next.w;}else{car.next=old;car.speed=0;}
      continue;
    }
    const desired=Math.atan2(-dx,-dz);car.heading+=turn(desired-car.heading)*Math.min(1,step*(car.model==='tirana-bus'?3:6));car.heading=turn(car.heading);
    const close=viewers.some(p=>(p.x-car.x)**2+(p.z-car.z)**2<320**2);
    const refresh=close||!car.awareness||state.elapsed>=car.awarenessAt;
    const nearbyPeople=refresh?people.near(car.x,car.z,50):[];
    if(refresh){car.awareness=trafficDecision(car,vehicles.near(car.x,car.z,55),nearbyPeople,state.elapsed);car.awarenessAt=state.elapsed+.25;}
    const decision=car.awareness;
    let target=cornerSpeed(turn(desired-car.heading),decision.target);
    // Slow before the current edge ends, so the next lane is reached without
    // high-speed right-angle slides. Long buses need a gentler approach.
    if(d<12)target=Math.min(target,Math.sqrt(2.4*d+4));
    if(car.model==='tirana-bus'){
      if(state.elapsed>=car.busStopAt&&car.speed<.25&&decision.reason==='signal'&&!car.doorsUntil){car.doorsUntil=state.elapsed+3;car.busStopAt=state.elapsed+55;}
      if(state.elapsed<(car.doorsUntil||0))target=0;else car.doorsUntil=0;
      car.trailerHeading=(car.trailerHeading??car.heading)+turn(car.heading-(car.trailerHeading??car.heading))*Math.min(1,step*Math.max(.35,car.speed/7));
    }
    const before=car.speed||0,deceleration=decision.gap<before*before/6+2?8:3;
    car.speed=Math.max(0,before+Math.max(-deceleration*step,Math.min(1.8*step,target-before)));
    car.braking=car.speed<before-.01;car.trafficReason=target<.1?decision.reason:'';
    // Cars cannot drive through a stopped queue or the red stop line.
    if((decision.reason!=='pedestrian'||decision.gap>=0)&&decision.gap<car.speed*step)car.speed=Math.max(0,decision.gap/step);
    const oldX=car.x,oldZ=car.z,move=Math.min(d,car.speed*step);
    decision.gap-=move;
    car.x+=dx/d*move;car.z+=dz/d*move;car.vx=(car.x-oldX)/step;car.vz=(car.z-oldZ)/step;
    if(car.speed>2)for(const n of nearbyPeople){
      if(n.health<=0||n.carId||n.aircraftId||n.motion==='drive'||state.elapsed-(n.trafficHitAt??-10)<2)continue;
      const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading),nx=n.x-car.x,nz=n.z-car.z,shape=vehicleSize(car);
      if(Math.abs(nx*fx+nz*fz)<shape.length*.5+.35&&Math.abs(nx*fz-nz*fx)<shape.width*.5+.25){n.trafficHitAt=state.elapsed;onImpact(n,Math.min(100,car.speed*7),car);car.speed*=.55;}
    }
  }
}
