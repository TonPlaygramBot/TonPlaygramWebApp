import {sampleCircuitDistance} from './circuitMetrics.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const CITY_JOB_KEY='tonplaygram.racing.city-career.v1';
/** Original Tirana driving stories. Stops are on the game's mapped road route,
 * not straight lines through blocks; rewards are device-local career XP. */
export const CITY_JOBS=Object.freeze([
 {id:'market-courier',title:'Market courier',district:'Qendër',track:'skanderbeg',kind:'delivery',unlock:0,xp:120,seconds:150,health:65,stops:[.035,.12,.22],labels:['Collect the market parcel','Deliver to the café','Return the signed receipt'],brief:'Make three stops. Brake inside each marker, then release both pedals for a 1.5-second handover.'},
 {id:'riverside-patrol',title:'River watch',district:'Lana',track:'lana',kind:'patrol',unlock:0,xp:140,seconds:180,health:85,stops:[.035,.11,.19,.27],labels:['Check the west bank','Inspect the crossing','Survey the embankment','Report at the final marker'],brief:'Follow the riverside checkpoints with at least 85% kart condition. A clean run earns the best medal.'},
 {id:'medical-express',title:'Medical express',district:'Blloku',track:'blloku',kind:'delivery',unlock:120,xp:180,seconds:125,health:80,stops:[.025,.12,.23],labels:['Collect the medical supplies','Deliver the first package','Deliver the final package'],brief:'A timed supply run. Stop at every handover and keep the fragile cargo safe.'},
 {id:'pyramid-drift',title:'Pyramid film crew',district:'Piramida',track:'pyramid',kind:'drift',unlock:120,xp:180,seconds:180,health:65,score:160,stops:[.03,.10,.19,.27],labels:['Reach the first filming marker','Film the next bend','Follow the camera route','Finish at the crew marker'],brief:'Earn 160 drift points while following the filming route. Impacts lose the current unbanked chain.'},
 {id:'stadium-survey',title:'Precision survey',district:'Nënë Tereza',track:'stadium',kind:'precision',unlock:300,xp:220,seconds:200,health:85,score:15,stops:[.03,.11,.20,.29],labels:['Begin the road survey','Scan the next sector','Complete the approach','Return the survey data'],brief:'Accumulate 15 seconds at 36–72 km/h without drifting or hitting anything, then complete the route.'},
 {id:'farke-supplies',title:'Farkë supply trail',district:'Farkë',track:'farke',kind:'delivery',unlock:300,xp:250,seconds:220,health:75,stops:[.025,.12,.25],labels:['Pick up the trail supplies','Reach the field team','Deliver to the final outpost'],brief:'Carry supplies along the lake route. The Cross kart helps over bumps; stop at both drop-offs.'}
].map(j=>Object.freeze({...j,stops:Object.freeze(j.stops),labels:Object.freeze(j.labels)})));
export const freshCityCareer=()=>({version:1,medals:{},best:{}});
export function normalizeCityCareer(raw){
 const p=freshCityCareer();if(raw?.version!==1)return p;
 for(const job of CITY_JOBS){const n=raw.medals?.[job.id],t=raw.best?.[job.id];if(Number.isInteger(n)&&n>=1&&n<=3)p.medals[job.id]=n;if(p.medals[job.id]&&Number.isFinite(t)&&t>0)p.best[job.id]=t;}
 return p;
}
export const cityCareerXP=profile=>{const p=normalizeCityCareer(profile);return CITY_JOBS.reduce((sum,j)=>sum+(p.medals[j.id]?j.xp:0),0);};
export function loadCityCareer(storage){try{return normalizeCityCareer(JSON.parse(storage?.getItem(CITY_JOB_KEY)||'null'));}catch{return freshCityCareer();}}
export function saveCityCareer(storage,profile){try{if(!storage)return false;storage.setItem(CITY_JOB_KEY,JSON.stringify(normalizeCityCareer(profile)));return true;}catch{return false;}}
export function createCityJob(id,track){
 const job=CITY_JOBS.find(j=>j.id===id);if(!job||track.id!==job.track)throw Error('This city job requires its mapped route.');
 return {id,status:'active',elapsed:0,stage:0,hold:0,score:0,chain:0,impacts:0,lastImpact:0,medal:0,reason:'',distance:0,health:100,
  targets:job.stops.map((fraction,i)=>({...sampleCircuitDistance(track,fraction*track.length),label:job.labels[i]}))};
}
const pointDistance=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
/** Mutated only by the fixed simulation clock. Pause never advances job time.
 * A recovery/discontinuity cannot collect a gate or score driving distance. */
