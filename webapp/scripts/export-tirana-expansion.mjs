import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ASSET_IDS,buildGltfAsset} from '../src/games/tirana-expansion/gltfAssets.mjs';
const out=resolve(process.argv[2]||'tirana-expansion-assets');await mkdir(out,{recursive:true});
for(const id of ASSET_IDS)await writeFile(resolve(out,`${id}.gltf`),JSON.stringify(buildGltfAsset(id)));
console.log(`Exported ${ASSET_IDS.length} original self-contained glTF assets to ${out}`);
