// Runtime bridge for the preserved historical civilian reducer. No account,
// online state, battle systems or token balance are read or written.
import {CHAPTERS,loadCareer,saveCareer,startChapter,currentStep,advanceCareer,accessPoint} from '../tiranastreets/career/careerCore.mjs';
import {gridKey} from './historicGrid.mjs';

// Exact historical WORLD landmark coordinates and civicSites footprint seeds,
// with one reviewed mapped pedestrian segment per public exterior. In
// particular, do not fall back to a road/building from an unrelated loaded cell.
const publicExteriors={
  square:['Sheshi Skënderbej',0,0,[8.42,34.79],[-2.9,-19.19]],
  clock:['Kulla e Sahatit',73.22,-23.06,[64.45,-20.77],[70.29,-21.69]],
  culture:['Pallati i Kulturës',81.60318181818181,-139.57409090909093,[82.69,-92.55],[82.52,-94.46]],
  pyramid:['Piramida',220.95,494.49,[190.44,504.88],[193.52,504.12]],
  'city-hall':['Bashkia e Tiranës',51.64866666666666,2.1355555555555554,[60.3,-20.08],[68.57,28.85]],
  bank:['Pranë Bankës së Shqipërisë',-176.3843902439024,-28.104390243902433,[-200.04,-36.79],[-190.03,10.59]],
  mosque:['Xhamia e Et’hem Beut',42.69,-32.05,[31.21,-19],[54.97,-22.41]],
  hotel:['Tirana International',-4.493636363636362,-262.83272727272725,[31.68,-229.94],[-45.72,-215.05]]
};
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const checkpoints=new Map(Object.entries(publicExteriors).map(([id,[name,x,z,a,b]])=>[
  id,{name,a,b,point:accessPoint({roads:[{a,b}]},{x,z},()=>true)}
]));
export const CIVILIAN_CAREER_ENTRIES=Object.freeze(CHAPTERS.map(c=>Object.freeze({
  id:c.id,title:c.title,steps:c.steps.length,available:c.steps.every(s=>s.action!=='ride'&&checkpoints.has(s.place))
})));
const entries=new Map(CIVILIAN_CAREER_ENTRIES.map(c=>[c.id,c]));
const chapters=new Map(CHAPTERS.map(c=>[c.id,c]));
const objective={
  'first-contact':[
    'Takohu me Arbenin në shesh.','Dorëzo letrën e prezantimit te Kulla e Sahatit.'
  ],
  'culture-run':[
    'Merr programin e provave te Pallati i Kulturës.','Verifiko hyrjen e provave nga shtegu pranë Piramidës.',
    'Dorëzo dosjen te pika publike pranë Bashkisë.','Ktheja Ilirit fletën e firmosur pranë Pallatit të Kulturës.'
  ],
  'city-ledger':[
    'Merr kërkesën për arkivin te pika publike pranë Bankës.','Verifiko referencën e regjistrit te pika pranë Bashkisë.',
    'Gjej kopjen e arkivit te pika pranë Pallatit të Kulturës.','Dorëzoja Luanit kopjen e verifikuar në pikën e takimit.'
  ],
  'light-and-stone':[
    'Dokumento pamjen e jashtme të xhamisë.','Dokumento pamjen e jashtme të Piramidës.',
    'Ndaji të dyja shënimet me Arbenin në shesh.'
  ],
  'last-delivery':[
    'Merr pakon e vulosur pranë hotelit.','Verifiko vulën te Kulla e Sahatit.','Dorëzo pakon te pika publike pranë Bashkisë para mbylljes.'
  ]
};
export function getCareerStorage(){try{return globalThis.localStorage;}catch{return undefined;}}
function menu(profile){
  const next=CIVILIAN_CAREER_ENTRIES.find(c=>c.available&&!profile.completed.includes(c.id));
  const active=profile.active?.id;
  return {completed:profile.completed,active,
    unavailable:!!active&&!entries.get(active)?.available,next,
    entries:CIVILIAN_CAREER_ENTRIES.map(c=>({...c,status:!c.available?'unavailable':
      active===c.id?'active':profile.completed.includes(c.id)?'completed':next?.id===c.id?'next':'locked'}))};
}
export function localCareerMenu(storage=getCareerStorage()){return menu(loadCareer(storage));}
const walkable=(mobility,x,z,r)=>!mobility.obstructed(x,z,r);
function clearWay(mobility,actor,point,distance){
  if(!walkable(mobility,actor.x,actor.z,.33))return false;
  const segments=Math.ceil(distance/.25);
  for(let i=1;i<=segments;i++){
    const t=i/segments;
    if(!walkable(mobility,actor.x+(point.x-actor.x)*t,actor.z+(point.z-actor.z)*t,.08))return false;
  }
  return true;
}
export function createCivilianCareer(storage){
  let profile=loadCareer(storage), storageOK=!!storage, elapsedSinceSave=0, dirty=false;
  let pointContext=null, cachedTarget=null;
  const flush=()=>{
    if(dirty){storageOK=saveCareer(storage,profile);dirty=!storageOK;}
    elapsedSinceSave=0;
  };
  let overview=menu(profile);
  function getTarget(city,mobility){
    const active=profile.active, step=entries.get(active?.id)?.available&&currentStep(profile);
    if(!step||!city||!mobility)return null;
    if(pointContext?.city!==city||pointContext?.mobility!==mobility||pointContext?.step!==step){
      pointContext={city,mobility,step};
      const {point,name,a,b}=checkpoints.get(step.place);
      const inSector=city.regions?.some(([x0,z0,x1,z1])=>point.x>=x0&&point.z>=z0&&point.x<=x1&&point.z<=z1);
      const loaded=!!inSector&&city.roads.some(r=>r.walk===true&&
        ((same(r.a,a)&&same(r.b,b))||(same(r.a,b)&&same(r.b,a))))&&walkable(mobility,point.x,point.z,.65);
      cachedTarget={step,point,name,loaded,sector:gridKey(point.x,point.z),text:objective[active.id]?.[active.step]||step.text};
    }
    return cachedTarget;
  }
  function interaction(city,mobility,actor,paused){
    const target=getTarget(city,mobility);
    if(!target||!actor||![actor.x,actor.z].every(Number.isFinite))return {target,canInteract:false};
    const dx=target.point.x-actor.x,dz=target.point.z-actor.z;
    const distance=Math.hypot(dx,dz), bearing=Math.atan2(dx,dz)-(actor.yaw||0);
    const grounded=actor.mode==='walk'&&actor.walkY===0&&!paused;
    const canInteract=target.loaded&&grounded&&distance<=4&&clearWay(mobility,actor,target.point,distance);
    return {target,distance,bearing,canInteract};
  }
  function commit(next){profile=next;overview=menu(profile);dirty=true;flush();}
  return {
    start(chapter){
      const id=chapter??profile.active?.id??overview.next?.id;
      if(!entries.get(id)?.available || (profile.active && profile.active.id!==id))return false;
      if(profile.active?.status==='active')return true; // opening twice never resets progress
      const next=startChapter(profile,id);
      if(next===profile)return false;
      commit(next);return true;
    },
    tick(dt,paused=false){
      if(!entries.get(profile.active?.id)?.available)return;
      const next=advanceCareer(profile,{type:'tick',dt,paused});
      if(next!==profile){profile=next;dirty=true;elapsedSinceSave+=Math.min(dt,.1);
        if(elapsedSinceSave>=5||next.active?.status==='failed')flush();}
    },
    interact(city,mobility,actor,paused=false){
      const {target,distance,canInteract}=interaction(city,mobility,actor,paused);
      if(!canInteract)return false;
      const next=advanceCareer(profile,{type:'interact',place:target.step.place,action:target.step.action,distance,lineOfSight:true});
      if(next===profile)return false;
      commit(next);return true;
    },
    marker(city,mobility){
      const target=getTarget(city,mobility);
      return target?.loaded?target.point:null;
    },
    view(city,mobility,actor,paused=false){
      const {target,distance,bearing,canInteract}=interaction(city,mobility,actor,paused);
      const active=profile.active, chapter=chapters.get(active?.id);
      return {storageOK,unavailable:overview.unavailable,chapter:chapter?.title,next:overview.next,
        completed:profile.completed.length,position:active?active.step+1:0,steps:chapter?.steps.length,
        failed:active?.status==='failed',remaining:chapter?.limit?Math.max(0,Math.ceil(chapter.limit-active.elapsed)):null,
        task:target&&{name:target.name,text:target.text,
          distance:Number.isFinite(distance)?Math.ceil(distance):null,bearing,canInteract,loaded:target.loaded,sector:target.sector,
          marker:{x:target.point.x,z:target.point.z}}};
    },
    flush
  };
}
