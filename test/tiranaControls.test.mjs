import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require = createRequire(new URL('../webapp/package.json', import.meta.url));
const {build} = require('esbuild');
const temp = await mkdtemp(join(tmpdir(), 'tirana-controls-test-'));

await build({entryPoints:[new URL('../webapp/src/games/tiranastreets/renderSettings.ts',import.meta.url).pathname],outfile:join(temp,'renderSettings.mjs'),bundle:true,platform:'node',format:'esm'});
const {FramePacer, FRAME_RATES, targetFps, CITY_RADIUS, beginCityFrame, runCityWork} = await import(pathToFileURL(join(temp,'renderSettings.mjs')));


test.after(()=>rm(temp,{recursive:true,force:true}));
for (const hz of [60,90,120]) for (const fps of FRAME_RATES) {
  test(`${fps} FPS target on ${hz} Hz display retains frame deadlines`,()=>{
    const pacer=new FramePacer();let count=0;
    for(let i=0;i<hz*10;i++)if(pacer.shouldRender(i*1000/hz,fps))count++;
    assert.ok(Math.abs(count-Math.min(fps,hz)*10)<=1,`${count} frames`);
  });
}
test('changing targets applies immediately and a background gap never bursts',()=>{
  const p=new FramePacer();assert.equal(p.shouldRender(0,50),true);
  assert.equal(p.shouldRender(8,50),false);assert.equal(p.shouldRender(8,120),true);
  assert.equal(p.shouldRender(30000,120),true);assert.equal(p.shouldRender(30000,120),false);
});
test('every career weapon thumbnail is present and is a small WebP',async()=>{
  const {WEAPONS}=await import('../webapp/src/games/tiranastreets/shared/weapons.mjs');
  for(const w of WEAPONS.filter(w=>!['fpsGunAttack','punch','egg','tomato'].includes(w.id))){
    const b=await readFile(`webapp/public/assets/tirana-streets/weapon-thumbnails/${w.id}.webp`);
    assert.equal(b.toString('utf8',8,12),'WEBP',w.id);assert.ok(b.length<30000,w.id);
  }
  assert.ok(CITY_RADIUS.high>2400);assert.ok(CITY_RADIUS.battery>1400);
});

test('shared CPU budget is bounded and legacy direct hosts start a fresh frame',()=>{
  let calls=0,blocked=0;
  const slow={run(){calls++;const until=performance.now()+5;while(performance.now()<until){}}};
  const other={run(){blocked++;}};
  beginCityFrame(120);runCityWork(slow,false);runCityWork(other,false);
  assert.equal(calls,1);assert.equal(blocked,0);
  runCityWork(slow,false);assert.equal(calls,2);
});
