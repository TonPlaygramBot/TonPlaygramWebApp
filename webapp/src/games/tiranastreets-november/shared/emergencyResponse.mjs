import {citySpatialGrids,trafficLanePoints,vehicleSize} from './trafficSimulation.mjs';
/** Deterministic service dispatch on the existing street graph. No random
 * teleporting, duplicate traffic integration or medical response to wanted stars.
 */
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function emergencyTarget(service,players,time) {
  const eligible=players.filter(p=>!p.finished&&!p.failed&&(service==='ambulance'
    ? p.health>0&&p.health<65&&time-p.lastDamage<30
    : service==='police-patrol'?p.health>0&&p.wanted>0:false));
  return eligible.sort((a,b)=>service==='ambulance'?a.health-b.health||a.id.localeCompare(b.id)
    : b.wanted-a.wanted||a.id.localeCompare(b.id))[0];
}
export function trafficClearance(car,vehicles,pedestrians=[]) {
  const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading),shape=vehicleSize(car);
  let gap=Infinity;
  for(const other of vehicles){
    if(other.id===car.id)continue;
    const dx=other.x-car.x,dz=other.z-car.z,forward=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);
    const size=vehicleSize(other),angle=car.heading-(other.heading||0);
    const halfLength=(Math.abs(Math.cos(angle))*size.length+Math.abs(Math.sin(angle))*size.width)/2;
    const halfWidth=(Math.abs(Math.cos(angle))*size.width+Math.abs(Math.sin(angle))*size.length)/2;
    if(forward>0&&side<shape.width/2+halfWidth+.2)gap=Math.min(gap,forward-shape.length/2-halfLength-.8);
  }
  for(const n of pedestrians){
    if(n.health<=0||n.motion==='drive'||n.carId||n.aircraftId)continue;
    const dx=n.x-car.x,dz=n.z-car.z,forward=dx*fx+dz*fz;
    if(forward>0&&Math.abs(dx*fz-dz*fx)<shape.width/2+.6)gap=Math.min(gap,forward-shape.length/2-.8);
  }
  // Comfortable deceleration with a hard stop before bodies overlap.
  return Math.sqrt(Math.max(0,gap)*4);
}
export function updateEmergencyResponse(state,dt,env) {
  if(!(dt>0)||!Number.isFinite(dt))return;
  const players=Object.values(state.players),time=state.elapsed;
  let grids;
  for(const car of state.traffic){
    if(!car.service)continue;
    if(car.destroyed||car.burning){car.speed=car.vx=car.vz=0;car.responding=false;continue;}
    car.homeNode??=car.node;
    const assigned=players.find(p=>p.id===car.responseTarget&&p.health>0&&!p.failed&&!p.finished);
    const target=car.responsePhase==='onscene'&&assigned?assigned:emergencyTarget(car.service,players,time);
    // A completed patient gets a cooldown; no immediate redispatch loop.
    const incident=target&&!(car.completedTarget===target.id&&time<(car.cooldownUntil||0))?target:null;
    let phase=car.responsePhase||'patrol';
    if(incident&&phase==='patrol')phase='responding';
    if(!incident&&['responding','onscene'].includes(phase))phase='returning';
    if(phase==='patrol'){
      car.responding=false;car.responsePhase=phase;car.cruise=car.service==='police-patrol'?8:7;continue;
    }
    const destination=phase==='returning'?env.world.graph.nodes[car.homeNode]:incident&&[incident.x,incident.z];
    if(!destination){car.responsePhase='patrol';car.responding=false;continue;}
    const goalNode=env.nearestNode(...destination),goal=env.world.graph.nodes[goalNode];
    if(time>=(car.nextResponseRoute||0)&&(!car.responsePath?.length||car.responseGoal!==goalNode)){
      const path=env.route(env.nearestNode(car.x,car.z),goalNode);
      car.responsePath=trafficLanePoints(path);
      // Alternate test/scenario graphs may not share the city's road nodes.
      if(!car.responsePath.length)car.responsePath=path;
      car.responseIndex=0;car.responseGoal=goalNode;car.nextResponseRoute=time+2;
    }
    if(car.responseTarget!==incident?.id)car.arrivedAt=undefined;
    car.responsePhase=phase;car.responding=phase==='responding';car.responseTarget=incident?.id;
    const arrived=distance(car,{x:goal[0],z:goal[1]})<5;
    if(arrived){
      car.speed=car.vx=car.vz=0;
      if(phase==='returning'){
        car.node=goalNode;car.next=goalNode;car.responsePhase='patrol';car.responsePath=[];car.responding=false;
        continue;
      }
      car.responsePhase='onscene';car.responding=true;car.arrivedAt??=time;
      // Assistance only when the patient is close and visible, never through walls.
      if(car.service==='ambulance'&&incident&&distance(car,incident)<12&&env.clear(car,incident)){
        incident.health=Math.min(80,incident.health+dt*7);
        if(incident.health>=80||time-car.arrivedAt>12){
          car.completedTarget=incident.id;car.cooldownUntil=time+35;
          car.responsePhase='returning';car.responding=false;car.responsePath=[];
        }
      }
      if(time-car.arrivedAt>20){car.responsePhase='returning';car.completedTarget=incident?.id;car.cooldownUntil=time+25;car.responsePath=[];}
      continue;
    }
    car.arrivedAt=undefined;
    const waypoint=car.responsePath?.[car.responseIndex];
    if(!waypoint){car.speed=car.vx=car.vz=0;continue;}
    grids??=citySpatialGrids(state);
    const desired=Math.atan2(car.x-waypoint.x,car.z-waypoint.z),previousHeading=car.heading||0;
    // Clearance follows the actual path direction, including when a vehicle is
    // still visually turning into a junction.
    const cap=trafficClearance({...car,heading:desired},grids.vehicles.near(car.x,car.z,45),grids.people.near(car.x,car.z,35));
    const desiredSpeed=Math.min(phase==='returning'?7:car.service==='ambulance'?11:13,cap);
    const previousSpeed=Math.max(0,car.speed||0),speed=Math.min(cap*cap/(4*dt),Math.max(0,previousSpeed+Math.max(-8*dt,Math.min(2.6*dt,desiredSpeed-previousSpeed))));
    const x=car.x,z=car.z;
    if(speed>0&&env.along(car,waypoint,speed,dt))car.responseIndex++;
    env.collide(car,1.35);
    car.vx=(car.x-x)/dt;car.vz=(car.z-z)/dt;car.speed=Math.hypot(car.vx,car.vz);
    car.heading=previousHeading+Math.atan2(Math.sin(desired-previousHeading),Math.cos(desired-previousHeading))*Math.min(1,dt*4);
    car.braking=car.speed<previousSpeed-.01;
  }
}
