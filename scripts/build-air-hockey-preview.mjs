import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import postcss from '../webapp/node_modules/postcss/lib/postcss.mjs';
import tailwindcss from '../webapp/node_modules/tailwindcss/lib/index.js';
import { AIR_HOCKEY_CUSTOMIZATION } from '../webapp/src/config/airHockeyInventoryConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const asset = await readFile(resolve(root, 'webapp/public/assets/airhockey/air-hockey-table.glb'));
const compressed = gzipSync(asset).toString('base64');
const beep = Buffer.alloc(44 + 1200);
beep.write('RIFF', 0); beep.writeUInt32LE(beep.length - 8, 4); beep.write('WAVEfmt ', 8);
beep.writeUInt32LE(16, 16); beep.writeUInt16LE(1, 20); beep.writeUInt16LE(1, 22);
beep.writeUInt32LE(12000, 24); beep.writeUInt32LE(24000, 28); beep.writeUInt16LE(2, 32); beep.writeUInt16LE(16, 34);
beep.write('data', 36); beep.writeUInt32LE(1200, 40);
for (let i = 0; i < 600; i++) beep.writeInt16LE(Math.round(Math.sin(i * .25) * 9000 * (1 - i / 600)), 44 + i * 2);
const tone = `data:audio/wav;base64,${beep.toString('base64')}`;
const popupStub = `import React from 'react';export default function Popup({open,onClose}){return open?<div className="ah-preview-notice" role="dialog" aria-label="Live match feature"><p>Gifts and live video are available in TonPlaygram matches.</p><button type="button" onClick={onClose}>Close</button></div>:null;}`;
const live = `const noop=()=>{};const state={startLiveChat:noop,stopLiveChat:noop,toggleMicrophone:noop,toggleCamera:noop,localStream:null,mediaState:{},remotePeers:[],isConnected:false,error:''};export default ()=>state;`;
const customization = Object.fromEntries(Object.entries(AIR_HOCKEY_CUSTOMIZATION).map(([key, options]) => [key, ['puck','mallet','goals'].includes(key) ? options : [{id:'original',name:'Original table'}]]));
const stubs = {
  'socket.js': `export const socket={on(){},off(){},emit(){},connected:false};export const refreshSocketAuthIdentity=()=>{};`,
  'coreSoundData.js': `export const bombSound=${JSON.stringify(tone)},chatBeep=bombSound;`,
  'giftSounds.js': 'export const giftSounds={};',
  'GiftPopup.jsx': popupStub,
  'LiveVideoChatPanel.jsx': popupStub.replace('{open,onClose}', '{open,onClose}'),
  'useLiveVideoChat.js': live,
  'avatarUtils.js': `export function getAvatarUrl(src){return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">'+src+'</text></svg>')}`,
  'airHockeyInventoryConfig.js': `export const AIR_HOCKEY_CUSTOMIZATION=${JSON.stringify(customization)};`,
  'airHockeyInventory.js': `export const airHockeyAccountId=()=> 'preview';export const getAirHockeyInventory=()=>({});export const isAirHockeyOptionUnlocked=()=>true;`,
  'textToSpeech.js': `export const getSpeechSupport=()=>false,getSpeechSynthesis=()=>null,onSpeechSupportChange=()=>()=>{},primeSpeechSynthesis=()=>{},speakCommentaryLines=()=>Promise.resolve();`
};
// The preview uses the production game, controls, camera and collision code.
// Only external services and asset transport are substituted for the inline frame.
const result = await build({
  absWorkingDir: root, bundle: true, minify: true, write: false, format: 'esm', target: 'es2022',
  outfile: 'air-hockey-inline.js', jsx: 'automatic', external: ['react','react/jsx-runtime','react-dom','react-dom/client','three','three/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Game from './webapp/src/components/AirHockey3D.jsx';const player={name:'You',avatar:'🇦🇱'},ai={name:'Opponent',avatar:'🇬🇧'};createRoot(document.getElementById('tonplaygram-air-hockey-preview')).render(<Game player={player} ai={ai} target={11}/>);`, resolveDir: root, sourcefile: 'air-hockey-inline-entry.tsx', loader: 'tsx' },
  plugins: [{ name: 'inline-offline-preview', setup(b) {
    b.onLoad({ filter: /\.(jsx?|tsx?)$/ }, async ({path}) => {
      const name=path.split('/').pop();
      if (stubs[name]) return { contents:stubs[name],loader:name.endsWith('jsx')?'jsx':'js' };
      if (name==='AirHockey3D.jsx') {
        let source=await readFile(path,'utf8');
        source="import { AirHockeySoftwareRenderer } from '../previews/AirHockeySoftwareRenderer';\n"+source;
        source=source.replace('new THREE.WebGLRenderer({', 'new InlineRenderer({');
        source+=`\nfunction InlineRenderer(options){const canvas=document.createElement('canvas');const context=canvas.getContext('webgl2',options);return context?new THREE.WebGLRenderer({...options,canvas,context}):new AirHockeySoftwareRenderer();}\n`;
        source=source.replace('loadPolyHavenHdriEnvironment(renderer, hdriOption)', 'Promise.resolve(null)')
          .replace('modelLoaded = true;', 'if (renderer.isSoftwareRenderer) { renderer.staticVersion++; [you, aiMallet, puck].forEach(piece => piece.traverse(object => { object.renderOrder = 4; })); } modelLoaded = true;')
          .replaceAll(/new Audio\('\/assets\/sounds\/[^']+'\)/g,'new Audio(bombSound)')
          .replace("{renderOptionRow('HDRI Environment', 'environmentHdri')}", '')
          .replace('onClick={toggleLiveFromAvatar}', 'onClick={() => setShowGift(true)}')
          .replace("aria-label={liveMode ? 'Turn off live avatar video' : 'Turn on live avatar video'}", 'aria-label="Live match features"');
        return { contents:source,loader:'jsx' };
      }
      if (path.endsWith('/airHockey/model.ts')) {
        const source=(await readFile(path,'utf8')).replace('const gltf = await new GLTFLoader().loadAsync(url);','const gltf = await decodeEmbeddedModel();');
        return {loader:'ts',contents:source+`\nasync function decodeEmbeddedModel(){
          const raw=atob('${compressed}'), bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
          const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          const reader=stream.getReader(), chunks=[];let size=0;
          for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;}
          const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
          const view=new DataView(data.buffer),len=view.getUint32(12,true),glb=JSON.parse(new TextDecoder().decode(data.subarray(20,20+len))),bin=28+len;
          const primitive=glb.meshes[0].primitives[0];
          function attribute(id){const a=glb.accessors[id],v=glb.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],values=new Float32Array(a.count*n);for(let i=0;i<a.count;i++)for(let c=0;c<n;c++){const at=bin+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*4)+c*4;values[i*n+c]=a.componentType===5126?view.getFloat32(at,true):view.getUint32(at,true);}return new THREE.BufferAttribute(values,n);}
          const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',attribute(primitive.attributes.POSITION));geometry.setAttribute('normal',attribute(primitive.attributes.NORMAL));geometry.setAttribute('uv',attribute(primitive.attributes.TEXCOORD_0));geometry.setIndex(Array.from(attribute(primitive.indices).array));
          const textures=await Promise.all(glb.images.map(image=>new Promise((resolve,reject)=>{const v=glb.bufferViews[image.bufferView],payload=data.subarray(bin+(v.byteOffset||0),bin+(v.byteOffset||0)+v.byteLength);let text='';for(let i=0;i<payload.length;i+=8192)text+=String.fromCharCode(...payload.subarray(i,i+8192));const img=new Image(),texture=new THREE.Texture(img);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;img.onload=()=>{texture.needsUpdate=true;resolve(texture)};img.onerror=reject;img.src='data:'+image.mimeType+';base64,'+btoa(text);} )));
          const material=new THREE.MeshStandardMaterial({map:textures[0],emissiveMap:textures[1],emissive:0xffffff,roughness:.6,metalness:0,side:THREE.DoubleSide});const scene=new THREE.Group();scene.add(new THREE.Mesh(geometry,material));return {scene};
        }`};
      }
    });
  }}]
});
const source = await readFile(resolve(root,'webapp/src/components/AirHockey3D.jsx'),'utf8');
const quick = await readFile(resolve(root,'webapp/src/components/QuickMessagePopup.jsx'),'utf8');
const tailwind = await postcss([tailwindcss({ content:[{raw:source,extension:'jsx'},{raw:quick,extension:'jsx'}], corePlugins:{preflight:false} })]).process('@tailwind utilities;', {from:undefined});
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const script=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const importmap={imports:{react:'https://esm.sh/react@18.2.0','react/jsx-runtime':'https://esm.sh/react@18.2.0/jsx-runtime','react-dom':'https://esm.sh/react-dom@18.2.0?external=react','react-dom/client':'https://esm.sh/react-dom@18.2.0/client?external=react',three:'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js','three/':'https://cdn.jsdelivr.net/npm/three@0.164.0/'}};
const fragment=`<div id="tonplaygram-air-hockey-preview"></div>\n<style>\n${tailwind.css}\n${css}\n#tonplaygram-air-hockey-preview{position:relative;max-width:430px;margin:0 auto}#tonplaygram-air-hockey-preview *{box-sizing:border-box}#tonplaygram-air-hockey-preview .ah-game{height:720px;max-height:none}#tonplaygram-air-hockey-preview button{cursor:pointer;font-family:inherit}#tonplaygram-air-hockey-preview .ah-preview-notice{position:absolute;inset:30% 20px auto;z-index:60;background:#0e1928;color:#eef8ff;padding:24px;border-radius:20px;box-shadow:0 0 0 100vmax #0009;text-align:center}#tonplaygram-air-hockey-preview .ah-preview-notice button{min-height:44px;padding:8px 20px;border:1px solid #b9e7ff26;border-radius:12px;background:#123345;color:#d8f6ff}\n</style>\n<script type="importmap">${JSON.stringify(importmap)}</script>\n<script type="module">\n${script.replace(/<\/script/gi,'<\\/script')}\n</script>\n`;
if(Buffer.byteLength(fragment)>=1_000_000)throw new Error('Inline preview exceeds 1 MB: '+Buffer.byteLength(fragment));
if(/\bfetch\(|XMLHttpRequest|new WebSocket/.test(script))throw new Error('Inline preview must not request external data');
const output=resolve(process.argv[2]||'/workspace/tonplaygram-air-hockey.html');
await writeFile(output,fragment);console.log(`Preview: ${output} (${Buffer.byteLength(fragment)} bytes)`);
