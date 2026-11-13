import test from 'node:test';
import assert from 'node:assert/strict';
import {KART_LENGTH,KART_WIDTH,KART_SCALE,MIN_PASSING_WIDTH,kartPassingRoom} from '../webapp/src/games/kartroyale/racingDimensions.mjs';
import {segmentHasClearance,widenPassingSections} from '../webapp/src/games/kartroyale/passingClearance.mjs';
import {circuitSides} from '../webapp/src/games/kartroyale/trackEdges.mjs';
const sides=points=>circuitSides(points,2.4);
const square=(width=2.2)=>({width,points:[{x:0,z:0,width},{x:20,z:0,width},{x:20,z:20,width},{x:0,z:20,width}]});
const free=()=>24;

test('karts shrink uniformly to two metres rather than rescaling the city',()=>{
 assert.equal(KART_LENGTH,2);assert.ok(Math.abs(KART_WIDTH-1.72*KART_SCALE)<1e-12);
 assert.ok(KART_SCALE<.75&&KART_SCALE>.73);
});
test('two kart lane centres leave half a metre of body-to-body space',()=>{
 const lane=.9;assert.ok(2*lane-KART_WIDTH>.5);
 assert.ok(MIN_PASSING_WIDTH/2-lane-KART_WIDTH/2>.8);
 assert.ok(kartPassingRoom(MIN_PASSING_WIDTH)>=lane);
});
test('AI room follows the body width and clamps invalid or narrow roads',()=>{
 assert.ok(kartPassingRoom(4.8)>1.3);assert.equal(kartPassingRoom(1),0);
 assert.equal(kartPassingRoom(100),2.2);assert.equal(kartPassingRoom(NaN),0);
 assert.equal(kartPassingRoom(4.8,-1),0);assert.ok(kartPassingRoom(4.8,2)<kartPassingRoom(4.8));
});
test('continuous probe checks reject an obstruction between sample points',()=>{
 const a={x:0,z:0},b={x:1,z:0},distance=(x,z)=>Math.hypot(x-.5,z);
 assert.ok(distance(0,0)>.2&&distance(1,0)>.2);
 assert.equal(segmentHasClearance(a,b,.2,distance,1),false);
});
test('clear segments are certified, including zero-length probes',()=>{
 assert.equal(segmentHasClearance({x:0,z:0},{x:30,z:0},3,free),true);
 assert.equal(segmentHasClearance({x:0,z:0},{x:0,z:0},3,()=>3),true);
});
test('invalid geometry and unknown clearance cannot be certified',()=>{
 assert.throws(()=>segmentHasClearance({x:NaN,z:0},{x:1,z:0},1,free));
 assert.throws(()=>segmentHasClearance({x:0,z:0},{x:1,z:0},1,free,0));
 assert.equal(segmentHasClearance({x:0,z:0},{x:1,z:0},1,()=>NaN),false);
 assert.throws(()=>widenPassingSections(square(NaN),{clearance:free,sides}));
});
test('open dry shoulders reach the two-lane minimum without moving the route',()=>{
 const track=square(),coords=track.points.map(p=>[p.x,p.z]);
 const audit=widenPassingSections(track,{clearance:free,sides});
 assert.equal(audit.minimumWidth,4.8);assert.equal(audit.widenedSamples,4);
 assert.equal(audit.unresolved.length,0);assert.deepEqual(track.points.map(p=>[p.x,p.z]),coords);
});
test('wider original roads are never narrowed by the passing fitter',()=>{
 const track=square(9);const audit=widenPassingSections(track,{clearance:free,sides});
 assert.equal(audit.minimumWidth,9);assert.equal(audit.widenedSamples,0);assert.equal(track.width,9);
});
test('buildings or water leave explicit unresolved bottlenecks, never false success',()=>{
 const track=square();const audit=widenPassingSections(track,{clearance:()=>1,sides});
 assert.equal(audit.widenedSamples,0);assert.equal(audit.unresolved.length,4);
 assert.equal(audit.minimumWidth,2.2);assert.equal(audit.unresolved[0].index,0);
});
test('joined corner extent, not nominal half width, governs obstacle clearance',()=>{
 const track=square();const audit=widenPassingSections(track,{clearance:()=>3,sides});
 assert.equal(audit.widenedSamples,0); // 4.8m square corners extend 3.394m from their centre.
 assert.equal(audit.unresolved.length,4);
});
test('an interior segment obstruction is found even with clear route vertices',()=>{
 const track=square(),clearance=(x,z)=>Math.hypot(x-10,z);
 assert.ok(track.points.every(p=>clearance(p.x,p.z)>5));
 const audit=widenPassingSections(track,{clearance,sides});
 assert.ok(audit.unresolved.some(p=>p.index===0));assert.ok(audit.unresolved.some(p=>p.index===1));
});
test('safe distant sections can widen while the blocked section remains unchanged',()=>{
 const track=square(),clearance=(x,z)=>Math.hypot(x-10,z);
 const audit=widenPassingSections(track,{clearance,sides});
 assert.equal(track.points[0].width,2.2);assert.equal(track.points[1].width,2.2);
 assert.equal(track.points[2].width,4.8);assert.equal(track.points[3].width,4.8);
 assert.equal(audit.widenedSamples,2);
});
test('fitting is deterministic and re-running does not keep growing roads',()=>{
 const a=square(),b=square(),options={clearance:free,sides};
 assert.deepEqual(widenPassingSections(a,options),widenPassingSections(b,options));
 const before=structuredClone(a);widenPassingSections(a,options);assert.deepEqual(a,before);
});
test('continuous certification has no false positives against analytic circle distance',()=>{
 let seed=9127;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 for(let i=0;i<300;i++){
  const a={x:random()*8,z:random()*8},b={x:random()*8,z:random()*8};
  const obstacle={x:random()*8,z:random()*8},radius=random()*2;
  const clearance=(x,z)=>Math.hypot(x-obstacle.x,z-obstacle.z);
  if(!segmentHasClearance(a,b,radius,clearance))continue;
  const dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,((obstacle.x-a.x)*dx+(obstacle.z-a.z)*dz)/(lengthSq||1)));
  assert.ok(clearance(a.x+t*dx,a.z+t*dz)>=radius);
 }
});
