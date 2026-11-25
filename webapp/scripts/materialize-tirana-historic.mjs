/** Build from the reviewed immutable ODbL data only. No world-module import,
 * Git checkout, renderer dependency, remote fetch, or source extraction. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

const root=fileURLToPath(new URL('../',import.meta.url));
const archive='vendor-inputs/tirana-historical-sectors.v1.json.gz';
const dataPath='public/assets/tirana-city-game/historic';
const expected='3e5ec23ba64f96b79ac0fcceb24b7898c1f9db03ed10b2fcd28dbebc58faf2c7';
const startSha='62b395a8ac85a8bdb6e92818ed36075e890bbd665ac4598c171b4c1f12f0ad0a';
const historic='871f3c38c512084c495eeaa0811b0788d62c751b';
const sha=b=>createHash('sha256').update(b).digest('hex');
const isName=s=>typeof s==='string'&&/^(start|-?\d{1,2}_-?\d{1,2})\.json$/.test(s);
export async function readHistoricBundle(file=path.join(root,archive)){
  const stat=await lstat(file);
  assert.ok(stat.isFile()&&stat.size<3_000_000,'Unsupported historic input file');
  const input=await readFile(file);
  assert.equal(sha(input),expected,'Historic input hash mismatch');
  const value=JSON.parse(gunzipSync(input,{maxOutputLength:16_000_000}).toString('utf8'));
  assert.equal(value.version,1);
  assert.ok(Array.isArray(value.files)&&value.files.length===420);
  const tiles=new Map();
  for(const row of value.files){
    assert.ok(Array.isArray(row)&&row.length===3);
    const [name,digest,text]=row;
    assert.ok(isName(name)&&!tiles.has(name),'Invalid or duplicate sector name');
    assert.ok(typeof text==='string'&&text.length<160_000,'Unexpected sector size');
    assert.equal(sha(text),digest,'Sector data hash mismatch: '+name);
    tiles.set(name,{digest,text});
  }
  const start=tiles.get('start.json');
  assert.equal(start?.digest,startSha,'Historical start mismatch');
  const m=JSON.parse(start.text);
  assert.equal(m.historical,historic);
  assert.ok(m.keys.length===tiles.size&&new Set(m.keys).size===tiles.size);
  for(const k of m.keys){
    assert.ok(isName(k+'.json'));
    if(k!==m.first.key)assert.ok(tiles.has(k+'.json'),'Missing sector '+k);
  }
  return tiles;
}
async function verify(out,bundle){
  const s=await lstat(out);assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'Historic directory must not be symlinked');
  const listed=await readdir(out,{withFileTypes:true});
  assert.equal(listed.length,bundle.size,'Unexpected number of staged historic tiles');
  for(const dirent of listed){
    const tile=bundle.get(dirent.name);
    assert.ok(dirent.isFile()&&tile,'Unexpected staged sector '+dirent.name);
    assert.equal(sha(await readFile(path.join(out,dirent.name))),tile.digest,'Staged sector mismatch: '+dirent.name);
  }
}
export async function materializeHistoricalSectors({webapp=root,verifyOnly=false}={}){
  const bundle=await readHistoricBundle(path.join(webapp,archive));
  const out=path.join(webapp,dataPath);
  if(verifyOnly){await verify(out,bundle);return bundle.size;}
  const parent=path.dirname(out);
  await mkdir(parent,{recursive:true});
  const scratch=await mkdtemp(path.join(parent,'.historic-swap-')), staged=path.join(scratch,'next'), backup=path.join(scratch,'old');
  let saved=false,keepForRecovery=false;
  try{
    await mkdir(staged);
    for(const [name,row] of bundle)await writeFile(path.join(staged,name),row.text,{flag:'wx'});
    await verify(staged,bundle);
    const previous=await lstat(out).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(previous){
      assert.ok(previous.isDirectory()&&!previous.isSymbolicLink(),'Historic directory must not be symlinked');
      // This is the project's generated output folder. Refuse unrelated files.
      assert.ok((await readdir(out,{withFileTypes:true})).every(d=>d.isFile()&&isName(d.name)),'Unexpected content in generated historic directory');
      await rename(out,backup);saved=true;
    }
    try{await rename(staged,out);}catch(error){
      if(saved)try{await rename(backup,out);}catch(rollback){
        keepForRecovery=true;throw new AggregateError([error,rollback],'Could not activate output; inspect historic swap folder');
      }
      throw error;
    }
    return bundle.size;
  }finally{if(!keepForRecovery)await rm(scratch,{recursive:true,force:true});}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const count=await materializeHistoricalSectors({verifyOnly:process.argv.includes('--verify')});
  console.log('Verified '+count+' pinned historic Tirana tiles.');
}
