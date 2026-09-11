import {projectRegion,REGION_BBOX} from '../../src/games/tirana-region/regionCore.mjs';
import {validatePolygonRing,containsRing,holesOverlap} from './polygonValidation.mjs';
const legalNumber=s=>{if(typeof s!=='string'||!/^\d+(\.\d+)?\s*(m)?$/.test(s.trim()))return null;const n=Number.parseFloat(s);return Number.isFinite(n)?n:null;};
/** Assemble OSM relation members by identity, preserving holes and all vertices. */
export function stitchRegionRings(chains){
 const todo=chains.map(c=>[...c]);const degree=new Map();
 for(const c of todo){if(c.length<2)throw Error('Invalid member chain');if(c[0]===c.at(-1))continue;for(const n of [c[0],c.at(-1)])degree.set(n,(degree.get(n)||0)+1);}
 if([...degree.values()].some(n=>n!==2))throw Error('Open or ambiguous multipolygon');
 const rings=[];
 while(todo.length){const ring=todo.shift();let guard=todo.length+1;
  while(ring[0]!==ring.at(-1)){if(guard--<=0)throw Error('Open multipolygon');const matches=todo.map((c,i)=>({c,i})).filter(({c})=>c[0]===ring.at(-1)||c.at(-1)===ring.at(-1));if(matches.length!==1)throw Error('Open or ambiguous multipolygon');const {c,i}=matches[0];todo.splice(i,1);if(c.at(-1)===ring.at(-1))c.reverse();ring.push(...c.slice(1));}
  if(ring.length<4||new Set(ring.slice(0,-1)).size!==ring.length-1)throw Error('Degenerate or ambiguous multipolygon: repeated vertex');rings.push(ring);
 }return rings;
}
/** Input must be a full OSM JSON body, including referenced nodes. No fake data,
 * geographic smoothing, spatial-junction inference or Google extraction. */
