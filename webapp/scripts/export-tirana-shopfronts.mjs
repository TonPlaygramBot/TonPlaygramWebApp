#!/usr/bin/env node
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import ts from 'typescript';
import {buildFacadeGltf} from '../src/games/tirana-region/facadeAssets.mjs';
import {advertSVG,signSVG} from '../src/games/tirana-region/advertArt.mjs';
import {AD_BRANDS} from '../src/games/tirana-region/facadeCore.mjs';
async function main(){
 const dir=resolve(process.argv[2]||'../artifacts/tirana-shopfronts'),width=Number(process.argv[3]||2048);
 if(![1024,2048,4096].includes(width))throw Error('Resolution must be 1024, 2048 or 4096');await mkdir(dir,{recursive:true});
 const files=[],assets=[];for(let i=0;i<AD_BRANDS.length;i++){
  const svg=advertSVG(i,width),png=await sharp(Buffer.from(svg)).png().toBuffer(),name=AD_BRANDS[i].id;
  await writeFile(`${dir}/${name}.svg`,svg);await writeFile(`${dir}/${name}.png`,png);
  const sign=signSVG(i,width),signPng=await sharp(Buffer.from(sign)).png().toBuffer();await writeFile(`${dir}/${name}-sign.svg`,sign);await writeFile(`${dir}/${name}-sign.png`,signPng);
  const gltf=buildFacadeGltf(i,`data:image/png;base64,${signPng.toString('base64')}`);await writeFile(`${dir}/${name}.gltf`,JSON.stringify(gltf));assets.push({name:AD_BRANDS[i].title,gltf});files.push({id:name,width,height:width/2,pngBytes:png.length,geometry:'original glTF 2.0 with embedded PNG'});
 }
 await writeFile(`${dir}/manifest.json`,JSON.stringify({license:'Original generated assets for TonPlaygram',advertising:'Fictional brands and original illustrations; not photographs',files},null,2));
 const source=await readFile(new URL('../src/games/tirana-region/AssetPreview.tsx',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{fileName:'AssetPreview.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const imports={imports:{react:'https://esm.sh/react@18.2.0','react/jsx-runtime':'https://esm.sh/react@18.2.0/jsx-runtime?external=react','react-dom/client':'https://esm.sh/react-dom@18.2.0/client?external=react',three:'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js','three/examples/jsm/':'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/'}};
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tirana original glTF preview</title><body style="margin:0;background:#172c32"><div id="root" style="color:#f2e9d4;font:14px system-ui;padding:16px">Loading the React + Three.js asset viewer. Internet access to pinned CDN dependencies is required. This is an asset preview, not the live city.</div><script type="importmap">${JSON.stringify(imports)}</script><script type="module">${js}\nimport {createRoot} from 'react-dom/client';import {createElement} from 'react';createRoot(document.getElementById('root')).render(createElement(AssetPreview,{assets:${JSON.stringify(assets)}}));</script></body></html>`;
 await writeFile(`${dir}/preview.html`,html);
 console.log(`Exported ${files.length} self-contained glTF assets with ${width}px PNG textures to ${dir}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
