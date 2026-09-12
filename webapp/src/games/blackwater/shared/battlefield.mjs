import { BATTLEFIELD_MAPS, OBSTACLES } from './layout.mjs';
import { collides } from './physics.mjs';
export const BATTLE_MODES = Object.freeze([
  {id:'last-stand',name:'Last operator standing',description:'Every operator for themselves. One life. Stay inside the shrinking combat zone.'},
  {id:'sweep',name:'District sweep',description:'Clear the hostile squad, then reach extraction.'},
  {id:'hold',name:'Hold the district',description:'Capture the beacon for 45 seconds while holding off reinforcements.'},
  {id:'extraction',name:'Intel extraction',description:'Reach the intel beacon, collect it, then survive the trip to extraction.'},
  {id:'waves',name:'Three-wave survival',description:'Defeat three waves, select upgrades and extract.'}
]);
export const OPERATIONS = Object.freeze([
  {id:'square-sweep',map:'skanderbeg',mode:'sweep',title:'Clear the square'},
  {id:'bazaar-intel',map:'bazaar',mode:'extraction',title:'Bazaar intelligence'},
  {id:'lana-hold',map:'lana',mode:'hold',title:'Hold the river crossing'},
  {id:'blloku-sweep',map:'blloku',mode:'sweep',title:'Blloku cleanup'},
  {id:'embassy-intel',map:'embassy',mode:'extraction',title:'Embassy extraction'},
  {id:'dajti-survival',map:'dajti-gate',mode:'waves',title:'Dajti final stand'}
]);
export function sectorObstacles(center,radius=150,obstacles=OBSTACLES) {
  return obstacles.filter(o=>Math.abs(o.x-center.x)<radius+(o.w||1)/2&&Math.abs(o.z-center.z)<radius+(o.d||1)/2);
}
export function sectorSpawns(mapId,count=7,obstacles=OBSTACLES) {
  const sector=BATTLEFIELD_MAPS.find(s=>s.id===mapId)||BATTLEFIELD_MAPS[0],out=[];
  const nearby=sectorObstacles(sector.start,100,obstacles);
  for(let i=0;i<count;i++) {
    let best;
    for(let ring=0;ring<10&&!best;ring++)for(let n=0;n<32;n++){
      const angle=(n/32+i/count)*Math.PI*2,r=24+ring*5;
      const p={x:sector.start.x+Math.sin(angle)*r,z:sector.start.z+Math.cos(angle)*r};
      if(!collides(p.x,p.z,.65,nearby)&&out.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>5)){best=p;break;}
    }
    if(best)out.push(best);
  }
  return out;
}
export function zoneRadius(elapsed) {return Math.max(8,110-Math.max(0,elapsed-25)*.58);}
export function normalizeOperations(raw) {
  if(!raw||!Array.isArray(raw.completed))return {completed:[]};
  const completed=[];
  for(const op of OPERATIONS){if(!raw.completed.includes(op.id))break;completed.push(op.id);}
  return {completed};
}
export function finishOperation(raw,id,won) {
  const p=normalizeOperations(raw),index=OPERATIONS.findIndex(o=>o.id===id);
  if(won&&index===p.completed.length)p.completed.push(id);
  return p;
}
