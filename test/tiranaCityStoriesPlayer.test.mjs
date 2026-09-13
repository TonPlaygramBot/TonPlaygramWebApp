import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),require=createRequire(join(webapp,'package.json'));
const dir=await mkdtemp(join(webapp,'.city-stories-player-test-'));
after(()=>rm(dir,{recursive:true,force:true}));
const file=join(dir,'player.mjs');
await build({stdin:{contents:"export {CareerPlayer} from './src/games/tiranastreets/career/CareerPlayer';export {CareerRuntime} from './src/games/tiranastreets/career/CareerRuntime';export {BattlefieldPlayer} from './src/games/blackwater/BattlefieldPlayer';export {selectPlayerAsset} from './src/games/tiranastreets/playerCatalog.mjs';",resolveDir:webapp,loader:'ts'},outfile:file,bundle:true,format:'esm',platform:'node',external:['three','three/*'],logLevel:'silent',plugins:[{
  name:'headless-texture-decoder',setup(build){
    build.onResolve({filter:/^three\/examples\/jsm\/loaders\/GLTFLoader\.js$/},()=>({path:'headless-loader',namespace:'test'}));
    build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`import {GLTFLoader as Original} from ${JSON.stringify(require.resolve('three/examples/jsm/loaders/GLTFLoader.js'))};import {Texture} from 'three';export class GLTFLoader extends Original {constructor(){super();this.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new Texture()}));}}`,loader:'js',resolveDir:webapp}));
  }
}]});
const {CareerPlayer,CareerRuntime,BattlefieldPlayer,selectPlayerAsset}=await import(pathToFileURL(file));
const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
globalThis.window={location:{href:'https://game.example/games/tiranastreets?activity=career'}};
after(()=>{globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;});
const asset=id=>({id,url:`/assets/tirana-streets/players/${id}.glb`});
const response=async url=>new Response(await readFile(join(webapp,'public',new URL(url).pathname)));

test('City Stories and Operations cannot silently replace a missing player choice with a default skin',async()=>{
  let requests=0;globalThis.fetch=async()=>{requests++;throw Error('Unexpected fallback');};
  for(const Type of [CareerPlayer,BattlefieldPlayer]){
    const scene=new T.Scene(),player=new Type(scene);
    await player.load();assert.match(player.errors[0],/Choose a player/);assert.equal(requests,0);player.dispose();assert.equal(scene.children.length,0);
  }
});
for(const id of ['tactical','polish','agent-47'])test(`City Stories loads ${id}, uses its body, and hides it during the authored cable trip`,async()=>{
  selectPlayerAsset(asset(id));let requests=0;globalThis.fetch=async url=>{requests++;assert.equal(new URL(url).pathname,asset(id).url);return response(url);};
  const scene=new T.Scene(),player=new CareerPlayer(scene),a=player.load(),b=player.load();
  assert.equal(a,b,'one in-flight download');assert.equal(player.ready,false);await a;
  assert.equal(player.ready,true);assert.deepEqual(player.errors,[]);assert.equal(requests,1);
  player.update({x:12,z:-4,yaw:.7,pitch:-.4,speed:3,time:1,hidden:false},1/60);
  const body=scene.getObjectByName('Tirana:city-stories-player');assert.ok(body);assert.equal(body.position.x,12);assert.equal(body.position.z,-4);
  assert.ok(Math.abs(body.rotation.y-(.7+Math.PI))<1e-6,'body follows the existing look heading');
  assert.equal(scene.getObjectByName('first-person-held-weapon').visible,false,'City Stories stays unarmed');
  player.update({x:12,z:-4,yaw:.7,pitch:-.4,speed:0,time:2,hidden:true},1/60);assert.equal(body.visible,false);
  player.update({x:12,z:-4,yaw:.7,pitch:-.4,speed:0,time:3,hidden:false},1/60);assert.equal(body.visible,true);
  player.dispose();assert.equal(player.ready,false);assert.equal(scene.children.length,0);
});
test('a failed City Stories player download stays blocked and can retry the same selected original',async()=>{
  selectPlayerAsset(asset('polish'));let attempts=0;globalThis.fetch=async url=>++attempts===1?new Response('',{status:503}):response(url);
  const player=new CareerPlayer(new T.Scene());await player.load();assert.equal(player.ready,false);assert.match(player.errors[0],/503/);
  await player.load();assert.equal(player.ready,true);assert.deepEqual(player.errors,[]);assert.equal(attempts,2);player.dispose();
});
test('leaving City Stories during download prevents a late model from entering the disposed scene',async()=>{
  selectPlayerAsset(asset('agent-47'));let release;const gate=new Promise(resolve=>{release=resolve;});
  globalThis.fetch=async url=>{await gate;return response(url);};
  const scene=new T.Scene(),player=new CareerPlayer(scene),pending=player.load();player.dispose();release();await pending;
  assert.equal(player.ready,false);assert.equal(scene.children.length,0);assert.deepEqual(player.errors,[]);
});
test('Operations prepares the lobby weapon before its selected body finishes loading',async()=>{
  selectPlayerAsset(asset('polish'));globalThis.fetch=async url=>response(new URL(url,'https://game.example'));
  const scene=new T.Scene(),player=new BattlefieldPlayer(scene);let prepared;
  player.rig.prepare=async weapon=>{prepared=weapon;};
  await player.load('sigsauer');assert.deepEqual(player.errors,[]);assert.equal(prepared,'sigsauerTacticalAttack');
  assert.ok(scene.getObjectByName('Tirana:player-body'));player.dispose();assert.equal(scene.children.length,0);
});
test('City Stories runtime gates resume and chapter changes until the chosen body is ready',()=>{
  const game=Object.create(CareerRuntime.prototype);let emits=0,starts=0,clears=0;
  Object.assign(game,{playerVisual:{ready:false},paused:true,input:{active:false,clear:()=>clears++},audio:{start:()=>starts++},emit:()=>emits++});
  game.resume();game.select('anything');assert.equal(game.paused,true);assert.equal(game.input.active,false);assert.equal(starts,0);assert.equal(clears,0);
  game.playerVisual.ready=true;game.resume();assert.equal(game.paused,false);assert.equal(game.input.active,true);assert.equal(starts,1);assert.equal(clears,1);assert.equal(emits,2);
});
