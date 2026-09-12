import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {CITY_COMPLETION as DATA} from '../src/games/tirana-city-completion/data.mjs';
import {COMPLETED_BUILDINGS} from '../src/games/tirana-city-completion/buildingRegistry.mjs';
import {MAPPED_TREES} from '../src/games/tirana-city-source/registry.mjs';
import {STREET_LIFE} from '../src/games/tirana-street-life/registry.mjs';
const root=new URL('../',import.meta.url),building=COMPLETED_BUILDINGS.find(b=>b.id==='736721581');
const [x,z]=building.origin;
const road=WORLD.roads.filter(r=>!r.walk).map(r=>({r,d:Math.hypot((r.a[0]+r.b[0])/2-x,(r.a[1]+r.b[1])/2-z)})).sort((a,b)=>a.d-b.d)[0].r;
const park=DATA.parking.filter(p=>p.bays.length>=10).sort((a,b)=>Math.hypot(a.bays[0].x-900,a.bays[0].z+400)-Math.hypot(b.bays[0].x-900,b.bays[0].z+400))[0];
const signal=DATA.fixtures.filter(p=>p.kind==='traffic_signals').sort((a,b)=>Math.hypot(a.x+400,a.z+350)-Math.hypot(b.x+400,b.z+350))[0];
const views=[{id:'ali-demi',name:'Ali Demi · Blender building',x,z,y:11,distance:44,yaw:Math.atan2((road.a[0]+road.b[0])/2-x,(road.a[1]+road.b[1])/2-z),buildingId:building.id},
 {id:'parking',name:'Mapped parking · road markings',x:park.bays[0].x,z:park.bays[0].z,y:2,distance:32,yaw:.7},
 {id:'signals',name:'Traffic controls · street trees',x:signal.x,z:signal.z,y:2,distance:23,yaw:signal.yaw}];
const near=p=>views.some(v=>Math.hypot(p[0]-v.x,p[1]-v.z)<230);
const subset={origin:WORLD.origin,buildings:WORLD.buildings.filter(b=>b.p.some(near)).map(({id,p,h,holes,levels,heightSource,minHeight,tags})=>({id,p,h,holes,levels,heightSource,minHeight,tags})),roads:WORLD.roads.filter(r=>near(r.a)||near(r.b)).map(({a,b,w,walk})=>({a,b,w,walk})),parks:WORLD.parks.filter(p=>p.some(near)),areas:[],water:[]};
const data={...DATA,trees:DATA.trees.filter(p=>near([p.x,p.z])),shrubs:DATA.shrubs.filter(p=>near([p.x,p.z])),fixtures:DATA.fixtures.filter(p=>near([p.x,p.z])),parking:DATA.parking.filter(p=>p.p.some(near)),arrows:DATA.arrows.filter(p=>near([p.x,p.z])),greenAreas:[]};
const ids=new Set(STREET_LIFE.trees.map(p=>p.id));
const trees=[...STREET_LIFE.trees,...MAPPED_TREES.filter(p=>!ids.has(p.id)).map((p,i)=>({...p,shape:'upright',height:p.height||9,crown:p.crown||5,seed:i,zone:'existing-mapped-tree'}))].filter(p=>near([p.x,p.z]));
const asset=gzipSync(await readFile(new URL('public/assets/tirana-streets/neighbourhood/completion-'+building.id+'.glb',root)),{level:9}).toString('base64');
const packed=object=>`import {decodeSource} from '../tirana-neighbourhood/decodeSource.mjs'; export const CITY_COMPLETION=decodeSource(['${gzipSync(JSON.stringify(object)).toString('base64')}']);`;
const code=`import React from 'react';import {createRoot} from 'react-dom/client';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';import {gunzipSync} from './src/games/tirana-neighbourhood/vendor/fflate-gunzip.mjs';import Explorer from './src/games/tirana-city-completion/CompletionExplorer';
const asset='${asset}';async function loadBuilding(id){const bytes=gunzipSync(Uint8Array.from(atob(asset),c=>c.charCodeAt(0)));return(await new GLTFLoader().parseAsync(bytes.buffer,'')).scene;}
createRoot(document.getElementById('tirana-city-update')).render(React.createElement(Explorer,{views:${JSON.stringify(views)},loadBuilding}));`;
const output=await build({stdin:{contents:code,resolveDir:root.pathname,loader:'tsx'},bundle:true,write:false,minify:true,format:'esm',jsx:'automatic',target:'es2022',external:['react','react/*','react-dom/*','three','three/*'],plugins:[{name:'bounded-review-data',setup(b){
 b.onLoad({filter:/tiranastreets\/shared\/world\.mjs$/},()=>({contents:`import {decodeSource} from '../../tirana-neighbourhood/decodeSource.mjs';export const WORLD=decodeSource(['${gzipSync(JSON.stringify(subset)).toString('base64')}']);`,loader:'js'}));
 b.onLoad({filter:/tirana-neighbourhood\/data\.mjs$/},()=>({contents:'export const NEIGHBOURHOOD={buildings:[]};',loader:'js'}));
 b.onLoad({filter:/tirana-city-source\/housingRegistry\.mjs$/},()=>({contents:'export const AGED_HOUSING_IDS=new Set();',loader:'js'}));
 b.onLoad({filter:/tirana-city-completion\/data\.mjs$/},()=>({contents:packed(data),loader:'js'}));
 b.onLoad({filter:/tirana-street-life\/registry\.mjs$/},()=>({contents:'export const STREET_LIFE='+JSON.stringify({trees})+';',loader:'js'}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
}}]});
const css=await readFile(new URL('src/games/tirana-city-completion/completionExplorer.css',root),'utf8');
const fragment=`<div id="tirana-city-update"></div>\n<style>${css}</style>\n<script type="importmap">{"imports":{"react":"https://esm.sh/react@18.2.0","react/jsx-runtime":"https://esm.sh/react@18.2.0/jsx-runtime","react-dom/client":"https://esm.sh/react-dom@18.2.0/client?external=react","three":"https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js","three/":"https://cdn.jsdelivr.net/npm/three@0.164.0/"}}</script>\n<script type="module">${output.outputFiles[0].text}</script>\n`;
if(Buffer.byteLength(fragment)>1000000)throw Error('Preview exceeds 1 MB: '+Buffer.byteLength(fragment));
const target=process.argv[2]||'/workspace/tirana-city-update.html';await writeFile(target,fragment);console.log(JSON.stringify({target,bytes:Buffer.byteLength(fragment),views}));
