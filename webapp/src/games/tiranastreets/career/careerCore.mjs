/** Original single-player campaign. No TPG awards, multiplayer authority or GTA
 * content. Reducer events come from this game's movement/interaction loop. */
export const SAVE_KEY='tpg:tirana:career:v1';
export const CHAPTERS=Object.freeze([
 {id:'first-contact',title:'A name in the square',contact:'Arben',reward:80,steps:[['square','Meet Arben at the square','talk'],['clock','Deliver the introduction at the Clock Tower','deliver']]},
 {id:'culture-run',title:'After the rehearsal',contact:'Ilir',reward:120,steps:[['culture','Collect the rehearsal schedule','talk'],['city-hall','Deliver the sealed folder','deliver']]},
 {id:'city-ledger',title:'The missing ledger',contact:'Luan',reward:150,steps:[['bank','Collect the archive request','talk'],['culture','Return the archive copy','deliver']]},
 {id:'light-and-stone',title:'Light and stone',contact:'Arben',reward:180,steps:[['mosque','Observe the mosque exterior','inspect'],['pyramid','Record the Pyramid exterior','inspect']]},
 {id:'last-delivery',title:'Before the doors close',contact:'Ilir',reward:220,limit:360,steps:[['hotel','Collect the parcel','talk'],['city-hall','Deliver it before closing','deliver']]},
 {id:'dajti-connection',title:'Above the city',contact:'Luan',reward:260,steps:[['clock','Meet the mountain contact','talk'],['dajti-upper','Complete the cable-car excursion','ride']]}
].map(c=>Object.freeze({...c,steps:Object.freeze(c.steps.map(([place,text,action])=>Object.freeze({place,text,action})))})));
const idOf=id=>CHAPTERS.find(c=>c.id===id);
export function freshCareer(){return {version:1,completed:[],bestTimes:{},active:null};}
export function normalizeCareer(raw){
 const clean=freshCareer();if(raw?.version!==1||!Array.isArray(raw.completed))return clean;
 // A corrupted/out-of-order save cannot silently unlock later chapters.
 for(const chapter of CHAPTERS){if(!raw.completed.includes(chapter.id))break;clean.completed.push(chapter.id);const best=raw.bestTimes?.[chapter.id];if(Number.isFinite(best)&&best>=0)clean.bestTimes[chapter.id]=best;}
 const a=raw.active,c=idOf(a?.id);
 if(c&&CHAPTERS.indexOf(c)<=clean.completed.length&&Number.isInteger(a.step)&&a.step>=0&&a.step<c.steps.length&&Number.isFinite(a.elapsed)&&a.elapsed>=0){
  clean.active={id:c.id,step:a.step,elapsed:Math.min(a.elapsed,86400),status:['active','failed'].includes(a.status)?a.status:'active',reason:String(a.reason||'').slice(0,120)};
 }
 return clean;
}
export function loadCareer(storage){try{return normalizeCareer(JSON.parse(storage?.getItem(SAVE_KEY)||'null'));}catch{return freshCareer();}}
export function saveCareer(storage,profile){try{if(!storage)return false;storage.setItem(SAVE_KEY,JSON.stringify(normalizeCareer(profile)));return true;}catch{return false;}}
export function careerBalance(profile){return CHAPTERS.filter(c=>profile.completed.includes(c.id)).reduce((sum,c)=>sum+c.reward,0);}
export function startChapter(profile,id){
 const c=idOf(id);if(!c||CHAPTERS.indexOf(c)>profile.completed.length)return profile;
 return {...profile,active:{id,step:0,elapsed:0,status:'active',reason:''}};
}
export function currentStep(profile){const a=profile.active;return a?.status==='active'?idOf(a.id)?.steps[a.step]||null:null;}
export function advanceCareer(profile,event){
 const a=profile.active;if(!a||a.status!=='active')return profile;
 const c=idOf(a.id),step=c?.steps[a.step];if(!step)return profile;
 if(event.type==='cancel')return {...profile,active:null};
 if(event.type==='tick'){
  if(event.paused||!Number.isFinite(event.dt)||event.dt<=0)return profile;
  const elapsed=a.elapsed+Math.min(event.dt,.1);
  return {...profile,active:{...a,elapsed,status:c.limit&&elapsed>c.limit?'failed':'active',reason:c.limit&&elapsed>c.limit?'Delivery time expired. Retry this chapter.':''}};
 }
 if(event.type!=='interact'||event.place!==step.place||event.action!==step.action||event.paused)return profile;
 if(step.action==='ride'){
  if(event.completedJourney!==true)return profile;
 }else if(!Number.isFinite(event.distance)||event.distance>4||event.distance<0||event.lineOfSight!==true)return profile;
 if(a.step+1<c.steps.length)return {...profile,active:{...a,step:a.step+1}};
 const completed=profile.completed.includes(c.id)?profile.completed:[...profile.completed,c.id];
 return {...profile,completed,bestTimes:{...profile.bestTimes,[c.id]:Math.min(profile.bestTimes[c.id]??Infinity,a.elapsed)},active:null};
}
/** Pick the nearest physically accessible mapped path point, not a building
 * centre. The injected collision predicate uses the game's actual obstacles. */
export function accessPoint(world,anchor,isWalkable){
 if(!anchor||![anchor.x,anchor.z].every(Number.isFinite))return null;
 const candidates=[];
 for(const r of world.roads){
  if(r.access==='private'||r.access==='no'||r.highway==='motorway')continue;
  const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],d=dx*dx+dz*dz;
  const t=d?Math.max(0,Math.min(1,((anchor.x-r.a[0])*dx+(anchor.z-r.a[1])*dz)/d)):0;
  const p={x:r.a[0]+dx*t,z:r.a[1]+dz*t};
  const distance=Math.hypot(p.x-anchor.x,p.z-anchor.z);
  if(distance<100)candidates.push({...p,distance});
 }
 candidates.sort((a,b)=>a.distance-b.distance);
 return candidates.find(p=>isWalkable(p))||null;
}
