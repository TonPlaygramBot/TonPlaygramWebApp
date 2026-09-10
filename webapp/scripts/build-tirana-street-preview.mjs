import {build} from 'esbuild';
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {STREET_VIEWS} from '../src/games/tirana-street-life/streetViews.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const photos={};
for(const name of new Set(STREET_VIEWS.map(p=>p.photo).filter(Boolean))){
 const bytes=await sharp(path.join(root,'public/assets/tirana-streets/references',name)).resize({width:440,height:300,fit:'inside',withoutEnlargement:true}).jpeg({quality:67}).toBuffer();
 photos[name]='data:image/jpeg;base64,'+bytes.toString('base64');
}
const near=p=>STREET_VIEWS.some(v=>Math.hypot(p[0]-v.x,p[1]-v.z)<v.context+10);
const subset={...WORLD,buildings:WORLD.buildings.filter(b=>b.p.some(near)),roads:WORLD.roads.filter(r=>near(r.a)||near(r.b)).map(({a,b,w,walk})=>({a,b,w,walk})),parks:WORLD.parks.filter(p=>p.some(near)),water:[],sourceSha256:WORLD.sourceSha256};
const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Explorer from './src/games/tirana-street-life/StreetLifeExplorer';createRoot(document.getElementById('tirana-street-preview')).render(React.createElement(Explorer,{photos:${JSON.stringify(photos)}}));`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',minify:true,jsx:'automatic',target:'es2022',external:['react','react/*','react-dom/*','three','three/*'],plugins:[{name:'street-review-world',setup(b){
 b.onLoad({filter:/tiranastreets\/shared\/world\.mjs$/},()=>({contents:'export const WORLD='+JSON.stringify(subset),loader:'js'}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
}}]});
let fragment=await readFile(path.join(root,'scripts/tirana-street-preview.fragment.html'),'utf8');
fragment=fragment.replace('/*__STREET_CSS__*/',await readFile(path.join(root,'src/games/tirana-street-life/streetLifeExplorer.css'),'utf8')).replace('/*__STREET_SCRIPT__*/',new TextDecoder().decode(output.outputFiles[0].contents));
if(Buffer.byteLength(fragment)>1000000)throw Error('Inline preview exceeds 1 MB');
const target=process.argv[2]||'/workspace/tirana-main-streets-preview.html';await writeFile(target,fragment);console.log(target+' · '+Buffer.byteLength(fragment)+' bytes');
