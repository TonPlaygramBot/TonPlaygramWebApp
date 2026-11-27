import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachSnakeSoundBank } from '../webapp/src/utils/snakeSoundBank.js';
class Media {
 constructor(){this.pauses=0;}
 pause(){this.pauses++;}
 removeAttribute(name){if(name==='src')this.src='';}
}
test('guest practice owns lazy sounds without requiring a profile',()=>{
 const a={current:null},b={current:null};
 const clean=attachSnakeSoundBank([[a,'/move.mp3'],[b,'/ladder.mp3']],{volume:.35,muted:true},Media);
 const sound=b.current;
 assert.equal(sound.src,'/ladder.mp3');
 assert.equal(sound.preload,'none');
 assert.equal(sound.volume,.35);
 assert.equal(sound.muted,true);
 sound.muted=false;
 assert.equal(b.current,sound);
 clean();
 assert.equal(sound.pauses,1);
 assert.equal(sound.src,'');
 assert.equal(b.current,null);
});
test('older teardown does not clear an independently assigned replacement',()=>{
 const a={current:null};
 const clean=attachSnakeSoundBank([[a,'/snake.mp3']],{volume:1,muted:false},Media);
 const old=a.current;
 a.current=new Media();
 clean();
 assert.equal(old.pauses,1);
 assert.ok(a.current);
});
