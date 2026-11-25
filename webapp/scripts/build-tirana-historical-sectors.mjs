/** Regenerates the standalone playable historic map from the retained original
 * ODbL source tree (pre-removal main 871f3c38). No network, scene actors, or API.
 * Run from any directory. Generated static payload is not release source code.
 */
import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import polygonClipping from 'polygon-clipping';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {HYDROGRAPHY} from '../src/games/tirana-environment/hydrography.mjs';
import {gridKey,gridBounds,HISTORIC_OFFSETS,HISTORIC_CELL} from '../src/games/tirana-standalone/historicGrid.mjs';

const out=new URL('../public/assets/tirana-city-game/historic/',import.meta.url);
const clipBox=WORLD.bounds;
const sector=new Map();
const center={...WORLD.graph.nodes.reduce((p,v)=>Math.hypot(v[0]+60,v[1]-130)<Math.hypot(p[0]+60,p[1]-130)?v:p,WORLD.graph.nodes[0])};
const spawn={x:center[0],z:center[1]};
const startKey=gridKey(spawn.x,spawn.z);
const compact=n=>Math.round(n*100)/100;
const coords=p=>p.map(compact);
const useRoad=r=>r?.a?.every(Number.isFinite)&&r?.b?.every(Number.isFinite)&&Number.isFinite(r.w)&&r.w>0&&!r.tunnel&&!['private','no'].includes(r.access);
const treePoints=points=>points?.length>=3&&points.every(p=>p?.length===2&&p.every(Number.isFinite));
const entry=(ix,iz)=>{
  const key=ix+'_'+iz;
  if(!sector.has(key)){
    const b=gridBounds(key);
    const bounds=[Math.max(b[0],clipBox[0]),Math.max(b[1],clipBox[1]),Math.min(b[2],clipBox[2]),Math.min(b[3],clipBox[3])];
    if(bounds[0]>=bounds[2]||bounds[1]>=bounds[3])return null;
    sector.set(key,{key,bounds,roads:[],buildings:[],areas:[],parks:[],water:[]});
  }
  return sector.get(key);
};
function eachCell(points,fn){
  const [x0,z0]=gridKey(Math.min(...points.map(v=>v[0])),Math.min(...points.map(v=>v[1]))).split('_').map(Number);
  const [x1,z1]=gridKey(Math.max(...points.map(v=>v[0])),Math.max(...points.map(v=>v[1]))).split('_').map(Number);
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const cell=entry(x,z);if(cell)fn(cell);}
}
function segment(a,b,box){
  const dx=b[0]-a[0],dz=b[1]-a[1];let min=0,max=1;
  for(const [p,q] of [[-dx,a[0]-box[0]],[dx,box[2]-a[0]],[-dz,a[1]-box[1]],[dz,box[3]-a[1]]]){
    if(!p){if(q<0)return null;continue;}
    const t=q/p;if(p<0)min=Math.max(min,t);else max=Math.min(max,t);
    if(max<=min)return null;
  }
  const l=Math.hypot(dx,dz)*(max-min);
  return l>.12?[coords([a[0]+dx*min,a[1]+dz*min]),coords([a[0]+dx*max,a[1]+dz*max])]:null;
}
function polygon(p,box){
  const [x0,z0,x1,z1]=box;
  if(p.every(([x,z])=>x>=x0&&x<=x1&&z>=z0&&z<=z1))return [p];
  return polygonClipping.intersection([p],[[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]]])
    .map(r=>r[0].slice(0,-1).map(coords)).filter(r=>r.length>=3);
}
function line(cell,key,a,b,props){
  const s=segment(a,b,cell.bounds);if(s)cell[key].push({a:s[0],b:s[1],...props});
}

for(const r of WORLD.roads)if(useRoad(r))
  eachCell([r.a,r.b],cell=>line(cell,'roads',r.a,r.b,{w:r.w,walk:Boolean(r.walk||r.cycle||['private','no'].includes(r.motorVehicle)),bridge:Boolean(r.bridge)}));
for(const {p,h} of WORLD.buildings)if(treePoints(p))
  eachCell(p,cell=>cell.buildings.push(...polygon(p,cell.bounds).map(p=>({p,h}))));
for(const key of ['parks','areas'])for(const p of WORLD[key])if(treePoints(p))
  eachCell(p,cell=>cell[key].push(...polygon(p,cell.bounds)));
const hydro=HYDROGRAPHY.paths.filter(a=>a.lana);
for(const p of [...WORLD.water,...hydro]){
  if(Array.isArray(p)){if(treePoints(p))eachCell(p,cell=>cell.water.push(...polygon(p,cell.bounds).map(p=>({p}))));}
  else if(p.line?.length)for(let i=1;i<p.line.length;i++)eachCell([p.line[i-1],p.line[i]],cell=>line(cell,'water',p.line[i-1],p.line[i],{w:p.width}));
}
const site=JSON.parse(await readFile(new URL('../public/assets/tirana-city-game/central-city.json',import.meta.url),'utf8'));
const landmarks=site.landmarks.filter(p=>['square','clock','pyramid'].includes(p.id));
const markings=site.markings.filter(m=>['clock','mosque','pyramid'].includes(m.id));
const keys=[];
await mkdir(out,{recursive:true});
for(const file of await readdir(out))if(/^(-?\d+_-?\d+|start)\.json$/.test(file))await unlink(new URL(file,out));
for(const [key,data] of [...sector].sort(([a],[b])=>a.localeCompare(b,'en'))){
  if(!data.roads.length)continue;
  for(const name of ['roads','buildings','areas','parks','water']){
    const rows=data[name];data[name]=[...new Map(rows.map(r=>[JSON.stringify(r),r])).values()];
  }
  data.neutralCivicMarks=markings.filter(m=>gridKey(m.x,m.z)===key);
  keys.push(key);
  if(key!==startKey)await writeFile(new URL(key+'.json',out),JSON.stringify(data));
}
const first=sector.get(startKey);
if(!first||!keys.includes(startKey))throw Error('Unsupported historic start sector');
const start={version:1,historical:'871f3c38c512084c495eeaa0811b0788d62c751b',sourceSha256:WORLD.sourceSha256,bounds:WORLD.bounds,cellSize:HISTORIC_CELL,origin:HISTORIC_OFFSETS,spawn,landmarks,keys,first};
await writeFile(new URL('start.json',out),JSON.stringify(start));
console.log(JSON.stringify({historical:start.historical,spawn,bounds:start.bounds,sourceRoads:WORLD.roads.length,sourceFootprints:WORLD.buildings.length,tiles:keys.length,firstRoads:first.roads.length,firstBuildings:first.buildings.length}));
