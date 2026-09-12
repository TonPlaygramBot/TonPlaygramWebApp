import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const temp=await mkdtemp(join(tmpdir(),'tirana-completion-'));
let api;
try{
 const file=join(temp,'runtime.mjs');
 await build({stdin:{contents:"export * as T from 'three';export {CityCompletionLayer} from './src/games/tirana-city-completion/CityCompletionLayer';export {FacadeCompletionLayer} from './src/games/tirana-city-completion/FacadeCompletionLayer';export {CITY_COMPLETION} from './src/games/tirana-city-completion/data.mjs';",resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm'});
 api=await import(pathToFileURL(file).href);
}finally{await rm(temp,{recursive:true,force:true});}
const {T,CityCompletionLayer,FacadeCompletionLayer,CITY_COMPLETION:C}=api;
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};
test('actual Blender batches remain bounded, finite and disposable across city/quality changes',()=>{
 const streets=new CityCompletionLayer(),facades=new FacadeCompletionLayer();
 let tick=0;for(const p of [{x:1182,z:201},{x:-550,z:-320},...C.fixtures.filter(p=>p.kind==='direction').slice(0,3),{x:8000,z:8000}])for(const battery of [false,true]){
  streets.update(++tick,p,battery);facades.update(tick,p,battery);
  for(const layer of [streets,facades])layer.group.traverse(o=>{if(!(o instanceof T.InstancedMesh))return;assert.ok(o.count<=o.instanceMatrix.count,o.name);assert.ok(o.count>=0);const a=o.instanceMatrix.array;for(let i=0;i<o.count*16;i++)assert.ok(Number.isFinite(a[i]));});
  const uv=streets.signs.geometry.getAttribute('instanceAtlas');for(let i=0;i<streets.signs.count;i++){assert.ok(uv.getX(i)>=0&&uv.getX(i)+uv.getZ(i)<=1.00001);assert.ok(uv.getY(i)>=0&&uv.getY(i)+uv.getW(i)<=1.00001);}
 }
 assert.equal(streets.signs.count,0);assert.equal(streets.lenses.count,0);assert.equal(streets.white.count,0);
 for(const layer of [streets,facades]){const resources=new Set();layer.group.traverse(o=>{if(o instanceof T.Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)resources.add(v);}}});let disposed=0;resources.forEach(r=>r.addEventListener('dispose',()=>disposed++));layer.dispose();layer.dispose();assert.equal(disposed,resources.size);assert.equal(layer.group.children.length,0);}
});
test('late updates cannot resurrect retired layers',()=>{const layer=new CityCompletionLayer();layer.dispose();layer.update(100,C.fixtures[0]);assert.equal(layer.group.children.length,0);});
