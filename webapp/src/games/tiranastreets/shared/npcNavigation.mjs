const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Short, remembered detours keep pedestrians from pressing into walls. `clear`
 * is supplied by the active world's geometry, so this also works in missions. */
export function steerNPC(actor,goal,clear,time){
  if(distance(actor,goal)<.2)return goal;
  const cached=actor.walkPlan;
  if(cached&&time<cached.until&&distance(cached.goal,goal)<.7)return cached.point;
  const remember=point=>{actor.walkPlan={point,goal:{x:goal.x,z:goal.z},until:time+(actor.kind==='civilian'?.4:.2)};return point;};
  const reach=Math.min(1,8/distance(actor,goal)),ahead={x:actor.x+(goal.x-actor.x)*reach,z:actor.z+(goal.z-actor.z)*reach};
  if(clear(actor,ahead)){actor.walkDetour=null;return remember(goal);}
  const old=actor.walkDetour;
  if(old&&time<old.until&&distance(actor,old)>.45&&clear(actor,old))return remember(old);
  const yaw=Math.atan2(goal.z-actor.z,goal.x-actor.x),candidates=[];
  let hash=0;for(const c of String(actor.id))hash=(hash*31+c.charCodeAt(0))>>>0;
  const preference=hash%2?1:-1;
  for(const length of [6,3,1.5])for(const turn of [30,-30,60,-60,90,-90,120,-120]){
    const angle=yaw+turn*Math.PI/180;
    const p={x:actor.x+Math.cos(angle)*length,z:actor.z+Math.sin(angle)*length};
    if(!clear(actor,p))continue;
    const score=distance(p,goal)+length*.15+(clear(p,goal)?0:3)+(Math.sign(turn)===preference?0:.1);
    candidates.push({...p,score,until:time+1.8});
  }
  candidates.sort((a,b)=>a.score-b.score);
  actor.walkDetour=candidates[0]||null;
  return remember(actor.walkDetour||actor);
}
export function friendlyInFiringLane(shooter,target,allies,radius=.5){
  const dx=target.x-shooter.x,dz=target.z-shooter.z,length=Math.hypot(dx,dz);
  return length>0&&allies.some(a=>{
    if(a===shooter||a.id===shooter.id||a.id===target.id||a.health<=0||a.motion==='drive')return false;
    const x=a.x-shooter.x,z=a.z-shooter.z,t=(x*dx+z*dz)/(length*length);
    return t>0&&t<1&&Math.abs(x*dz-z*dx)/length<radius;
  });
}
