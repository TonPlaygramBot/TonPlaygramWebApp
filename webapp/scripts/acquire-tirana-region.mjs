#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {acquisitionTiles,mergeAcquisition} from './tirana/regionAcquisition.mjs';
import {buildRegionQuery,REGION_BBOX} from '../src/games/tirana-region/regionCore.mjs';
import {importRegionSource} from './tirana/regionImport.mjs';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
 const [output,at,...extra]=process.argv.slice(2);
 if(!output||!at||extra.length||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(at)||!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.now())throw Error('Usage: node scripts/acquire-tirana-region.mjs output-directory snapshot-UTC (YYYY-MM-DDTHH:mm:ssZ, not in the future)');
 const root=resolve(output),url='https://overpass-api.de/api/interpreter',tiles=acquisitionTiles();
 await mkdir(root,{recursive:true});const parts=[],receipts=[];
 for(const tile of tiles){
  const query=buildRegionQuery(tile.bbox).replace('out body;','out meta;').replace('[out:json]','[out:json][date:"'+at+'"]'),file=join(root,`${tile.id}.json`),meta=file+'.receipt.json';
  let bytes,receipt;
  try{bytes=await readFile(file);receipt=JSON.parse(await readFile(meta,'utf8'));if(receipt.query!==query||receipt.sha256!==sha(bytes)||receipt.url!==url)throw Error('Cache provenance mismatch');}
  catch(e){
   // Invalid cached data is never quietly overwritten. Remove it explicitly to reacquire.
   if(e.code!=='ENOENT')throw e;
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(210000)});
   if(!response.ok)throw Error(`Tile ${tile.id}: HTTP ${response.status}; rerun later to resume`);
   if(Number(response.headers.get('content-length'))>100*1024*1024)throw Error('Tile exceeds 100 MiB');
   const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>100*1024*1024)throw Error('Tile exceeds 100 MiB');chunks.push(chunk);}bytes=Buffer.concat(chunks);
   const raw=JSON.parse(bytes);if(raw.remark||!raw.elements?.length)throw Error(`Tile ${tile.id}: empty or partial response`);
   receipt={tile:tile.id,bbox:tile.bbox,url,query,snapshot:at,acquiredAt:new Date().toISOString(),sha256:sha(bytes)};
   await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);await writeFile(meta,JSON.stringify(receipt,null,2));
  }
  parts.push(JSON.parse(bytes));receipts.push(receipt);console.log(`${tile.id}: ${parts.at(-1).elements.length} source elements`);
 }
 const raw=mergeAcquisition(parts,{snapshot:at}),bytes=Buffer.from(JSON.stringify(raw));
 const review=importRegionSource(raw,{origin:WORLD.origin,sourceURL:url,acquiredAt:new Date().toISOString(),sha256:sha(bytes)});
 review.acquisition={snapshot:at,bbox:REGION_BBOX,tiles:receipts};
 for(const [name,data] of [['region.osm.json',bytes],['region-review.json',JSON.stringify(review)]]){await writeFile(join(root,name+'.tmp'),data);await rename(join(root,name+'.tmp'),join(root,name));}
 console.log(`Complete source acquisition: ${review.roads.length} segments, ${review.buildings.length} footprints. Terrain/collision promotion remains separate.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
