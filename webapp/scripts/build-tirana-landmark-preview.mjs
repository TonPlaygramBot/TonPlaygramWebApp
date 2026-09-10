import {build} from 'esbuild';
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {REFERENCE_BUILDINGS} from '../src/games/tirana-city-source/profiles.mjs';
import {LANDMARK_CATALOG} from '../src/games/tirana-city-source/landmarkCatalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const photos={};
for(const name of new Set(Object.values(LANDMARK_CATALOG).map(p=>p.photo).filter(Boolean))){
 const bytes=await sharp(path.join(root,'public/assets/tirana-streets/references',name)).resize({width:620,height:420,fit:'inside',withoutEnlargement:true}).jpeg({quality:73}).toBuffer();
 photos[name]='data:image/jpeg;base64,'+bytes.toString('base64');
}
const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Explorer from './src/games/tirana-city-source/LandmarkExplorer';createRoot(document.getElementById('tirana-landmark-preview')).render(React.createElement(Explorer,{photos:${JSON.stringify(photos)}}));`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',minify:true,jsx:'automatic',target:'es2022',external:['react','react/*','react-dom/*','three','three/*'],plugins:[{name:'review-world-subset',setup(b){
 b.onLoad({filter:/tiranastreets\/shared\/world\.mjs$/},()=>({contents:'export const WORLD='+JSON.stringify({...WORLD,buildings:WORLD.buildings.filter(b=>REFERENCE_BUILDINGS[b.id]),roads:[],landuse:[],landmarks:[]}),loader:'js'}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
}}]});
let fragment=await readFile(path.join(root,'scripts/tirana-landmark-preview.fragment.html'),'utf8');
fragment=fragment.replace('/*__LANDMARK_CSS__*/',await readFile(path.join(root,'src/games/tirana-city-source/landmarkExplorer.css'),'utf8')).replace('/*__LANDMARK_SCRIPT__*/',new TextDecoder().decode(output.outputFiles[0].contents));
if(Buffer.byteLength(fragment)>1000000)throw new Error('Inline preview exceeds 1 MB');
const target=process.argv[2]||'/workspace/tirana-landmarks-preview.html';await writeFile(target,fragment);console.log(target+' · '+Buffer.byteLength(fragment)+' bytes');