export function stepCityJob(state,r,dt){
 if(state.status!=='active'||!Number.isFinite(dt)||dt<=0)return state;
 const job=CITY_JOBS.find(j=>j.id===state.id);if(!job)return state;
 dt=Math.min(dt,.05);state.elapsed+=dt;state.health=Number.isFinite(r.health)?r.health:0;
 const impact=(r.impactId||0)>state.lastImpact;state.lastImpact=r.impactId||0;
 if(impact){state.impacts++;state.chain=0;}
 const finite=[r.x,r.z,r.speed].every(Number.isFinite);
 const previous=state.previous||{x:r.x,z:r.z};
 const travel=Math.hypot(r.x-previous.x,r.z-previous.z);
 const continuous=finite&&travel<=Math.max(3,Math.abs(r.speed)*dt*2+.5)&&state.recoveryAt===(r.recoveryAt??-10);
 state.previous={x:r.x,z:r.z};state.recoveryAt=r.recoveryAt??-10;
 if(state.health<job.health||r.retired||r.disconnected){state.status='failed';state.reason='Kart condition fell below the job requirement.';return state;}
 if(state.elapsed>=job.seconds){state.status='failed';state.reason='Time expired. Retry from the job board.';return state;}
 if(continuous&&!impact&&!r.airborne&&!r.waterRecovery){
  if(job.kind==='drift'&&r.drifting&&r.speed>7&&travel>.015){state.chain+=travel*Math.min(2.5,1+Math.abs(r.steering||0));}
  else if(job.kind==='drift'&&!r.drifting&&state.chain>0){state.score+=state.chain;state.chain=0;}
  if(job.kind==='precision'&&r.speed>=10&&r.speed<=20&&!r.drifting&&travel>.015)state.score+=dt;
 }
 const target=state.targets[state.stage];
 if(target){
  state.distance=Math.hypot(target.x-r.x,target.z-r.z);
  const radius=job.kind==='delivery'?4:6;
  const inside=finite&&state.distance<=radius;
  if(job.kind==='delivery'){
   state.hold=inside&&continuous&&Math.abs(r.speed)<.8&&!r.waterRecovery?state.hold+dt:0;
   if(state.hold>=1.5){state.stage++;state.hold=0;}
  }else if(continuous&&r.speed>0&&(inside||pointDistance(target,previous,r)<=radius)){state.stage++;}
 }
 if(state.stage>=state.targets.length&&state.score>=(job.score||0)){
  state.status='complete';state.distance=0;
  state.medal=1+Number(state.elapsed<job.seconds*.8&&state.health>=90)+Number(state.elapsed<job.seconds*.65&&state.impacts===0&&state.health>=95);
  state.reason=state.medal===3?'Gold · flawless run':state.medal===2?'Silver · clean delivery':'Bronze · job complete';
 }
 return state;
}
export function finishCityJob(profile,state){
 const p=normalizeCityCareer(profile),job=CITY_JOBS.find(j=>j.id===state?.id);
 if(!job||state.status!=='complete'||state.stage!==job.stops.length||state.health<job.health||!(state.elapsed>0&&state.elapsed<job.seconds)||!Number.isInteger(state.medal)||state.medal<1||state.medal>3||state.score<(job.score||0)||cityCareerXP(p)<job.unlock)return {profile:p,xp:0};
 const first=!p.medals[job.id];p.medals[job.id]=Math.max(p.medals[job.id]||0,state.medal);p.best[job.id]=Math.min(p.best[job.id]||Infinity,state.elapsed);
 return {profile:p,xp:first?job.xp:0};
}
