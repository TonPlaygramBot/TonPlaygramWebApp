import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {materializeHistoricalSectors} from '../webapp/scripts/materialize-tirana-historic.mjs';

const bundleName='tirana-historical-sectors.v1.json.gz';
const bundle=new URL('../webapp/vendor-inputs/'+bundleName,import.meta.url);
const data='public/assets/tirana-city-game/historic';
const stage=async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'tp-historic-materialize-'));
  await mkdir(path.join(root,'vendor-inputs'));
  await copyFile(bundle,path.join(root,'vendor-inputs',bundleName));
  return {root,out:path.join(root,data)};
};

test('materializer works without checkout history, source modules, npm dependencies or network',async()=>{
  const {root,out}=await stage();
  try{
    assert.equal(await materializeHistoricalSectors({webapp:root}),420);
    assert.equal(await materializeHistoricalSectors({webapp:root,verifyOnly:true}),420);
    await writeFile(path.join(out,'1_0.json'),'{}');
    await assert.rejects(materializeHistoricalSectors({webapp:root,verifyOnly:true}),/Staged sector mismatch/);
    assert.equal(await materializeHistoricalSectors({webapp:root}),420);
    assert.equal(await materializeHistoricalSectors({webapp:root,verifyOnly:true}),420);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('corrupt source or unrelated files cannot clobber existing working generated data',async()=>{
  const {root,out}=await stage();
  try{
    await materializeHistoricalSectors({webapp:root});
    const startPath=path.join(out,'start.json'), start=await readFile(startPath);
    const stored=path.join(root,'vendor-inputs',bundleName);
    await rename(stored,stored+'.good');
    await writeFile(stored,'invalid');
    await assert.rejects(materializeHistoricalSectors({webapp:root}),/input hash mismatch/);
    assert.deepEqual(await readFile(startPath),start);
    await rename(stored+'.good',stored);
    await writeFile(path.join(out,'keep.txt'),'not generated');
    await assert.rejects(materializeHistoricalSectors({webapp:root}),/Unexpected content/);
    assert.deepEqual(await readFile(startPath),start);
    assert.equal(await readFile(path.join(out,'keep.txt'),'utf8'),'not generated');
  }finally{await rm(root,{recursive:true,force:true});}
});
