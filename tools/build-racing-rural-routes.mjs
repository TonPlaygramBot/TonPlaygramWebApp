// Offline closed-event course authoring on the checked-in OSM roads and paths.
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
const regions=[
  {id:'farke',name:'Farkë Gravel Run',district:'FARKË · LAKESIDE',surface:'gravel',accent:'#dfb66c',bounds:[2700,250,4800,2700],target:4100},
  {id:'surrel',name:'Surrel Hill Circuit',district:'SURREL · DAJTI FOOTHILLS',surface:'asphalt',accent:'#9ec8e6',bounds:[6300,-1500,8700,900],target:2400},
  {id:'liqeni',name:'Liqeni Park Trail',district:'TIRANA · GRAND PARK',surface:'dirt',accent:'#a7d486',bounds:[-500,950,1550,2900],target:2500}
];
const data=regions.map(region=>({...region,roads:WORLD.roads.filter(r=>{
  if(r.tunnel||r.bridge||r.layer||['private','no'].includes(r.access)||['steps','construction','proposed','motorway','motorway_link'].includes(r.highway))return false;
  if(![r.a,r.b].every(p=>p[0]>=region.bounds[0]&&p[0]<=region.bounds[2]&&p[1]>=region.bounds[1]&&p[1]<=region.bounds[3]))return false;
  const steps=Math.ceil(Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])/6);
  for(let i=0;i<=steps;i++)if(buildingClearance(r.a[0]+(r.b[0]-r.a[0])*i/steps,r.a[1]+(r.b[1]-r.a[1])*i/steps)<3.5)return false;
  return true;
}).map(r=>({a:r.a,b:r.b,width:Math.max(6,r.w),offroad:r.walk||r.highway==='track',name:r.name||'',source:r.source||WORLD.source}))}));
const result=execFileSync('python3',[fileURLToPath(new URL('./select-racing-rural-routes.py',import.meta.url))],{input:JSON.stringify(data),maxBuffer:10e6,encoding:'utf8'});
const routes=JSON.parse(result);
await writeFile(new URL('../webapp/src/games/kartroyale/rural-routes.mjs',import.meta.url),
  '// Authored closed events on sourced streets/paths. © OpenStreetMap contributors, ODbL 1.0.\n'+
  '// Reproduce: node tools/build-racing-rural-routes.mjs (Python networkx + shapely).\n'+
  'export const RURAL_ROUTES = '+JSON.stringify(routes)+';\n');
console.log(routes.map(r=>({id:r.id,length:Math.round(r.originalLength),offroad:r.offroadFraction,points:r.points.length})));
