// Source geometry stays in WORLD metres. This module never changes gameplay data.
import { containsPoint, distanceToPolygon } from '../tirana-landmarks/nativeLocations.mjs';
import {footprintIndex} from './footprintIndex.mjs';

export const CLOSED_PLACES = Object.freeze({
  'way/382468440': { reason: 'Former Iranian embassy; diplomatic relations severed in September 2022.',
    source: 'https://en.wikipedia.org/wiki/Albania%E2%80%93Iran_relations' }
});
export const FLAG_COUNTRIES = Object.freeze(['AL','AM','CA','CH','DK','EE','EU','IL','IT','LK','ME','NL','QA','RS','RU','SI','UA','US','VA','XK']);
const publicKinds = new Set(['townhall', 'government', 'police', 'fire_station']);
const inside = (p, bounds) => p[0] >= bounds[0] && p[0] <= bounds[2] && p[1] >= bounds[1] && p[1] <= bounds[3];
export function metres(value) {
  const match = typeof value === 'string' && value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:m)?$/);
  const n = match ? Number(match[1]) : null;
  return n !== null && n > 0 && n < 500 ? n : null;
}
const ring = p => p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1] ? p.slice(0, -1) : p;
const centre = p => ({x:p.reduce((s,v)=>s+v[0],0)/p.length,z:p.reduce((s,v)=>s+v[1],0)/p.length});

/** A source ID, a uniquely containing footprint, or a fully contained campus
 * building is required. Nearby buildings are never substituted for an embassy. */
export function resolvePlaces(world, source) {
  const sites = [], issues = [];
  for (const place of source.places) {
    if (CLOSED_PLACES[place.id]) { issues.push({id:place.id,reason:CLOSED_PLACES[place.id].reason}); continue; }
    if (place.tags.building === 'roof') continue;
    const isNode = place.id.startsWith('node/');
    const polygon = isNode ? null : ring(place.p);
    const point = isNode ? {x:place.p[0],z:place.p[1]} : centre(polygon);
    if (!inside([point.x,point.z],world.bounds)) { issues.push({id:place.id,reason:'Outside the playable map'}); continue; }
    let buildings = world.buildings.filter(b => `way/${b.id}` === place.id);
    let match = 'source-building-id';
    if (!buildings.length && isNode) {
      buildings = world.buildings.filter(b => containsPoint(point.x,point.z,b.p));
      if (buildings.length !== 1) buildings = [];
      match = 'unique-containing-footprint';
    } else if (!buildings.length && polygon?.length >= 3) {
      // Campus boundaries must never themselves become a solid building.
      buildings = world.buildings.filter(b => b.p.every(p => distanceToPolygon(p[0],p[1],polygon) < .1));
      match = 'campus-contained-footprint';
    }
    if (!buildings.length) { issues.push({id:place.id,reason:'No unambiguous existing building footprint'}); continue; }
    const diplomatic = ['embassy','consulate'].includes(place.category);
    const country = diplomatic ? place.tags.country : publicKinds.has(place.category) ||
      ['government','public'].includes(place.tags['operator:type']) ? 'AL' : null;
    const flag = FLAG_COUNTRIES.includes(country) ? country : null;
    if (diplomatic && !flag) issues.push({id:place.id,reason:'Unknown country; flag omitted'});
    for (const b of buildings) {
      const c = centre(b.p);
      sites.push({id:`${place.id}:${b.id}`,sourceId:place.id,buildingId:String(b.id),
        name:place.tags.name || place.tags['name:en'] || b.name || '',
        category:place.category,country:flag,footprint:b.p.map(p=>[...p]),
        x:c.x,z:c.z,height:b.h,tags:place.tags,match,
        source:`https://www.openstreetmap.org/${place.id}`,website:place.tags.website || null,
        placementAccuracy:'OSM identity and existing footprint; facade/flag mounts are authored',
        anchor:isNode?[point.x,point.z]:null});
    }
  }
  // Campus + building tags can describe the same institution. Keep the explicit
  // building identity first; different tenants of one building remain distinct.
  const unique = new Map();
  sites.sort((a,b)=>(a.match==='source-building-id'?-1:1)-(b.match==='source-building-id'?-1:1));
  for (const site of sites) {
    const key = `${site.buildingId}:${site.category}:${site.country || ''}`;
    if (!unique.has(key)) unique.set(key,site);
  }
  return {sites:[...unique.values()],issues};
}

