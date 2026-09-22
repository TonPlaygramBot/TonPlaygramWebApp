import { FORCE_VEHICLE_BOUNDS,FORCE_ASSET_BY_ID } from './albanianForces.mjs';
import {scheduledActorStep} from './actorSchedule.mjs';
import { forceWeaponFor } from './uploadedWeapons.mjs';
import { TrafficGrid, trafficDecision, trafficLanePoints } from './trafficSimulation.mjs';

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const level = role => ({patrol:1,shqiponja:2,fnsh:3,renea:4,army:5}[role] || 1);
const stars = p => Math.min(5,Math.ceil((p?.wanted || 0)/100));
const available = u => !u.destroyed && !u.burning && u.driver==='npc' && ['patrol','standby'].includes(u.duty);
export const POLICE_RESPONSE_DELAY = 3.5;

/** Real mapped facilities; staging bays are authored road access points. */
export function policeStations(world,env) {
  return world.buildings.filter(b=>/komisariat|drejtoria e policis|posta e policis|rajoni i policis/i.test(b.name||''))
    .map(b=>{const x=b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;
      return {id:String(b.id),name:b.name,building:{x,z},...env.roadPoint(x,z)};});
}

/** Allocate once, before play. Dispatch changes orders, never positions or IDs. */
export function initPoliceDispatch(state,env) {
  if(state.policeVersion===1)return;
  state.policeStations=policeStations(env.world,env);
  state.dispatchQueue={};
  const occupied=[...state.cars,...state.traffic,...state.units];
  const legacyUnits=state.units;state.units=[];
  const add=(car,role='patrol',station=null,reserve=false)=>{
    const bounds=FORCE_VEHICLE_BOUNDS.find(b=>b.id===car.forceVehicle);
    const originalCharacter=FORCE_ASSET_BY_ID.get(car.forceCharacter);
    Object.assign(car,bounds?{w:bounds.w,d:bounds.d,h:bounds.h}:{}, {
      role,kind:role==='army'?'military':'patrol',squadId:`patrol-${car.id}`,
      duty:reserve?'standby':'patrol',home:{x:car.x,z:car.z},stationId:station?.id,
      target:null,path:[],pathIndex:0,nextRoute:0,cruise:8,driver:'npc',responding:false,
      forceCharacter:originalCharacter?.category==='person'?originalCharacter.id:role==='army'?'army_soldier':`${role}_officer`,patrolIndex:0
    });
    state.units.push(car);
    if(state.npcs.some(n=>n.unit===car.id))return;
    for(let seat=0;seat<(role==='patrol'||role==='shqiponja'?2:4);seat++)state.npcs.push({
      id:`${car.id}-officer-${seat}`,unit:car.id,squadId:car.squadId,seat,formationIndex:seat,
      forceCharacter:car.forceCharacter,kind:role==='army'?'soldier':'police',motion:'drive',anim:'drive',
      x:car.x,z:car.z,heading:car.heading,speed:0,health:role==='army'?150:100,
      weapon:forceWeaponFor(car.forceCharacter,seat),nextShot:0,downUntil:0,panicUntil:0
    });
  };
  for(const car of legacyUnits)add(car,car.role||'patrol');
  // Reuse geographically distributed cars already occupying safe traffic lanes.
  const candidates=state.traffic.filter(c=>c.model==='police');
  const selected=[];
  for(const car of candidates){delete car.service;selected.push(car);add(car);}
  const ids=new Set(selected.map(c=>c.id));state.traffic=state.traffic.filter(c=>!ids.has(c.id));
  // Stage one specialist group per facility, offset along actual road segments.
  const roles=['shqiponja','fnsh','renea','army'];
  state.policeStations.forEach((station,i)=>{
    const specialist=roles[i%roles.length];
    const roads=env.world.roads.filter(r=>!r.walk&&r.w>=6)
      .sort((a,b)=>Math.hypot(a.a[0]-station.x,a.a[1]-station.z)-Math.hypot(b.a[0]-station.x,b.a[1]-station.z));
    for(const role of [specialist,'patrol']){
    const vehicle={shqiponja:'shqiponja_bike',fnsh:'fnsh_armored_van',renea:'renea_armored_van',army:'renea_armored_van',patrol:'police_van'}[role];
    const bounds=FORCE_VEHICLE_BOUNDS.find(b=>b.id===vehicle),width=bounds?.w||2.4,length=bounds?.d||5.5;
    let placement;
    for(const r of roads.slice(0,40)){
      const len=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]);if(len<18)continue;
      const ux=(r.b[0]-r.a[0])/len,uz=(r.b[1]-r.a[1])/len;
      for(const t of [.3,.7])for(const side of [-1,1]){
        const offset=side*(r.w/2+width/2+.5),p={x:r.a[0]+ux*len*t-uz*offset,z:r.a[1]+uz*len*t+ux*offset};
        if(occupied.some(c=>distance(c,p)<10))continue;
        const probes=[p,...[-1,1].flatMap(a=>[-1,1].map(b=>({x:p.x+ux*a*length/2-uz*b*width/2,z:p.z+uz*a*length/2+ux*b*width/2})))];
        if(probes.some(q=>{const check={...q};env.collide(check,.3);return distance(q,check)>.1;}))continue;
        if(!env.clear(p,{x:r.a[0]+ux*len*t,z:r.a[1]+uz*len*t}))continue;
        placement={...p,heading:Math.atan2(-ux,-uz)};break;
      }
      if(placement)break;
    }
    if(!placement)continue;
    const car={...placement,id:`station-${station.id}-${role}`,model:'police',forceVehicle:vehicle,custodyCapable:role==='patrol',
      speed:0,vx:0,vz:0,steering:0,driver:'npc'};
    add(car,role,station,true);occupied.push(car);
    }
  });
  state.policeVersion=1;
}

