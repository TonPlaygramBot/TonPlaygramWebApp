import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,createState,collide,collideVehicle} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {URBAN_BOUNDS,pointInUrbanBounds} from '../webapp/src/games/tiranastreets/shared/urbanBounds.mjs';
import {NEIGHBOURHOOD} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
import {EAST} from '../webapp/src/games/tirana-east/data.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {clipUrbanRing,cropUrbanRegion} from '../webapp/src/games/tirana-neighbourhood/urbanCropCore.mjs';
import {urbanTrafficGraph} from '../webapp/src/games/tirana-neighbourhood/urbanRoutingCore.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {URBAN_MONUMENTS,urbanMonumentSolids} from '../webapp/src/games/tirana-landmarks/urbanMonuments.mjs';
import {vehicleSize} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {buildingAccessSites} from '../webapp/src/games/tiranastreets/shared/buildingAccess.mjs';
import {buildMapGraph,findMapRoute} from '../webapp/src/games/tiranastreets/map/mapCore.mjs';

test('the shared playable cut contains every road, building, tree and urban destination',()=>{
 assert.deepEqual(WORLD.bounds,URBAN_BOUNDS);
 for(const road of WORLD.roads)for(const p of [road.a,road.b])assert.ok(pointInUrbanBounds(p),road.id);
 for(const b of WORLD.buildings)assert.ok(b.p.every(p=>pointInUrbanBounds(p)),b.id);
 assert.ok(CANOPY_TREES.every(t=>pointInUrbanBounds(t)));
 assert.equal(EAST.cable.length,0);assert.equal(EAST.peaks.length,0);
 assert.ok(![...EAST.districts,...NEIGHBOURHOOD.districts].some(d=>/Surrel|Dajt/.test(d.name)));
 assert.ok(WORLD.roads.length<110000&&WORLD.buildings.length<35000);
 for(const name of ['Kombinat','Lapraka','Kinostudio','Ali Demi','Sauk','Shkozë'])assert.ok(NEIGHBOURHOOD.districts.some(d=>d.name===name),name);
});

test('routing retains one connected city graph with valid directions and reachable quarter targets',()=>{
 const {nodes,edges,directions}=WORLD.graph;assert.equal(directions.length,edges.length);
 const adjacency=nodes.map(()=>[]);edges.forEach(([a,b],i)=>{assert.ok(nodes[a]&&nodes[b]);assert.ok([-1,0,1].includes(directions[i]));adjacency[a].push(b);adjacency[b].push(a);});
 const visited=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const next of adjacency[queue[i]])if(!visited.has(next)){visited.add(next);queue.push(next);}
 assert.equal(visited.size,nodes.length);assert.ok(nodes.every(p=>pointInUrbanBounds(p)));
 // Applying the directed round-trip selection again must retain every spawn.
 assert.deepEqual(urbanTrafficGraph(WORLD.graph),WORLD.graph);
 const graph=buildMapGraph(WORLD,'drive');
 for(const id of ['node/10950616148','node/6824084784','node/7699528590']){const site=NEIGHBOURHOOD.places.find(p=>p.id===id);assert.ok(site);const route=findMapRoute(graph,{x:0,z:0},{x:site.point[0],z:site.point[1]});assert.equal(route.reachable,true,site.name);}
});

test('all 15 shops, 300 pickups and prior accessible roofs survive the compact map',()=>{
 const s=createState([{id:'urban-review',name:'Review'}],'free-roam');
 assert.equal(s.shops.length,15);assert.equal(s.pickups.length,300);
 for(const p of [...s.shops,...s.pickups,...s.traffic,...s.npcs,...s.cars,...Object.values(s.players)])assert.ok(pointInUrbanBounds(p),p.id);
 const sites=buildingAccessSites(WORLD);assert.equal(sites.length,11);for(const p of sites)assert.ok(pointInUrbanBounds(p.entrance),p.id);
});

test('pedestrians and entire bus bodies stay inside all four edges',()=>{
 const [left,north,right,south]=URBAN_BOUNDS;
 for(const p of [{x:left-40,z:0},{x:right+40,z:0},{x:0,z:north-40},{x:0,z:south+40}]){assert.ok(collide(p,.4));assert.ok(pointInUrbanBounds(p,4));}
 const world=new StreetWorld([],true);
 for(const p of [{x:left-2,z:0,y:0},{x:right+2,z:0,y:0},{x:0,z:north-2,y:0},{x:0,z:south+2,y:0}]){world.move(p,0,0,1.78);assert.ok(pointInUrbanBounds(p,4));}
 for(const heading of [0,Math.PI/4,Math.PI/2])for(const [x,z] of [[left,0],[right,0],[0,north],[0,south]]){
  const bus={id:'boundary-bus',model:'tirana-bus',x,z,heading,speed:0};collideVehicle(bus);const size=vehicleSize(bus),sx=Math.sin(heading),cz=Math.cos(heading);
  for(const side of [-1,1])for(const end of [-1,1])assert.ok(pointInUrbanBounds({x:bus.x+side*cz*size.width/2+end*sx*size.length/2,z:bus.z-side*sx*size.width/2+end*cz*size.length/2}));
 }
});

test('source-anchored monuments block walking and bullets at their matching plinths',()=>{
 const world=new StreetWorld(urbanMonumentSolids(),false);
 for(const s of URBAN_MONUMENTS){assert.equal(world.clearance({x:s.x,y:.05,z:s.z},1.78),false);assert.equal(world.clear({x:s.x-4,y:s.plinth.h/2,z:s.z},{x:s.x+4,y:s.plinth.h/2,z:s.z}),false);assert.equal(world.surface(s.x,s.z,s.plinth.h+.5),s.plinth.h);}
});

test('crop does not fabricate road intersections or move retained source vertices',()=>{
 const roads=[{id:'kept',a:[0,0],b:[1,1],nodeA:'a',nodeB:'b',oneway:-1},{id:'crossing',a:[3590,0],b:[3650,0],nodeA:'b',nodeB:'c'}];
 const cropped=cropUrbanRegion({roads,buildings:[],water:[]});assert.deepEqual(cropped.roads,[roads[0]]);
 const ring=clipUrbanRing([[3500,0],[3700,0],[3700,100],[3500,100]]);assert.deepEqual(ring,[[3500,0],[3600,0],[3600,100],[3500,100]]);
 const graph=urbanTrafficGraph({nodes:[[0,0],[1,0],[2,0],[1,1]],edges:[[0,1],[1,2],[1,3]],directions:[0,1,-1]});
 assert.deepEqual(graph,{nodes:[[0,0],[1,0]],edges:[[0,1]],directions:[0]});
});
