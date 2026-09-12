import {MAPPED_TREES} from '../tirana-city-source/registry.mjs';
import {STREET_LIFE} from './streetLifeData.mjs';
import {CANOPY_SUPPLEMENT} from './canopySupplement.mjs';
import {NEIGHBOURHOOD_CANOPY} from './neighbourhoodCanopy.mjs';
const mature=new Map(STREET_LIFE.trees.map(t=>[t.id,t]));
// All original source trunks now share the same distant LOD as mature trees.
// Existing photo-informed dimensions take precedence; coordinates are retained.
export const CANOPY_TREES=[...MAPPED_TREES.map((t,i)=>mature.get(t.id)||({
 id:t.id,x:t.x,z:t.z,shape:t.model==='tree_cypress'?'column':'upright',height:t.height||9,crown:t.crown||5.5,seed:i,zone:'mapped-trunk',accuracy:'Mapped trunk; unmeasured dimensions estimated'
})),...STREET_LIFE.trees.filter(t=>!MAPPED_TREES.some(p=>p.id===t.id)),...CANOPY_SUPPLEMENT.trees,...NEIGHBOURHOOD_CANOPY.trees];
