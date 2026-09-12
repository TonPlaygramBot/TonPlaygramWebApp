import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import sharp from 'sharp';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {HYDROGRAPHY} from '../src/games/tirana-environment/hydrography.mjs';
import {environmentAt} from '../src/games/tirana-environment/weatherCore.mjs';
const root=new URL('../',import.meta.url),near=p=>p[0]>-380&&p[0]<410&&p[1]>80&&p[1]<820;
const subset={...WORLD,bounds:[-600,-100,650,1050],graph:{nodes:[],edges:[]},buildings:WORLD.buildings.filter(b=>b.p.some(near)),roads:WORLD.roads.filter(r=>near(r.a)||near(r.b)),areas:WORLD.areas.filter(p=>p.some(near)),parks:WORLD.parks.filter(p=>p.some(near)),water:WORLD.water.filter(w=>w.line?w.line.some(near):w.some(near))};
const hydro={...HYDROGRAPHY,paths:HYDROGRAPHY.paths.filter(p=>p.line.some(near))};
const textures={};for(const name of ['concrete_pavement','rough_concrete','asphalt_02','weathered_brown_planks','grass_path_2','plastered_wall_02']){
 const folder=['grass_path_2','plastered_wall_02'].includes(name)?'materials':'environment';
 textures[name]='data:image/jpeg;base64,'+(await sharp(await readFile(new URL(`public/assets/tirana-streets/${folder}/${name}-diff.jpg`,root))).resize(128,128).jpeg({quality:74}).toBuffer()).toString('base64');
}
let seed=0;while(seed<100000){const p=environmentAt(seed,60);if(p.hour>16.7&&p.hour<17.6&&p.name==='Clear')break;seed++;}
const code=`import React from 'react';import{createRoot}from'react-dom/client';import EnvironmentReview from './src/games/tirana-environment/EnvironmentReview';createRoot(document.getElementById('tirana-environment-review')).render(React.createElement(EnvironmentReview,{textures:${JSON.stringify(textures)},seed:${seed}}));`;
const output=await build({stdin:{contents:code,resolveDir:root.pathname,loader:'tsx'},bundle:true,write:false,minify:true,format:'esm',jsx:'automatic',target:'es2022',external:['react','react/*','react-dom/*','three','three/*'],plugins:[{name:'bounded-city-preview',setup(b){
 b.onLoad({filter:/tiranastreets\/shared\/world\.mjs$/},()=>({contents:'export const WORLD='+JSON.stringify(subset)+';',loader:'js'}));
 b.onLoad({filter:/tirana-environment\/hydrography\.mjs$/},()=>({contents:'export const HYDROGRAPHY='+JSON.stringify(hydro)+';',loader:'js'}));
 b.onLoad({filter:/tirana-city-source\/housingRegistry\.mjs$/},()=>({contents:'export const AGED_HOUSING_IDS=new Set();',loader:'js'}));
}}]});
const fragment=`<div id="tirana-environment-review"></div>
<style>#tirana-environment-review .tirana-env-review{color:#e7eade;background:#182624;font:14px system-ui;overflow:hidden}#tirana-environment-review .tirana-env-stage{position:relative;width:100%;height:480px;touch-action:none}#tirana-environment-review canvas{display:block;width:100%;height:100%;touch-action:none}#tirana-environment-review .tirana-env-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;flex-wrap:wrap}#tirana-environment-review button{font:inherit;color:#e7eade;background:#2c413a;border:1px solid #557366;border-radius:6px;padding:11px 14px;min-height:44px}#tirana-environment-review button[aria-pressed=true]{background:#48634f}#tirana-environment-review .tirana-env-views{display:flex;gap:8px;padding:0 12px 12px}#tirana-environment-review .tirana-env-views button{flex:1}</style>
<script type="importmap">{"imports":{"react":"https://esm.sh/react@18.2.0","react/jsx-runtime":"https://esm.sh/react@18.2.0/jsx-runtime","react-dom/client":"https://esm.sh/react-dom@18.2.0/client?external=react","three":"https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js","three/":"https://cdn.jsdelivr.net/npm/three@0.164.0/"}}</script>
<script type="module">${output.outputFiles[0].text}</script>
`;
if(Buffer.byteLength(fragment)>1000000)throw Error('Preview exceeds 1 MB: '+Buffer.byteLength(fragment));
const target=process.argv[2]||'/workspace/tirana-lana-environment.html';await writeFile(target,fragment);console.log(JSON.stringify({target,bytes:Buffer.byteLength(fragment),seed,buildings:subset.buildings.length}));
