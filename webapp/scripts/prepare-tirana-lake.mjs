import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SOURCE_QUERY,importLakeSource} from './tirana/lakeSource.mjs';
// Run with a saved Overpass JSON extract, or explicitly request one bounded fetch.
// This writes a REVIEW artifact, never overwrites the live WORLD or uploads data.
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node webapp/scripts/prepare-tirana-lake.mjs source.json|--fetch output.review.json');
let bytes;
if(input==='--fetch'){
  const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:SOURCE_QUERY}),signal:AbortSignal.timeout(55000)});
  if(!response.ok)throw Error(`OSM source request failed: HTTP ${response.status}`);
  bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>80*1024*1024)throw Error('Unexpectedly large regional extract');
}else bytes=await readFile(input);
const result=importLakeSource(JSON.parse(bytes.toString('utf8')));
result.sourceSha256=createHash('sha256').update(bytes).digest('hex');
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,stage:result.stage,shorelineNodes:result.lake.nodeIds.length,roads:result.roads.length,buildings:result.buildings.length,furniture:result.furniture.length,readyForRuntime:false}));