/** Rank by traversable road distance, so a closer car behind a barrier loses. */
export function nearestAvailableUnit(units,target,env,wanted=stars(target)) {
  let best=null;
  for(const unit of units.filter(u=>available(u)&&(!u.custodyCapable||wanted===0)&&level(u.role)<=Math.max(1,wanted))
    .sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,12)){
    const route=env.route(env.nearestNode(unit.x,unit.z),env.nearestNode(target.x,target.z));
    if(!route.length)continue;
    let cost=distance(unit,route[0]);for(let i=1;i<route.length;i++)cost+=distance(route[i-1],route[i]);
    cost+=unit.duty==='standby'?35:0;
    if(!best||cost<best.cost)best={unit,route,cost};
  }
  return best;
}

export function dispatchPolice(state,env) {
  const targets=Object.values(state.players).filter(p=>p.health>0&&!p.failed&&!p.finished&&stars(p)>0)
    .sort((a,b)=>stars(b)-stars(a)||a.id.localeCompare(b.id));
  const live=new Set(targets.map(p=>p.id));
  for(const id of Object.keys(state.dispatchQueue))if(!live.has(id))delete state.dispatchQueue[id];
  for(const u of state.units)if(u.target&&!live.has(u.target)){
    u.target=null;u.duty='returning';u.responding=false;u.path=[];u.pathIndex=0;u.nextRoute=0;
  }
  for(const p of targets){
    const q=state.dispatchQueue[p.id]??={at:state.elapsed+POLICE_RESPONSE_DELAY};
    if(state.elapsed<q.at)continue;
    const assigned=state.units.filter(u=>u.target===p.id&&!u.destroyed),wanted=stars(p);
    if(assigned.length>=Math.min(6,wanted+1))continue;
    // Higher alert requests specialists while retaining the original patrol.
    const needSpecialist=wanted>1&&!assigned.some(u=>level(u.role)===wanted);
    const pool=needSpecialist?state.units.filter(u=>level(u.role)===wanted):state.units;
    const chosen=nearestAvailableUnit(pool,p,env,wanted)||nearestAvailableUnit(state.units,p,env,wanted);
    q.at=state.elapsed+4;
    if(!chosen)continue;
    const {unit}=chosen;
    Object.assign(unit,{target:p.id,duty:'responding',responding:true,path:[],pathIndex:0,nextRoute:0,
      assignedAt:state.elapsed,lastSeen:{x:p.x,z:p.z,heading:p.heading,speed:p.speed},lastSeenAt:state.elapsed});
  }
}

