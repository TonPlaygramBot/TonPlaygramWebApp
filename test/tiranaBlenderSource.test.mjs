import test from 'node:test';
import assert from 'node:assert/strict';
import {importRegionSource} from '../webapp/scripts/tirana/regionImport.mjs';
import {prepareBlenderScene} from '../webapp/scripts/tirana/blenderScene.mjs';
const options={origin:[41.3275,19.8188],sourceURL:'https://www.openstreetmap.org/',acquiredAt:'2026-09-11T00:00:00Z',sha256:'a'.repeat(64)};
// All coordinates are synthetic test data, never shipped as city geometry.
function fixture(){
 return {elements:[
  ...[[1,41.33,19.81],[2,41.33,19.82],[3,41.32,19.82],[4,41.32,19.81],
      [5,41.328,19.812],[6,41.328,19.818],[7,41.322,19.818],[8,41.322,19.812]]
    .map(([id,lat,lon])=>({type:'node',id,lat,lon})),
  {type:'way',id:10,nodes:[1,2],tags:{highway:'service',access:'private',bridge:'yes',surface:'asphalt'}},
  {type:'way',id:11,nodes:[1,2,3,4,1],tags:{building:'yes'}},
  {type:'way',id:12,nodes:[5,6,7,8,5]},
  {type:'relation',id:20,members:[{type:'way',ref:11,role:'outer'},{type:'way',ref:12,role:'inner'}],
   tags:{type:'multipolygon',building:'office',office:'company',height:'15 m','roof:shape':'flat','addr:street':'Synthetic fixture'}}]};
}
test('building relation owns its footprint, courtyard and private office metadata without duplicate shells',()=>{
 const region=importRegionSource(fixture(),options);
 assert.equal(region.buildings.length,1);
 const b=region.buildings[0];assert.equal(b.id,'relation/20');
 assert.equal(b.polygons[0].holes.length,1);assert.equal(b.tags.office,'company');
 assert.equal(region.places[0].buildingId,b.id);
 assert.equal(region.roads[0].access,'private');assert.equal(region.roads[0].tags.surface,'asphalt');
 assert.equal(region.roads[0].bridge,true);
});
test('Blender roof triangulation preserves courtyard area and upward normals',()=>{
 const region=importRegionSource(fixture(),options),scene=prepareBlenderScene(region);
 const mesh=scene.tiles.flatMap(t=>t.objects).find(m=>m.name==='building/relation/20');
 const area=ring=>Math.abs(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2);
 const polygon=region.buildings[0].polygons[0],expected=area(polygon.outer)-area(polygon.holes[0]);
 let roofArea=0;
 for(const face of mesh.faces.filter(f=>f.length===3)){
  const [a,b,c]=face.map(i=>mesh.vertices[i]);
  assert.ok([a,b,c].every(p=>p[1]===15));
  const cross=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
  assert.ok(cross<0,'roof must face +Y');roofArea+=Math.abs(cross)/2;
 }
 assert.ok(Math.abs(roofArea-expected)<1e-6);
 assert.equal(mesh.faces.filter(f=>f.length===4).length,8,'inner and outer walls retained');
 assert.ok(mesh.vertices.flat().every(Number.isFinite));
 assert.equal(scene.runtimeReady,false);assert.match(scene.verticalDatum,/UNRESOLVED/);
});
test('unknown heights and unmeasured pitched roofs do not become invented solid models',()=>{
 const input=fixture();delete input.elements.at(-1).tags.height;
 let scene=prepareBlenderScene(importRegionSource(input,options));
 let mesh=scene.tiles.flatMap(t=>t.objects).find(m=>m.name==='building/relation/20');
 assert.equal(scene.report.unknownHeightBuildings,1);assert.equal(mesh.faces.length,0);assert.equal(mesh.edges.length,8);
 input.elements.at(-1).tags.height='15';input.elements.at(-1).tags['roof:shape']='gabled';
 scene=prepareBlenderScene(importRegionSource(input,options));
 mesh=scene.tiles.flatMap(t=>t.objects).find(m=>m.name==='building/relation/20');
 assert.equal(mesh.faces.length,0);assert.equal(mesh.extras.roofResolved,false);
});
test('source buildings with multiple outer rings and parts retain separate geometry',()=>{
 const input=fixture();input.elements.at(-1).members[1].role='outer';
 for(const e of input.elements) if(e.type==='node'&&e.id>=5) e.lat+=.02;
 const region=importRegionSource(input,options);
 assert.equal(region.buildings[0].polygons.length,2);assert.equal(region.buildings[0].p,null);
 const part=structuredClone(input.elements.find(e=>e.id===12));part.id=13;part.tags={'building:part':'yes',height:'10',min_height:'3'};
 input.elements.push(part);
 assert.equal(importRegionSource(input,options).buildings.find(b=>b.id==='13').part,true);
});
test('tile origin reconstructs original road coordinates and keeps source junction identity',()=>{
 const region=importRegionSource(fixture(),options),scene=prepareBlenderScene(region);
 for(const tile of scene.tiles) for(const object of tile.objects) if(object.name==='source-road-centrelines'){
  assert.deepEqual(object.vertices.map(p=>[p[0]+tile.origin[0],p[2]+tile.origin[1]]),[region.roads[0].a,region.roads[0].b]);
  assert.equal(object.extras.segments[0].nodeA,'1');assert.equal(object.extras.segments[0].tags.access,'private');
 }
});
test('invalid relation references fail and absent access stays unknown',()=>{
 const input=fixture();delete input.elements.find(e=>e.id===10).tags.access;
 assert.equal(importRegionSource(input,options).roads[0].access,null);
 input.elements.at(-1).members[1].ref=999;
 assert.throws(()=>importRegionSource(input,options),/Missing relation member/);
});
