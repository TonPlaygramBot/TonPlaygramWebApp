import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {CANOPY_SOURCE_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
const region=(x,z)=>Math.hypot(x-4900,z-2100)<1900?'farke':Math.hypot(x-7331.41,z+528.61)<2100?'surrel':null;
const center=b=>b.p.reduce((s,p)=>({x:s.x+p[0]/b.p.length,z:s.z+p[1]/b.p.length}),{x:0,z:0});
const houses=WORLD.buildings.filter(b=>{const p=center(b);return region(p.x,p.z)&&!b.part&&!b.tags?.construction&&['house','detached','semidetached_house','terrace','villa','residential'].includes(b.tags?.building);});
const seen=new Set(CANOPY_SOURCE_TREES.map(t=>t.id)), trees=[];
for(const file of ['assets-source/tirana-east/source.osm.json.gz','assets-source/tirana-neighbourhood/source.osm.json.gz']){
 const data=JSON.parse(gunzipSync(fs.readFileSync(file)));
 for(const e of data.elements||[]){
  if(e.type!=='node'||e.tags?.natural!=='tree'||!Number.isFinite(e.lat))continue;
  const id='node/'+e.id,x=(e.lon-WORLD.origin[1])*111320*Math.cos(WORLD.origin[0]*Math.PI/180),z=(WORLD.origin[0]-e.lat)*111320;
  if(!region(x,z)||seen.has(id))continue;seen.add(id);
  const height=Number.parseFloat(e.tags.height),crown=Number.parseFloat(e.tags['diameter_crown']);
  trees.push({id,x:+x.toFixed(3),z:+z.toFixed(3),height:Number.isFinite(height)?height:9,crown:Number.isFinite(crown)?crown:5.5,shape:e.tags.leaf_type==='needleleaved'?'column':'upright',seed:e.id%10007,zone:'mapped-rural-trunk'});
 }
}
const paths=WORLD.roads.filter(r=>{const x=(r.a[0]+r.b[0])/2,z=(r.a[1]+r.b[1])/2;return region(x,z)==='farke'&&(r.walk||r.cycle)&&r.access!=='private';});
const coverage={source:'Retained OpenStreetMap snapshots; not a complete satellite survey',houses:houses.length,trees:trees.length,publicPathSegments:paths.length,pathMetres:Math.round(paths.reduce((s,r)=>s+Math.hypot(r.a[0]-r.b[0],r.a[1]-r.b[1]),0)),houseIds:houses.map(b=>b.id),pathIds:paths.map(r=>r.id)};
fs.writeFileSync('webapp/src/games/tirana-east/ruralData.mjs','// Generated from retained source nodes; run tools/build-tirana-rural-details.mjs\nexport const RURAL_TREES='+JSON.stringify(trees)+';\nexport const RURAL_HOUSE_IDS=new Set('+JSON.stringify(coverage.houseIds)+');\n');
fs.mkdirSync('assets-source/tirana-landmark-rebuild',{recursive:true});
fs.writeFileSync('assets-source/tirana-landmark-rebuild/rural-coverage.json',JSON.stringify(coverage,null,2));
console.log({...coverage,houseIds:undefined,pathIds:undefined});
