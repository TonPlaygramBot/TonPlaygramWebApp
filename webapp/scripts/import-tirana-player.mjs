import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PLAYER_CATALOG} from '../src/games/tiranastreets/playerCatalog.mjs';
// Run only on an original downloaded with permission, after retarget/visual QA.
// Embedded GLB resources make the asset portable and complete offline.
const [id,input,reviewed]=process.argv.slice(2);
const entry=PLAYER_CATALOG.find(p=>p.id===id);
if(!entry||!input||reviewed!=='--rig-reviewed')throw Error('Usage: node scripts/import-tirana-player.mjs <tactical|polish|city|forest|sand> <reviewed.glb> --rig-reviewed');
const buffer=await readFile(input);
if(buffer.length<20||buffer.readUInt32LE(0)!==0x46546c67||buffer.readUInt32LE(4)!==2||buffer.readUInt32LE(8)!==buffer.length||buffer.readUInt32LE(16)!==0x4e4f534a)throw Error('Expected a complete GLB 2.0 file');
const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
if(!json.skins?.some(s=>s.joints?.length>12)||!json.nodes?.some(n=>n.skin!==undefined&&n.mesh!==undefined))throw Error('A skinned humanoid rig is required');
if([...json.buffers||[],...json.images||[]].some(r=>r.uri&&!r.uri.startsWith('data:')))throw Error('Embed all textures and buffers before importing for offline play');
const names=(json.nodes||[]).map(n=>(n.name||'').replace(/[^a-z]/gi,'').toLowerCase()).join(' ');
for(const pattern of [/head/,/hand/,/(hips|pelvis)/,/(foot|ankle)/])if(!pattern.test(names))throw Error('Rig lacks named humanoid joints required by the body/weapon solver');
if(buffer.length>40*1024*1024)throw Error('Optimize the character below 40 MB for mobile before importing');
const root=fileURLToPath(new URL('../public/assets/tirana-streets/players/',import.meta.url));await mkdir(root,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
await copyFile(input,path.join(root,id+'.glb'));
manifest.players[id]={url:'/assets/tirana-streets/players/'+id+'.glb',rigValidated:true,sha256:createHash('sha256').update(buffer).digest('hex'),size:buffer.length,source:entry.source,author:entry.author,licence:entry.licence,changes:'Converted/optimized for the Tirana humanoid and weapon rig; reviewed in game'};
await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Imported '+entry.label+'. Include the GLB and manifest in the same commit.');
