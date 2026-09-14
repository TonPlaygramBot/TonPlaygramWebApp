const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=id=>[...String(id)].reduce((v,c)=>(Math.imul(v,31)+c.charCodeAt(0))>>>0,0);
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
export function pedestrianIntent(n,state,nearVehicles,nearPeople,world){
  const time=state.elapsed;
  if(!n.path?.length)return {goal:n,speed:0,anim:'idle'};
  if(n.role==='cafe-guest'&&time>=n.panicUntil)return {goal:n,speed:0,anim:'idle'};
  const danger=Object.values(state.players).filter(p=>p.health>0&&time-p.lastCrime<10&&distance(n,p)<42)
    .sort((a,b)=>distance(n,a)-distance(n,b))[0];
  const panic=time<n.panicUntil&&danger;
  let goal=n.path[n.pathIndex]||n.path[0];
  if(panic){
    const options=n.path.concat(walkJunctions(world).get(`${Math.round(goal.x)}:${Math.round(goal.z)}`)||[]);
    goal=options.reduce((best,p)=>distance(p,danger)>distance(best,danger)?p:best,goal);
    n.behavior='flee';n.restUntil=0;
  }else{
    if(distance(n,goal)<.55){
      n.visits=(n.visits||0)+1;
      const exits=(walkJunctions(world).get(`${Math.round(goal.x)}:${Math.round(goal.z)}`)||[])
        .filter(p=>distance(p,n.path[1-n.pathIndex]||n)>1);
      if(exits.length){const to=exits[(hash(n.id)+n.visits)%exits.length];n.path=[{...goal},{...to}];n.pathIndex=1;}
      else n.pathIndex=1-n.pathIndex;
      goal=n.path[n.pathIndex];
      if(n.motion!=='cycle'&&(hash(n.id)+n.visits)%4===0)n.restUntil=time+1.5+(hash(n.id)%30)/10;
    }
    if(time<(n.restUntil||0)){n.behavior='rest';return {goal:n,speed:0,anim:'idle'};}
    n.behavior='walk';
  }
  const dx=goal.x-n.x,dz=goal.z-n.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
  let speed=panic?3.8:n.motion==='cycle'?4.2:n.role==='child'?1.9:1.05+(hash(n.id)%5)*.12;
  for(const c of nearVehicles){
    const vx=c.vx||0,vz=c.vz||0;
    // Predict the next 1.8 seconds of lane occupancy before crossing.
    for(const t of [0,.6,1.2,1.8]){
      const px=c.x+vx*t,pz=c.z+vz*t,rx=n.x+ux*Math.min(1.6,speed*t),rz=n.z+uz*Math.min(1.6,speed*t);
      const x=rx-px,z=rz-pz,side=Math.abs(x*Math.cos(c.heading)-z*Math.sin(c.heading)),ahead=Math.abs(x*Math.sin(c.heading)+z*Math.cos(c.heading));
      if(side<(c.w||1.9)/2+.6&&ahead<(c.d||(c.model==='tirana-bus'?18:4.5))/2+.8){speed=0;n.behavior='yield';break;}
    }
  }
  for(const other of nearPeople){
    if(other===n||other.health<=0||other.motion==='drive')continue;
    const x=other.x-n.x,z=other.z-n.z,forward=x*ux+z*uz,lateral=Math.abs(x*uz-z*ux);
    if(forward>0&&forward<1.3&&lateral<.55){
      // Consistent passing side prevents both pedestrians dodging into each other.
      goal={x:goal.x-uz*.7,z:goal.z+ux*.7};speed=Math.min(speed,.8);
      if(forward<.6)speed=0;
    }
  }
  return {goal,speed,anim:speed===0?'idle':n.motion==='cycle'?'ride':panic?'run':'walk'};
}
