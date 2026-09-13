import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {build} from '../../webapp/node_modules/esbuild/lib/main.js';
import {makeTrack,TRACKS} from '../../webapp/src/games/kartroyale/simulation.mjs';
import {tyreBarrierLayout} from '../../webapp/src/games/kartroyale/tyreBarrierCore.mjs';
import {courseClearance} from '../../webapp/src/games/kartroyale/raceCourse.mjs';
import {WORLD} from '../../webapp/src/games/tiranastreets/shared/world.mjs';
import {CANOPY_TREES} from '../../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {ribbonExclusion} from '../../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
import {TERRAIN} from '../../webapp/src/games/tirana-east/terrainData.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
const models={};
models.driver=(await readFile(resolve(root,'webapp/public/assets/kart-royale/karts/race-driver-lod.glb'))).toString('base64');
const previewIds=['skanderbeg','farke','surrel','liqeni'];
const courses=previewIds.map(id=>{
const track=makeTrack(id),near=ribbonExclusion(track);
const bounds=track.bounds.map((n,i)=>n+(i<2?-260:260));
const contains=p=>p[0]>=bounds[0]&&p[1]>=bounds[1]&&p[0]<=bounds[2]&&p[1]<=bounds[3];
const buildings=WORLD.buildings.filter(b=>b.p.some(contains)).map((b,i)=>({p:b.p,h:b.h,color:['#ccbab1','#d3d8d3','#b4c5d0','#d7c99a','#bba7a0'][i%5]}));
const roads=WORLD.roads.filter(r=>[r.a,r.b].some(contains)&&!r.tunnel&&!r.bridge&&!r.layer&&r.highway!=='steps').map(r=>({a:r.a,b:r.b,w:r.w,walk:r.walk}));
const waterAreas=WORLD.waterAreas.filter(w=>w.polygons.some(p=>p.outer.some(contains)));
const trees=CANOPY_TREES.filter(t=>!near(t.x,t.z,Math.max(.8,t.crown*.75))&&near(t.x,t.z,60)).map(t=>({x:t.x,z:t.z,h:t.height,c:t.crown}));
// A millimetre of presentation precision retains the validated footprint margin.
return {track,buildings,trees,roads,waterAreas,bounds,tyres:tyreBarrierLayout(track,(x,z)=>courseClearance(track,x,z)).positions.map(p=>[+p.x.toFixed(3),+p.z.toFixed(3),p.index])};
});
if(process.argv.includes('--stats'))console.log(JSON.stringify(courses.map(c=>({id:c.track.id,parts:Object.fromEntries(Object.entries(c).map(([k,v])=>[k,{count:Array.isArray(v)?v.length:undefined,gzip:gzipSync(JSON.stringify(v)).length}]))}))));
// Typed DEM arrays must be encoded as arrays, not millions of numeric keys.
// Keep the original grid origin/spacing and only crop outside preview coverage.
const terrain={...TERRAIN,grids:TERRAIN.grids.map(g=>{
  const xs=courses.flatMap(c=>[c.bounds[0]-120,c.bounds[2]+120,0]),zs=courses.flatMap(c=>[c.bounds[1]-120,c.bounds[3]+120,0]);
  const ix=Math.max(0,Math.floor((Math.min(...xs)-g.x)/g.step)),iz=Math.max(0,Math.floor((Math.min(...zs)-g.z)/g.step));
  const ex=Math.min(g.nx-1,Math.ceil((Math.max(...xs)-g.x)/g.step)),ez=Math.min(g.nz-1,Math.ceil((Math.max(...zs)-g.z)/g.step));
  const heights=[];for(let z=iz;z<=ez;z++)for(let x=ix;x<=ex;x++)heights.push(+g.heights[z*g.nx+x].toFixed(2));
  return {...g,x:g.x+ix*g.step,z:g.z+iz*g.step,nx:ex-ix+1,nz:ez-iz+1,heights};
})};
const packed=gzipSync(JSON.stringify({courses,models,terrain}),{level:9}).toString('base64');
const result=await build({entryPoints:[resolve(here,'racing-manual-preview.tsx')],bundle:true,write:false,format:'esm',minify:true,platform:'browser',jsx:'transform',plugins:[{name:'portable-preview',setup(b){
 b.onResolve({filter:/^preview-data$/},()=>({path:'data',namespace:'preview'}));
 b.onResolve({filter:/terrainData\.mjs$/},()=>({path:'terrain',namespace:'terrain'}));
 b.onLoad({filter:/.*/,namespace:'terrain'},()=>({contents:"import DATA from 'preview-data';export const TERRAIN=DATA.terrain;",loader:'js'}));
 b.onLoad({filter:/.*/,namespace:'preview'},()=>({contents:`const bytes=Uint8Array.from(atob('${packed}'),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));export default JSON.parse(new TextDecoder().decode(await new Response(stream).arrayBuffer()));`,loader:'js'}));
 b.onResolve({filter:/\/three\/(build\/three\.module\.js|examples\/jsm\/.*\.js)$/},args=>({path:args.path.includes('/build/')?'https://esm.sh/three@0.164.1':'https://esm.sh/three@0.164.1/'+args.path.split('/three/')[1],external:true}));
 b.onResolve({filter:/^lucide-react$/},()=>({path:'icons',namespace:'icons'}));
 b.onLoad({filter:/.*/,namespace:'icons'},()=>({contents:"import React from 'react';export const ChevronLeft=()=>React.createElement('span',{'aria-hidden':true},'◀');export const ChevronRight=()=>React.createElement('span',{'aria-hidden':true},'▶');export const Zap=()=>React.createElement('span',{'aria-hidden':true},'ϟ');",loader:'js'}));
 b.onResolve({filter:/^(react(?:\/jsx-runtime)?|react-dom\/client|three(?:\/.*)?)$/},args=>({path:args.path==='react/jsx-runtime'?'https://esm.sh/react@18.2.0/jsx-runtime':args.path==='react'?'https://esm.sh/react@18.2.0':args.path==='react-dom/client'?'https://esm.sh/react-dom@18.2.0/client?deps=react@18.2.0':args.path==='three'?'https://esm.sh/three@0.164.1':'https://esm.sh/three@0.164.1/'+args.path.slice(6),external:true}));
}}]});
let fragment=await readFile(resolve(here,'racing-manual-preview.html'),'utf8');
const css=await readFile(resolve(root,'webapp/src/games/kartroyale/kart-controls.css'),'utf8');
fragment+='\n<style>\n'+css+'\n</style>\n<script type="module">\n'+result.outputFiles[0].text+'\n</script>\n';
if(Buffer.byteLength(fragment)>1000000)throw Error(`Inline preview exceeds 1 MB: ${Buffer.byteLength(fragment)} bytes, ${packed.length} packed data`);
const output=process.argv[2]||'/workspace/racing-royal-upgrade.html';await writeFile(output,fragment);console.log(JSON.stringify({output,bytes:Buffer.byteLength(fragment),courses:courses.map(c=>({id:c.track.id,buildings:c.buildings.length,trees:c.trees.length}))}));