export function importRegionSource(raw,{origin,sourceURL,acquiredAt,sha256}={}){
 if(!raw||raw.remark||!Array.isArray(raw.elements))throw Error('Incomplete OSM response');
 if(!sourceURL||!/^https:\/\//.test(sourceURL)||!acquiredAt||!Number.isFinite(Date.parse(acquiredAt))||!sha256||!/^[a-f0-9]{64}$/.test(sha256))throw Error('Provenance URL, timestamp and SHA256 required');
 try{const u=new URL(sourceURL);if(u.protocol!=='https:'||!u.hostname)throw Error();}catch{throw Error('Provenance requires a valid HTTPS URL');}
 projectRegion(origin,origin?.[0],origin?.[1]);
 const nodes=new Map(),ways=new Map(),relations=[],ids=new Set();
 for(const e of raw.elements){if(!e||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<=0)throw Error('Invalid OSM identity');const key=`${e.type}/${e.id}`;if(ids.has(key))throw Error(`Duplicate ${key}`);ids.add(key);if(e.type==='node'){if(![e.lat,e.lon].every(Number.isFinite))throw Error(`Missing coordinate ${key}`);nodes.set(e.id,e);}if(e.type==='way')ways.set(e.id,e);if(e.type==='relation')relations.push(e);}
 const point=id=>{const n=nodes.get(id);if(!n)throw Error(`Missing source node ${id}`);const p=projectRegion(origin,n.lat,n.lon);return [p.x,p.z];};
 const ring=w=>{if(!w?.nodes||w.nodes.length<4||w.nodes[0]!==w.nodes.at(-1))throw Error(`Unclosed polygon ${w?.id}`);return validatePolygonRing(w.nodes.slice(0,-1).map(point),`way/${w.id}`);};
 const roads=[],buildings=[],water=[],places=[],warnings=[],waterMembers=new Set();
 for(const r of relations){const t=r.tags||{};if(t.type!=='multipolygon'||!(t.natural==='water'||t.landuse==='reservoir'))continue;
  const member=role=>(r.members||[]).filter(m=>m.type==='way'&&(m.role===role||role==='outer'&&!m.role)).map(m=>{const w=ways.get(m.ref);if(!w)throw Error(`Missing relation member ${m.ref}`);waterMembers.add(m.ref);w.nodes.forEach(point);return w.nodes;});
  const outer=stitchRegionRings(member('outer')).map(c=>validatePolygonRing(c.slice(0,-1).map(point),`relation/${r.id}`)),inner=stitchRegionRings(member('inner')).map(c=>validatePolygonRing(c.slice(0,-1).map(point),`relation/${r.id}`));if(!outer.length)throw Error('Water relation has no outer ring');
  const polygons=outer.map(p=>({outer:p,holes:[]}));for(const hole of inner){const owners=polygons.filter(p=>containsRing(p.outer,hole));if(owners.length!==1)throw Error('Water hole has no unique outer owner');if(owners[0].holes.some(h=>holesOverlap(h,hole)))throw Error('Overlapping or nested water holes are ambiguous');owners[0].holes.push(hole);}
  water.push({id:`relation/${r.id}`,polygons,source:`https://www.openstreetmap.org/relation/${r.id}`});
 }
 for(const w of ways.values()){
  if(!Array.isArray(w.nodes)||w.nodes.length<2)throw Error(`Invalid way ${w.id}`);w.nodes.forEach(point);const t=w.tags||{},source=`https://www.openstreetmap.org/way/${w.id}`;
  if(t.highway){const unbuilt=['construction','proposed','abandoned'].includes(t.highway)||t.construction||t.proposed;
   if(unbuilt){warnings.push(`${source}: unbuilt highway excluded`);continue;}
   for(let i=1;i<w.nodes.length;i++){const a=point(w.nodes[i-1]),b=point(w.nodes[i]);if(Math.hypot(a[0]-b[0],a[1]-b[1])<.001)continue;
    roads.push({id:`${w.id}:${i-1}`,way:String(w.id),a,b,nodeA:String(w.nodes[i-1]),nodeB:String(w.nodes[i]),name:t.name||'',highway:t.highway,oneway:t.oneway==='no'?false:t.oneway==='-1'?-1:['yes','1','true'].includes(t.oneway)||t.junction==='roundabout'?true:false,layer:Number.isFinite(Number(t.layer))?Number(t.layer):0,bridge:!!t.bridge&&t.bridge!=='no',tunnel:!!t.tunnel&&t.tunnel!=='no',access:t.access||'yes',foot:t.foot||null,bicycle:t.bicycle||null,motorVehicle:t.motor_vehicle||t.motorcar||null,cycleway:t.cycleway||null,cyclewayLeft:t['cycleway:left']||null,cyclewayRight:t['cycleway:right']||null,walk:['footway','path','pedestrian','steps'].includes(t.highway),cycle:t.highway==='cycleway',width:legalNumber(t.width),source});
   }
  }
  if(t.building&&t.building!=='no')buildings.push({id:String(w.id),p:ring(w),h:legalNumber(t.height),levels:legalNumber(t['building:levels']),name:t.name||'',source,heightSource:t.height?'OSM height tag':'unknown'});
  if(!waterMembers.has(w.id)&&(t.natural==='water'||t.landuse==='reservoir'))water.push({id:`way/${w.id}`,polygons:[{outer:ring(w),holes:[]}],source});
  else if(t.waterway&&t.waterway!=='dam')water.push({id:`way/${w.id}`,line:w.nodes.map(point),width:legalNumber(t.width),waterway:t.waterway,source});
 }
 if(!roads.length)throw Error('Regional import contains no road segments');
 const bounds=[Infinity,Infinity,-Infinity,-Infinity];for(const r of roads)for(const p of [r.a,r.b]){bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);}
 // Public places retain their own identity and full tags. A campus polygon or
 // nearby point must not be promoted into an invented building footprint.
 for(const e of raw.elements){
  const t=e.tags||{};
  if(!(t.shop||t.amenity||t.office==='government'||t.tourism||t.historic))continue;
  const id=`${e.type}/${e.id}`;
  const geometry=e.type==='node'?{point:point(e.id)}:e.type==='way'?{outline:e.nodes.map(point)}:{members:e.members||[]};
  places.push({id,name:t.name||t['name:en']||'',tags:{...t},...geometry,source:`https://www.openstreetmap.org/${id}`,buildingId:e.type==='way'&&t.building&&t.building!=='no'?String(e.id):null});
 }
 const hasRingRelation=relations.some(r=>r.id===20772795);if(!hasRingRelation)warnings.push('Unaza e Madhe route relation absent; ring completeness is unverified');
 return {version:1,stage:'source-review',runtimeReady:false,origin:[...origin],bounds,requestedBbox:[...REGION_BBOX],roads,buildings,water,places,source:{url:sourceURL,acquiredAt,sha256,license:'ODbL-1.0',attribution:'© OpenStreetMap contributors'},warnings,releaseGates:['Review real data coverage at Rinas, Vaqarr, Sauk, Farkë, Kamza, TEG/Elbasan and Dajti','Supply a licensed DEM with horizontal and vertical datum','Validate bridges, tunnels, grades and water collisions','Build shared navigation and simulation bounds in both games','Run actual-game and phone performance checks']};
}
