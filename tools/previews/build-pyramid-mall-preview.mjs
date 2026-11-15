import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname,join,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {build} from '../../webapp/node_modules/esbuild/lib/main.js';
import sharp from '../../webapp/node_modules/sharp/lib/index.js';
import games from '../../webapp/src/config/gamesCatalog.js';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),temp=await mkdtemp(join(tmpdir(),'pyramid-inline-'));
// Calculate the live shop names/counts with the same catalog, then drop unrelated
// item rendering and purchase logic from this read-only in-chat preview.
await build({entryPoints:[resolve(root,'webapp/src/components/store/storeCatalog.ts')],bundle:true,platform:'node',format:'esm',outfile:join(temp,'catalog.mjs'),logLevel:'silent'});
const catalog=await import(pathToFileURL(join(temp,'catalog.mjs')));
const store={STORE_GAMES:catalog.STORE_GAMES.map(({slug,name,shortName})=>({slug,name,shortName})),STORE_ITEMS:catalog.STORE_ITEMS.map(({slug})=>({slug}))};
const pictures={};
for(const {image} of games){if(!image||pictures[image])continue;const file=resolve(root,'webapp/public',decodeURIComponent(image).slice(1));const bytes=await readFile(file);const svg=extname(file)==='.svg';const content=svg?bytes:await sharp(bytes).resize(192,128,{fit:'inside',withoutEnlargement:true}).webp({quality:70}).toBuffer();pictures[image]=`data:image/${svg?'svg+xml':'webp'};base64,${content.toString('base64')}`;}
// Use the game's own Apex LOD export to keep the phone preview below 1 MB.
const models={};
for(const path of ['/assets/kart-royale/karts/apex.glb','/assets/airhockey/air-hockey-table.glb'])models[path]=(await readFile(resolve(root,'webapp/public',(path.endsWith('/apex.glb')?path.replace('/apex.glb','/apex-lod.glb'):path).slice(1)))).toString('base64');
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PyramidGamingMall}from'./src/games/tirana-mall/PyramidGamingMall';function Preview(){const[route,setRoute]=React.useState('');return <div style={{position:'relative',height:700,minHeight:500,maxWidth:480,margin:'auto'}}><PyramidGamingMall onClose={()=>setRoute('Return to Tirana city')} onLaunch={setRoute}/>{route&&<div role="status" style={{position:'absolute',left:12,right:12,bottom:8,zIndex:100,padding:14,borderRadius:10,background:'#143c35',color:'#eafff3',font:'13px system-ui'}}>{route}<button onClick={()=>setRoute('')} style={{float:'right',minHeight:36,padding:'4px 10px',background:'#e5f8ee',color:'#153e34',border:0,borderRadius:6}}>OK</button></div>}</div>}createRoot(document.getElementById('pyramid-mall-inline')).render(<Preview/>);`,resolveDir:resolve(root,'webapp'),loader:'tsx'},bundle:true,write:false,outfile:'preview.js',format:'esm',minify:true,jsx:'automatic',platform:'browser',plugins:[{name:'portable-production-mall',setup(b){
 b.onResolve({filter:/components\/store\/storeCatalog(?:\.ts)?$/},()=>({path:'catalog',namespace:'inline'}));
 b.onLoad({filter:/catalog/,namespace:'inline'},()=>({contents:`export const STORE_GAMES=${JSON.stringify(store.STORE_GAMES)};export const STORE_ITEMS=${JSON.stringify(store.STORE_ITEMS)};`,loader:'js'}));
 b.onLoad({filter:/PyramidMallScene\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace("const MODELS:Record<string,string>=",`const INLINE_MODELS:Record<string,string>=${JSON.stringify(models)};const INLINE_PICTURES:Record<string,string>=${JSON.stringify(pictures)};const MODELS:Record<string,string>=`).replace('new T.TextureLoader().load(item.image,','new T.TextureLoader().load(INLINE_PICTURES[item.image],').replace('this.loader.loadAsync(MODELS[id])',"this.loader.parseAsync(Uint8Array.from(atob(INLINE_MODELS[MODELS[id]]),c=>c.charCodeAt(0)).buffer,'')"),loader:'ts'}));
 b.onResolve({filter:/^(react(?:\/jsx-runtime)?|react-dom\/client|three(?:\/.*)?)$/},args=>({path:args.path==='react/jsx-runtime'?'https://esm.sh/react@18.2.0/jsx-runtime':args.path==='react'?'https://esm.sh/react@18.2.0':args.path==='react-dom/client'?'https://esm.sh/react-dom@18.2.0/client?deps=react@18.2.0':args.path==='three'?'https://esm.sh/three@0.164.0':'https://esm.sh/three@0.164.0/'+args.path.slice(6),external:true}));
}}]});
const js=result.outputFiles.find(file=>file.path.endsWith('.js')).text,css=result.outputFiles.find(file=>file.path.endsWith('.css')).text;
const packed=gzipSync(js,{level:9}).toString('base64');
const fragment=await readFile(resolve(here,'pyramid-mall-preview.html'),'utf8');
const html=fragment.replace('/* PRODUCTION_MALL_CSS */',css).replace('PACKED_PRODUCTION_MALL_MODULE',packed);
if(Buffer.byteLength(html)>1_000_000)throw Error(`Preview exceeds 1 MB: ${Buffer.byteLength(html)}`);
const output=process.argv[2]||'/workspace/pyramid-gaming-mall-preview.html';await writeFile(output,html);console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),halls:games.length,shops:store.STORE_GAMES.length+1,items:store.STORE_ITEMS.length,models:Object.keys(models)}));
