#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {importRegionSource} from './tirana/regionImport.mjs';
import {buildRegionQuery} from '../src/games/tirana-region/regionCore.mjs';
// Explicit opt-in command; never run an external Overpass request during a build.
async function main(){
 const args=process.argv.slice(2);
 if(args[0]==='--query'){console.log(buildRegionQuery());return;}
 if(args.length!==4)throw Error('Usage: node scripts/import-tirana-region.mjs input.osm.json output.json source-https-url acquired-at-ISO');
 const [input,output,url,acquiredAt]=args,bytes=await readFile(input);if(bytes.length>100*1024*1024)throw Error('Input exceeds 100 MiB safety limit');
 const {WORLD}=await import(new URL('../src/games/tiranastreets/shared/world.mjs',import.meta.url).href);
 const result=importRegionSource(JSON.parse(bytes.toString('utf8')),{origin:WORLD.origin,sourceURL:url,acquiredAt,sha256:createHash('sha256').update(bytes).digest('hex')});
 await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(result));
 console.log(`${result.roads.length} source road segments, ${result.buildings.length} footprints, ${result.water.length} water features. REVIEW ONLY: existing games unchanged.`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
