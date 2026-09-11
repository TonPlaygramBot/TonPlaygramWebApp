/** Deterministic SOLO city simulation. No renderer, browser or financial authority.
 * All coordinates are game-local metres. Navigation/collision is injected.
 */
export type Point={x:number;z:number};
export type Role='student'|'worker'|'courier'|'business'|'local';
export type NpcState='walk'|'idle'|'flee'|'chase'|'draw'|'aim'|'melee'|'down'|'treated';
export type IncidentKind='medical'|'fire';
export type Nav={
 sample(center:Point,seed:number,min:number,max:number,drive?:boolean):Point|null;
 route(from:Point,to:Point,drive?:boolean):Point[];
 move(from:Point,to:Point,radius:number):Point;
 clear(from:Point,to:Point):boolean;
};
export type NPC={id:number;role:Role;p:Point;heading:number;hp:number;armed:boolean;ammo:number;state:NpcState;until:number;cooldown:number;threatAt:number;home:Point;path:Point[];at:number;nextPlan:number;mission?:string;playerCaused:boolean};
export type Crew={p:Point;heading:number;state:'walk'|'work';path:Point[];at:number};
export type Incident={id:number;kind:IncidentKind;p:Point;patient:number|'player'|null;mission?:string;playerCaused:boolean;intensity:number;status:'queued'|'responding'|'working'|'returning'|'resolved'|'blocked';created:number;retryAt:number;attempts:number};
export type Unit={id:number;kind:IncidentKind;p:Point;heading:number;home:Point;incident:number;state:'responding'|'working'|'returning';path:Point[];at:number;crew:Crew[];work:number;stuck:number};
export type LifeEvent={type:'hit'|'shot'|'playerDown'|'incident'|'dispatch'|'blocked'|'resolved'|'warning';id?:number;mission?:string;kind?:IncidentKind;from?:Point;to?:Point;eligible?:boolean;text?:string};
export type Quality='low'|'balanced'|'high';
export const BUDGETS={low:{population:36,near:6,radius:80},balanced:{population:72,near:10,radius:110},high:{population:120,near:14,radius:145}} as const;
const roles:Role[]=['student','worker','courier','business','local'];
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.z);
const cp=(p:Point):Point=>({x:p.x,z:p.z});
export class CityLifeCore{
 readonly npcs=new Map<number,NPC>();readonly incidents=new Map<number,Incident>();readonly units=new Map<number,Unit>();
 time=0;health=100;reputation=0;player:Point={x:0,z:0};paused=false;quality:Quality;lastNotice='';
 private serial=0;private rng:number;private spawnAt=0;private attackAt=0;private accumulator=0;private missionIds=new Set<string>();private cells=new Map<string,NPC[]>();
 constructor(readonly nav:Nav,readonly event:(e:LifeEvent)=>void=()=>{},quality:Quality='balanced',seed=20260911){this.quality=quality;this.rng=seed>>>0||1;}
 private random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
 private notice(text:string){this.lastNotice=text;this.event({type:'warning',text});}
 setQuality(q:Quality){this.quality=q;}
 setPaused(value:boolean){if(value!==this.paused){this.paused=value;this.accumulator=0;}}
 addNPC(p:Point,options:Partial<Pick<NPC,'role'|'armed'|'mission'>>={}):NPC{
  if(!finite(p))throw new Error('Invalid NPC position');
  const id=++this.serial,role=options.role??roles[id%5];
  // Being armed is independent of appearance, occupation or demographic traits.
  const n:NPC={id,role,p:cp(p),heading:0,hp:100,armed:options.armed??this.random()<.12,ammo:6,state:'walk',until:0,cooldown:0,threatAt:-1e9,home:cp(p),path:[],at:0,nextPlan:0,mission:options.mission,playerCaused:false};this.npcs.set(id,n);return n;
 }
 attack(targetId?:number,forward?:Point):boolean{
  if(this.paused||this.health<=0||this.time<this.attackAt)return false;
  const targets=[...this.npcs.values()].filter(n=>n.hp>0&&dist(n.p,this.player)<=2.05&&this.nav.clear(this.player,n.p)&&(!forward||((n.p.x-this.player.x)*forward.x+(n.p.z-this.player.z)*forward.z)/Math.max(.01,dist(n.p,this.player))>.35));
  const n=targetId===undefined?targets.sort((a,b)=>dist(a.p,this.player)-dist(b.p,this.player))[0]:targets.find(n=>n.id===targetId);this.attackAt=this.time+.65;
  if(!n)return false;this.hitNPC(n.id,24,true);return true;
 }
 hitNPC(id:number,damage:number,byPlayer=false){
  const n=this.npcs.get(id);if(!n||n.hp<=0||!Number.isFinite(damage)||damage<=0||this.paused)return;
  n.hp=Math.max(0,n.hp-Math.min(damage,100));n.playerCaused ||=byPlayer;n.threatAt=this.time;this.event({type:'hit',id,from:cp(this.player),to:cp(n.p)});
  if(byPlayer){this.reputation=Math.max(-100,this.reputation-3);for(const i of this.incidents.values())if(i.patient===id)i.playerCaused=true;}
  if(n.hp===0){n.state='down';n.path=[];this.request('medical',n.p,n.id,n.mission,n.playerCaused);return;}
  if(!byPlayer)return;
  n.path=[];n.nextPlan=0;
  if(n.armed){n.state='draw';n.until=this.time+.85;this.notice('NPC po nxjerr armën. Largohu dhe kërko mbulim.');}
  else if(this.random()<.6){n.state='chase';n.until=this.time+10;}
  else{n.state='flee';n.until=this.time+9;}
 }
 damagePlayer(amount:number){
  if(this.health<=0||this.paused||!Number.isFinite(amount)||amount<=0)return;this.health=Math.max(0,this.health-amount);
  if(this.health===0){this.event({type:'playerDown'});this.request('medical',this.player,'player',undefined,true);this.notice('Je rrëzuar. Urgjenca është njoftuar.');}
 }
 request(kind:IncidentKind,p:Point,patient:number|'player'|null=null,mission?:string,playerCaused=false):Incident|null{
  if(!finite(p))return null;
  const old=[...this.incidents.values()].find(i=>i.status!=='resolved'&&i.kind===kind&&(patient!==null?i.patient===patient:dist(i.p,p)<5));if(old)return old;
  const live=[...this.incidents.values()].filter(i=>i.status!=='resolved');if(live.length>=12){this.notice('Dispeçeria është e zënë.');return null;}
  const i:Incident={id:++this.serial,kind,p:cp(p),patient,mission,playerCaused,intensity:kind==='fire'?1:0,status:'queued',created:this.time,retryAt:0,attempts:0};this.incidents.set(i.id,i);this.event({type:'incident',id:i.id,kind});return i;
 }
 beginMission(kind:IncidentKind,p:Point,id:string):boolean{
  if(this.paused||this.health<=0||!finite(p)||!id||this.missionIds.has(id)||dist(p,this.player)>4||!this.nav.clear(this.player,p))return false;
  let patient:number|null=null;
  if(kind==='medical'){const n=this.addNPC(p,{armed:false,role:'local',mission:id});n.hp=0;n.state='down';patient=n.id;}
  const i=this.request(kind,p,patient,id,false);if(!i){if(patient)this.npcs.delete(patient);return false;}this.missionIds.add(id);return true;
 }
 private plan(n:NPC,target:Point){const path=this.nav.route(n.p,target);n.path=path.filter(finite);n.at=0;n.nextPlan=this.time+1.5+this.random();}
 private follow(p:Point,path:Point[],at:number,speed:number,dt:number,radius:number):{p:Point;at:number;heading:number;moved:number}{
  const old=cp(p);let heading=0,budget=speed*dt;
  for(let k=0;k<5&&at<path.length&&budget>0;k++){
   const t=path[at],d=dist(p,t);if(d<.12){at++;continue;}const step=Math.min(budget,d),to={x:p.x+(t.x-p.x)*step/d,z:p.z+(t.z-p.z)*step/d};heading=Math.atan2(t.x-p.x,t.z-p.z);
   const next=this.nav.move(p,to,radius);if(!finite(next))break;const moved=dist(p,next);p=next;budget-=step;if(moved<step*.15)break;if(d<=step+.12)at++;
  }
  return {p,at,heading,moved:dist(old,p)};
 }
 update(dt:number,player:Point){
  if(!finite(player)||!Number.isFinite(dt)||dt<=0||this.paused)return;this.player=cp(player);this.accumulator+=Math.min(.2,dt);
  for(let i=0;i<6&&this.accumulator>=1/30;i++){this.step(1/30);this.accumulator-=1/30;}
 }
 private population(){
  const b=BUDGETS[this.quality];
  for(const [id,n]of this.npcs)if(!n.mission&&n.hp>0&&this.time-n.threatAt>20&&(dist(n.p,this.player)>b.radius+30||this.npcs.size>b.population&&dist(n.p,this.player)>25))this.npcs.delete(id);
  for(let k=0;k<6&&this.npcs.size<b.population;k++){
   const p=this.nav.sample(this.player,Math.floor(this.random()*1e9),18,b.radius);if(p&&[...this.npcs.values()].every(n=>dist(p,n.p)>1.1))this.addNPC(p);
  }
  this.spawnAt=this.time+.5;
 }
 private step(dt:number){
  this.time+=dt;if(this.time>=this.spawnAt)this.population();
  this.cells.clear();for(const n of this.npcs.values()){const key=`${Math.floor(n.p.x/3)}:${Math.floor(n.p.z/3)}`;const a=this.cells.get(key)||[];a.push(n);this.cells.set(key,a);}
  for(const n of this.npcs.values()){
   if(n.hp<=0||n.state==='treated')continue;
   const d=dist(n.p,this.player),hostile=['draw','aim','chase','melee'].includes(n.state);
   if(hostile&&(this.health<=0||this.time-n.threatAt>14||dist(n.p,n.home)>45||d>40)){n.state='flee';n.until=this.time+5;n.nextPlan=0;}
   if(n.state==='draw'&&this.time>=n.until){n.state='aim';n.cooldown=this.time+.35;}
   if(n.state==='aim'){
    n.heading=Math.atan2(this.player.x-n.p.x,this.player.z-n.p.z);
    if(n.ammo===0){n.state='flee';n.until=this.time+8;n.nextPlan=0;}
    else if(d<24&&d>.4&&this.nav.clear(n.p,this.player)&&this.time>=n.cooldown){n.ammo--;n.cooldown=this.time+1.1;this.event({type:'shot',id:n.id,from:cp(n.p),to:cp(this.player)});this.damagePlayer(11);}
    else if((d>=24||!this.nav.clear(n.p,this.player))&&this.time>=n.nextPlan)this.plan(n,this.player);
   }
   if(n.state==='chase'||n.state==='melee'){
    if(d<1.7&&this.nav.clear(n.p,this.player)){n.state='melee';n.path=[];if(this.time>=n.cooldown){n.cooldown=this.time+.9;this.damagePlayer(7);this.event({type:'hit',id:n.id,from:cp(n.p),to:cp(this.player)});}}
    else{n.state='chase';if(this.time>=n.nextPlan)this.plan(n,this.player);}
   }
   if(n.state==='flee'){
    if(this.time>=n.until){n.state='walk';n.path=[];n.nextPlan=0;}
    else if(this.time>=n.nextPlan){const dx=n.p.x-this.player.x,dz=n.p.z-this.player.z,len=Math.hypot(dx,dz)||1;const target=this.nav.sample({x:n.p.x+dx/len*15,z:n.p.z+dz/len*15},n.id,2,10);if(target)this.plan(n,target);else n.nextPlan=this.time+2;}
   }
   if((n.state==='walk'||n.state==='idle')&&this.time>=n.nextPlan&&n.at>=n.path.length){
    const t=this.nav.sample(n.p,Math.floor(this.random()*1e9),6,24);if(t)this.plan(n,t);else{n.state='idle';n.nextPlan=this.time+3;} }
   const speed=n.state==='flee'?3.5:n.state==='chase'?2.9:1.15+(n.id%5)*.12;
   if(n.path.length&&n.state!=='draw'&&n.state!=='melee'){
    const f=this.follow(n.p,n.path,n.at,speed,dt,.32);let candidate=f.p;
    const cx=Math.floor(candidate.x/3),cz=Math.floor(candidate.z/3);let blocked=false;
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const other of this.cells.get(`${x}:${z}`)||[])if(other!==n&&other.hp>0&&dist(candidate,other.p)<.53&&other.id<n.id)blocked=true;
    if(!blocked){n.p=candidate;n.at=f.at;if(f.moved>.0001)n.heading=f.heading;}else n.nextPlan=Math.min(n.nextPlan,this.time+.3);
    if(n.at>=n.path.length&&n.state==='walk'){n.state='idle';n.nextPlan=this.time+.5+this.random()*2;}
    if(n.state==='idle'&&f.moved>.0001)n.state='walk';
   }
  }
  for(const i of this.incidents.values())if((i.status==='queued'||i.status==='blocked')&&this.time>=i.retryAt&&this.units.size<2&&i.attempts<3)this.dispatch(i);
  for(const u of [...this.units.values()])this.updateUnit(u,dt);
  for(const [id,i]of this.incidents)if(i.status==='resolved'&&this.time-i.created>180)this.incidents.delete(id);
 }
 private dispatch(i:Incident){
  i.attempts++;const home=this.nav.sample(i.p,i.id*73+i.attempts,45,110,true);const path=home?this.nav.route(home,i.p,true):[];
  if(!home||path.length<2){i.status='blocked';i.retryAt=this.time+15;this.event({type:'blocked',id:i.id,text:'Nuk u gjet rrugë e kalueshme për automjetin.'});return;}
  // These are validated game staging points, NOT invented real station locations.
  const u:Unit={id:++this.serial,kind:i.kind,p:cp(home),heading:0,home:cp(home),incident:i.id,state:'responding',path,at:0,crew:[],work:0,stuck:0};this.units.set(u.id,u);i.status='responding';this.event({type:'dispatch',id:i.id,kind:i.kind});
 }
 private failUnit(u:Unit,i:Incident,text:string){this.units.delete(u.id);i.status='blocked';i.retryAt=this.time+15;this.event({type:'blocked',id:i.id,text});}
 private updateUnit(u:Unit,dt:number){
  const i=this.incidents.get(u.incident);if(!i){this.units.delete(u.id);return;}
  if(u.state==='responding'||u.state==='returning'){
   const f=this.follow(u.p,u.path,u.at,u.kind==='medical'?9:7,dt,1.3);u.p=f.p;u.at=f.at;if(f.moved>1e-5)u.heading=f.heading;u.stuck=f.moved<.002?u.stuck+dt:0;
   if(i.patient==='player'&&u.state==='returning')this.player=cp(u.p);
   if(u.stuck>15){this.failUnit(u,i,'Automjeti u bllokua. Kërkohet rishikim i aksesit.');return;}
   if(u.state==='responding'&&dist(u.p,i.p)<8)u.at=u.path.length;
   if(u.at>=u.path.length){
    if(u.state==='returning'){
     if(i.patient==='player'){this.health=65;this.player=cp(u.home);}else if(typeof i.patient==='number'){const n=this.npcs.get(i.patient);if(n){n.hp=65;n.state='walk';n.p=cp(u.home);n.home=cp(u.home);n.path=[];n.nextPlan=this.time+1;}}
     i.status='resolved';if(i.mission)this.missionIds.delete(i.mission);this.units.delete(u.id);const eligible=!!i.mission&&!i.playerCaused;this.reputation=Math.min(100,this.reputation+(eligible?5:0));this.event({type:'resolved',id:i.id,kind:i.kind,mission:i.mission,eligible});return;
    }
    const crewPath=this.nav.route(u.p,i.p);if(crewPath.length<1||dist(crewPath[crewPath.length-1],i.p)>3){this.failUnit(u,i,'Ekuipazhi nuk ka akses të sigurt në incident.');return;}
    u.state='working';i.status='working';u.crew=[0,1].map(k=>{const start=this.nav.move(u.p,{x:u.p.x+(k?1.2:-1.2),z:u.p.z+1.6},.32),goal=this.nav.move(i.p,{x:i.p.x+(k?.65:-.65),z:i.p.z+.3},.32);return {p:start,heading:0,state:'walk',path:this.nav.route(start,goal),at:0};});
   }
  }else{
   let ready=0;
   for(const c of u.crew){if(dist(c.p,i.p)>1.6){const f=this.follow(c.p,c.path,c.at,1.8,dt,.32);c.p=f.p;c.at=f.at;c.heading=f.heading;if(f.moved<.001)u.stuck+=dt;}else{c.state='work';ready++;}}
   if(u.stuck>20){this.failUnit(u,i,'Ekuipazhi nuk arriti te objektivi.');return;}
   if(ready){u.work+=dt;if(i.kind==='fire')i.intensity=Math.max(0,1-u.work/12);}
   if(u.work>=(i.kind==='medical'?8:12)){
    const path=this.nav.route(u.p,u.home,true);if(path.length<2){this.failUnit(u,i,'Rruga e kthimit nuk është e kalueshme.');return;}
    if(typeof i.patient==='number'){const n=this.npcs.get(i.patient);if(n)n.state='treated';}
    u.state='returning';u.path=path;u.at=0;u.crew=[];i.status='returning';u.stuck=0;
   }
  }
 }
 dispose(){this.npcs.clear();this.units.clear();this.incidents.clear();this.cells.clear();this.missionIds.clear();}
}
