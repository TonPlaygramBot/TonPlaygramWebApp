import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../webapp/src/games/royallanes/touch.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {resolveGesture,BowlingTouch}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const p=(x,y,t)=>({x,y,t});
test('screen-right drag aims right and upward swipe bowls; downward movement cannot bowl',()=>{assert.ok(resolveGesture([p(100,600,0),p(180,605,200)],390,844,0).aim>0);assert.ok(resolveGesture([p(180,600,0),p(100,605,200)],390,844,0).aim<0);assert.equal(resolveGesture([p(100,600,0),p(100,350,200)],390,844,0).kind,'roll');assert.equal(resolveGesture([p(100,350,0),p(100,600,200)],390,844,0).kind,'cancel');});
test('curving toward the right side of the phone adds right hook without reversing direction',()=>{const right=resolveGesture([p(160,700,0),p(160,530,200),p(225,460,280)],390,844,0);const left=resolveGesture([p(160,700,0),p(160,530,200),p(95,460,280)],390,844,0);assert.ok(right.shot.hook>0);assert.ok(left.shot.hook<0);assert.ok(right.shot.power>=35&&right.shot.power<=100);});
function input(){const handlers=new Map(),events=[];const el={clientWidth:390,clientHeight:844,addEventListener:(key,fn)=>handlers.set(key,fn),removeEventListener:key=>handlers.delete(key),setPointerCapture:()=>{}};const touch=new BowlingTouch(el,{ready:()=>true,onAim:v=>events.push(['aim',v]),onRoll:s=>events.push(['roll',s]),onPause:()=>events.push(['pause']),onTap:()=>events.push(['tap']),onInteraction:()=>{}});return {touch,events,handlers,send:(type,id,x,y)=>handlers.get(type)?.({pointerId:id,clientX:x,clientY:y})};}
test('cancelled touches and two-finger gestures cannot accidentally launch a TPG roll',()=>{const f=input();f.send('pointerdown',1,100,650);f.send('pointermove',1,100,430);f.send('pointercancel',1,100,430);f.send('pointerup',1,100,400);assert.equal(f.events.filter(e=>e[0]==='roll').length,0);f.send('pointerdown',2,100,650);f.send('pointerdown',3,180,650);f.send('pointerup',2,100,400);f.send('pointerup',3,180,400);assert.equal(f.events.filter(e=>e[0]==='roll').length,0);assert.equal(f.events.filter(e=>e[0]==='pause').length,1);f.touch.dispose();assert.equal(f.handlers.size,0);});

test('hold then swipe has the same release power as an immediate swipe', () => {
  const immediate = resolveGesture(
    [p(160, 700, 900), p(160, 600, 960), p(160, 430, 1040)],
    390,
    844,
    0
  );
  const held = resolveGesture(
    [p(160, 700, 0), p(160, 700, 900), p(160, 600, 960), p(160, 430, 1040)],
    390,
    844,
    0
  );
  assert.equal(held.kind, 'roll');
  assert.equal(held.shot.power, immediate.shot.power);
});
test('mostly sideways swipes remain aim gestures and invalid samples cannot become shots', () => {
  assert.equal(
    resolveGesture([p(30, 650, 0), p(310, 560, 180)], 390, 844, 0).kind,
    'aim'
  );
  assert.equal(
    resolveGesture([p(160, 700, 0), p(NaN, 430, 140)], 390, 844, 0).kind,
    'cancel'
  );
});
