import assert from 'node:assert/strict';
import test from 'node:test';
import {makeTrack,normalizeTrack,TRACKS,CUPS} from '../webapp/src/games/kartroyale/simulation.mjs';
import {ghostKey} from '../webapp/src/games/kartroyale/ghostLap.mjs';
import {validateSeatTableRequest} from '../bot/config/onlineGamePolicy.js';
import {
  LANA_BOULEVARD_PREVIEW_ID as id,loadLanaBoulevardPreview
} from '../webapp/src/games/kartroyale/lanaBoulevardPreview.mjs';

const local={id,mode:'local-geometry-preview',optIn:true};
const legacyId='tirana-sulejman-delvina';
const canonical=()=>makeTrack(legacyId);
const seat=trackId=>validateSeatTableRequest({gameType:'kartroyale',stake:100,maxPlayers:2,matchMeta:{trackId,token:'TPG',mode:'online'}});

test('new route is available only through the explicit offline preview contract',()=>{
  assert.equal(loadLanaBoulevardPreview(),null);
  assert.equal(loadLanaBoulevardPreview(null),null);
  for(const args of [{optIn:false},{mode:'career'},{mode:'online'},{mode:'local'},{id:legacyId},{id:'blloku'},{optIn:'true'}])
    assert.equal(loadLanaBoulevardPreview({...local,...args}),null);
  const preview=loadLanaBoulevardPreview(local);
  assert.equal(preview.id,id);
  assert.equal(preview.previewOnly,true);
  assert.equal(preview.recordEligible,false);
  assert.equal(preview.onlineEligible,false);
  assert.ok(Math.abs(preview.length-2171.329863747408)<.001);
  assert.ok(preview.points.every(p=>p.width>=4.8));
  assert.notEqual(ghostKey(preview,'apex'),ghostKey(canonical(),'apex'));
});
test('shared network catalog and existing alias geometry are unchanged before and after preview',()=>{
  const track=canonical(), originalKey=ghostKey(track,'apex');
  const early=structuredClone(track.points);
  const oldCups=CUPS.map(c=>c.track);
  loadLanaBoulevardPreview(local);
  assert.equal(TRACKS.length,20);
  for(const alias of [legacyId,'blloku','neon']){
    assert.equal(normalizeTrack(alias),legacyId);
    assert.equal(makeTrack(alias),track);
    assert.ok(Math.abs(makeTrack(alias).length-1456.9591038435105)<.001);
  }
  assert.equal(ghostKey(track,'apex'),originalKey);
  assert.match(originalKey,/\.1793898406\.apex$/);
  assert.deepEqual(track.points,early);
  assert.deepEqual(CUPS.map(c=>c.track),oldCups);
  assert.equal(TRACKS.some(t=>t.id===id),false);
  assert.throws(()=>makeTrack(id),/unavailable/);
});
test('paid admission validates old alias using the canonical ID and rejects preview metadata',()=>{
  assert.equal(seat('blloku').safeMatchMeta.trackId,legacyId);
  assert.equal(seat('neon').safeMatchMeta.trackId,legacyId);
  assert.deepEqual(seat(id),{ok:false,error:'invalid_track'});
});
test('cold preview generation makes no storage or network accesses',async()=>{
  const touched=[];
  const globals=['localStorage','sessionStorage','fetch','WebSocket'];
  const originals=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const key of globals)Object.defineProperty(globalThis,key,{configurable:true,get(){
    touched.push(key);
    throw Error('Preview may not access '+key);
  }});
  try{
    const {loadLanaBoulevardPreview:load}=await import(
      '../webapp/src/games/kartroyale/lanaBoulevardPreview.mjs?cold-preview-fixture'
    );
    assert.equal(load(local).id,id);
    assert.deepEqual(touched,[]);
  }finally{
    for(const [key,desc] of originals) {
      if(desc)Object.defineProperty(globalThis,key,desc);
      else delete globalThis[key];
    }
  }
});
