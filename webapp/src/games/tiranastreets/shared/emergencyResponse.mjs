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
  const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading);
  let gap=Infinity;
  for(const other of vehicles){
    if(other.id===car.id)continue;
    const dx=other.x-car.x,dz=other.z-car.z,forward=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);
    if(forward>0&&side<2.1)gap=Math.min(gap,forward-4.6);
  }
  for(const n of pedestrians){
    if(n.health<=0||n.motion==='drive')continue;
    const dx=n.x-car.x,dz=n.z-car.z,forward=dx*fx+dz*fz;
    if(forward>0&&Math.abs(dx*fz-dz*fx)<1.65)gap=Math.min(gap,forward-2.8);
  }
  // Comfortable deceleration with a hard stop before bodies overlap.
  return Math.sqrt(Math.max(0,gap)*4);
}
export function updateEmergencyResponse(state,dt,env) {
  const players=Object.values(state.players),time=state.elapsed;
  const vehicles=[...state.cars,...state.traffic,...(state.units||[])];
  for(const car of state.traffic){
    if(!car.service)continue;
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
      car.responsePath=env.route(env.nearestNode(car.x,car.z),goalNode);
      car.responseIndex=0;car.responseGoal=goalNode;car.nextResponseRoute=time+2;
    }
    car.responsePhase=phase;car.responding=phase==='responding';car.responseTarget=incident?.id;car.speed=0;
    const arrived=distance(car,{x:goal[0],z:goal[1]})<5;
    if(arrived){
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
    if(!waypoint)continue;
    const cap=trafficClearance(car,vehicles,state.npcs);
    const speed=Math.min(phase==='returning'?7:car.service==='ambulance'?11:13,cap);
    if(speed>0&&env.along(car,waypoint,speed,dt))car.responseIndex++;
    env.collide(car,1.35);
  }
}
