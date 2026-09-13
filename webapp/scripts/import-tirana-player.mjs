import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PLAYER_CATALOG} from '../src/games/tiranastreets/playerCatalog.mjs';
import {canonicalHumanoidBone} from '../src/games/tiranastreets/street-career/humanoidRig.mjs';
// Structural compatibility validation. Visual and device QA are separate gates.
// Embedded GLB resources make the asset portable and complete offline.
const [id,input]=process.argv.slice(2);
const entry=PLAYER_CATALOG.find(p=>p.id===id);
if(!entry||!input)throw Error('Usage: node scripts/import-tirana-player.mjs <tactical|polish|agent-47> <optimized.glb>');
const buffer=await readFile(input);
if(buffer.length<20||buffer.readUInt32LE(0)!==0x46546c67||buffer.readUInt32LE(4)!==2||buffer.readUInt32LE(8)!==buffer.length||buffer.readUInt32LE(16)!==0x4e4f534a)throw Error('Expected a complete GLB 2.0 file');
const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
if(!json.skins?.some(s=>s.joints?.length>12)||!json.nodes?.some(n=>n.skin!==undefined&&n.mesh!==undefined))throw Error('A skinned humanoid rig is required');
if([...json.buffers||[],...json.images||[]].some(r=>r.uri&&!r.uri.startsWith('data:')))throw Error('Embed all textures and buffers before importing for offline play');
const names=new Set((json.skins||[]).flatMap(s=>s.joints).map(i=>canonicalHumanoidBone(json.nodes[i]?.name||'')));
for(const name of ['hips','head','leftarm','leftforearm','lefthand','rightarm','rightforearm','righthand','leftupleg','leftleg','leftfoot','rightupleg','rightleg','rightfoot'])
  if(!names.has(name))throw Error('Rig lacks required humanoid joint: '+name);
if(buffer.length>15*1024*1024)throw Error('Optimize the character below 15 MiB for mobile before importing');
const root=fileURLToPath(new URL('../public/assets/tirana-streets/players/',import.meta.url));await mkdir(root,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
if(path.resolve(input)!==path.join(root,id+'.glb'))await copyFile(input,path.join(root,id+'.glb'));
manifest.players[id]={url:'/assets/tirana-streets/players/'+id+'.glb',rigValidated:true,validation:'Embedded GLB and mapped humanoid joints; visual/device QA tracked separately',sha256:createHash('sha256').update(buffer).digest('hex'),size:buffer.length,source:entry.source,author:entry.author,licence:entry.licence,licenceUrl:entry.licenceUrl,changes:'Textures resized and re-encoded; source geometry, skin and authored transforms preserved. Gameplay uses a rig adapter.'};
await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Imported '+entry.label+'. Include the GLB and manifest in the same commit.');
