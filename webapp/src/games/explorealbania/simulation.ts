import { CITIES, ROADS, cityById, distanceKm, pathBetween } from './world.js';

export type Controls = { steer: number; throttle: number; brake: number };
export type Job = {
  id: string;
  from: string;
  to: string;
  cargo: string;
  tonnes: number;
  payout: number;
  distance: number;
  fragile: boolean;
};
export type TruckState = {
  x: number; z: number; heading: number; speed: number; rpm: number;
  fuel: number; damage: number; money: number; time: number; odometer: number;
  currentCity: string; activeJob: Job | null; delivered: number; level: number;
  engine: boolean; paused: boolean; notice: string; noticeUntil: number;
};

export const neutralControls = (): Controls => ({ steer: 0, throttle: 0, brake: 0 });
export const defaultState = (): TruckState => {
  const tirana = cityById('tirana');
  return {
    x: tirana.x, z: tirana.z - 12, heading: Math.PI, speed: 0, rpm: 700,
    fuel: 100, damage: 0, money: 12000, time: 7.5, odometer: 0,
    currentCity: 'tirana', activeJob: null, delivered: 0, level: 1,
    engine: true, paused: false, notice: 'Welcome to Tirana depot', noticeUntil: 7.62
  };
};

const CARGO = ['Olive oil', 'Mountain timber', 'Port containers', 'Fresh produce', 'Marble', 'Mineral water'];
const hash = (text:string) => [...text].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
export function jobsFrom(cityId: string, day = 0): Job[] {
  return CITIES.filter((c) => c.id !== cityId).map((to, index) => {
    const distance = distanceKm(cityId, to.id), seed = hash(`${cityId}-${to.id}-${day}`);
    const tonnes = 8 + seed % 17, fragile = seed % 5 === 0;
    return {
      id: `${cityId}-${to.id}-${day}`,
      from: cityId, to: to.id, cargo: CARGO[(seed + index) % CARGO.length],
      tonnes, distance, fragile,
      payout: Math.round((distance * 18 + tonnes * 120) * (fragile ? 1.25 : 1) / 50) * 50
    };
  }).sort((a,b)=>b.payout-a.payout).slice(0,5);
}

export function acceptJob(state: TruckState, job: Job) {
  if (state.activeJob || job.from !== state.currentCity || Math.abs(state.speed) > 1) return false;
  state.activeJob = job;
  state.notice = `${job.cargo} loaded · ${cityById(job.to).name}`;
  state.noticeUntil = state.time + .08;
  return true;
}

type Point={x:number;z:number};
function nearestOnSegment(p:Point,a:Point,b:Point){
  const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l));
  const x=a.x+dx*t,z=a.z+dz*t;return {x,z,distance:Math.hypot(p.x-x,p.z-z)};
}
export function nearestRoad(x:number,z:number){
  let best={x,z,distance:Infinity};
  for(const road of ROADS)for(let i=1;i<road.points.length;i++){
    const point=nearestOnSegment({x,z},road.points[i-1],road.points[i]);
    if(point.distance<best.distance)best=point;
  }
  return best;
}

export function remainingDistance(state: TruckState) {
  if (!state.activeJob) return 0;
  const route = pathBetween(state.activeJob.from, state.activeJob.to);
  let nearest = 0, best = Infinity, travelled = 0, total = 0;
  for(let i=1;i<route.length;i++){
    const len=Math.hypot(route[i].x-route[i-1].x,route[i].z-route[i-1].z);
    const q=nearestOnSegment(state,route[i-1],route[i]);
    if(q.distance<best){best=q.distance;nearest=travelled+Math.hypot(q.x-route[i-1].x,q.z-route[i-1].z);}
    travelled+=len;total+=len;
  }
  return Math.max(0,Math.round((total-nearest)*.55));
}

export function advanceTruck(state: TruckState, input: Controls, dt: number) {
  if (state.paused || dt <= 0) return;
  dt = Math.min(dt, .1);
  const road = nearestRoad(state.x,state.z), offroad=road.distance>7.5;
  const max=offroad?8:state.activeJob?.tonnes && state.activeJob.tonnes>20?25:30;
  const throttle=Math.max(0,Math.min(1,input.throttle)),brake=Math.max(0,Math.min(1,input.brake));
  if(state.engine&&state.fuel>0){
    const drive=throttle*(3.7-Math.abs(state.speed)*.06), drag=.012*state.speed*Math.abs(state.speed)+(offroad?.9:.16)*Math.sign(state.speed);
    state.speed+=Math.max(-7,Math.min(5,drive-drag-brake*8*Math.sign(state.speed||1)))*dt;
  } else state.speed-=Math.sign(state.speed)*Math.min(Math.abs(state.speed),1.5*dt);
  if(brake>.5&&Math.abs(state.speed)<.5&&throttle>.15)state.speed=Math.max(-4,state.speed-2.2*dt);
  const impactSpeed=Math.abs(state.speed);
  state.speed=Math.max(-5,Math.min(max,state.speed));
  const steer=Math.max(-1,Math.min(1,input.steer)),turn=steer*Math.min(1,Math.abs(state.speed)/6)*(.52/(1+Math.abs(state.speed)*.035));
  state.heading+=turn*dt*Math.sign(state.speed||1);
  state.x+=Math.sin(state.heading)*state.speed*dt;
  state.z+=Math.cos(state.heading)*state.speed*dt;
  const km=Math.abs(state.speed)*dt*.055;state.odometer+=km;
  state.fuel=Math.max(0,state.fuel-(.0007+throttle*.003+Math.abs(state.speed)*.00008)*dt);
  state.time=(state.time+dt/90)%24;
  state.rpm=state.engine&&state.fuel>0?700+Math.abs(state.speed)*58+throttle*900:0;
  if(offroad&&impactSpeed>14)state.damage=Math.min(100,state.damage+(impactSpeed-14)*.008*dt);
  let nearestCity=cityById(state.currentCity),cityDistance=Infinity;
  for(const c of CITIES){const d=Math.hypot(c.x-state.x,c.z-state.z);if(d<cityDistance){cityDistance=d;nearestCity=c;}}
  if(cityDistance<18)state.currentCity=nearestCity.id;
  if(state.activeJob&&state.currentCity===state.activeJob.to&&cityDistance<16&&Math.abs(state.speed)<1.2){
    const damagePenalty=Math.round(state.activeJob.payout*Math.min(.65,state.damage/120));
    state.money+=state.activeJob.payout-damagePenalty;state.delivered++;state.level=1+Math.floor(state.delivered/3);
    state.notice=`Delivered · +Lek ${(state.activeJob.payout-damagePenalty).toLocaleString()}`;
    state.noticeUntil=state.time+.1;state.activeJob=null;
  }
}

export function serviceTruck(state:TruckState,kind:'fuel'|'repair'){
  if(Math.abs(state.speed)>1)return false;
  if(kind==='fuel'){
    const amount=100-state.fuel,cost=Math.ceil(amount*18);if(cost>state.money)return false;
    state.money-=cost;state.fuel=100;state.notice=`Fueled · Lek ${cost.toLocaleString()}`;
  }else{
    const cost=Math.ceil(state.damage*95);if(cost>state.money)return false;
    state.money-=cost;state.damage=0;state.notice=`Truck repaired · Lek ${cost.toLocaleString()}`;
  }
  state.noticeUntil=state.time+.06;return true;
}
