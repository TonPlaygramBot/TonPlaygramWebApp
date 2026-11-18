import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
const source=readFileSync(new URL('../webapp/src/games/kartroyale/KartExhaust.ts',import.meta.url),'utf8');
const threeUrl=new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).href;
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'three'",JSON.stringify(threeUrl));
const {KartExhaust}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const racer=()=>({speed:20,throttle:1,boost:50,turbo:0,input:{boost:false},retired:false,finished:false,disconnected:false,braking:false});
test('exhaust uses a fixed pool and only emits flame under powered boost',()=>{
 const e=new KartExhaust(),r=racer(),count=e.root.children.length;
 for(let i=0;i<60;i++)e.update(r,1/60,i/60,false);
 assert.equal(e.root.children.filter(o=>o.geometry.type==='ConeGeometry'&&o.visible).length,0);
 assert.equal(e.root.children.filter(o=>o.geometry.type==='IcosahedronGeometry'&&o.visible).length,5);
 r.input.boost=true;
 for(let i=0;i<60;i++)e.update(r,1/60,i/60,false);
 assert.equal(e.root.children.filter(o=>o.geometry.type==='ConeGeometry'&&o.visible).length,2);
 r.braking=true;
 for(let i=0;i<120;i++)e.update(r,1/60,i/60,false);
 assert.equal(e.root.children.filter(o=>o.geometry.type==='ConeGeometry'&&o.visible).length,0);
 assert.equal(e.root.children.length,count);
});
test('stopped/retired engines and reduced motion suppress smoke',()=>{
 for(const props of [{retired:true},{finished:true},{disconnected:true},{throttle:0}]){
  const e=new KartExhaust();e.update({...racer(),...props},1,1,false);
  assert.ok(e.root.children.filter(o=>o.geometry.type==='IcosahedronGeometry').every(o=>!o.visible));
 }
 const e=new KartExhaust();e.update(racer(),1,1,true);
 assert.ok(e.root.children.filter(o=>o.geometry.type==='IcosahedronGeometry').every(o=>!o.visible));
});
