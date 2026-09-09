/** Device-local kart challenges, evaluated only from the existing renderer's
 * completed race result. Task XP never credits TPG or multiplayer settlements. */
export const KART_TASK_KEY='tonplaygram.kartroyale.tasks.v1';
export const KART_TASKS=Object.freeze([
  {id:'qender-qualifier',title:'Qendër qualifier',track:'skanderbeg',difficulty:'rookie',seconds:420,xp:100,description:'Finish the full Skënderbej race within 7 minutes.'},
  {id:'blloku-clean',title:'Clean driving in Blloku',track:'blloku',difficulty:'rookie',health:75,xp:150,description:'Finish with at least 75% kart health.'},
  {id:'lana-podium',title:'Lana podium',track:'lana',difficulty:'street',place:3,xp:200,description:'Finish in the top three against AI.'},
  {id:'grand-endurance',title:'Grand endurance',track:'lana-pyramid-grand',difficulty:'street',health:40,seconds:480,xp:250,description:'Complete the Grand race within 8 minutes, with at least 40% kart health.'}
].map(Object.freeze));
export const freshKartTasks=()=>({version:1,completed:[],best:{}});
export function normalizeKartTasks(raw){
  const p=freshKartTasks();if(raw?.version!==1)return p;
  for(const t of KART_TASKS){if(!Array.isArray(raw.completed)||!raw.completed.includes(t.id))break;p.completed.push(t.id);const best=raw.best?.[t.id];if(Number.isFinite(best)&&best>0)p.best[t.id]=best;}
  return p;
}
export const kartTaskXP=p=>KART_TASKS.filter(t=>normalizeKartTasks(p).completed.includes(t.id)).reduce((sum,t)=>sum+t.xp,0);
export function finishKartTask(profile,id,result){
  const p=normalizeKartTasks(profile),index=KART_TASKS.findIndex(t=>t.id===id),t=KART_TASKS[index];
  if(!t||index>p.completed.length)return {profile:p,complete:false,xp:0,reason:'Complete the earlier kart mission first.'};
  const racers=Array.isArray(result?.racers)?result.racers:[],me=racers.find(r=>r.id===result?.playerId);
  if(result?.trackId!==t.track||!me?.finished||me.retired||me.disconnected||!Number.isFinite(me.finishTime)||me.finishTime<=0||me.finishTime>480)
    return {profile:p,complete:false,xp:0,reason:'Finish this mission’s complete race to record a result.'};
  const place=racers.filter(r=>r.finished&&Number.isFinite(r.finishTime)&&r.finishTime<me.finishTime).length+1;
  if(t.seconds&&me.finishTime>t.seconds)return {profile:p,complete:false,xp:0,reason:'Time target missed. Retry the mission.'};
  if(t.health&&(!Number.isFinite(me.health)||me.health<t.health))return {profile:p,complete:false,xp:0,reason:'Kart damage exceeded the mission limit.'};
  if(t.place&&place>t.place)return {profile:p,complete:false,xp:0,reason:'Podium target missed. Retry the mission.'};
  const first=!p.completed.includes(id);if(first)p.completed.push(id);p.best[id]=Math.min(p.best[id]||Infinity,me.finishTime);
  return {profile:p,complete:true,xp:first?t.xp:0,reason:first?'Kart mission complete.':'Replay complete; no duplicate XP.'};
}
export function loadKartTasks(storage){try{return normalizeKartTasks(JSON.parse(storage?.getItem(KART_TASK_KEY)||'null'));}catch{return freshKartTasks();}}
export function saveKartTasks(storage,profile){try{if(!storage)return false;storage.setItem(KART_TASK_KEY,JSON.stringify(normalizeKartTasks(profile)));return true;}catch{return false;}}
