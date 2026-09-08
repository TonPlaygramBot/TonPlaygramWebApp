import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import ts from 'typescript';
import {buildFinishGltf,finishSVG,bicycleSVG} from '../src/games/tirana-street-detail/finishAssets.mjs';
const output=path.resolve(process.argv[2]||'../artifacts/tirana-street-detail');
const size=Number(process.argv[3]||2048);
if(![1024,2048].includes(size))throw Error('Texture width must be 1024 or 2048');
await mkdir(output,{recursive:true});
const maps={};
for(const channel of ['color','normal','orm']){
 const svg=finishSVG(channel,size),png=await sharp(Buffer.from(svg)).png().toBuffer();
 maps[channel]='data:image/png;base64,'+png.toString('base64');
 await writeFile(path.join(output,`${channel}.png`),png);
}
const gltf=buildFinishGltf(maps);
await writeFile(path.join(output,'tirana-concrete-pbr.gltf'),JSON.stringify(gltf));
const glyph=await sharp(Buffer.from(bicycleSVG())).png().toBuffer();
await writeFile(path.join(output,'cycle-symbol.png'),glyph);
const source=await readFile(new URL('../src/games/tirana-street-detail/StreetDetailPreview.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{fileName:'StreetDetailPreview.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Tirana — street detail preview</title><style>html,body,#root{margin:0;width:100%;height:100%;background:#13272c;font-family:system-ui;color:#f4eddf}button{min-height:44px;font:inherit;padding:8px 14px;cursor:pointer}</style><script type="importmap">${JSON.stringify({imports:{react:'https://esm.sh/react@18.2.0','react/jsx-runtime':'https://esm.sh/react@18.2.0/jsx-runtime','react-dom/client':'https://esm.sh/react-dom@18.2.0/client',three:'https://unpkg.com/three@0.164.0/build/three.module.js','three/':'https://unpkg.com/three@0.164.0/'}})}</script></head><body><div id="root"></div><script type="module">${code}\nimport {createRoot} from 'react-dom/client';\ncreateRoot(document.getElementById('root')).render(React.createElement(StreetDetailPreview,{asset:${JSON.stringify(gltf)},glyph:${JSON.stringify('data:image/png;base64,'+glyph.toString('base64'))}}));</script></body></html>`;
await writeFile(path.join(output,'preview.html'),html);
await writeFile(path.join(output,'README.md'),'# Tirana street-detail assets\n\nOriginal authored glTF/PNG material study. Not satellite imagery, a surveyed streetscape, or a screenshot of either live game. Colour is sRGB; normal/ORM are linear data. 2K by default; 1K export available. The preview uses pinned external React/Three modules and needs internet. No existing human models or fonts are included.\n');
console.log(JSON.stringify({output,size,bytes:Buffer.byteLength(JSON.stringify(gltf)),triangles:gltf.accessors[3].count/3},null,2));
