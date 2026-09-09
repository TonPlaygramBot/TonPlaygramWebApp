/** Original kart-only jobs on the existing Tirana circuits. No city on-foot
 * objectives, extra currencies, account writes or changes to paid race rules. */
export const KART_MISSIONS=Object.freeze([
  {id:'city-licence',title:'City licence',track:'skanderbeg',difficulty:'rookie',objective:'finish',reward:100,description:'Complete the Skënderbej circuit race in your kart.'},
  {id:'lana-podium',title:'Lana podium',track:'lana',difficulty:'rookie',objective:'podium',place:3,reward:180,description:'Finish among the first three along the Lana.'},
  {id:'blloku-clean',title:'Blloku clean run',track:'blloku',difficulty:'rookie',objective:'clean',minHealth:65,reward:220,description:'Finish with at least 65 kart health. Heavy impacts fail the job.'},
  {id:'pyramid-express',title:'Pyramid express',track:'pyramid',difficulty:'street',objective:'timed',seconds:300,reward:260,description:'Complete the kart race within five minutes.'},
  {id:'stadium-control',title:'Stadium control',track:'stadium',difficulty:'street',objective:'clean',minHealth:75,reward:300,description:'Complete the stadium route with at least 75 kart health.'},
  {id:'capital-winner',title:'Capital winner',track:'skanderbeg',difficulty:'street',objective:'podium',place:1,reward:400,description:'Win the city-centre kart race.'}
].map(Object.freeze));
const byId=new Map(KART_MISSIONS.map(m=>[m.id,m]));
export function normalizeKartJobs(raw){
  const completed=[];for(const m of KART_MISSIONS){if(!Array.isArray(raw?.completed)||!raw.completed.includes(m.id))break;completed.push(m.id);}
  const best={};for(const id of completed){const n=raw?.best?.[id];if(Number.isFinite(n)&&n>0)best[id]=n;}
  return {completed,best};
}
export function availableKartJob(jobs,id){const i=KART_MISSIONS.findIndex(m=>m.id===id);return i>=0&&i<=normalizeKartJobs(jobs).completed.length;}
export function evaluateKartJob(id,result,minimumHealth){
  const m=byId.get(id),index=Array.isArray(result?.racers)?result.racers.findIndex(p=>p?.id===result.playerId):-1,p=index>=0?result.racers[index]:null;
  if(!m||result?.trackId!==m.track)return {success:false,reason:'Wrong circuit for this job.'};
  if(!p?.finished||p.retired||!Number.isFinite(p.finishTime)||p.finishTime<=0)return {success:false,reason:'Finish the race in your kart to complete this job.'};
  if(m.objective==='podium'&&index+1>m.place)return {success:false,reason:`Finish in the top ${m.place}.`};
  if(m.objective==='timed'&&p.finishTime>m.seconds)return {success:false,reason:`Time limit: ${m.seconds} seconds.`};
  if(m.objective==='clean'&&(!Number.isFinite(minimumHealth)||minimumHealth<m.minHealth||!Number.isFinite(p.health)||p.health<m.minHealth))return {success:false,reason:`Keep at least ${m.minHealth} kart health throughout the race.`};
  return {success:true,reason:'Kart mission complete.'};
}
export function completeKartJob(jobs,id,result,minimumHealth){
  const next=normalizeKartJobs(jobs),m=byId.get(id);
  if(!m||!availableKartJob(next,id))return {jobs:next,reward:0,success:false,reason:'Complete the previous kart mission first.'};
  const verdict=evaluateKartJob(id,result,minimumHealth);
  if(!verdict.success)return {jobs:next,reward:0,...verdict};
  const first=!next.completed.includes(id),p=result.racers.find(p=>p.id===result.playerId);
  if(first)next.completed.push(id);next.best[id]=Math.min(next.best[id]||Infinity,p.finishTime);
  return {jobs:next,reward:first?m.reward:0,...verdict};
}
/** Pointer/key ownership prevents releasing BOOST from also releasing steering.
 * Positive steer still means screen-right for the original kart renderer. */
export class KartControlState {
  constructor(){this.held=new Map();this.enabled=true;}
  hold(token,action,value=true){if(!this.enabled||!['steer','brake','boost','drift'].includes(action))return;this.held.set(token,{action,value});}
  release(token){this.held.delete(token);}
  clear(){this.held.clear();}
  setEnabled(value){this.enabled=!!value;if(!this.enabled)this.clear();}
  read(){const out={steer:0,brake:false,boost:false,drift:false};if(!this.enabled)return out;for(const {action,value} of this.held.values()){if(action==='steer')out.steer+=Number.isFinite(value)?value:0;else out[action] ||= value===true;}out.steer=Math.max(-1,Math.min(1,out.steer));return out;}
}
export const KART_KEYS=Object.freeze({ArrowLeft:['steer',-1],KeyA:['steer',-1],ArrowRight:['steer',1],KeyD:['steer',1],Space:['brake',true],ShiftLeft:['drift',true],ShiftRight:['drift',true],KeyB:['boost',true],ArrowUp:['boost',true]});
