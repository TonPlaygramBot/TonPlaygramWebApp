#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {prepareBlenderScene} from './tirana/blenderScene.mjs';

const [input,output,...rest]=process.argv.slice(2);
if (!input||!output||rest.length||resolve(input)===resolve(output))
  throw Error('Usage: node webapp/scripts/prepare-tirana-blender.mjs regional-review.json blender-scene.json');
const result=prepareBlenderScene(JSON.parse(await readFile(input,'utf8')));
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(output,JSON.stringify(result));
console.log(JSON.stringify(result.report,null,2));
console.log('Blender authoring input prepared; no GLTF exported and no playable region promoted.');
