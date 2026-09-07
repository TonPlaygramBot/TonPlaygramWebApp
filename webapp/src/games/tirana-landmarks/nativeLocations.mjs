/** Shared, traceable placements for original artist recreations. OSM-derived data
 * remains ODbL. These are map/source anchors, not survey-accurate measurements. */
export const NATIVE_LANDMARK_SPECS = Object.freeze([
  { id:'clock', name:'Clock Tower', way:'233519333', landmark:'clock', yaw:0,
    source:'https://www.openstreetmap.org/way/233519333', accuracy:'existing-map-anchor' },
  { id:'mosque', name:"Et’hem Bey Mosque", way:'175108083', landmark:'mosque', yaw:0,
    source:'https://www.openstreetmap.org/way/175108083', accuracy:'existing-map-anchor' },
  { id:'pyramid', name:'Pyramid of Tirana', way:'174510408', landmark:'pyramid', yaw:.19,
    source:'https://www.openstreetmap.org/way/174510408', accuracy:'existing-map-anchor' },
  { id:'museum', name:'National History Museum', lat:41.32944, lon:19.8174, yaw:0,
    names:['muzeu historik kombetar','national history museum','national historical museum'],
    source:'https://mapcarta.com/35570648', accuracy:'mapped-building-centre' },
  { id:'eyes', name:'Eyes of Tirana', lat:41.32864, lon:19.81558, yaw:0,
    names:['eyes of tirana','syte e tiranes'],
    source:'https://mapcarta.com/W764634562', accuracy:'mapped-site-centre' },
  { id:'skanderbeg', name:'Skanderbeg Monument', lat:41.32777, lon:19.81855, yaw:-Math.PI/2,
    source:'https://www.openstreetmap.org/node/13137823114', accuracy:'mapped-statue-node' }
].map(Object.freeze));
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function containsPoint(x,z,poly){
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
export function distanceToPolygon(x,z,poly){
  if(containsPoint(x,z,poly))return 0;
  let best=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return best;
}
export function projectLocation(world,lat,lon){
  const [a,b]=world.origin;
  if(![a,b,lat,lon].every(Number.isFinite)||Math.abs(a)>=90||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Invalid geographic anchor');
  return {x:(lon-b)*111320*Math.cos(a*Math.PI/180),z:(a-lat)*111320};
}
const boundsOf=poly=>({minX:Math.min(...poly.map(p=>p[0])),maxX:Math.max(...poly.map(p=>p[0])),minZ:Math.min(...poly.map(p=>p[1])),maxZ:Math.max(...poly.map(p=>p[1]))});
/** Never mutate WORLD or snap a monument onto a road. An unresolved special
 * landmark is omitted with a diagnostic rather than silently placed at zero. */
export function resolveNativeLandmarks(world){
  const landmarks=[],issues=[],used=new Set();
  for(const spec of NATIVE_LANDMARK_SPECS){
    const anchored=spec.landmark?world.landmarks.filter(l=>l.id===spec.landmark):[];
    if(spec.landmark&&anchored.length!==1){issues.push(`${spec.id}: expected one existing map anchor`);continue;}
    const point=anchored.length?{x:anchored[0].x,z:anchored[0].z}:projectLocation(world,spec.lat,spec.lon);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.z)||point.x<world.bounds[0]||point.x>world.bounds[2]||point.z<world.bounds[1]||point.z>world.bounds[3]){
      issues.push(`${spec.id}: outside map bounds`);continue;
    }
    let building;
    if(spec.way)building=world.buildings.find(b=>String(b.id)===spec.way);
    else if(spec.names){
      // Name identity AND geographic vicinity are required. Never use a museum
      // office across town or an unrelated adjacent footprint as the landmark.
      const named=world.buildings.filter(b=>spec.names.includes(normalize(b.name))&&distanceToPolygon(point.x,point.z,b.p)<100);
      if(named.length===1)building=named[0];
      else if(named.length>1)issues.push(`${spec.id}: multiple named footprints; retain existing shells`);
      else {
        const containing=world.buildings.filter(b=>containsPoint(point.x,point.z,b.p));
        // Unnamed footprint exactly containing the source coordinate is usable;
        // a differently named building or a courtyard is not guessed.
        if(containing.length===1&&!normalize(containing[0].name))building=containing[0];
      }
    }
    let footprint=null,buildingId=null;
    if(building&&!used.has(String(building.id))&&building.p?.length>=3){
      const bounds=boundsOf(building.p);
      if(bounds.maxX-bounds.minX<160&&bounds.maxZ-bounds.minZ<160){
        buildingId=String(building.id);used.add(buildingId);footprint=building.p.map(p=>[p[0],p[1]]);
      }
    }
    landmarks.push({...spec,...point,buildingId,footprint,groundY:.12,
      geometryAccuracy:'original-approximation',orientationAccuracy:'art-directed-not-surveyed'});
    if(spec.names&&!buildingId)issues.push(`${spec.id}: no unambiguous source footprint; mapped-site placement only`);
  }
  return {landmarks,issues};
}
export function nativeReplacementIds(world){return new Set(resolveNativeLandmarks(world).landmarks.flatMap(l=>l.buildingId?[l.buildingId]:[]));}
export function translateNativeLandmarks(items,origin={x:0,z:0}){
  if(!Number.isFinite(origin.x)||!Number.isFinite(origin.z))throw new Error('Invalid game origin');
  return items.map(l=>({...l,x:l.x-origin.x,z:l.z-origin.z,footprint:l.footprint?.map(p=>[p[0]-origin.x,p[1]-origin.z])||null}));
}
/** Conservative geometric pruning: all three vertices must belong to the SAME
 * verified replacement footprint. Unrelated spanning/ground triangles survive. */
export function triangleInReplacement(vertices,footprints,tolerance=.35){
  return footprints.some(poly=>vertices.every(p=>distanceToPolygon(p[0],p[2],poly)<=tolerance));
}
