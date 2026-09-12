#!/usr/bin/env node
import fs from 'node:fs';
import {removeExactDuplicates,cutWaterFromParks} from './tirana/sourceOverlap.mjs';
import {packRecords} from './tirana/compactSource.mjs';
import {gunzipSync} from 'node:zlib';
import {readSourceArchive} from './tirana/sourceArchive.mjs';
import {writeCompressedSource} from './tirana/compressedSource.mjs';
import {createHash} from 'node:crypto';
import {importRegionSource} from './tirana/regionImport.mjs';
import {facadeEdges} from '../src/games/tirana-city-source/sourceCore.mjs';
import {WORLD as CORE} from '../src/games/tiranastreets/shared/centralWorld.mjs';
import {HEROES,KIT_IDS} from '../src/games/tirana-neighbourhood/assets.mjs';

const urban=process.argv.includes('--urban');
const archive=urban?'assets-source/tirana-urban/source.osm.json.gz':'assets-source/tirana-neighbourhood/source.osm.json.gz';
const bytes=readSourceArchive(archive),raw=JSON.parse(gunzipSync(bytes));
const ways=new Set(raw.elements.filter(e=>e.type==='way').map(e=>e.id));
const geometryRelation=e=>e.type==='relation'&&e.tags.type==='multipolygon'&&(e.tags.building||e.tags['building:part']||e.tags.natural==='water'||e.tags.landuse==='reservoir');
const omittedRelations=raw.elements.filter(geometryRelation).filter(e=>e.members.some(m=>m.type==='relation'||m.type==='way'&&!ways.has(m.ref))).map(e=>e.id);
if(omittedRelations.length)throw Error(`Incomplete geometry relations: ${omittedRelations.join(',')}`);
const source=importRegionSource({...raw,elements:raw.elements.filter(e=>e.type!=='relation'||geometryRelation(e))},{origin:CORE.origin,sourceURL:raw.receipts[0].url,acquiredAt:raw.receipts.at(-1).acquiredAt,sha256:createHash('sha256').update(bytes).digest('hex')});
const round=p=>p.map(v=>Math.round(v*100)/100);
const envelopes=raw.receipts.map(r=>r.bbox).filter(Boolean);
const inside=(p,margin=0)=>{
 const lat=CORE.origin[0]-p[1]/111320,lon=CORE.origin[1]+p[0]/(111320*Math.cos(CORE.origin[0]*Math.PI/180));
 return envelopes.some(([w,s,e,n])=>lon>=w-margin/84000&&lon<=e+margin/84000&&lat>=s-margin/111320&&lat<=n+margin/111320);
};
const center=p=>p.reduce((s,v)=>[s[0]+v[0]/p.length,s[1]+v[1]/p.length],[0,0]);
const existing=new Set(CORE.buildings.map(b=>b.id));
const roadTypes=new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified','living_street','service','footway','pedestrian','path','steps','cycleway','track']);
const roads=source.roads.filter(r=>roadTypes.has(r.highway)&&inside(r.a,25)&&inside(r.b,25)).map(r=>({...r,a:round(r.a),b:round(r.b),w:r.width??(r.walk||r.cycle?2.4:r.highway==='service'?4:r.highway==='track'?3:6.2),widthBasis:r.width?'OSM width':'class-based visual estimate',walk:r.walk||r.cycle,neighbourhood:true}));
const buildings=[];
for(const b of source.buildings){
 if(existing.has(b.id))continue;
 for(const [index,poly] of b.polygons.entries()){
  const c=center(poly.outer);
  if(!inside(c)||c[0]>=CORE.bounds[0]&&c[0]<=CORE.bounds[2]&&c[1]>=CORE.bounds[1]&&c[1]<=CORE.bounds[3])continue;
  // One-storey massing for untagged heights is explicitly an estimate, never
  // published as an OSM measurement. The selected municipal facade is two storeys
  // in its dated March 2023 photograph; the 7 m height is still an estimate.
  const h=b.id==='1227869701'?7:b.h??(b.levels?b.levels*3.2:3.2);
  if(!Number.isFinite(h)||h<=0)continue;
  buildings.push({...b,id:b.polygons.length===1?b.id:`${b.id}/${index}`,sourceId:b.id,p:roundRing(poly.outer),holes:poly.holes.map(roundRing),polygons:undefined,h,minHeight:b.minHeight??0,
    heightBasis:b.id==='1227869701'?'Two visible storeys; authored 7 m estimate':b.h?'OSM height':b.levels?'OSM levels × 3.2 m estimate':'Unknown height; one-storey visual placeholder',neighbourhood:true});
 }
}
function roundRing(p){return p.map(round);}
const contains=(point,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const candidates=buildings.map(b=>({...b,minX:Math.min(...b.p.map(p=>p[0])),maxX:Math.max(...b.p.map(p=>p[0])),minZ:Math.min(...b.p.map(p=>p[1])),maxZ:Math.max(...b.p.map(p=>p[1]))}));
const places=source.places.filter(p=>p.point&&inside(p.point)).map(p=>({...p,point:round(p.point)}));
const storefronts=[];const unresolved=[];
for(const place of places){
 const t=place.tags,kind=t.amenity||t.shop||t.office;
 if(!place.name||!['pharmacy','hospital','clinic','doctors','townhall','supermarket','convenience','greengrocer','hairdresser','bakery','butcher','cafe','restaurant','bar','fast_food','marketplace'].includes(kind))continue;
 const [x,z]=place.point;
 const owners=candidates.filter(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&contains(place.point,b.p)&&!b.holes.some(h=>contains(place.point,h)));
 if(owners.length!==1){unresolved.push({id:place.id,name:place.name,reason:owners.length?'ambiguous footprint':'no containing footprint'});continue;}
 const owner=owners[0],edges=facadeEdges(owner.p).filter(e=>e.length>=2.8);
 const choices=edges.map(e=>{const width=Math.min(5,e.length-.25),margin=width/2+.125;const u=Math.max(margin,Math.min(e.length-margin,(x-e.a[0])*e.ux+(z-e.a[1])*e.uz));return {e,u,x:e.a[0]+e.ux*u,z:e.a[1]+e.uz*u,d:Math.hypot(x-e.a[0]-e.ux*u,z-e.a[1]-e.uz*u)};}).sort((a,b)=>a.d-b.d);
 const edge=choices[0];if(!edge){unresolved.push({id:place.id,name:place.name,reason:'no facade wide enough'});continue;}
 const width=Math.min(5,edge.e.length-.25);
 const model=kind==='pharmacy'?'pharmacy':kind==='hairdresser'?'barber':kind==='greengrocer'||kind==='marketplace'?'produce':kind==='townhall'?'civic':['hospital','clinic','doctors'].includes(kind)?'clinic':['bar','restaurant','cafe','fast_food'].includes(kind)?'cafe':'market';
 storefronts.push({id:place.id,name:place.name,buildingId:owner.id,kind,shop:t.shop??null,point:place.point,x:edge.x+edge.e.nx*.08,z:edge.z+edge.e.nz*.08,yaw:Math.atan2(edge.e.nx,edge.e.nz),width,terrace:false,model,source:place.source,placementAccuracy:'Unique containing OSM footprint; nearest wall is an authored frontage estimate',street:t['addr:street']||''});
}
const occupied=[];
// Avoid stacked facades when multiple mapped tenants occupy the same wall.
const fronts=storefronts.sort((a,b)=>a.id.localeCompare(b.id)).filter(s=>{
 if(occupied.some(o=>o.buildingId===s.buildingId&&Math.hypot(o.x-s.x,o.z-s.z)<(o.width+s.width)/2&&Math.cos(o.yaw-s.yaw)>.8)){unresolved.push({id:s.id,name:s.name,reason:'overlapping frontage; retained as a mapped place'});return false;}occupied.push(s);return true;
});
const polygonFeatures=[];
const pointMap=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,round([(e.lon-CORE.origin[1])*111320*Math.cos(CORE.origin[0]*Math.PI/180),(CORE.origin[0]-e.lat)*111320])]));
for(const e of raw.elements){if(e.type!=='way'||e.nodes[0]!==e.nodes.at(-1))continue;const t=e.tags;
 if(!['park','garden','pitch','playground'].includes(t.leisure)&&t.amenity!=='marketplace'&&t.landuse!=='grass'&&t.man_made!=='reservoir_covered')continue;
 const p=e.nodes.slice(0,-1).map(n=>pointMap.get(n));if(p.some(v=>!v)||!inside(center(p)))continue;
 polygonFeatures.push({id:`way/${e.id}`,p,tags:t});
}
const bounds=[...CORE.bounds];for(const b of buildings)for(const p of b.p){bounds[0]=Math.min(bounds[0],p[0]-5);bounds[1]=Math.min(bounds[1],p[1]-5);bounds[2]=Math.max(bounds[2],p[0]+5);bounds[3]=Math.max(bounds[3],p[1]+5);}for(const r of roads)for(const p of [r.a,r.b]){bounds[0]=Math.min(bounds[0],p[0]-10);bounds[1]=Math.min(bounds[1],p[1]-10);bounds[2]=Math.max(bounds[2],p[0]+10);bounds[3]=Math.max(bounds[3],p[1]+10);}
const outsideCore=p=>p[0]<CORE.bounds[0]||p[0]>CORE.bounds[2]||p[1]<CORE.bounds[1]||p[1]>CORE.bounds[3];
const water=[];
for(const w of source.water){
 if(w.line)for(let i=1;i<w.line.length;i++){const a=round(w.line[i-1]),b=round(w.line[i]);if(inside(a,25)&&inside(b,25)&&outsideCore(center([a,b])))water.push({...w,id:`${w.id}:${i}`,line:[a,b],width:w.width??(w.waterway==='river'?8:w.waterway==='stream'?2:1),widthBasis:w.width?'OSM width':'class-based visual estimate'});}
 else for(const polygon of w.polygons)if(inside(center(polygon.outer))&&polygon.outer.every(outsideCore))water.push({...w,polygons:[{outer:roundRing(polygon.outer),holes:polygon.holes.map(roundRing)}]});
}
const deduped=removeExactDuplicates(buildings);
const surfaces=cutWaterFromParks(polygonFeatures,water);
const districts=raw.elements.filter(e=>e.type==='node'&&['suburb','neighbourhood','quarter'].includes(e.tags?.place)&&e.tags.name).map(e=>({id:`node/${e.id}`,name:e.tags.name,point:pointMap.get(e.id),source:`https://www.openstreetmap.org/node/${e.id}`})).filter(d=>d.point&&inside(d.point));
const audit={duplicates:deduped.duplicates,waterSurfaceCorrections:surfaces.corrected,districts,buildingCount:deduped.buildings.length,monuments:places.filter(p=>p.tags.historic==='memorial'||p.tags.historic==='monument'||p.tags.tourism==='artwork').map(p=>({id:p.id,name:p.name,source:p.source})),unknownHeights:buildings.filter(b=>b.heightSource==='unknown'&&!b.levels).length};
if(urban)fs.writeFileSync('assets-source/tirana-urban/coverage-audit.json',JSON.stringify(audit,null,2)+'\n');
const data={origin:CORE.origin,bounds,roads,buildings:deduped.buildings,places,water,storefronts:fronts,polygonFeatures:surfaces.features,districts,source:{...source.source,receipts:raw.receipts},terrainAccuracy:'Existing flat gameplay datum; terrain slopes are not surveyed',unresolved};
// Repeated way tags/provenance are stored once in the JS payload. Runtime road
// records retain the same source fields; the full acquisition remains archived.
const roadWays={},segments=[];
for(const r of roads){const {id,a,b,nodeA,nodeB,...common}=r;roadWays[r.way]=common;segments.push({id,way:r.way,a,b,nodeA,nodeB});}
const compact={...data,roads:undefined,buildings:packRecords(data.buildings),places:packRecords(data.places),storefronts:packRecords(data.storefronts)};
const roadNodes=[],pointIds=new Map();
const pointIndex=(id,p)=>{if(!pointIds.has(id)){pointIds.set(id,roadNodes.length);roadNodes.push([id,...p]);}return pointIds.get(id);};
const compactSegments=roads.map(r=>[r.way,Number(r.id.split(':').at(-1)),pointIndex(r.nodeA,r.a),pointIndex(r.nodeB,r.b)]);
writeCompressedSource({roadWays:packRecords(Object.values(roadWays)),points:roadNodes,segments:compactSegments,neighbourhood:compact},'webapp/src/games/tirana-neighbourhood');
fs.mkdirSync('assets-source/tirana-neighbourhood',{recursive:true});
fs.writeFileSync('assets-source/tirana-neighbourhood/building-input.json',JSON.stringify(buildings.filter(b=>['548100908','682723386','1227869701','548098442'].includes(b.id)),null,2));
const kitNames={market:'Market',pharmacy:'Farmaci',barber:'Berberanë',produce:'Fruta-perime',cafe:'Bar / restorant',civic:'Shërbime publike',clinic:'Klinikë'};
const review=[...HEROES.map(h=>{const b=buildings.find(b=>b.id===h.id);return {...h,origin:center(b.p),fronts:fronts.filter(s=>s.buildingId===h.id).map(({x,z,yaw,width,name,model})=>({x,z,yaw,width,name,model}))};}),...KIT_IDS.map(asset=>({asset,name:kitNames[asset],origin:[0,0],fronts:[]}))];
fs.writeFileSync('webapp/src/games/tirana-neighbourhood/reviewData.mjs','// Same source positions and Blender assets as gameplay.\nexport const REVIEW_SITES='+JSON.stringify(review)+';\n');
console.log(JSON.stringify({roads:roads.length,buildings:buildings.length,mappedPlaces:places.length,storefronts:fronts.length,unresolved:unresolved.length,heroBuildings:buildings.filter(b=>['548100908','682723386','1227869701','548098442'].includes(b.id)).map(b=>b.id),bounds}));
