import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaces, CLOSED_PLACES, FLAG_COUNTRIES } from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import { containsPoint, distanceToPolygon } from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';

// Frozen pre-index resolver: an exhaustive oracle for identity, ambiguity,
// campus tolerance, output ordering, diagnostics and duplicate suppression.
const publicKinds = new Set(['townhall', 'government', 'police', 'fire_station']);
const inside = (p,b) => p[0]>=b[0] && p[0]<=b[2] && p[1]>=b[1] && p[1]<=b[3];
const ring = p => p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1] ? p.slice(0,-1) : p;
const centre = p => ({x:p.reduce((s,v)=>s+v[0],0)/p.length,z:p.reduce((s,v)=>s+v[1],0)/p.length});
function exhaustiveResolvePlaces(world, source) {
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


const rectangle = (id,x,z,w=4,d=4) => ({id,h:8,p:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]]});
const place = (id,p,category='embassy',tags={}) => ({id,p,category,tags:{name:`Site ${id}`,country:'CH',...tags}});
const map = buildings => ({bounds:[-1000,-1000,1000,1000],buildings});

test('indexed places preserve exhaustive identities, ambiguity, ordering and diagnostics', () => {
  const duplicate=rectangle('same',-25,-25);
  const buildings=[rectangle('first',90,5),rectangle('inside',82,5),rectangle('straddles',79.95,5),
    rectangle('outside',79.89,5),rectangle('overlap',83,6),rectangle('negative',-83,-3),
    rectangle(7,500,500),rectangle('7',510,510),duplicate,duplicate];
  const source={places:[
    place('way/campus',[[80,0],[100,0],[100,20],[80,20],[80,0]]),
    place('node/ambiguous',[84,7]),place('node/unique',[-81,-1]),
    place('node/unknown',[-81,-1],'embassy',{country:'XX'}),
    place('way/7',[[0,0],[1,0],[1,1],[0,1]]),
    place('way/inside',[[0,0],[1,0],[1,1],[0,1]]),
    place('node/duplicate',[-23,-23]),place('node/outside',[1001,0]),
    place('way/382468440',buildings[0].p),
    place('way/roof',buildings[0].p,'government',{building:'roof'}),
    place('node/unmatched',[300,300])
  ]};
  const result=resolvePlaces(map(buildings),source);
  assert.deepEqual(result,exhaustiveResolvePlaces(map(buildings),source));
  assert.equal(result.sites.find(site=>site.buildingId==='inside').match,'source-building-id');
  assert.ok(result.sites.some(site=>site.buildingId==='straddles'));
  assert.ok(!result.sites.some(site=>site.buildingId==='outside'));
  assert.ok(result.issues.some(issue=>issue.id==='node/duplicate'));
});

test('indexed places match an exhaustive oracle across cell edges, concave campuses and reordered footprints', () => {
  let seed=83;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  for(let pass=0;pass<6;pass++){
    const buildings=Array.from({length:180},(_,i)=>rectangle(i,random()*1200-600,random()*1200-600,random()*50+.1,random()*50+.1));
    // Boundary cases include a building entirely inside the tolerance strip
    // of the adjacent spatial cell, and one exactly at the exclusion distance.
    buildings.push(rectangle('strip',-.08,80,.04,4),rectangle('limit',-.1,80,.01,4));
    if(pass%2)buildings.reverse();
    const source={places:[place('way/strip-campus',[[0,80],[10,80],[10,100],[0,100]])]};
    for(let i=0;i<90;i++){
      const building=buildings[i], [x,z]=building.p[0];
      source.places.push(place(`node/${i}`,[x+1,z+1],i%3?'embassy':'government'));
      if(i%6===0)source.places.push(place(`way/campus-${i}`,[[x-20,z-20],[x+100,z-20],[x+100,z+30],[x+30,z+30],[x+30,z+100],[x-20,z+100]]));
      if(i%13===0)source.places.push(place(`way/${building.id}`,building.p));
    }
    const world=map(buildings);
    assert.deepEqual(resolvePlaces(world,source),exhaustiveResolvePlaces(world,source));
  }
});

test('repeated place resolution avoids unrelated footprint reads and retains empty-campus semantics', () => {
  const nearby=rectangle('nearby',1,1), remote=rectangle('remote',700,700), empty={id:'empty',h:0,p:[]};
  let reads=0;
  const remotePolygon=remote.p;
  Object.defineProperty(remote,'p',{get(){reads++;return remotePolygon;}});
  const world=map([remote,nearby,empty]);
  resolvePlaces(world,{places:[place('node/warm',[2,2])]});
  reads=0;
  const result=resolvePlaces(world,{places:[place('node/local',[2,2]),place('way/campus',[[0,0],[8,0],[8,8],[0,8]])]});
  assert.equal(reads,0,'a reused source index must not rescan distant footprints');
  assert.deepEqual(result.sites.map(site=>site.buildingId),['nearby','empty']);
  assert.deepEqual(result,exhaustiveResolvePlaces(world,{places:[place('node/local',[2,2]),place('way/campus',[[0,0],[8,0],[8,8],[0,8]])]}));
});
