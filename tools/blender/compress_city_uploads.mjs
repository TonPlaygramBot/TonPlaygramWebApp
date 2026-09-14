/** Run after tirana_mobility.py; preserves triangle topology and embeds textures. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const folder=root+'webapp/public/assets/tirana-streets/city-mobility/';
const manifest=JSON.parse(readFileSync(folder+'manifest.json'));
const catalog=root+'webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
let source=readFileSync(catalog,'utf8');
for(const id of ['namazgjah','golf-gti']){
 const input=folder+id+'.glb',output=folder+id+'.compressed.glb';
 execFileSync('npx',['--yes','@gltf-transform/cli@4.2.1','draco',input,output,'--quantize-position','16'],{stdio:'inherit'});renameSync(output,input);
 const bytes=readFileSync(input),sha256=createHash('sha256').update(bytes).digest('hex');
 Object.assign(manifest[id],{bytes:bytes.length,sha256,compression:'Draco 16-bit positions; original triangle topology'});
 if(id==='namazgjah')manifest[id].ground='Main scan plinth at the 10th vertex-height percentile; below-plinth scan fragments intersect terrain';
 if(id==='golf-gti'){
  source=source.replace(/("id":"golf-gti"[^\n]*?"sha256":")[^"]+/,`$1${sha256}`);
  source=source.replace(/("id":"golf-gti"[^\n]*?"bytes":)\d+/,`$1${bytes.length}`);
 }
}
writeFileSync(folder+'manifest.json',JSON.stringify(manifest,null,2)+'\n');writeFileSync(catalog,source);
