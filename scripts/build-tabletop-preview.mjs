import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { readFile, writeFile } from 'node:fs/promises';
import { RGBELoader } from '../webapp/node_modules/three/examples/jsm/loaders/RGBELoader.js';
import { DataUtils } from '../webapp/node_modules/three/build/three.module.js';
const root = new URL('../', import.meta.url),
  pieces = await readFile(
    new URL('webapp/public/assets/tabletop/tabletop-pieces.glb', root)
  );
const bytes = await readFile(
  new URL(
    'webapp/public/assets/royal-lanes/textures/billiard-hall-1k.hdr',
    root
  )
);
const hdr = new RGBELoader().parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);
const colors = [];
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 64; x++) {
    const pos =
      (Math.floor((y / 32) * hdr.height) * hdr.width +
        Math.floor((x / 64) * hdr.width)) *
      4;
    for (let k = 0; k < 4; k++)
      colors.push(
        Number(DataUtils.fromHalfFloat(hdr.data[pos + k]).toFixed(3))
      );
  }
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter,Routes,Route,Link}from'react-router-dom';import Game from './Game';import{TABLETOP_GAMES}from'./shared/catalog.mjs';
function Menu(){const[count,setCount]=React.useState(2);return <div className="tt-lobby" style={{paddingBottom:24,minHeight:0}}><h1 style={{fontSize:30}}>Tabletop collection</h1><p>Free AI preview</p><label>Players<select value={count} onChange={e=>setCount(+e.target.value)}>{[2,3,4].map(n=><option key={n} value={n}>{n} players · You + {n-1} AI</option>)}</select></label>{TABLETOP_GAMES.map(g=><Link key={g.id} style={{display:'block',border:'1px solid #425b64',padding:16,borderRadius:10,marginTop:14,color:g.color,textDecoration:'none'}} to={'/games/'+g.id+'?mode=ai&players='+count}><strong>{g.name}</strong><small style={{display:'block',marginTop:5}}>{g.description}</small></Link>)}</div>};const root=document.getElementById('tpg-tabletop-preview');createRoot(root).render(<MemoryRouter initialEntries={['/games/oligarchs?mode=ai&players=2']}><Routes><Route path="/games/:game/lobby" element={<Menu/>}/>{TABLETOP_GAMES.map(g=><Route key={g.id} path={'/games/'+g.id} element={<Game key={g.id} gameId={g.id}/>}/>)}</Routes></MemoryRouter>);`;
const result = await build({
  stdin: {
    contents: entry,
    resolveDir: new URL('webapp/src/games/tabletop', root).pathname,
    loader: 'tsx'
  },
  bundle: true,
  write: false,
  format: 'esm',
  minify: true,
  jsx: 'automatic',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'preview',
      setup(api) {
        api.onResolve({ filter: /^three$/ }, () => ({
          path: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js',
          external: true
        }));
        api.onResolve({ filter: /onlineSession$/ }, () => ({
          path: 'online',
          namespace: 'preview-stub'
        }));
        api.onResolve({ filter: /utils\/telegram\.js$/ }, () => ({
          path: 'telegram',
          namespace: 'preview-stub'
        }));
        api.onResolve({ filter: /utils\/sound\.js$/ }, () => ({
          path: 'sound',
          namespace: 'preview-stub'
        }));
        api.onResolve({ filter: /hooks\/useTelegramBackButton\.js$/ }, () => ({
          path: 'back',
          namespace: 'preview-stub'
        }));
        api.onLoad({ filter: /.*/, namespace: 'preview-stub' }, (args) => ({
          contents:
            args.path === 'online'
              ? `export class OnlineTabletopSession{constructor(){throw Error('Online matches are available in the full app.');}}`
              : args.path === 'telegram'
                ? `export const getTelegramFirstName=()=> 'You';`
                : args.path === 'sound'
                  ? `let muted=true;export const isGameMuted=()=>muted,getGameVolume=()=>0,setGameMuted=value=>muted=value;`
                  : `export default function useTelegramBackButton(){}`,
          loader: 'js'
        }));
        api.onLoad({ filter: /\/Game\.tsx$/ }, async (args) => ({
          contents: (await readFile(args.path, 'utf8')).replace(
            /new Audio\(\s*'\/assets\/sounds\/pounding-cards-on-table-99355\.mp3'\s*\)/,
            "({preload:'none',pause(){},play:async()=>{},volume:0,currentTime:0} as HTMLAudioElement)"
          ),
          loader: 'tsx'
        }));
        api.onLoad({ filter: /\/Room\.tsx$/ }, async (args) => {
          let text = await readFile(args.path, 'utf8');
          text = text.replace(
            'import { GLTFLoader }',
            'import { GLTFLoader as OriginalGLTFLoader }'
          );
          text = text.replace(
            "import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';",
            `const GLTFLoader=class extends OriginalGLTFLoader{load(url,onLoad,onProgress,onError){const bytes=Uint8Array.from(atob('${pieces.toString('base64')}'),c=>c.charCodeAt(0));this.parse(bytes.buffer,'',onLoad,onError);}};const RGBELoader=class{load(url,onLoad){const t=new THREE.DataTexture(new Float32Array(${JSON.stringify(colors)}),64,32,THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;onLoad(t);}};`
          );
          return { contents: text, loader: 'tsx' };
        });
        api.onLoad({ filter: /\.css$/ }, () => ({
          contents: 'export {};',
          loader: 'js'
        }));
      }
    }
  ]
});
const css = await readFile(
  new URL('webapp/src/games/tabletop/tabletop.css', root),
  'utf8'
);
const fragment = `<div id="tpg-tabletop-preview"></div>\n<style>${css}\n#tpg-tabletop-preview{max-width:430px;margin:auto;background:#0c151c;border-radius:16px;overflow:hidden}#tpg-tabletop-preview .tt-game{position:relative;inset:auto;overflow:visible;min-height:0;padding:12px 0}#tpg-tabletop-preview .tt-scene-wrap{height:340px;min-height:340px}#tpg-tabletop-preview .tt-help{position:absolute}#tpg-tabletop-preview{position:relative}#tpg-tabletop-preview .tt-actions{max-height:210px}</style>\n<script type="module">${result.outputFiles.find((f) => f.path.endsWith('.js') || f.path === '<stdout>').text}</script>\n`;
if (Buffer.byteLength(fragment) > 1_000_000)
  throw Error('Inline preview exceeds 1 MB');
const path = process.argv[2] || '/workspace/tabletop-five-games.html';
await writeFile(path, fragment);
console.log(path, Buffer.byteLength(fragment));
