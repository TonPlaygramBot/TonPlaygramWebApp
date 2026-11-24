// Offline export only; browser loads the bounded district JSON, not WORLD.
import {readFile,writeFile} from 'node:fs/promises';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {HYDROGRAPHY} from '../src/games/tirana-environment/hydrography.mjs';
const target=new URL('../public/assets/tirana-city-game/districts/lana-blloku.json',import.meta.url);
const central=JSON.parse(await readFile(new URL('../public/assets/tirana-city-game/central-city.json',import.meta.url),'utf8'));
const bounds=[-580,155,-118,733];
const overlaps=points=>Math.min(...points.map(p=>p[0]))<bounds[2]&&Math.max(...points.map(p=>p[0]))>=bounds[0]&&Math.min(...points.map(p=>p[1]))<bounds[3]&&Math.max(...points.map(p=>p[1]))>=bounds[1];
const licensed=(r)=>!['private','no'].includes(r.access)&&!r.tunnel;
const raw={
  roads:WORLD.roads.filter(r=>overlaps([r.a,r.b])&&licensed(r)&&Math.hypot(r.a[0]-r.b[0],r.a[1]-r.b[1])<150).map(({a,b,w,walk,bridge})=>({a,b,w,walk,bridge:Boolean(bridge)})),
  buildings:WORLD.buildings.filter(b=>b.p?.length>=3&&overlaps(b.p)).map(({p,h})=>({p,h})),
  areas:WORLD.areas.filter(p=>overlaps(p)),
  parks:WORLD.parks.filter(p=>overlaps(p)),
  water:WORLD.water.flatMap(p=>Array.isArray(p)?overlaps(p)?[{p}]:[]:p.line.slice(1).flatMap((b,i)=>overlaps([b,p.line[i]])?[{a:p.line[i],b,w:p.width}]:[]))
};
const lana=HYDROGRAPHY.paths.filter(p=>p.lana&&p.name==='Lana').flatMap(p=>p.line.slice(1).flatMap((b,i)=>overlaps([b,p.line[i]])?[{a:p.line[i],b,w:p.width}]:[]));
raw.water.push(...lana);
const mids=(name,x,z)=>{
  const normalize=s=>s?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return WORLD.roads.filter(r=>!r.walk&&licensed(r)&&normalize(r.name)===normalize(name)&&overlaps([r.a,r.b])).map(r=>({x:(r.a[0]+r.b[0])*.5,z:(r.a[1]+r.b[1])*.5})).filter(p=>p.x>bounds[0]+20&&p.x<bounds[2]-20&&p.z>bounds[1]+20&&p.z<bounds[3]-20).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
};
const landmarks=[
  {id:'myslym',...mids('Rruga Myslym Shyri',-258,270)},
  {id:'lana',...mids('Bulevardi Bajram Curri',-335,525)},
  {id:'brigada',...mids('Rruga Brigada VIII',-333,633)}
];
if(landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)))throw Error('A public district waypoint was not resolved to existing cartography');
const result={bounds,landmarks};
for(const [key,entries] of Object.entries(raw)){
  const set=new Set(central[key].map(v=>JSON.stringify(v)));
  result[key]=entries.filter(v=>{const id=JSON.stringify(v);if(set.has(id))return false;set.add(id);return true;});
}
await writeFile(target,JSON.stringify(result));
console.log({bounds,landmarks,counts:Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.length]))});
