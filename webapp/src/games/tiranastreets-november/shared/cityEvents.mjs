/** Fictional ambient city event. Timings and unit orders are game design, not
 * a reconstruction of real people, incidents or operational police tactics. */
export const CITY_EVENT_SITE = Object.freeze({x:0,z:0,name:'Skanderbeg Square'});
export const CITY_EVENT_PHASES = Object.freeze([
  {id:'gathering',until:30,label:'Crowds gathering',radio:'Keep the exits open.'},
  {id:'rally',until:90,label:'Rally in the square',radio:'Patrol: speak with the crowd. FNSH: hold the line.'},
  {id:'unrest',until:135,label:'Clashes and fireworks',radio:'Protect the exit corridor. Traffic: stop incoming vehicles.'},
  {id:'deescalation',until:195,label:'Tension easing',radio:'Hold position. Let people leave.'},
  {id:'dispersal',until:240,label:'Crowds dispersing',radio:'Stand down in sequence. Reopen the square.'}
]);
export const UNIT_DUTIES = Object.freeze({
  patrol:{label:'Policia',order:'communicate',speed:1.35},
  traffic:{label:'Policia Rrugore',order:'divert',speed:1.3},
  shqiponja:{label:'Shqiponja',order:'patrol-perimeter',speed:1.65},
  fnsh:{label:'FNSH',order:'hold-cordon',speed:1.4},
  renea:{label:'RENEA',order:'reserve',speed:1.3}
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
export function createCityEvent(time=0){
  return {enabled:true,phase:'waiting',startedAt:null,nextAt:time,sequence:0,
    center:{...CITY_EVENT_SITE},radius:27,actors:[],orders:{},tension:0,lastCrimeAt:-Infinity,
    nextPyro:0,pyro:[],report:'A rally is expected at Skanderbeg Square.'};
}
/** A command is acknowledged by each member, and cannot be replaced by an old
 * packet. Expired commands stop movement rather than leaving stale pursuit. */
export function issueUnitOrder(event,role,kind,goal,time,ttl=12){
  if(!UNIT_DUTIES[role]||!finitePoint(goal)||!Number.isFinite(time))return null;
  if(!['communicate','divert','patrol-perimeter','hold-cordon','reserve','withdraw'].includes(kind))return null;
  const order={sequence:++event.sequence,kind,goal:{x:goal.x,z:goal.z},issuedAt:time,expiresAt:time+(Number.isFinite(ttl)?Math.max(.1,Math.min(60,ttl)):12)};
  event.orders[role]=order;return order;
}
export function acceptUnitOrder(n,order,time){
  if(!order||!finitePoint(order.goal)||!Number.isInteger(order.sequence)||![order.expiresAt,order.issuedAt].every(Number.isFinite)||order.expiresAt<=time||order.issuedAt>time)return false;
  if(order.sequence<(n.orderSequence||0))return false;
  n.orderSequence=order.sequence;n.orderKind=order.kind;n.orderAcknowledgedAt=time;
  return true;
}
function safePoint(candidate,env,occupied){
  const point={...candidate};env.collide(point,.5);
  return distance(point,candidate)<.15&&!occupied.some(n=>distance(n,point)<1.05)?point:null;
}
function populate(event,state,env){
  const occupied=[...state.npcs.filter(n=>distance(n,event.center)<45),...state.cars,...state.units];
  const add=(candidate,extra)=>{
    const point=safePoint(candidate,env,occupied);if(!point)return;
    const n={...point,id:`rally-${event.startedAt}-${event.actors.length}`,kind:'civilian',role:'protester',
      cityEvent:true,eventSlot:event.actors.length,eventHome:{...point},heading:0,speed:0,health:100,
      weapon:null,motion:'walk',anim:'idle',downUntil:0,panicUntil:0,...extra};
    event.actors.push(n.id);state.npcs.push(n);occupied.push(n);
  };
  for(let i=0;i<36;i++){
    const x=event.center.x+(i%8-3.5)*2.1,z=event.center.z+8+Math.floor(i/8)*2.5;
    add({x,z},{eventSlot:i,agitator:i%11===0});
  }
  for(const [role,count,z] of [['fnsh',6,-3],['patrol',2,1],['shqiponja',2,-10],['renea',2,-17],['traffic',2,30]]){
    for(let i=0;i<count;i++)add({x:event.center.x+(i-(count-1)/2)*(role==='fnsh'?1.55:14),z:event.center.z+z},
      {kind:'police',role:'event-officer',eventRole:role,eventSlot:i,
        forceCharacter:`${role}_officer`,cordon:role==='fnsh'?'event':undefined});
  }
}
export function stopCityEvent(state,enabled=false){
  const event=state.cityEvent;if(!event)return;
  const ids=new Set(event.actors);
  state.npcs=state.npcs.filter(n=>!ids.has(n.id));
  Object.assign(event,{enabled,phase:'waiting',startedAt:null,nextAt:state.elapsed+360,actors:[],orders:{},pyro:[],tension:0});
}
export function updateCityEvent(state,dt,env){
  const event=state.cityEvent;if(!event?.enabled)return;
  const time=state.elapsed,players=Object.values(state.players);
  if(event.startedAt===null){
    if(time<event.nextAt||state.missionId!=='free-roam'||!players.some(p=>p.health>0&&distance(p,event.center)<180))return;
    event.startedAt=time;event.nextPyro=time;event.orderAt=0;populate(event,state,env);
  }
  const age=time-event.startedAt;
  if(age<0||age>=240){stopCityEvent(state,true);return;}
  const phase=CITY_EVENT_PHASES.find(p=>age<p.until);
  event.phase=phase.id;event.report=phase.radio;
  const incident=players.find(p=>distance(p,event.center)<60&&time-p.lastCrime<1&&p.lastCrime>event.lastCrimeAt);
  if(incident){event.tension=Math.min(1,event.tension+.3);event.lastCrimeAt=incident.lastCrime;}
  event.tension=Math.max(0,event.tension-Math.max(0,dt)*.035);
  const alarm=event.phase==='unrest'||event.tension>.25;
  event.pyro=event.pyro.filter(p=>time-p.at<5);
  if(alarm&&time>=event.nextPyro){
    // Cosmetic fireworks are separate from combat explosions and rewards.
    const i=Math.floor(age/3.5),x=event.center.x+Math.sin(i*2.4)*13,z=event.center.z+5+Math.cos(i*1.7)*4;
    event.pyro.push({id:++event.sequence,x,z,at:time});event.nextPyro=time+3.5;
    if(event.pyro.length>3)event.pyro.shift();
  }
  if(time<event.orderAt)return;
  event.orderAt=time+3;
  for(const [role,duty] of Object.entries(UNIT_DUTIES)){
    const kind=event.phase==='dispersal'?'withdraw':duty.order;
    issueUnitOrder(event,role,kind,event.center,time,8);
  }
}
export function cityEventIntent(n,state){
  const event=state.cityEvent;
  if(!n.cityEvent||!event?.enabled||event.startedAt===null)return null;
  const age=state.elapsed-event.startedAt,home=n.eventHome;
  if(n.kind==='police'){
    const role=n.eventRole,order=event.orders[role];
    if(!acceptUnitOrder(n,order,state.elapsed))return {goal:n,speed:0,anim:'idle'};
    let goal={x:home.x+order.goal.x-event.center.x,z:home.z+order.goal.z-event.center.z},anim='idle';
    if(order.kind==='withdraw')goal.z-=12;
    else if(role==='shqiponja'){goal.x+=Math.sin(age*.12+n.eventSlot*Math.PI)*5;goal.z+=Math.cos(age*.12)*2;}
    else if(role==='traffic')anim='direct';
    else if(role==='patrol')anim='communicate';
    else if(role==='fnsh')anim='hold';
    const moving=distance(n,goal)>.25;
    return {goal,speed:moving?UNIT_DUTIES[role].speed:0,anim:moving?'walk':anim,
      heading:Math.atan2(n.x-event.center.x,n.z-(event.center.z+12))};
  }
  const alarm=event.phase==='unrest'||event.tension>.25||n.panicUntil>state.elapsed;
  let goal={...home},speed=0,anim='chant';
  if(event.phase==='gathering'){goal.z-=2;speed=1.15;anim='walk';}
  else if(event.phase==='dispersal'||alarm&&!n.agitator){
    // Keep a wide central escape corridor; adults leave away from the line.
    goal={x:event.center.x+(n.eventSlot%2?-1:1)*(28+n.eventSlot%4),z:event.center.z+38+n.eventSlot%5};
    speed=alarm?3.1:1.25;anim=alarm?'run':'walk';
  }else if(alarm&&n.agitator){anim='protest';goal.z-=3;speed=.8;}
  else if(event.phase==='deescalation'){anim='idle';speed=1;}
  if(distance(n,goal)<.5)speed=0;
  return {goal,speed,anim:speed>0?(speed>2?'run':'walk'):anim,heading:Math.atan2(n.x-event.center.x,n.z-event.center.z)};
}
/** Incoming traffic brakes outside the event; vehicles already inside can
 * leave. The same circle is used when choosing alternate road graph edges. */
export function cityEventRoadGap(car,event){
  if(!event?.enabled||event.startedAt===null||event.phase==='dispersal')return Infinity;
  const dx=event.center.x-car.x,dz=event.center.z-car.z,r=event.radius;
  if(dx*dx+dz*dz<r*r)return Infinity;
  const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading),ahead=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);
  if(ahead<=0||side>=r)return Infinity;
  return Math.max(0,ahead-Math.sqrt(r*r-side*side)-(car.d||4.5)/2-2);
}
export function cityEventRoadBlocked(a,b,event){
  if(!event?.enabled||event.startedAt===null||event.phase==='dispersal'||distance(a,event.center)<event.radius)return false;
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((event.center.x-a.x)*dx+(event.center.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return distance({x:a.x+dx*t,z:a.z+dz*t},event.center)<event.radius;
}
