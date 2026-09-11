/** Bundle the user's original 26 models at build time; never silently substitute. */
import {readFile,writeFile,mkdir,copyFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const manifest=JSON.parse(await readFile(join(root,'public/assets/tirana-streets/imported/manifest.json'),'utf8'));
const out=join(root,'public/assets/tirana-streets/imported');await mkdir(join(out,'draco'),{recursive:true});
for(const name of ['draco_decoder.js','draco_decoder.wasm','draco_wasm_wrapper.js'])await copyFile(join(root,'node_modules/three/examples/jsm/libs/draco/gltf',name),join(out,'draco',name));
async function fetchBytes(url) {
  let last;
  for(let attempt=0;attempt<3;attempt++)try {
    const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);
    let bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.subarray(0,42).toString().startsWith('version https://git-lfs.github.com/spec/v1')) {
      const pointer=bytes.toString(),oid=pointer.match(/oid sha256:([a-f0-9]+)/)?.[1];
      const media=String(url).replace(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@/]+)@([^/]+)\//,'https://media.githubusercontent.com/media/$1/$2/$3/').replace('https://raw.githubusercontent.com/','https://media.githubusercontent.com/media/');
      if(media===String(url))throw Error(`Cannot resolve LFS source: ${url}`);
      const original=await fetch(media,{signal:AbortSignal.timeout(45000)});if(!original.ok)throw Error(`LFS HTTP ${original.status}`);
      bytes=Buffer.from(await original.arrayBuffer());
      if(createHash('sha256').update(bytes).digest('hex')!==oid)throw Error(`LFS hash mismatch: ${url}`);
    }
    return bytes;
  }catch(error){last=error;}
  throw last;
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function importAsset(item) {
  const file=join(root,'public',item.localUrl);
  try{const existing=await readFile(file);if(hash(existing)===item.sha256)return;}catch{}
  // These exact originals ship with the repository because their host blocks CI.
  if(new URL(item.sourceUrl).hostname==='static.poly.pizza') {
    throw Error(`Bundled original missing or corrupt: ${item.name} (${item.localUrl}). Restore this file from Git; its SHA-256 must match manifest.json.`);
  }
  let bytes=await fetchBytes(item.sourceUrl);
  if(item.localUrl.endsWith('.gltf')){
    const doc=JSON.parse(bytes);
    for(const key of ['buffers','images'])for(const resource of doc[key]||[]){
      const uri=resource.uri;if(!uri||uri.startsWith('data:'))continue;
      const data=await fetchBytes(new URL(uri,item.sourceUrl));
      const mime=resource.mimeType||(key==='buffers'?'application/octet-stream':/\.jpe?g$/i.test(uri)?'image/jpeg':'image/png');
      resource.uri=`data:${mime};base64,${data.toString('base64')}`;
    }
    bytes=Buffer.from(JSON.stringify(doc));
  }
  if(hash(bytes)!==item.sha256)throw Error(`Original changed upstream: ${item.name}. Review the source and refresh its manifest explicitly.`);
  await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);
  console.log(`Bundled ${item.name}`);
}
let index=0;
await Promise.all(Array.from({length:4},async()=>{while(index<manifest.length)await importAsset(manifest[index++]);}));
console.log(`Verified ${manifest.length} original Tirana assets`);
