import {segmentDistance} from '../tiranastreets/shared/streetLayout.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {clearStreetPoint} from '../tiranastreets/shared/streetSafety.mjs';
const road=WORLD.roads.filter(r=>r.name==='Rruga e Kavajës'&&!r.walk&&!r.bridge);

// Rough spreading broadleaf outline observed on Kavajës. Species, crown height
// and individual planting dates aren't present in the mapped source.
export function withKavajeCanopy(tree) {
 if(tree.shape!=='upright'||!/^node\/\d+$/.test(tree.id)||
    !['mapped-trunk','urban-extract'].includes(tree.zone)||
    tree.x< -2460||tree.x> -210||tree.z< -135||tree.z> 710) return tree;
 if(!road.some(r=>segmentDistance(tree.x,tree.z,r.a,r.b)<19)||!clearStreetPoint(tree,.45))return tree;
 return {...tree,shape:'garden',
  dimensionsAccuracy:'Existing estimated height and crown; broadleaf-like appearance read from corridor photographs'};
}