export function facadeEdges(footprint) {
  return footprint.map((a,i)=>{
    const b=footprint[(i+1)%footprint.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.1)return null;
    const ux=dx/length,uz=dz/length,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    let nx=-uz,nz=ux;
    if(containsPoint(mx+nx*.1,mz+nz*.1,footprint)){nx=-nx;nz=-nz;}
    return {a,b,length,ux,uz,nx,nz,x:mx,z:mz,yaw:Math.atan2(nx,nz)};
  }).filter(Boolean);
}
export function frontage(site, roads, entrances=[]) {
  const edges=facadeEdges(site.footprint).filter(e=>e.length>=3);
  const entry=entrances.find(p=>p.tags.entrance==='main'&&distanceToPolygon(p.p[0],p.p[1],site.footprint)<.2);
  const distance=(p,e)=>segmentDistance(p[0],p[1],e.a,e.b);
  if(entry)return edges.sort((a,b)=>distance(entry.p,a)-distance(entry.p,b))[0];
  if(site.anchor)return edges.sort((a,b)=>distance(site.anchor,a)-distance(site.anchor,b))[0];
  const score=e=>Math.min(...roads.filter(r=>r.name).map(r=>segmentDistance(e.x+e.nx*2,e.z+e.nz*2,r.a,r.b)));
  return edges.sort((a,b)=>score(a)-score(b)||b.length-a.length)[0];
}
export function segmentDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
const pointKey=p=>`${Math.round(p[0]*100)},${Math.round(p[1]*100)}`;
export function sourceSegmentIndex(source) {
  const index = new Map();
  for(const way of source.roads)for(let i=1;i<way.p.length;i++){
    const a=way.p[i-1],b=way.p[i],segment={a,b,way:way.id,tags:way.tags,nodes:[way.nodes[i-1],way.nodes[i]]};
    index.set(`${pointKey(a)}|${pointKey(b)}`,segment);
  }
  return index;
}

/** Explicitly mapped cycleways use their own geometry. On-road lane offsets use
 * the retained game road width, and are labelled estimates. A `track` tag alone
 * is NOT enough to invent a parallel path: independently mapped paths own it. */
