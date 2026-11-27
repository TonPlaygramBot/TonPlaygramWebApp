import assert from 'node:assert/strict';
import test from 'node:test';
import {HYDROGRAPHY} from '../webapp/src/games/tirana-environment/hydrography.mjs';
import {CHANNEL_LINER_RUN,channelWaterMargin,offsetRiver,riverFlowOrigins}
 from '../webapp/src/games/tirana-environment/riverShapeCore.mjs';

test('both existing Lana water levels meet the sloped liner without changing the datum', () => {
 const bed=-3.35,shoulder=-1.6;
 for (const [level,expected] of [[-2.85,.743],[-2.15,1.783]]) {
  const physical = CHANNEL_LINER_RUN*(level-bed)/(shoulder-bed);
  const visible = channelWaterMargin(level,bed,shoulder);
  assert.ok(Math.abs(physical-expected)<.001);
  assert.ok(visible-physical>.025 && visible-physical<.045);
 }
 assert.equal(channelWaterMargin(-4,bed,shoulder),0);
 assert.equal(channelWaterMargin(0,bed,shoulder),CHANNEL_LINER_RUN);
 assert.equal(channelWaterMargin(0,bed,bed),0);
});

test('liner intersection is linear through the mapped Lana bends', () => {
 const path = HYDROGRAPHY.paths.find(p=>p.id==='733080610');
 const f=(-2.15+3.35)/(-1.6+3.35);
 for (const side of [-1,1]) {
  const bottom=offsetRiver(path.line,side*path.width/2);
  const top=offsetRiver(path.line,side*(path.width/2+CHANNEL_LINER_RUN));
  const contact=offsetRiver(path.line,side*(path.width/2+CHANNEL_LINER_RUN*f));
  for(let i=0;i<contact.length;i++)for(let axis=0;axis<2;axis++)
   assert.ok(Math.abs(contact[i][axis]-(bottom[i][axis]+(top[i][axis]-bottom[i][axis])*f))<1e-8);
 }
});

test('connected source ways align animation phase at their joint regardless of input order', () => {
 const first={id:'a',width:8,lana:true,line:[[10,0],[10,20]]};
 const second={...first,id:'b',line:[[10,20],[20,20]]};
 const third={...first,id:'c',line:[[20,20],[20,10]]};
 const phase=riverFlowOrigins([third,second,first]);
 assert.equal(phase.get('b')-phase.get('a'),20);
 assert.equal(phase.get('c')-phase.get('b'),10);
 const all=HYDROGRAPHY.paths;
 const field=riverFlowOrigins(all);
 assert.equal(field.size,all.length);
 assert.ok([...field.values()].every(Number.isFinite));
});
