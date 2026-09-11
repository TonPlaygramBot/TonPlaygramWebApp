import {ShapeUtils, Vector2} from 'three';
import {validatePolygonRing, containsRing, holesOverlap} from './polygonValidation.mjs';

/** Source authoring scene, never a ready-to-play map. Ground is a documented
 * review plane until DEM integration; unknown heights stay footprint linework.
 * Whole buildings are owned by one 500 m tile, never cut at tile boundaries. */
export function prepareBlenderScene(region) {
  if (region?.stage !== 'source-review' || region.runtimeReady !== false || !region.source?.sha256)
    throw Error('Expected a provenance-bearing regional source review');
  const tiles = new Map();
  const report = {buildings:0, heightTaggedBuildings:0, unknownHeightBuildings:0, roadSegments:0,
    roofGeometryUnresolved:[], unknownWidthRoadSegments:0};
  const tileAt = (x,z) => {
    const tx=Math.floor(x/500),tz=Math.floor(z/500),key=`${tx}_${tz}`;
    if (!tiles.has(key)) tiles.set(key,{id:key,origin:[tx*500,tz*500],objects:[]});
    return tiles.get(key);
  };
  for (const building of region.buildings) {
    const polygons=building.polygons ?? [{outer:building.p,holes:[]}];
    if (!polygons.length) throw Error(`No footprint ${building.id}`);
    for (const polygon of polygons) {
      validatePolygonRing(polygon.outer,building.id);
      polygon.holes.forEach((hole,i)=>{
        validatePolygonRing(hole,building.id);
        if (!containsRing(polygon.outer,hole) || polygon.holes.slice(0,i).some(other=>holesOverlap(other,hole)))
          throw Error(`Invalid courtyard ${building.id}`);
      });
    }
    const points=polygons.flatMap(p=>p.outer),center=points.reduce((v,p)=>[v[0]+p[0]/points.length,v[1]+p[1]/points.length],[0,0]);
    const tile=tileAt(...center),base=building.minHeight ?? 0;
    const measured=Number.isFinite(building.h)&&Number.isFinite(base)&&base>=0&&building.h>base;
    const roofHeight=building.roofHeight ?? 0;
    const wallTop=building.h-roofHeight;
    const wallsKnown=measured&&Number.isFinite(roofHeight)&&roofHeight>=0&&wallTop>base
      && (!building.roofShape||building.roofShape==='flat'||building.roofHeight!==null&&building.roofHeight!==undefined);
    const flatRoof=wallsKnown&&building.roofShape==='flat'&&roofHeight===0;
    report.buildings++;
    if (measured) report.heightTaggedBuildings++; else report.unknownHeightBuildings++;
    if (!flatRoof) report.roofGeometryUnresolved.push(building.id);
    const mesh={name:`building/${building.id}`,vertices:[],faces:[],edges:[],uv:[],
      material:wallsKnown?'plaster-proxy':null,
      extras:{source:building.source,tags:building.tags,footprintOnly:!wallsKnown,
        sourceHeight:building.h,roofResolved:flatRoof,materialAccuracy:'generic Poly Haven plaster proxy, not a surveyed facade'}};
    const vertex=(p,y,u=0,v=0)=>{mesh.vertices.push([p[0]-tile.origin[0],y,p[1]-tile.origin[1]]);mesh.uv.push([u,v]);return mesh.vertices.length-1;};
    for (const polygon of polygons) {
      // Outer ring CCW in x/z and courtyards CW; wall normals point away from solid.
      const rings=[polygon.outer,...polygon.holes].map((ring,i)=>{
        const copy=ring.map(p=>[...p]);
        if (ShapeUtils.isClockWise(copy.map(p=>new Vector2(...p))) === (i===0)) copy.reverse();
        return copy;
      });
      for (const ring of rings) {
        const outline=ring.map(p=>vertex(p,0));
        outline.forEach((a,i)=>mesh.edges.push([a,outline[(i+1)%outline.length]]));
        if (!wallsKnown) continue;
        let distance=0;
        ring.forEach((a,i)=>{
          const b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
          const indices=[vertex(a,base,distance/4,base/4),vertex(a,wallTop,distance/4,wallTop/4),
            vertex(b,wallTop,(distance+length)/4,wallTop/4),vertex(b,base,(distance+length)/4,base/4)];
          mesh.faces.push(indices);distance+=length;
        });
      }
      if (flatRoof) {
        const flat=rings.flat(),indices=flat.map(p=>vertex(p,building.h,p[0]/4,p[1]/4));
        for (const triangle of ShapeUtils.triangulateShape(rings[0].map(p=>new Vector2(...p)),rings.slice(1).map(r=>r.map(p=>new Vector2(...p))))) {
          let [a,b,c]=triangle;
          const pa=flat[a],pb=flat[b],pc=flat[c];
          // +Y in the game coordinate frame.
          if ((pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0])>0) [b,c]=[c,b];
          mesh.faces.push([indices[a],indices[b],indices[c]]);
        }
      }
    }
    tile.objects.push(mesh);
  }
  const roadMeshes=new Map();
  for (const road of region.roads) {
    if (![...road.a,...road.b].every(Number.isFinite)) throw Error(`Invalid road ${road.id}`);
    const tile=tileAt((road.a[0]+road.b[0])/2,(road.a[1]+road.b[1])/2);
    // Keep the original centreline and access/bridge/tunnel metadata. A width tag
    // alone cannot establish a road surface or its elevation above/below terrain.
    if (!roadMeshes.has(tile.id)) {
      const mesh={name:'source-road-centrelines',vertices:[],faces:[],edges:[],uv:[],material:null,extras:{segments:[]}};
      roadMeshes.set(tile.id,mesh);tile.objects.push(mesh);
    }
    const mesh=roadMeshes.get(tile.id),offset=mesh.vertices.length;
    mesh.vertices.push(...[road.a,road.b].map(p=>[p[0]-tile.origin[0],0,p[1]-tile.origin[1]]));
    mesh.uv.push([0,0],[0,0]);mesh.edges.push([offset,offset+1]);
    mesh.extras.segments.push({id:road.id,source:road.source,nodeA:road.nodeA,nodeB:road.nodeB,tags:road.tags,width:road.width});
    report.roadSegments++;
    if (!Number.isFinite(road.width)) report.unknownWidthRoadSegments++;
  }
  return {version:1,stage:'blender-source-review',runtimeReady:false,origin:region.origin,
    horizontalProjection:'Existing WORLD local approximation; x east, z south, metres',
    verticalDatum:'UNRESOLVED: zero is an authoring review plane, not terrain or sea level',
    source:region.source,report,tiles:[...tiles.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}
