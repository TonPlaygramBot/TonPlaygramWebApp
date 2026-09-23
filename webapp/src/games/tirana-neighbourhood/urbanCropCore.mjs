import {URBAN_BOUNDS,pointInUrbanBounds} from '../tiranastreets/shared/urbanBounds.mjs';
/** Clip area outlines, retaining the original vertices away from the map edge. */
export function clipUrbanRing(ring){
 let points=ring;
 for(const [axis,edge,positive] of [[0,URBAN_BOUNDS[0],true],[0,URBAN_BOUNDS[2],false],[1,URBAN_BOUNDS[1],true],[1,URBAN_BOUNDS[3],false]]){
  const result=[];
  for(let i=0;i<points.length;i++){
   const a=points[(i+points.length-1)%points.length],b=points[i],insideA=positive?a[axis]>=edge:a[axis]<=edge,insideB=positive?b[axis]>=edge:b[axis]<=edge;
   if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t].map(v=>Math.round(v*100)/100));}
   if(insideB)result.push(b);
  }points=result;
 }
 return points.length>=3?points:[];
}
export function cropUrbanRegion(region){
 const buildingIds=new Set();
 const buildings=region.buildings.filter(b=>b.p.every(p=>pointInUrbanBounds(p))).map(b=>{buildingIds.add(String(b.id));return b;});
 // Never invent an intersection at a map cutoff. Both original endpoint IDs,
 // one-way semantics and grade separation survive; crossing segments are omitted.
 const roads=region.roads.filter(r=>pointInUrbanBounds(r.a,8)&&pointInUrbanBounds(r.b,8));
 const water=[];
 for(const w of region.water||[]){
  if(w.polygons){const polygons=w.polygons.map(p=>({...p,outer:clipUrbanRing(p.outer),holes:p.holes.map(clipUrbanRing).filter(p=>p.length)})).filter(p=>p.outer.length);if(polygons.length)water.push({...w,polygons});}
  if(w.line){let line=[];const flush=()=>{if(line.length>1)water.push({...w,line});line=[];};for(const p of w.line){if(pointInUrbanBounds(p))line.push(p);else flush();}flush();}
 }
 const result={...region,bounds:[...URBAN_BOUNDS],buildings,roads,water,
  places:(region.places||[]).filter(p=>pointInUrbanBounds(p.point)),
  districts:(region.districts||[]).filter(p=>pointInUrbanBounds(p.point)),
  storefronts:(region.storefronts||[]).filter(p=>pointInUrbanBounds(p)&&(!p.buildingId||buildingIds.has(String(p.buildingId)))),
  playableCoverage:{basis:'Authored urban crop of the unchanged archived OSM snapshot',bounds:[...URBAN_BOUNDS],sourceBuildings:region.buildings.length,sourceRoads:region.roads.length,retainedBuildings:buildings.length,retainedRoads:roads.length}};
 if(region.polygonFeatures)result.polygonFeatures=region.polygonFeatures.map(p=>({...p,p:clipUrbanRing(p.p),holes:(p.holes||[]).map(clipUrbanRing).filter(p=>p.length)})).filter(p=>p.p.length);
 if(region.forests)result.forests=[];
 if(region.peaks)result.peaks=[];
 // Cable source stays archival; there are no active cable stations in the cut.
 if(region.cable)result.cable=[];
 return result;
}