export function mappedCycling(world,source) {
  const index=sourceSegmentIndex(source),roadIndex=new Map();
  for(const r of world.roads)roadIndex.set(`${pointKey(r.a)}|${pointKey(r.b)}`,r);
  const segments=[],issues=[];
  for(const s of index.values()){
    if(!inside(s.a,world.bounds)||!inside(s.b,world.bounds))continue;
    const t=s.tags;
    if(['private','no'].includes(t.access)||t.bicycle==='no'||t.tunnel==='yes'||t.bridge==='yes'||Number(t.layer||0)!==0)continue;
    const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],length=Math.hypot(dx,dz);if(length<.2)continue;
    const rx=-dz/length,rz=dx/length;
    if(t.highway==='cycleway'){
      const measured=metres(t.width)||metres(t['cycleway:width']);
      segments.push({...s,width:measured||1.8,widthAccuracy:measured?'source-tag':'estimated',kind:'path',side:0,
        oneway:t.oneway==='yes'?1:t.oneway==='-1'?-1:0,evidence:'osm-cycleway-centreline',surface:t.surface||null});
      continue;
    }
    // Preserve OSM way direction even if the game stores this segment reversed.
    const r=roadIndex.get(`${pointKey(s.a)}|${pointKey(s.b)}`)||roadIndex.get(`${pointKey(s.b)}|${pointKey(s.a)}`);
    if(!r||r.walk)continue;
    const sides=[];
    for(const [name,side] of [['left',-1],['right',1]]){
      const v=t[`cycleway:${name}`]??t['cycleway:both'];
      if(['lane','opposite_lane'].includes(v))sides.push({side,name,opposite:v==='opposite_lane'});
    }
    if(!sides.length&&t.cycleway==='lane'&&t.oneway==='yes'&&!t['cycleway:right']&&!t['cycleway:both'])sides.push({side:1,name:'right'});
    if(!sides.length){if(t.cycleway==='lane')issues.push({id:s.way,reason:'Lane side unspecified; not inferred'});continue;}
    for(const {side,name,opposite} of sides){
      const measured=metres(t[`cycleway:${name}:width`])||metres(t['cycleway:width']);
      const width=measured||1.5;if(r.w<width+2)continue;
      const offset=side*(r.w/2-width/2-.15);
      // OSM implicit values for right-hand traffic. An explicit side/both
      // direction overrides them; left lanes on two-way roads run in reverse.
      // https://wiki.openstreetmap.org/wiki/Key:cycleway:right:oneway
      const direction=t[`cycleway:${name}:oneway`]??t['cycleway:both:oneway'];
      const oneway=direction==='no'?0:direction==='-1'?-1:['yes','1'].includes(direction)?1
        :opposite?-1:t.oneway==='yes'?1:t.oneway==='-1'?-1:side;
      segments.push({...s,a:[s.a[0]+rx*offset,s.a[1]+rz*offset],b:[s.b[0]+rx*offset,s.b[1]+rz*offset],
        sourceA:s.a,sourceB:s.b,width,side,kind:'lane',widthAccuracy:measured?'source-tag':'estimated',
        oneway,
        evidence:'osm-side-tag; offset uses existing road width',surface:t[`cycleway:${name}:surface`]||null});
    }
  }
  return {segments,issues};
}

export function cyclingDecals(segments,world,exclude=()=>false) {
  const decals=[];
  const candidates=footprintIndex(world.buildings);
  const occupied=(x,z)=>candidates(x,z).some(b=>containsPoint(x,z,b.p)&&!(b.holes||[]).some(h=>containsPoint(x,z,h)));
  const push=(kind,x,z,w,d,yaw,s)=>{if(!exclude(x,z)&&!occupied(x,z))decals.push({kind,x,z,w,d,yaw,evidence:s.evidence,source:s.way});};
  for(const s of segments){
    const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,yaw=Math.atan2(dx,dz);
    for(let start=0;start<length;start+=4){
      const d=Math.min(4,length-start),x=s.a[0]+ux*(start+d/2),z=s.a[1]+uz*(start+d/2);
      push('cycle-bed',x,z,s.width,d,yaw,s);
      for(const side of [-1,1])push('cycle-edge',x-uz*side*(s.width/2-.05),z+ux*side*(s.width/2-.05),.08,d,yaw,s);
    }
    if(length>9){const x=(s.a[0]+s.b[0])/2,z=(s.a[1]+s.b[1])/2;
      push('bicycle',x,z,Math.min(1.05,s.width*.7),2.1,yaw+(s.oneway<0?0:Math.PI),s);}
  }
  return decals;
}

export function mappedTrees(world,source) {
  const candidates=footprintIndex(world.buildings);
  return source.trees.filter(t=>inside(t.p,world.bounds)&&!candidates(...t.p).some(b=>containsPoint(t.p[0],t.p[1],b.p)&&!(b.holes||[]).some(h=>containsPoint(t.p[0],t.p[1],h)))).map(t=>{
    const height=metres(t.tags.height),crown=metres(t.tags.diameter_crown);
    const text=`${t.tags.genus||''} ${t.tags.species||''}`.toLowerCase();
    const model=/cupress|cypress/.test(text)?'tree_cypress':/tilia|linden/.test(text)?'tree_linden':'tree_plane';
    return {id:t.id,x:t.p[0],z:t.p[1],height,crown,model,scale:height?height/7:1,
      dimensionsAccuracy:height||crown?'partial-source-dimensions':'authored-size',
      speciesAccuracy:text.trim()||t.tags.leaf_type?'source-tag':'generic-canopy',tags:t.tags};
  });
}
