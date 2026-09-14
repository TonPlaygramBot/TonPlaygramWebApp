import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {BATTLEFIELD_MAP_CATALOG} from '../webapp/src/games/blackwater/shared/mapCatalog.mjs';

const heavy = /games\/(?:tiranastreets\/shared\/(?:world|engine)|blackwater\/(?:engine|shared\/layout)|tirana-neighbourhood\/data|tirana-east\/data)|node_modules\/three\//;
const bundle = entry => build({entryPoints:[entry],bundle:true,write:false,metafile:true,outdir:'webapp/.lobby-build-test',splitting:true,format:'esm',platform:'browser',logLevel:'silent'});
function staticGraph(meta, entry) {
  const start=Object.entries(meta.outputs).find(([,out])=>out.entryPoint===entry)?.[0];
  assert.ok(start,'entry output exists');
  const seen=new Set(),inputs=new Set();
  function visit(path) {
    if(seen.has(path))return;seen.add(path);
    const out=meta.outputs[path];assert.ok(out,`output ${path}`);
    Object.keys(out.inputs).forEach(p=>inputs.add(p));
    out.imports.filter(i=>!i.external&&i.kind!=='dynamic-import').forEach(i=>visit(i.path));
  }
  visit(start);return {inputs:[...inputs],outputs:[...seen]};
}
const staticInputs=(meta,entry)=>staticGraph(meta,entry).inputs;
test('lobby selectors do not bundle city data, collision placement or Three.js',async()=>{
  const entry='webapp/src/pages/Games/TiranaStreetsLobby.jsx',result=await bundle(entry);
  assert.deepEqual(staticInputs(result.metafile,entry).filter(p=>heavy.test(p)),[]);
  // Optional character previews have their own chunk; budget the code needed
  // for the lobby's first render, not every separately loadable asset.
  const bytes=staticGraph(result.metafile,entry).outputs.reduce((n,p)=>n+result.metafile.outputs[p].bytes,0);
  assert.ok(bytes<2_000_000,`lobby bundle unexpectedly large: ${bytes}`);
});
test('direct game host can show loading/back controls before city runtime loads',async()=>{
  const entry='webapp/src/pages/Games/Blackwater.jsx',result=await bundle(entry);
  assert.deepEqual(staticInputs(result.metafile,entry).filter(p=>heavy.test(p)),[]);
  assert.ok(staticInputs(result.metafile,entry).some(p=>p.endsWith('/TiranaLoading.tsx')));
});
test('Blender ornament is an optional chunk; complete mosque masses stay synchronous',async()=>{
  const entry='webapp/src/games/tirana-city-source/BlenderMosque.ts',result=await bundle(entry);
  const inputs=staticInputs(result.metafile,entry);
  assert.ok(inputs.some(p=>p.endsWith('/MosqueShell.ts')));
  assert.ok(!inputs.some(p=>p.endsWith('/namazgah-far.mjs')),'2 MB geometry must not gate the runtime import');
  assert.ok(Object.values(result.metafile.outputs).some(o=>o.entryPoint?.endsWith('/namazgah-far.mjs')),'authored Blender detail remains a separately loadable asset');
});
test('Career renderer uses baked imported props without evaluating battlefield deployments',async()=>{
  const entry='webapp/src/games/tiranastreets/renderer.ts',result=await bundle(entry);
  const inputs=staticInputs(result.metafile,entry);
  assert.ok(inputs.some(p=>p.endsWith('/blackwater/shared/importedPlacements.mjs')));
  assert.ok(!inputs.some(p=>p.endsWith('/blackwater/shared/layout.mjs')),'Career must not calculate all battlefield starts merely to draw imported props');
});
test('menu preserves unique maps and district seeds from the mapped snapshots',async()=>{
  const [{NEIGHBOURHOOD},{EAST}]=await Promise.all([
    import('../webapp/src/games/tirana-neighbourhood/data.mjs'),
    import('../webapp/src/games/tirana-east/data.mjs')
  ]);
  const districts=[...new Map([...NEIGHBOURHOOD.districts,...EAST.districts].map(d=>[d.id,d])).values()].filter(d=>d.name!=='Blloku').map(d=>({id:`district-${d.id.split('/').pop()}`,name:d.name,worldX:d.point[0],worldZ:d.point[1]}));
  assert.deepEqual(BATTLEFIELD_MAP_CATALOG.filter(m=>m.id.startsWith('district-')),districts);
  assert.equal(new Set(BATTLEFIELD_MAP_CATALOG.map(m=>m.id)).size,BATTLEFIELD_MAP_CATALOG.length);
  assert.equal(BATTLEFIELD_MAP_CATALOG[0].id,'skanderbeg');
  for(const m of BATTLEFIELD_MAP_CATALOG)assert.ok(m.name&&Number.isFinite(m.worldX)&&Number.isFinite(m.worldZ));
});
