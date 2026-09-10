import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { CITY_SOURCE } from '../webapp/src/games/tirana-city-source/sourceData.mjs';
import { CITY_PLACES, MAPPED_CYCLING, MAPPED_TREES } from '../webapp/src/games/tirana-city-source/registry.mjs';
import { resolvePlaces, mappedCycling, facadeEdges, metres } from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import { FLAG_RATIOS } from '../webapp/src/games/tirana-city-source/flagRatios.mjs';
import { containsPoint } from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';

const rectangle = (id, x, z, w = 4, d = 4) => ({id, h:8, p:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]]});
const world = {bounds:[-100,-100,100,100], buildings:[rectangle('1',0,0)], roads:[]};
const place = (id, p, tags = {}) => ({id, p, category:'embassy', tags:{country:'CH',name:'Test embassy',...tags}});

test('diplomatic identities require an exact or unambiguous contained building, never the nearest one', () => {
  const source = {places:[place('node/1',[2,2]),place('node/2',[4.1,2])]};
  const result = resolvePlaces(world, source);
  assert.deepEqual(result.sites.map(p=>[p.sourceId,p.buildingId,p.country]), [['node/1','1','CH']]);
  assert.equal(result.issues[0].id, 'node/2');
  const ambiguous = resolvePlaces({...world,buildings:[...world.buildings,rectangle('2',1,1)]},source);
  assert.equal(ambiguous.sites.some(p=>p.sourceId==='node/1'), false);
});

test('campus boundaries do not become solid buildings or include a nearby building across the boundary', () => {
  const result=resolvePlaces({...world,buildings:[rectangle('1',1,1),rectangle('2',9,1)]},
    {places:[place('way/99',[[0,0],[10,0],[10,10],[0,10],[0,0]])]});
  assert.deepEqual(result.sites.map(p=>p.buildingId),['1']);
  assert.equal(result.sites[0].match,'campus-contained-footprint');
});

test('unknown and closed diplomatic identities never receive a guessed flag', () => {
  const result=resolvePlaces(world,{places:[place('node/3',[2,2],{country:'XX'}),place('way/382468440',world.buildings[0].p)]});
  assert.equal(result.sites[0].country,null);
  assert.equal(result.sites.length,1);
  assert.equal(result.issues.length,2);
  assert.equal(CITY_PLACES.sites.some(p=>p.sourceId==='way/382468440'),false);
});

test('lane side and direction remain tied to source way orientation when the game segment is reversed', () => {
  const source={roads:[{id:'way/1',p:[[0,0],[20,0]],nodes:['1','2'],tags:{highway:'secondary','cycleway:left':'opposite_lane'}}]};
  const result=mappedCycling({...world,roads:[{a:[20,0],b:[0,0],w:8}]},source);
  assert.equal(result.segments.length,1);
  assert.ok(result.segments[0].a[1]<0);
  assert.equal(result.segments[0].oneway,-1);
  assert.equal(result.segments[0].widthAccuracy,'estimated');
});

test('shared lanes, unmapped tracks, explicit no, private paths, and bridges do not become invented ground cycle lanes', () => {
  const tags=[{'cycleway:both':'shared_lane'},{'cycleway:both':'track'},
    {cycleway:'lane',oneway:'yes','cycleway:right':'no'},
    {highway:'cycleway',access:'private'},{highway:'cycleway',bridge:'yes'}];
  for(const tag of tags){
    const source={roads:[{id:'way/1',p:[[0,0],[20,0]],nodes:['1','2'],tags:{highway:'secondary',...tag}}]};
    assert.equal(mappedCycling({...world,roads:[{a:[0,0],b:[20,0],w:8}]},source).segments.length,0);
  }
});

test('two-way road lanes use opposite implicit directions and explicit bidirectional tags override them', () => {
  const road={id:'way/1',p:[[0,0],[20,0]],nodes:['1','2'],tags:{highway:'secondary','cycleway:both':'lane'}};
  const map={...world,roads:[{a:[0,0],b:[20,0],w:8}]};
  assert.deepEqual(mappedCycling(map,{roads:[road]}).segments.map(s=>s.oneway),[-1,1]);
  assert.deepEqual(mappedCycling(map,{roads:[{...road,tags:{...road.tags,'cycleway:both:oneway':'no'}}]}).segments.map(s=>s.oneway),[0,0]);
  assert.deepEqual(mappedCycling(map,{roads:[{...road,tags:{...road.tags,oneway:'yes'}}]}).segments.map(s=>s.oneway),[1,1]);
});

test('Swiss source identity is not duplicated as an Albanian civic building by the reference supplement', () => {
  const sites=CITY_PLACES.sites.filter(s=>s.buildingId==='470567580');
  assert.equal(sites.length,1);assert.equal(sites[0].country,'CH');
  assert.equal(CITY_PLACES.sites.find(s=>s.buildingId==='175108137').country,'AL');
  assert.equal(CITY_PLACES.sites.find(s=>s.buildingId==='410277122').country,'AL');
});

test('the committed tree centres and cycle paths are traceable to source geometry', () => {
  const trees=new Map(CITY_SOURCE.trees.map(t=>[t.id,t]));
  for(const tree of MAPPED_TREES){
    assert.deepEqual([tree.x,tree.z],trees.get(tree.id).p);
    assert.equal(WORLD.buildings.some(b=>containsPoint(tree.x,tree.z,b.p)),false);
  }
  const roads=new Map(CITY_SOURCE.roads.map(r=>[r.id,r]));
  for(const segment of MAPPED_CYCLING.segments){
    const source=roads.get(segment.way);assert.ok(source);
    if(segment.kind==='path')assert.ok(source.p.some(p=>p[0]===segment.a[0]&&p[1]===segment.a[1]));
    assert.ok(segment.width>0 && Number.isFinite(segment.width));
  }
});

test('facade normals face outside both polygon windings and dimensions reject ambiguous units', () => {
  const polygon=world.buildings[0].p;
  for(const points of [polygon,[...polygon].reverse()])for(const edge of facadeEdges(points))
    assert.equal(containsPoint(edge.x+edge.nx*.1,edge.z+edge.nz*.1,points),false);
  for(const value of ['3 ft','6;7','-2','NaN',null])assert.equal(metres(value),null);
  assert.equal(metres('7.5 m'),7.5);
});

test('all displayed flags are bundled, hash checked, and retain their own national aspect ratios', () => {
  const base=new URL('../webapp/public/assets/tirana-streets/flags/',import.meta.url);
  const metadata=JSON.parse(readFileSync(new URL('sources.json',base),'utf8'));
  for(const country of new Set(CITY_PLACES.sites.map(p=>p.country).filter(Boolean))){
    const bytes=readFileSync(new URL(country.toLowerCase()+'.svg',base));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),metadata.flags[country].sha256);
    assert.equal(FLAG_RATIOS[country],metadata.flags[country].aspect);
    assert.match(bytes.toString(),/<svg/);
  }
  assert.equal(FLAG_RATIOS.CH,1);assert.equal(FLAG_RATIOS.VA,1);assert.equal(FLAG_RATIOS.AL,1.4);
});

test('the importer rejects partial OSM responses before producing a dataset', () => {
  const script=new URL('../webapp/scripts/import-tirana-city-details.py',import.meta.url).pathname;
  const result=spawnSync('python3',['-c',`
import importlib.util, tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('city', ${JSON.stringify(script)})
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'partial.osm'
 p.write_text('<osm><remark>Query timed out</remark></osm>')
 try: module.extract(p.read_bytes(), '2026-09-10T13:41:03Z')
 except ValueError: pass
 else: raise AssertionError('partial response accepted')
`],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
