import {chooseCrowdExit,crowdNeighbors,crowdSteering} from './crowdBehavior.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const identities=new WeakMap();
const hash=n=>{let value=identities.get(n);if(value===undefined){value=0;for(const c of String(n.id))value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;identities.set(n,value);}return value;};
const junctions=new WeakMap();
function walkJunctions(world){
  if(junctions.has(world))return junctions.get(world);
  const map=new Map(),key=p=>`${Math.round(p[0])}:${Math.round(p[1])}`;
  for(const r of world.roads)if(r.walk){
    for(const [a,b] of [[r.a,r.b],[r.b,r.a]]){const k=key(a),list=map.get(k)||[];list.push({x:b[0],z:b[1]});map.set(k,list);}
  }
  junctions.set(world,map);return map;
}
/** Stay on connected walking paths; crossing vehicles get right of way before
 * stepping off a kerb. A threat changes the route goal, not world position. */
export function pedestrianIntent(n,state,nearVehicles,nearPeople,world,neighbors=crowdNeighbors(n,nearPeople),players=Object.values(state.players)){
  const time=state.elapsed;
  if(!n.path?.length)return {goal:n,speed:0,anim:'idle'};
  if(n.role==='cafe-guest'&&time>=n.panicUntil)return {goal:n,speed:0,anim:'idle'};
  let danger,nearest=42;
  for(const p of players)if(p.health>0&&time-p.lastCrime<10){
    const d=distance(n,p);if(d<nearest){nearest=d;danger=p;}
  }
  // A frightened pedestrian keeps escaping the last observed threat for a
  // short time instead of instantly turning back when it leaves awareness.
  if(danger&&time<n.panicUntil)n.fleeMemory={x:danger.x,z:danger.z,until:Math.min(n.panicUntil,time+3)};
  if(!danger&&n.fleeMemory?.until>time)danger=n.fleeMemory;
  if(n.fleeMemory&&n.fleeMemory.until<=time)delete n.fleeMemory;
  const panic=time<n.panicUntil&&danger;
  let goal=n.path[n.pathIndex]||n.path[0];
  if(panic){
    // Finish the current walking segment before considering the next one.
    // Selecting a neighbor of its endpoint early cuts diagonally across corners.
    goal=n.path.reduce((best,p)=>distance(p,danger)>distance(best,danger)?p:best,goal);
    n.pathIndex=n.path.indexOf(goal);
    n.behavior='flee';n.restUntil=0;
    // Reaching a safe waypoint continues along its connected escape route.
    // Without this, fleeing citizens can remain pinned at one path endpoint.
    if(distance(n,goal)<.55){
      const exits=walkJunctions(world).get(`${Math.round(goal.x)}:${Math.round(goal.z)}`)||[];
      const safer=exits.filter(p=>distance(p,danger)>distance(n,danger)+.5);
      if(safer.length){const next=safer.reduce((a,b)=>distance(a,danger)>distance(b,danger)?a:b);n.path=[{...goal},{...next}];n.pathIndex=1;goal=next;}
    }
  }else{
    if(distance(n,goal)<.55){
      n.visits=(n.visits||0)+1;
      const exits=(walkJunctions(world).get(`${Math.round(goal.x)}:${Math.round(goal.z)}`)||[])
        .filter(p=>distance(p,n.path[1-n.pathIndex]||n)>1);
      if(exits.length){const to=chooseCrowdExit(n,exits,nearPeople,hash(n)+n.visits);n.path=[{...goal},{...to}];n.pathIndex=1;}
      else n.pathIndex=1-n.pathIndex;
      goal=n.path[n.pathIndex];
      // Rest away from a busy crossing so one idle person cannot dam the path.
      if(n.motion!=='cycle'&&neighbors.length<3&&(hash(n)+n.visits)%4===0)n.restUntil=time+1.5+(hash(n)%30)/10;
    }
    if(time<(n.restUntil||0)){n.behavior='rest';return {goal:n,speed:0,anim:'idle'};}
    n.behavior='walk';
  }
  const dx=goal.x-n.x,dz=goal.z-n.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
  let speed=panic?3.8:n.motion==='cycle'?4.2:n.role==='child'?1.9:1.05+(hash(n)%5)*.12;
  for(const c of nearVehicles){
    const vx=c.vx||0,vz=c.vz||0;
    // Predict the next 1.8 seconds of lane occupancy before crossing.
    for(const t of [0,.6,1.2,1.8]){
      const px=c.x+vx*t,pz=c.z+vz*t,rx=n.x+ux*Math.min(1.6,speed*t),rz=n.z+uz*Math.min(1.6,speed*t);
      const x=rx-px,z=rz-pz,side=Math.abs(x*Math.cos(c.heading)-z*Math.sin(c.heading)),ahead=Math.abs(x*Math.sin(c.heading)+z*Math.cos(c.heading));
      if(side<(c.w||1.9)/2+.6&&ahead<(c.d||(c.model==='tirana-bus'?18:4.5))/2+.8){speed=0;n.behavior='yield';break;}
    }
  }
  ({goal,speed}=crowdSteering(n,goal,speed,neighbors));
  return {goal,speed,anim:speed===0?'idle':n.motion==='cycle'?'ride':panic?'run':'walk'};
}
