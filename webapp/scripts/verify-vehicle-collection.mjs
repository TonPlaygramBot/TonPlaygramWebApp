import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {VEHICLE_COLLECTION} from '../src/games/tiranastreets/shared/vehicleCollection.mjs';
for(const asset of VEHICLE_COLLECTION){
 const bytes=await readFile(new URL('../public'+asset.url,import.meta.url));
 if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error(`Original vehicle missing or changed: ${asset.id}. Restore the approved GLB; do not optimize or substitute it.`);
}
console.log('Verified all 10 unchanged Blender vehicle GLBs');
