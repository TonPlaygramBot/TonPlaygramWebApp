import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sources=new URL('../webapp/src/games/tiranastreets-november/street-career/',import.meta.url);
const local=new URL('./candidate/webapp/src/games/tiranastreets-november/street-career/',import.meta.url);
const src=fs.existsSync(new URL('storyReturnPreview.mjs',local))?local:sources;
const {
 readReturnPreview, saveReturnPreview, returnWorldStorage,
 stepReturnPreview, storyReturnEnabled
} = await import(new URL('storyReturnPreview.mjs',src));
const storage=()=>{
 const map = new Map();
 return {getItem:k=>map.get(k)??null, setItem:(k,v)=>map.set(k,v)};
};
const stops=[{x:0,z:0},{x:100,z:50}];
const approach=(x,z,driving)=>({type:'position',x,z,driving});
test('explicit flag only; normal career, preferences and story save are distinct',()=>{
 assert.equal(storyReturnEnabled('?storyPreview=ch01-return'),true);
 for(const input of ['','?storyPreview=1','?mission=ch01-return'])assert.equal(storyReturnEnabled(input),false);
 const s=storage(),world=returnWorldStorage(s);
 s.setItem('career','existing');world.setItem('career','preview');
 assert.equal(s.getItem('career'),'existing');
 assert.equal(world.getItem('career'),'preview');
 assert.equal(readReturnPreview(s).stage,'call');
});
test('fictional call, sequential driving checkpoints, dialog and persistent branch',()=>{
 for(const outcome of ['call-back','read-note']){
  const s=storage(),a=readReturnPreview(s);
  assert.strictEqual(stepReturnPreview(a,approach(0,0,true),stops),a);
  const b=stepReturnPreview(a,{type:'listen'},stops);
  assert.strictEqual(stepReturnPreview(b,approach(0,0,false),stops),b);
  assert.strictEqual(stepReturnPreview(b,approach(100,50,true),stops),b);
  const c=stepReturnPreview(b,approach(11.5,0,true),stops);
  assert.equal(c.stop,1);
  assert.strictEqual(stepReturnPreview(c,approach(0,0,true),stops),c);
  const d=stepReturnPreview(c,approach(100,50,true),stops);
  assert.equal(d.stage,'choice');
  assert.strictEqual(stepReturnPreview(d,{type:'choose',outcome:'bad'},stops),d);
  const e=stepReturnPreview(d,{type:'choose',outcome},stops);
  assert.equal(e.stage,'complete');assert.equal(e.outcome,outcome);
  assert.equal(saveReturnPreview(s,e),true);
  assert.deepEqual(readReturnPreview(s),e);
  assert.strictEqual(stepReturnPreview(e,{type:'choose',outcome},stops),e);
 }
});
test('malformed saves and denied storage never claim a persisted choice',()=>{
 assert.equal(readReturnPreview({getItem:()=>JSON.stringify({stage:'complete',stop:0,outcome:'call-back'})}).stage,'call');
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 const e=readReturnPreview(denied);assert.equal(e.stage,'call');assert.equal(saveReturnPreview(denied,e),false);
});
test('live Career is unchanged unless opt-in and account preload is skipped',()=>{
 const url=src;
 const ui=fs.readFileSync(new URL('StreetCareerGame.tsx',url),'utf8');
 const runtime=fs.readFileSync(new URL('StreetCareerRuntime.ts',url),'utf8');
 assert.match(ui,/storyPreview\?returnWorldStorage\(storage\(\)\):storage\(\)/);
 assert.match(ui,/!storyPreview && initialOperation/);
 assert.ok(ui.indexOf("const [session, setSession]")<ui.indexOf("story.stop,session]"));
 assert.match(ui,/setDestination\(stop\?/);
 assert.match(runtime,/if \(!this.storyPreview\) void loadWeaponStoreAccount\(\)/);
 assert.match(runtime,/economyAction\([^]*?if \(this.storyPreview\) return false/);
 assert.match(runtime,/openWallet\([^]*?if \(this.storyPreview\) return;/);
 assert.match(ui,/onClear=\{storyPreview && story.stage==='drive'\?undefined/);
 assert.match(ui,/onDestination=\{storyPreview && story.stage==='drive'\?undefined/);
 assert.match(ui,/jobs=\{storyPreview\?\[\]/);
});
