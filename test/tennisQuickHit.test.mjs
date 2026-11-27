import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createMatch, canQueueSwing } from '../shared/tennis/engine.js';
import { TAP_POWER } from '../shared/tennis/swipe.js';
const src = fs.readFileSync(new URL('../webapp/src/games/tennis/Game.tsx',import.meta.url),'utf8');
const body = src.slice(src.indexOf('  const canHit ='),src.indexOf('  const tour = TOUR[career.tour];'));

function setup({ phase, server=0, paused=false, confirmExit=false, online=null, active=null, own=0 }) {
  const match=createMatch();
  match.phase=phase;
  match.score.server=server;
  const operations=[];
  const input={direction:[4,9]};
  const ctx={screen:'match', pausedRef:{current:paused}, confirmExit, roomRef:{current:online},
    room:online, paused, own, hud:match, TAP_POWER, canQueueSwing, frame:{current:match}, pointer:{current:active},
    input:{current:input}, renderer:{current:{shotDirection:(dx,dy)=>{assert.equal(dx,0);assert.equal(dy,0);return null;}}},
    chooseAim:v=>operations.push(['aim',v]), unlock:()=>operations.push(['unlock']), release:p=>operations.push(['release',p])};
  vm.runInNewContext(body+'\nresult={quickHit,canQuickHit};',ctx);
  return {...ctx.result, input, operations, match};
}
test('quick hit is a semantic one-tap fallback alongside swipe',()=>{
  assert.match(src, /className="tr-quick-hit"\s+disabled=\{!canQuickHit\}[\s\S]*?onClick=\{quickHit\}/);
  assert.match(src, /onPointerUp=\{finishCourtTouch\}/);
});
test('own serve and opponent toss can queue ordinary centre tap power',()=>{
  for(const config of [{phase:'serve'}, {phase:'toss',server:1},{phase:'rally'}]){
    const f=setup(config);
    assert.equal(f.canQuickHit,true);
    f.quickHit();
    assert.equal(f.input.direction,null);
    assert.deepEqual(f.operations,[['aim',0],['unlock'],['release',TAP_POWER]]);
  }
});
test('blocking states cannot queue a swing or steal an active swipe',()=>{
  for(const config of [{phase:'toss'},{phase:'serve',server:1},{phase:'over'},
    {phase:'rally', paused:true},{phase:'rally',confirmExit:true},
    {phase:'rally',online:{joined:false}},{phase:'rally',active:3}]){
    const f = setup(config);
    if (!config.active) assert.equal(f.canQuickHit,false);
    f.quickHit();
    assert.deepEqual(f.operations,[]);
  }
});
test('an authoritative phase change since render still rejects stale click',()=>{
  const f=setup({phase:'rally'});
  assert.equal(f.canQuickHit,true);
  f.match.phase='over';
  f.quickHit();
  assert.deepEqual(f.operations,[]);
});