export function updatePolicePatrols(state,dt,env,grids) {
  if(!state.policeVersion)initPoliceDispatch(state,env);
  dispatchPolice(state,env);
  const vehicles=grids?.vehicles||new TrafficGrid([...state.cars,...state.traffic,...state.units]);
  const people=grids?.people||new TrafficGrid(state.npcs.filter(n=>n.motion!=='drive'&&n.health>0));
  const crewByUnit=new Map(),players=Object.values(state.players);
  for(const n of state.npcs)if(n.unit&&n.health>0){
    let crew=crewByUnit.get(n.unit);if(!crew)crewByUnit.set(n.unit,crew=[]);crew.push(n);
  }
  for(const u of state.units){
    if(u.driver!=='npc')continue;
    if(u.destroyed||u.burning){u.speed=0;continue;}
    const crew=crewByUnit.get(u.id)||[];
    if(!crew.length){u.speed=0;u.responding=false;continue;}
    const close=!!u.target||players.some(p=>(p.x-u.x)**2+(p.z-u.z)**2<320**2);
    const stepDt=scheduledActorStep(u,state.elapsed,dt,close?0:.2);
    if(!stepDt)continue;
    const actual=state.players[u.target];
    const seen=actual&&distance(u,actual)<85&&env.clear(u,actual);
    if(seen){u.lastSeen={x:actual.x,z:actual.z};u.lastSeenAt=state.elapsed;u.duty='responding';}
    else if(u.target&&state.elapsed-u.lastSeenAt>18){u.duty='search';}
    if(u.duty==='search'&&state.elapsed-u.lastSeenAt>35){u.target=null;u.duty='returning';u.responding=false;u.path=[];}
    if(u.duty==='standby'){u.speed=0;continue;}
    let goal=u.target?u.lastSeen:u.home;
    if(u.duty==='patrol'){
      if(!u.patrolGoal||distance(u,u.patrolGoal)<8){
        u.patrolIndex=(u.patrolIndex||0)+1;
        const nodes=env.world.graph.nodes,base=env.nearestNode(u.home.x,u.home.z);
        const nearby=nodes.map((p,i)=>({x:p[0],z:p[1],i})).filter(p=>distance(p,u.home)>70&&distance(p,u.home)<380);
        u.patrolGoal=nearby[(base+u.patrolIndex*17)%Math.max(1,nearby.length)]||u.home;
      }
      goal=u.patrolGoal;
    }
    u.regroup=u.duty==='returning'||!!actual?.carId&&distance(u,actual)>45;
    if(crew.some(n=>n.deployed)){u.speed=0;continue;}
    if(u.target&&distance(u,goal)<18){u.speed=0;u.duty=seen?'onscene':'search';continue;}
    if(u.duty==='returning'&&distance(u,u.home)<(u.stationId?1:7)){u.duty=u.stationId?'standby':'patrol';u.speed=0;u.path=[];continue;}
    if(state.elapsed>=u.nextRoute&&(!u.path?.length||u.pathIndex>=u.path.length||distance(goal,u.routeTarget||u)>14)){
      const path=env.route(env.nearestNode(u.x,u.z),env.nearestNode(goal.x,goal.z));
      // Lane offsets derive from directed graph edges, preserving one-way streets.
      u.path=trafficLanePoints(path);u.pathIndex=0;
      if(u.duty==='returning'&&u.path.length&&env.clear(u.path.at(-1),u.home))u.path.push({...u.home});
      while(u.pathIndex<u.path.length&&distance(u,u.path[u.pathIndex])<3)u.pathIndex++;
      u.routeTarget={...goal};u.nextRoute=state.elapsed+2;
    }
    const goalPoint=u.path?.[u.pathIndex];if(!goalPoint){u.speed=0;continue;}
    const dx=goalPoint.x-u.x,dz=goalPoint.z-u.z,d=Math.hypot(dx,dz);
    if(d<.3){u.pathIndex++;continue;}
    const desired=Math.atan2(-dx,-dz);
    u.heading+=Math.atan2(Math.sin(desired-u.heading),Math.cos(desired-u.heading))*Math.min(1,stepDt*4);
    u.cruise=u.target?12:7;
    const decision=trafficDecision(u,vehicles.near(u.x,u.z,45),people.near(u.x,u.z,30),state.elapsed);
    const before=u.speed||0,target=Math.min(decision.target,Math.sqrt(2.8*d+3));
    u.speed=Math.max(0,before+Math.max(-6*stepDt,Math.min(2.4*stepDt,target-before)));
    const step=Math.min(d,u.speed*stepDt,Math.max(0,decision.gap));
    u.vx=dx/d*step/stepDt;u.vz=dz/d*step/stepDt;u.x+=dx/d*step;u.z+=dz/d*step;
    u.braking=u.speed<before;u.trafficReason=decision.reason;
    if(step>=d-.05)u.pathIndex++;
  }
}
