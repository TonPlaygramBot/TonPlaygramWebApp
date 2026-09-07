/** Strict staging import for central Tirana + the lake. No approximate shoreline,
 * fabricated connecting street, or silent incomplete-way repair is permitted. */
export const LAKE_WAY=249196321;
export const PARK_RELATION=3351946;
export const ORIGIN=Object.freeze([41.3275,19.8188]);
export const BBOX=Object.freeze([41.303,19.804,41.332,19.837]); // south, west, north, east
export const SOURCE_QUERY=`[out:json][timeout:40];(way["highway"](${BBOX});way["building"](${BBOX});way["natural"="water"](${BBOX});way["leisure"](${BBOX});node["amenity"="bench"](${BBOX});node["highway"="street_lamp"](${BBOX});node["amenity"="bicycle_parking"](${BBOX});node["barrier"="bollard"](${BBOX});way(${LAKE_WAY});relation(${PARK_RELATION}););(._;>>;);out meta;`;
const project=n=>[(n.lon-ORIGIN[1])*111320*Math.cos(ORIGIN[0]*Math.PI/180),(ORIGIN[0]-n.lat)*111320];
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
export function stitchRings(parts){
  const todo=parts.map(p=>[...p]),rings=[];
  while(todo.length){const ring=todo.shift();if(ring.length<2)throw Error('Incomplete ring segment');
    while(ring[0]!==ring.at(-1)){
      const tail=ring.at(-1),matches=todo.map((p,i)=>p[0]===tail||p.at(-1)===tail?i:-1).filter(i=>i>=0);
      if(matches.length!==1)throw Error('Open or ambiguous multipolygon ring');
      const next=todo.splice(matches[0],1)[0];if(next[0]!==tail)next.reverse();ring.push(...next.slice(1));
    }
    if(new Set(ring).size<3)throw Error('Degenerate ring');rings.push(ring);
  }
  return rings;
}
export function importLakeSource(raw){
  if(!raw||!Array.isArray(raw.elements)||raw.remark)throw Error('Missing or incomplete Overpass snapshot');
  const nodes=new Map(),ways=new Map(),relations=new Map();
  for(const e of raw.elements){const table=e.type==='node'?nodes:e.type==='way'?ways:e.type==='relation'?relations:null;if(!table)continue;if(table.has(e.id))throw Error(`Duplicate OSM ${e.type}/${e.id}`);table.set(e.id,e);}
  const coordinate=id=>{const n=nodes.get(id);if(!n||!Number.isFinite(n.lat)||!Number.isFinite(n.lon)||Math.abs(n.lat)>90||Math.abs(n.lon)>180)throw Error(`Missing/invalid node ${id}`);return project(n);};
  const way=id=>{const w=ways.get(id);if(!w?.nodes||w.nodes.length<2)throw Error(`Missing/incomplete way ${id}`);return w;};
  const polygon=refs=>{if(refs[0]!==refs.at(-1)||new Set(refs).size<3)throw Error('Unclosed polygon; no invented closing segment allowed');const p=refs.slice(0,-1).map(coordinate);if(area(p)<.01)throw Error('Degenerate polygon');return p;};
  const lake=way(LAKE_WAY);
  if(lake.tags?.natural!=='water')throw Error('Expected the mapped Tirana lake water way');
  const lakePolygon=polygon(lake.nodes),lakeArea=area(lakePolygon);
  if(lakeArea<200000||lakeArea>900000)throw Error('Lake area outside plausible range; source review required');
  const geo=lake.nodes.map(id=>nodes.get(id));
  if(geo.some(n=>n.lat<41.303||n.lat>41.318||n.lon<19.81||n.lon>19.83))throw Error('Lake geometry does not lie in the expected Tirana district');
  const park=relations.get(PARK_RELATION);
  if(!park||park.tags?.type!=='multipolygon')throw Error('Missing complete Grand Park multipolygon');
  const rings=role=>stitchRings(park.members.filter(m=>m.type==='way'&&m.role===role).map(m=>way(m.ref).nodes)).map(polygon);
  const outer=rings('outer'),holes=rings('inner');
  if(!outer.length||!park.members.some(m=>m.type==='way'&&m.role==='inner'&&m.ref===LAKE_WAY))throw Error('Grand Park must preserve the lake as an inner water hole');
  if(holes.some(p=>!outer.some(q=>inside(p[0],q))))throw Error('Park hole outside all outer rings');
  const drivable=new Set(['primary','secondary','tertiary','residential','unclassified','living_street','service','primary_link','secondary_link','tertiary_link']);
  const foot=new Set(['footway','pedestrian','path','cycleway','steps']);
  const roads=[],buildings=[],furniture=[],diagnostics=[];
  for(const w of ways.values()){
    const t=w.tags||{};
    if(drivable.has(t.highway)||foot.has(t.highway)){
      if(t.access==='private'||t.access==='no')continue;
      const p=w.nodes.map(coordinate),width=Number(t.width),lanes=Number(t.lanes);
      for(let i=0;i<p.length-1;i++)if(Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1])>.05)roads.push({osmId:`way/${w.id}`,nodeA:String(w.nodes[i]),nodeB:String(w.nodes[i+1]),a:p[i],b:p[i+1],walk:foot.has(t.highway),highway:t.highway,name:t.name||'',bridge:t.bridge==='yes',tunnel:t.tunnel==='yes',layer:Number(t.layer)||0,oneway:t.oneway==='-1'?-1:['yes','1','true'].includes(t.oneway)?1:0,w:Number.isFinite(width)&&width>0?width:foot.has(t.highway)?3:Number.isFinite(lanes)&&lanes>0?lanes*3.1:6.2,widthSource:Number.isFinite(width)&&width>0?'tag':'inferred'});
    }
    if(t.building&&t.building!=='no'){
      const p=polygon(w.nodes),height=Number.parseFloat(t.height),levels=Number(t['building:levels']);
      const h=Number.isFinite(height)&&height>0?height:Number.isFinite(levels)&&levels>0?levels*3.2:null;
      buildings.push({id:String(w.id),p,h,name:t['name:en']||t.name||'',heightSource:Number.isFinite(height)&&height>0?'tag':h?'levels-inference':'unknown',tags:t});
      if(h===null)diagnostics.push(`way/${w.id}: unknown height; requires measured/explicit artistic fallback`);
    }
  }
  for(const n of nodes.values()){
    const t=n.tags||{},asset=t.amenity==='bench'?'park-bench':t.highway==='street_lamp'?'park-lamp':t.amenity==='bicycle_parking'?'cycle-rack':t.barrier==='bollard'?'bollard':null;
    if(asset){const [x,z]=coordinate(n.id);furniture.push({id:`node/${n.id}`,asset,x,z,source:`https://www.openstreetmap.org/node/${n.id}`,yaw:null,orientationSource:'unverified'});}
  }
  if(!roads.length)throw Error('Roads/paths are missing; a lake polygon alone is not a city expansion');
  return {schemaVersion:1,stage:'review-only',readyForRuntime:false,origin:ORIGIN,requestedBbox:BBOX,sourceTimestamp:raw.osm3s?.timestamp_osm_base||null,attribution:'© OpenStreetMap contributors · ODbL 1.0',lake:{osmId:`way/${LAKE_WAY}`,version:lake.version||null,p:lakePolygon,nodeIds:lake.nodes,areaM2:lakeArea},park:{osmId:`relation/${PARK_RELATION}`,version:park.version||null,outer,holes},roads,buildings,furniture,diagnostics,releaseChecks:['rebuild shared client/server world and routing together','retain park holes in rendering/tree placement','land-water collision and bridge validation','ground extent and streaming budgets','rebuild race routes and offline map','source-to-scene registration and physical-phone tests']};
}
