import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {STREET_LIFE} from '../src/games/tirana-street-life/registry.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const nearby=(x,z)=>x>-440&&x<440&&z>-250&&z<850;
const subset={source:WORLD.source,attribution:WORLD.attribution,origin:WORLD.origin,landmarks:WORLD.landmarks,graph:{nodes:[],edges:[]},water:WORLD.water.filter(w=>Array.isArray(w)?w.some(v=>nearby(...v)):w.line.some(v=>nearby(...v))),bounds:[-500,-310,500,910],
 buildings:WORLD.buildings.filter(b=>b.p.some(p=>nearby(...p))).map(({id,p,h,holes,tags})=>({id,p,h,holes,tags})),
 roads:WORLD.roads.filter(r=>nearby(...r.a)||nearby(...r.b)).map(({a,b,w,walk,bridge,tunnel,name})=>({a,b,w,walk,bridge,tunnel,name})),
 parks:WORLD.parks.filter(p=>p.some(v=>nearby(...v))),areas:WORLD.areas.filter(p=>p.some(v=>nearby(...v)))};
const street=Object.fromEntries(Object.entries(STREET_LIFE).map(([key,value])=>[key,Array.isArray(value)?value.filter(p=>nearby(p.x,p.z)):value]));
const logo='data:image/png;base64,'+(await readFile(path.join(root,'public/assets/tirana-streets/signs/mulliri-logo.png'))).toString('base64');
const result=await build({entryPoints:[path.join(root,'src/games/tirana-environment/LightingReview.tsx')],write:false,bundle:true,minify:true,format:'esm',platform:'browser',plugins:[{name:'bounded-in-chat-environment',setup(builder){
 builder.onResolve({filter:/^(three|react|react-dom)(\/.*)?$/},({path:specifier})=>({path:`https://esm.sh/${specifier.startsWith('three')?specifier.replace('three','three@0.164.0'):specifier.startsWith('react-dom')?specifier.replace('react-dom','react-dom@18.2.0'):specifier.replace('react','react@18.2.0')}`,external:true}));
 builder.onResolve({filter:/^polygon-clipping$/},()=>({path:'https://esm.sh/polygon-clipping@0.15.7',external:true}));
 builder.onLoad({filter:/tiranastreets\/shared\/world\.mjs$/},()=>({contents:`export const WORLD=${JSON.stringify(subset)};`,loader:'js'}));
 builder.onLoad({filter:/tirana-city-source\/housingRegistry\.mjs$/},()=>({contents:'export const AGED_HOUSING_IDS=new Set();',loader:'js'}));
 builder.onLoad({filter:/tirana-street-life\/registry\.mjs$/},()=>({contents:`export const STREET_LIFE=${JSON.stringify(street)};export const MATURE_TREE_IDS=new Set();export const FUEL_CANOPY_IDS=new Set();export const REAL_STOREFRONT_BUILDING_IDS=new Set();`,loader:'js'}));
 builder.onLoad({filter:/tirana-street-life\/signReferences\.mjs$/},async({path:file})=>({contents:(await readFile(file,'utf8')).replace('/assets/tirana-streets/signs/mulliri-logo.png',logo),loader:'js'}));
}}]});
const template=await readFile(path.join(root,'scripts/tirana-lighting-preview.fragment.html'),'utf8');
const html=template.replace('/*__LIGHTING_REVIEW_BUNDLE__*/',result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
if(Buffer.byteLength(html)>1000000)throw Error(`Preview exceeds 1 MB: ${Buffer.byteLength(html)}`);
const output=process.argv[2]||'/workspace/tirana-streets-lighting.html';await writeFile(output,html);
console.log(`Saved ${Buffer.byteLength(html)} bytes; ${subset.buildings.length} mapped buildings in the bounded environment preview.`);
