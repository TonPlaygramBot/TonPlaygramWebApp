import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchGameGlb} from '../webapp/src/games/tiranastreets/fetchGameGlb.mjs';
import {nearestRoadIndex,placementObstacleIndex} from '../webapp/src/games/blackwater/shared/placementIndex.mjs';
import {footprintDistance} from '../webapp/src/games/tiranastreets/shared/architecture.mjs';
const valid=()=>{const b=new ArrayBuffer(12),v=new DataView(b);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,12,true);return b;};
test('502 retries download and returns GLB bytes',async t=>{
 let calls=0;const retries=[];
 t.mock.method(globalThis,'fetch',async()=>++calls===1?new Response('Bad gateway',{status:502}):new Response(valid()));
 assert.equal((await fetchGameGlb('/operator.glb',{onRetry:n=>retries.push(n)})).byteLength,12);
 assert.equal(calls,2);assert.deepEqual(retries,[2]);
});
test('404 and HTML bodies fail without repeated requests',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('Not found',{status:404});});
 await assert.rejects(fetchGameGlb('/operator.glb'),/404/);assert.equal(calls,1);
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>gateway error</html>'));
 await assert.rejects(fetchGameGlb('/operator.glb'),/Invalid model/);
});
test('timeout is bounded and leaving cancels an active download',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',(_url,{signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
 await assert.rejects(fetchGameGlb('/operator.glb',{attempts:1,timeoutMs:10}),/timed out/);
 const controller=new AbortController(),pending=fetchGameGlb('/operator.glb',{signal:controller.signal});controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,2);
});
test('streaming budget rejects oversized model bodies',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(100)));
 await assert.rejects(fetchGameGlb('/operator.glb',{maxBytes:50}),/budget/);
});
test('road BVH preserves nearest segment, zero lengths and source-order ties',()=>{
 const roads=Array.from({length:70},(_,i)=>({a:[i*3-80,(i%7)*20-50],b:[i*3-70,(i%11)*20-40]}));roads.push({a:[0,0],b:[0,0]}, {a:[0,0],b:[0,0]});
 const near=nearestRoadIndex(roads);
 for(let x=-100;x<=130;x+=7)for(let z=-80;z<=170;z+=11){
  let best,distance=Infinity;for(const r of roads){const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-r.a[0])*dx+(z-r.a[1])*dz)/l)):0,px=r.a[0]+dx*t,pz=r.a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d<distance){distance=d;best={x:px,z:pz,road:r,distance:d};}}
  assert.deepEqual(near(x,z),best);
 }
 assert.equal(near(0,0).road,roads[70]);
});
test('obstacle index matches full scan including courtyards and newly placed fleet',()=>{
 const obstacles=[{x:0,z:0,w:40,d:40,footprint:[[-20,-20],[20,-20],[20,20],[-20,20]],holes:[[[-8,-8],[-8,8],[8,8],[8,-8]]]},{x:80,z:80,w:20,d:40}];
 const index=placementObstacleIndex(obstacles,16);
 const check=()=>{for(let x=-35;x<=110;x+=3)for(let z=-35;z<=110;z+=4)for(const r of [.5,4,15])assert.equal(index.clear(x,z,r),!obstacles.some(o=>o.footprint?footprintDistance(x,z,o.footprint,o.holes)<r:Math.hypot(x-o.x,z-o.z)<Math.hypot(o.w,o.d)/2+r));};
 check();const vehicle={x:0,z:0,w:4,d:7};obstacles.push(vehicle);index.add(vehicle);check();
});
test('player startup uses the existing backup rig when the primary asset is unavailable',async t=>{
 const {build}=await import('../webapp/node_modules/esbuild/lib/main.js');
 const built=await build({entryPoints:['webapp/src/games/tiranastreets/loadPlayerGltf.ts'],bundle:true,write:false,format:'esm',platform:'node'});
 const {loadPlayerGltf}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const urls=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(String(url));return String(url).endsWith('/operator.glb')?new Response('missing',{status:404}):new Response(valid());});
 const expected={scene:{name:'backup'},animations:[]};
 const result=await loadPlayerGltf({parseAsync:async()=>expected},new AbortController().signal);
 assert.equal(result,expected);assert.deepEqual(urls,['/assets/tirana-streets/living/operator.glb','/assets/tirana-streets/living/suited-agent.glb']);
});
