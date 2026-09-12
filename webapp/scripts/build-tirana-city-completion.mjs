import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {MAPPED_TREES} from '../src/games/tirana-city-source/registry.mjs';
import {STREET_LIFE} from '../src/games/tirana-street-life/registry.mjs';
import {SIGNALS,SHOP} from '../src/games/tiranastreets/shared/streetLayout.mjs';
import {bounds,inside,distance,nearestPoint,spatialIndex,hash,parkingBays} from '../src/games/tirana-city-completion/placementCore.mjs';

const root=new URL('../../',import.meta.url),source=new URL('assets-source/tirana-urban/',root);
const manifest=JSON.parse(await readFile(new URL('source.osm.json.gz.parts.json',source),'utf8'));
const buffers=[];for(const p of manifest.parts){const b=await readFile(new URL(p.file,source));if(createHash('sha256').update(b).digest('hex')!==p.sha256)throw Error('Source checksum mismatch: '+p.file);buffers.push(b);}
const bytes=Buffer.concat(buffers);if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Archive checksum mismatch');
const raw=JSON.parse(gunzipSync(bytes)),nodes=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
const round=n=>Math.round(n*100)/100,project=n=>[round((n.lon-WORLD.origin[1])*111320*Math.cos(WORLD.origin[0]*Math.PI/180)),round((WORLD.origin[0]-n.lat)*111320)];
const roadItems=WORLD.roads.filter(r=>!r.walk&&!r.tunnel&&!r.bridge);
const roadNear=spatialIndex(roadItems,r=>{const b=bounds([r.a,r.b]),pad=r.w/2+12;return [b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];});
const buildingNear=spatialIndex(WORLD.buildings,b=>bounds(b.p));
const waterNear=spatialIndex(WORLD.water.filter(w=>w.line),w=>bounds(w.line));
const inBuilding=(x,z)=>buildingNear(x,z,1).some(b=>inside(x,z,b.p,b.holes));
const inRoad=(x,z,pad=.3)=>roadNear(x,z).some(r=>distance([x,z],r.a,r.b)<r.w/2+pad);
const blocked=(x,z,pad=.3)=>inBuilding(x,z)||inRoad(x,z,pad)||Math.hypot(x-SHOP.x,z-SHOP.z)<10||waterNear(x,z,10).some(w=>w.line.slice(1).some((b,i)=>distance([x,z],w.line[i],b)<(w.width||4)/2+pad));
const ownedTrees=new Set([...MAPPED_TREES,...STREET_LIFE.trees].map(t=>t.id));
const existingTreeNear=spatialIndex([...MAPPED_TREES,...STREET_LIFE.trees],t=>[t.x,t.z,t.x,t.z]);
const signalNear=spatialIndex(SIGNALS,s=>[s.x,s.z,s.x,s.z]);
const data={trees:[],shrubs:[],fixtures:[],parking:[],arrows:[],greenAreas:[]},omitted=[];
const report=(id,reason)=>omitted.push({id,reason});
const numeric=(value,min,max)=>{const n=Number.parseFloat(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
const sourcePoint=e=>{if(e.type==='node')return project(e);const p=(e.nodes||[]).map(n=>nodes.get(n)).filter(Boolean).map(project);return p.length?p.reduce((s,q)=>[s[0]+q[0]/p.length,s[1]+q[1]/p.length],[0,0]):null;};
function closestRoad(p,way){return roadNear(...p,35).filter(r=>!way||String(r.way)===String(way)).map(r=>({r,d:distance(p,r.a,r.b)})).filter(v=>v.d<35).sort((a,b)=>a.d-b.d)[0]?.r;}
function roadside(e,p,kind){
 const r=closestRoad(p,kind==='direction'?e.id:undefined);if(!r){report(e.type+'/'+e.id,'no nearby ground road for '+kind);return null;}
 const q=nearestPoint(p,r.a,r.b),dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],len=Math.hypot(dx,dz);if(len<.01)return null;
 const reverse=e.tags?.direction==='backward'||e.tags?.['traffic_signals:direction']==='backward'||r.tags?.oneway==='-1';
 const sign=reverse?-1:1,rx=-dz/len*sign,rz=dx/len*sign;
 let [x,z]=p;const shifted=distance(p,r.a,r.b)<r.w/2+.45;
 if(shifted){x=q[0]+rx*(r.w/2+.65);z=q[1]+rz*(r.w/2+.65);}
 if(blocked(x,z,.2)){report(e.type+'/'+e.id,'roadside fixture conflicts with mapped road/building/water');return null;}
 const heading=Math.atan2(-dx*sign,-dz*sign),ground=r.neighbourhood?.065:.23;
 return {id:e.type+'/'+e.id,x:round(x),z:round(z),yaw:heading,y:ground,kind,road:r.name||'',point:p,placement:shifted?'mapped control; inferred right-hand roadside mount':'mapped point; inferred facing'};
}
for(const e of raw.elements){
 const t=e.tags||{},id=e.type+'/'+e.id,p=sourcePoint(e);if(!p)continue;
 if(e.type==='node'&&t.natural==='tree'){
  if(ownedTrees.has(id))continue;
  if(blocked(...p,.35)){report(id,'tree conflicts with rendered road/building/water');continue;}
  const seed=hash(id),height=numeric(t.height,2,35)||8+seed%6,crown=numeric(t['diameter_crown'],1,20)||Math.min(7,height*.55);
  data.trees.push({id,x:p[0],z:p[1],shape:t.leaf_type==='needleleaved'?'column':'upright',height,crown,seed,zone:'urban-extract',accuracy:t.height?'mapped height; crown estimated':'mapped trunk; dimensions estimated'});
 }
 if(e.type==='node'&&['waste_disposal','waste_basket','recycling'].includes(t.amenity)&&t.location!=='underground'&&t.indoor!=='yes'){
  if(blocked(...p,.65)){report(id,'bin conflicts with rendered surface');continue;}
  const r=closestRoad(p),yaw=r?Math.atan2(r.b[0]-r.a[0],r.b[1]-r.a[1]):0;
  data.fixtures.push({id,x:p[0],z:p[1],yaw,y:r?.neighbourhood?.065:.23,kind:t.amenity==='waste_basket'?'litter_bin':'waste_container',point:p,placement:'mapped point; model dimensions estimated'});
 }
 if(e.type==='node'&&t.highway==='street_lamp'&&!blocked(...p,.3))data.fixtures.push({id,x:p[0],z:p[1],yaw:0,y:.065,kind:'street_lamp',point:p,placement:'mapped point; pole design estimated'});
 if(e.type==='node'&&['traffic_signals','stop','give_way'].includes(t.highway)){
  if(t.highway==='traffic_signals'&&signalNear(...p,24).some(s=>Math.hypot(s.x-p[0],s.z-p[1])<s.width/2+15))continue;
  const item=roadside(e,p,t.highway);if(item)data.fixtures.push(item);
 }
 if(e.type==='node'&&t.traffic_sign==='maxspeed'&&numeric(t.maxspeed,5,130)){
  const item=roadside(e,p,'speed');if(item)data.fixtures.push({...item,text:t.maxspeed});
 }
 if(e.type==='way'&&t.highway&&(t.destination||t['destination:forward'])&&t.oneway==='yes'){
  const ns=e.nodes.map(id=>nodes.get(id)).filter(Boolean);if(ns.length>1){
   const pp=project(ns[Math.min(1,ns.length-1)]),item=roadside(e,pp,'direction');
   if(item&&!data.fixtures.some(f=>f.kind==='direction'&&f.text===(t.destination||t['destination:forward'])&&Math.hypot(f.x-item.x,f.z-item.z)<90))data.fixtures.push({...item,text:t.destination||t['destination:forward']});
  }
 }
 if(e.type==='way'&&e.nodes?.length>3&&e.nodes[0]===e.nodes.at(-1)){
  if(e.nodes.some(n=>!nodes.has(n))){report(id,'incomplete polygon');continue;}
  const polygon=e.nodes.slice(0,-1).map(n=>project(nodes.get(n)));
  if(t.amenity==='parking'&&['surface','lane','street_side'].includes(t.parking)&&!['private','no'].includes(t.access)){
   const feature={id,p:polygon,tags:{parking:t.parking,orientation:t.orientation,level:t.level,location:t.location}};
   const bays=parkingBays(feature,(x,z)=>inBuilding(x,z)||inRoad(x,z,-.2));
   if(bays.length){data.parking.push({...feature,bays:bays.map(b=>({...b,x:round(b.x),z:round(b.z)})),accuracy:'mapped parking boundary; bay layout estimated'});
    const q=polygon[0],mount=roadside(e,q,'parking');if(mount)data.fixtures.push({...mount,text:'P'});
   }else report(id,'no clear parking bays fit mapped polygon');
  }
  if(['scrub','wood'].includes(t.natural)||['grass','meadow'].includes(t.landuse)){
   const b=bounds(polygon),area=(b[2]-b[0])*(b[3]-b[1]);if(area>700000)continue;
   // One geometry owner for polygon ground. This layer owns shrub infill only.
   data.greenAreas.push({id,p:polygon,kind:t.natural||t.landuse});
   if(t.natural==='scrub')for(let x=b[0]+2;x<b[2];x+=6)for(let z=b[1]+2;z<b[3];z+=6){
    const seed=hash(id+':'+Math.round(x)+':'+Math.round(z)),xx=round(x+(seed%21)/10-1),zz=round(z+((seed>>>4)%21)/10-1);
    if(inside(xx,zz,polygon)&&!blocked(xx,zz,1)&&data.shrubs.length<6000)data.shrubs.push({id:id+':'+seed,x:xx,z:zz,yaw:seed,scale:.8+(seed%8)/10,sourceId:id});
   }
  }
 }
}
// Mapped linear vegetation has known alignment, but individual spacing is an
// estimate. Retain that distinction and never double a mapped individual trunk.
const newTreeNear=spatialIndex(data.trees,t=>[t.x,t.z,t.x,t.z]);
for(const e of raw.elements){const t=e.tags||{};if(e.type!=='way'||!['tree_row','hedge'].includes(t.natural||t.barrier)||e.nodes.some(n=>!nodes.has(n)))continue;
 const line=e.nodes.map(n=>project(nodes.get(n))),id='way/'+e.id;
 for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),step=t.barrier==='hedge'?2:8;
  for(let d=step/2;d<len;d+=step){const x=round(a[0]+(b[0]-a[0])*d/len),z=round(a[1]+(b[1]-a[1])*d/len),seed=hash(id+':'+i+':'+d);
   if(blocked(x,z,t.barrier==='hedge'?.5:1))continue;
   if(t.barrier==='hedge')data.shrubs.push({id:id+':'+i+':'+d,x,z,yaw:Math.atan2(b[0]-a[0],b[1]-a[1]),scale:.8,sourceId:id});
   else if(![...existingTreeNear(x,z,4),...newTreeNear(x,z,4)].some(q=>Math.hypot(q.x-x,q.z-z)<4))data.trees.push({id:id+':'+i+':'+d,x,z,shape:'upright',height:9,crown:5,seed,zone:'mapped-tree-row',accuracy:'mapped row; trunk spacing and dimensions estimated',sourceId:id});
  }
 }
}
// Direction arrows only on tagged one-way/turn lanes, at most one per 30 m.
for(const r of roadItems){const t=r.tags||{};if(t.oneway!=='yes'||r.w<2.8)continue;const len=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]);if(len<18)continue;
 for(let d=12;d<len-6;d+=35){const x=r.a[0]+(r.b[0]-r.a[0])*d/len,z=r.a[1]+(r.b[1]-r.a[1])*d/len;
  if(inBuilding(x,z)||signalNear(x,z,12).some(s=>Math.hypot(s.x-x,s.z-z)<10))continue;
  const other=roadNear(x,z).some(q=>q.way!==r.way&&Math.abs(Math.sin(Math.atan2(q.b[0]-q.a[0],q.b[1]-q.a[1])-Math.atan2(r.b[0]-r.a[0],r.b[1]-r.a[1])))>.45&&distance([x,z],q.a,q.b)<q.w/2+4);if(other)continue;
  data.arrows.push({id:r.id+':'+d,x:round(x),z:round(z),yaw:Math.atan2(r.b[0]-r.a[0],r.b[1]-r.a[1]),sourceId:'way/'+r.way,accuracy:'oneway source direction; marking location estimated'});
 }
}
data.source={sha256:manifest.sha256,origin:WORLD.origin,acquiredAt:raw.receipts.at(-1).acquiredAt,license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',bbox:raw.selection.bbox};
const target=new URL('../src/games/tirana-city-completion/',import.meta.url);await mkdir(target,{recursive:true});
const packed=gzipSync(JSON.stringify(data),{level:9}).toString('base64');
await writeFile(new URL('data.mjs',target),`// © OpenStreetMap contributors, ODbL-1.0. Generated; do not edit.\nimport {decodeSource} from '../tirana-neighbourhood/decodeSource.mjs';\nexport const CITY_COMPLETION=decodeSource(['${packed}']);\n`);
const counts={trees:data.trees.length,shrubs:data.shrubs.length,fixtures:Object.fromEntries([...new Set(data.fixtures.map(f=>f.kind))].map(k=>[k,data.fixtures.filter(f=>f.kind===k).length])),parkingAreas:data.parking.length,parkingBays:data.parking.reduce((n,p)=>n+p.bays.length,0),arrows:data.arrows.length,omitted:omitted.length};
const output=new URL('assets-source/tirana-city-completion/',root);await mkdir(output,{recursive:true});
await writeFile(new URL('coverage.json',output),JSON.stringify({source:data.source,counts,limitations:['Not a complete survey of every city object.','Existing known tree and signal owners excluded.','Street furniture models, unmeasured tree dimensions, bay layout and mounting offsets are estimates.','Source-conflicting fixtures are omitted, never shifted into buildings.','Unknown building heights remain unresolved.'],omitted},null,2)+'\n');
console.log(JSON.stringify(counts,null,2));
