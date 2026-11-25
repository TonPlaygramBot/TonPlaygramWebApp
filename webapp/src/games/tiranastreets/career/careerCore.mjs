/** Original single-player campaign. No TPG awards, multiplayer authority or GTA
 * content. Reducer events come from this game's movement/interaction loop. */
export const SAVE_KEY='tpg:tirana:career:v1';
export const CHAPTERS=Object.freeze([
 {id:'first-contact',title:'A name in the square',contact:'Arben',reward:80,parTime:240,steps:[['square','Meet Arben at the square','talk',[],['introduction']],['clock','Deliver the introduction at the Clock Tower','deliver',['introduction'],[],['introduction']]]},
 {id:'culture-run',title:'After the rehearsal',contact:'Ilir',reward:120,parTime:420,legacySteps:[0,2],steps:[['culture','Collect the rehearsal schedule','talk',[],['schedule']],['pyramid','Verify the rehearsal entrance at the Pyramid','inspect',['schedule'],['entrance-note']],['city-hall','Deliver the verified folder to City Hall','deliver',['schedule','entrance-note'],['receipt'],['schedule','entrance-note']],['culture','Return the signed receipt to Ilir','talk',['receipt'],[],['receipt']]]},
 {id:'city-ledger',title:'The missing ledger',contact:'Luan',reward:150,parTime:480,legacySteps:[0,2],steps:[['bank','Collect the archive request','talk',[],['archive-request']],['city-hall','Verify the ledger reference at City Hall','inspect',['archive-request'],['ledger-reference']],['culture','Locate the matching archive copy','inspect',['ledger-reference'],['archive-copy']],['bank','Return the verified ledger to Luan','deliver',['archive-copy'],[],['archive-request','ledger-reference','archive-copy']]]},
 {id:'light-and-stone',title:'Light and stone',contact:'Arben',reward:180,parTime:420,steps:[['mosque','Record the mosque exterior','inspect',[],['mosque-record']],['pyramid','Record the Pyramid exterior','inspect',['mosque-record'],['pyramid-record']],['square','Share both landmark records with Arben','talk',['mosque-record','pyramid-record'],[],['mosque-record','pyramid-record']]]},
 {id:'last-delivery',title:'Before the doors close',contact:'Ilir',reward:220,limit:360,parTime:240,legacySteps:[0,2],steps:[['hotel','Collect the parcel','talk',[],['sealed-parcel']],['clock','Verify the parcel seal at the Clock Tower','inspect',['sealed-parcel'],['verified-seal']],['city-hall','Deliver the verified parcel before closing','deliver',['sealed-parcel','verified-seal'],[],['sealed-parcel','verified-seal']]]},
 {id:'dajti-connection',title:'Above the city',contact:'Luan',reward:260,parTime:300,steps:[['clock','Collect the mountain excursion ticket','talk',[],['excursion-ticket']],['dajti-upper','Complete the cable-car excursion','ride',['excursion-ticket'],[],['excursion-ticket']]]}
].map(c=>Object.freeze({...c,steps:Object.freeze(c.steps.map(([place,text,action,requires=[],gives=[],takes=[]])=>Object.freeze({place,text,action,requires:Object.freeze(requires),gives:Object.freeze(gives),takes:Object.freeze(takes)})))})));
const idOf=id=>CHAPTERS.find(c=>c.id===id);
const itemsAt=(chapter,index)=>{const items=new Set();for(const step of chapter.steps.slice(0,index)){for(const item of step.takes)items.delete(item);for(const item of step.gives)items.add(item);}return [...items];};
export function freshCareer(){return {version:1,completed:[],bestTimes:{},grades:{},active:null};}
export function normalizeCareer(raw){
 const clean=freshCareer();if(raw?.version!==1||!Array.isArray(raw.completed))return clean;
 // A corrupted/out-of-order save cannot silently unlock later chapters.
 for(const chapter of CHAPTERS){if(!raw.completed.includes(chapter.id))break;clean.completed.push(chapter.id);const best=raw.bestTimes?.[chapter.id];if(Number.isFinite(best)&&best>=0)clean.bestTimes[chapter.id]=Math.min(86400,best);if(['gold','silver','bronze'].includes(raw.grades?.[chapter.id]))clean.grades[chapter.id]=raw.grades[chapter.id];}
 const a=raw.active,c=idOf(a?.id);
 if(c&&CHAPTERS.indexOf(c)<=clean.completed.length&&Number.isInteger(a.step)&&a.step>=0&&a.step<c.steps.length&&(a.routeVersion===2||a.routeVersion==null&&a.step<2)&&Number.isFinite(a.elapsed)&&a.elapsed>=0){
  const step=a.routeVersion===2?a.step:c.legacySteps?.[a.step]??a.step;
  const elapsed=Math.min(a.elapsed,86400),checkpoint=a.checkpoint;
  clean.active={id:c.id,routeVersion:2,step,elapsed,status:['active','failed'].includes(a.status)?a.status:'active',reason:String(a.reason||'').slice(0,120),items:itemsAt(c,step),checkpoint:
    a.routeVersion===2&&Number.isInteger(checkpoint?.step)&&checkpoint.step>=0&&checkpoint.step<=step&&Number.isFinite(checkpoint.elapsed)&&checkpoint.elapsed>=0&&checkpoint.elapsed<=elapsed
      ?{step:checkpoint.step,elapsed:checkpoint.elapsed}:{step,elapsed}};
 }
 return clean;
}
export function loadCareer(storage){try{return normalizeCareer(JSON.parse(storage?.getItem(SAVE_KEY)||'null'));}catch{return freshCareer();}}
export function saveCareer(storage,profile){try{if(!storage)return false;storage.setItem(SAVE_KEY,JSON.stringify(normalizeCareer(profile)));return true;}catch{return false;}}
export function careerBalance(profile){return CHAPTERS.filter(c=>profile.completed.includes(c.id)).reduce((sum,c)=>sum+c.reward,0);}
export function startChapter(profile,id){
 const c=idOf(id);if(!c||CHAPTERS.indexOf(c)>profile.completed.length)return profile;
 const previous=profile.active?.id===id&&profile.active.status==='failed'?normalizeCareer(profile).active:null;
 const checkpoint=previous?.checkpoint||{step:0,elapsed:0};
 return {...profile,active:{id,routeVersion:2,step:checkpoint.step,elapsed:checkpoint.elapsed,status:'active',reason:'',items:itemsAt(c,checkpoint.step),checkpoint:{...checkpoint}}};
}
export function currentStep(profile){const a=profile.active;return a?.status==='active'?idOf(a.id)?.steps[a.step]||null:null;}
export function advanceCareer(profile,event){
 const a=profile.active;if(!a)return profile;
 if(event.type==='cancel')return {...profile,active:null};
 if(a.status!=='active')return profile;
 const c=idOf(a.id),step=c?.steps[a.step];if(!step)return profile;
 if(event.type==='tick'){
  if(event.paused||!Number.isFinite(event.dt)||event.dt<=0)return profile;
  const elapsed=a.elapsed+Math.min(event.dt,.1);
  return {...profile,active:{...a,elapsed,status:c.limit&&elapsed>c.limit?'failed':'active',reason:c.limit&&elapsed>c.limit?'Delivery time expired. Retry this chapter.':''}};
 }
 if(event.type!=='interact'||event.place!==step.place||event.action!==step.action||event.paused)return profile;
 if(step.action==='ride'){
  if(event.completedJourney!==true)return profile;
 }else if(!Number.isFinite(event.distance)||event.distance>4||event.distance<0||event.lineOfSight!==true)return profile;
 const items=a.items||itemsAt(c,a.step);
 if(!step.requires.every(item=>items.includes(item)))return profile;
 if(a.step+1<c.steps.length)return {...profile,active:{...a,routeVersion:2,step:a.step+1,items:itemsAt(c,a.step+1),checkpoint:{step:a.step+1,elapsed:a.elapsed}}};
 const completed=profile.completed.includes(c.id)?profile.completed:[...profile.completed,c.id];
 const best=Math.min(profile.bestTimes[c.id]??Infinity,a.elapsed);
 return {...profile,completed,bestTimes:{...profile.bestTimes,[c.id]:best},grades:{...profile.grades,[c.id]:best<=c.parTime?'gold':best<=c.parTime*1.5?'silver':'bronze'},active:null};
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
