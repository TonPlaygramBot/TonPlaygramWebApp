#!/usr/bin/env node
import fs from 'node:fs';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {importRegionSource,stitchRegionRings} from './tirana/regionImport.mjs';
import {WORLD as CORE} from '../src/games/tiranastreets/shared/centralWorld.mjs';
import {NEIGHBOURHOOD as URBAN} from '../src/games/tirana-neighbourhood/data.mjs';
import {facadeEdges} from '../src/games/tirana-city-source/sourceCore.mjs';
const root='assets-source/tirana-east/',out='webapp/src/games/tirana-east/';
const bytes=fs.readFileSync(root+'source.osm.json.gz'),raw=JSON.parse(gunzipSync(bytes));
const receipt=JSON.parse(fs.readFileSync(root+'osm-receipts.json'));
const horizon=fs.existsSync(root+'horizon.osm.json.gz')?JSON.parse(gunzipSync(fs.readFileSync(root+'horizon.osm.json.gz'))):{elements:[]};
const landscapeRaw=[...new Map([...raw.elements,...horizon.elements].map(e=>[`${e.type}/${e.id}`,e])).values()];
const ways=new Map(raw.elements.filter(e=>e.type==='way').map(e=>[e.id,e]));
const geometry=e=>e.type==='relation'&&e.tags.type==='multipolygon'&&(e.tags.building||e.tags['building:part']||e.tags.natural==='water'||e.tags.landuse==='reservoir');
const omitted=raw.elements.filter(geometry).filter(e=>e.members.some(m=>m.type==='relation'||m.type==='way'&&!ways.has(m.ref)));
const source=importRegionSource({elements:raw.elements.filter(e=>e.type!=='relation'||geometry(e)&&!omitted.includes(e))},{origin:CORE.origin,sourceURL:receipt.receipts[0].url,acquiredAt:receipt.receipts.at(-1).acquiredAt,sha256:createHash('sha256').update(bytes).digest('hex')});
const project=n=>[(n.lon-CORE.origin[1])*111320*Math.cos(CORE.origin[0]*Math.PI/180),(CORE.origin[0]-n.lat)*111320];
const round=p=>p.map(n=>Math.round(n*100)/100),center=p=>p.reduce((s,v)=>[s[0]+v[0]/p.length,s[1]+v[1]/p.length],[0,0]);
const inside=p=>{const lat=CORE.origin[0]-p[1]/111320,lon=CORE.origin[1]+p[0]/(111320*Math.cos(CORE.origin[0]*Math.PI/180));return lat>=41.265&&lat<=41.405&&lon>=19.86&&lon<=19.970;};
const existing=new Set([...CORE.buildings,...URBAN.buildings].map(b=>b.id));
const buildings=source.buildings.flatMap(b=>existing.has(b.id)?[]:b.polygons.flatMap((p,i)=>!inside(center(p.outer))?[]:[{...b,id:b.polygons.length===1?b.id:`${b.id}/${i}`,p:p.outer.map(round),holes:p.holes.map(h=>h.map(round)),polygons:undefined,h:b.h??(b.levels?b.levels*3.2:3.2),minHeight:b.minHeight??0,heightBasis:b.h?'OSM height':b.levels?'OSM levels × 3.2 m':'Unmeasured one-storey visual estimate',neighbourhood:true,eastern:true}]));
const roads=source.roads.filter(r=>inside(r.a)&&inside(r.b)&&!['construction','proposed'].includes(r.highway)).map(r=>({...r,a:round(r.a),b:round(r.b),w:r.width??(r.walk||r.cycle?2.2:['service','track'].includes(r.highway)?3.5:6.2),walk:r.walk||r.cycle,neighbourhood:true,eastern:true}));
const points=new Map(landscapeRaw.filter(e=>e.type==='node').map(e=>[e.id,round(project(e))]));
const forests=[],forestMembers=new Set(),unresolved=[...omitted.map(e=>({id:`relation/${e.id}`,reason:'incomplete multipolygon excluded'}))];
const forest=t=>t?.natural==='wood'||t?.landuse==='forest';
const landscapeWays=new Map(landscapeRaw.filter(e=>e.type==='way').map(e=>[e.id,e]));
for(const e of landscapeRaw.filter(e=>e.type==='relation'&&forest(e.tags)&&e.tags.type==='multipolygon')){
 try{const outer=stitchRegionRings(e.members.filter(m=>m.type==='way'&&m.role!=='inner').map(m=>{const w=landscapeWays.get(m.ref);if(!w)throw Error('missing way');return w.nodes;})).map(r=>r.slice(0,-1).map(n=>{if(!points.has(n))throw Error('missing node');return points.get(n);}));
 const holes=stitchRegionRings(e.members.filter(m=>m.type==='way'&&m.role==='inner').map(m=>{if(!landscapeWays.has(m.ref))throw Error('missing way');return landscapeWays.get(m.ref).nodes;})).map(r=>r.slice(0,-1).map(n=>points.get(n)));
 forests.push({id:`relation/${e.id}`,outer,holes,leaf:e.tags.leaf_type||'mixed'});for(const m of e.members)if(m.type==='way')forestMembers.add(m.ref);
 }catch{unresolved.push({id:`relation/${e.id}`,reason:'incomplete forest relation; no invented closure'});}
}
for(const w of landscapeWays.values())if(forest(w.tags)&&!forestMembers.has(w.id)&&w.nodes[0]===w.nodes.at(-1)&&w.nodes.every(n=>points.has(n)))forests.push({id:`way/${w.id}`,outer:[w.nodes.slice(0,-1).map(n=>points.get(n))],holes:[],leaf:w.tags.leaf_type||'mixed'});
const sourceNodes=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
const cable=raw.elements.filter(e=>e.type==='way'&&e.tags?.aerialway==='gondola').map(w=>({id:`way/${w.id}`,name:w.tags.name||'',points:w.nodes.map(n=>points.get(n)),pylons:w.nodes.filter(n=>sourceNodes.get(n)?.tags?.aerialway==='pylon').map(n=>({id:`node/${n}`,point:points.get(n)})),tags:w.tags})).filter(w=>w.points.every(Boolean));
const peaks=raw.elements.filter(e=>e.type==='node'&&e.tags?.natural==='peak').map(e=>({id:`node/${e.id}`,name:e.tags.name||'',point:points.get(e.id),elevation:Number(e.tags.ele)||null}));
const places=source.places.filter(p=>p.point&&inside(p.point));
const contains=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const allBuildings=[...URBAN.buildings,...buildings],storefronts=[];
for(const p of places){const kind=p.tags.shop||p.tags.amenity;if(!['supermarket','greengrocer','convenience','marketplace','bakery','cafe','restaurant','fast_food'].includes(kind))continue;
 const owners=allBuildings.filter(b=>contains(p.point,b.p)&&!(b.holes||[]).some(h=>contains(p.point,h)));if(owners.length!==1){unresolved.push({id:p.id,reason:'no unique containing shop footprint'});continue;}
 const b=owners[0],edge=facadeEdges(b.p).filter(e=>e.length>3).sort((a,b)=>Math.hypot(...center([a.a,a.b]).map((n,i)=>n-p.point[i]))-Math.hypot(...center([b.a,b.b]).map((n,i)=>n-p.point[i])))[0];if(!edge)continue;
 storefronts.push({id:p.id,name:p.name||({greengrocer:'Fruta • Perime',supermarket:'Supermarket',convenience:'Market'}[kind]||kind),buildingId:b.id,x:(edge.a[0]+edge.b[0])/2+edge.nx*.08,z:(edge.a[1]+edge.b[1])/2+edge.nz*.08,yaw:Math.atan2(edge.nx,edge.nz),width:Math.min(5,edge.length-.25),kind,shop:p.tags.shop||null,model:kind==='greengrocer'||kind==='marketplace'?'produce':'market',source:p.source,placementAccuracy:'Mapped containing building; façade midpoint is an estimate'});
}
const districts=raw.elements.filter(e=>e.type==='node'&&e.tags?.place&&e.tags.name).map(e=>({id:`node/${e.id}`,name:e.tags.name,point:points.get(e.id)}));
const data={districts,origin:CORE.origin,bounds:[...URBAN.bounds.slice(0,2),12650,6960],buildings,roads,forests,cable,peaks,places,storefronts,water:[],source:source.source};data.bounds[1]=-8620;
const encode=(value,name,variable)=>{const str=gzipSync(JSON.stringify(value),{level:9,mtime:0}).toString('base64');fs.writeFileSync(out+name+'.mjs',`// Generated by build-tirana-east.mjs. Sources and attribution: assets-source/tirana-east.\nimport {decodeSource} from '../tirana-neighbourhood/decodeSource.mjs';\nexport const ${variable}=decodeSource([${JSON.stringify(str)}]);\n`);};
encode(data,'data','EAST');
const terrain=JSON.parse(gunzipSync(fs.readFileSync(root+'terrain.json.gz')));
for(const g of terrain.grids){const delta=Buffer.alloc(g.heights.length*2);for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++){const k=j*g.nx+i,left=i?g.heights[k-1]:0,up=j?g.heights[k-g.nx]:0,corner=i&&j?g.heights[k-g.nx-1]:0;delta.writeInt16LE(g.heights[k]-left-up+corner,k*2);}g.delta=delta.toString('base64');delete g.heights;}
encode(terrain,'terrainData','TERRAIN');
fs.appendFileSync(out+'terrainData.mjs',`// Lossless two-dimensional delta decoding, independent of host byte order.
for(const g of TERRAIN.grids){const str=atob(g.delta),bytes=Uint8Array.from(str,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),h=new Int16Array(g.nx*g.nz);for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++){const k=j*g.nx+i;h[k]=view.getInt16(k*2,true)+(i?h[k-1]:0)+(j?h[k-g.nx]:0)-(i&&j?h[k-g.nx-1]:0);}g.heights=h;delete g.delta;}
`);

fs.writeFileSync(root+'coverage.json',JSON.stringify({buildings:buildings.length,roads:roads.length,forests:forests.length,storefronts:storefronts.length,peaks,cable: cable.map(({points,...c})=>({...c,points:points.length})),unresolved},null,2)+'\n');
// Blender uses full footprint outlines and official storey tags; no box replacement.
const houses=allBuildings.filter(b=>['house','detached','semidetached_house','terrace'].includes(b.tags?.building));
const dorms=allBuildings.filter(b=>b.tags?.building==='dormitory'&&/^Godina\s/.test(b.name)&&b.p[0][0]>900&&b.p[0][0]<1700&&b.p[0][1]>500&&b.p[0][1]<1200);
fs.writeFileSync(root+'building-input.json',JSON.stringify({houses,dorms},null,2)+'\n');
console.log({buildings:buildings.length,roads:roads.length,forests:forests.length,shops:storefronts.length,houses:houses.length,dorms:dorms.map(b=>[b.id,b.name,b.h]),cable:data.cable.map(c=>[c.id,c.points.length])});
