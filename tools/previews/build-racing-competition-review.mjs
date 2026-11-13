import {build} from '../../webapp/node_modules/esbuild/lib/main.js';
import {mkdir,writeFile,cp,readFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(process.argv[2]||'/tmp/racing-competition-review');
await mkdir(resolve(output,'dist'),{recursive:true});
const result=await build({entryPoints:[resolve(root,'tools/previews/racing-competition-review.tsx')],bundle:true,format:'esm',minify:true,metafile:true,
  outfile:resolve(output,'dist/review.js'),nodePaths:[resolve(root,'webapp/node_modules')],define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
await writeFile(resolve(output,'dist/index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#101920"><title>Racing Royal · Competition Update</title><link rel="stylesheet" href="/review.css"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:#101920}*{box-sizing:border-box}button,select{font:inherit}button{cursor:pointer}</style></head><body><div id="root"></div><script type="module" src="/review.js"></script></body></html>`);
// Copy actual bundled GLTFs and textures, retaining their attribution files.
for(const dir of ['kart-royale','tirana-streets','table-tennis','tirana-detail-kit','tirana-landmarks']){
  await cp(resolve(root,'webapp/public/assets',dir),resolve(output,'dist/assets',dir),{recursive:true,
    filter:path=>!/(?:albanian-forces|vehicle-collection|weapons|players|population|city-mobility)(?:\/|$)/.test(relative(resolve(root,'webapp/public/assets',dir),path))});
}
await cp(resolve(root,'webapp/public/vendor'),resolve(output,'dist/vendor'),{recursive:true});
// Preserve the exact bundled source alongside the review for future edits.
for(const input of Object.keys(result.metafile.inputs)){
 const path=resolve(input);if(path.includes('node_modules')||!path.startsWith(root))continue;
 const dest=resolve(output,'source',relative(root,path));await mkdir(dirname(dest),{recursive:true});await cp(path,dest);
}
await writeFile(resolve(output,'source/package.json'),await readFile(resolve(root,'webapp/package.json')));
console.log(JSON.stringify({output,sourceFiles:Object.keys(result.metafile.inputs).length,entry:'Production Racing Royal · standalone account-free review'}));
