import {PARLIAMENT_GARDEN_TREES} from './parliamentGarden.mjs';
import {QUARTER} from '../tirana-tabakeve/quarterData.mjs';
import {pointInUrbanBounds} from '../tiranastreets/shared/urbanBounds.mjs';
import {roadsidePoint} from '../tiranastreets/shared/streetSafety.mjs';
import {MAPPED_TREES} from '../tirana-city-source/registry.mjs';
import {STREET_LIFE} from './streetLifeData.mjs';
import {CANOPY_SUPPLEMENT} from './canopySupplement.mjs';
import {NEIGHBOURHOOD_CANOPY} from './neighbourhoodCanopy.mjs';
const mature=new Map(STREET_LIFE.trees.map(t=>[t.id,t]));
// All original source trunks now share the same distant LOD as mature trees.
// Existing photo-informed dimensions take precedence; raw coordinates are retained below.
export const CANOPY_SOURCE_TREES=[...MAPPED_TREES.map((t,i)=>mature.get(t.id)||({
 id:t.id,x:t.x,z:t.z,shape:t.model==='tree_cypress'?'column':'upright',height:t.height||9,crown:t.crown||5.5,seed:i,zone:'mapped-trunk',accuracy:'Mapped trunk; unmeasured dimensions estimated'
})),...STREET_LIFE.trees.filter(t=>!MAPPED_TREES.some(p=>p.id===t.id)),...CANOPY_SUPPLEMENT.trees,...NEIGHBOURHOOD_CANOPY.trees,...PARLIAMENT_GARDEN_TREES].filter(t=>pointInUrbanBounds(t));

// Source positions remain available for attribution and single-owner suppression.
const quarterDimensions=new Map(QUARTER.overrides.map(t=>[t.id,t]));
export const CANOPY_TREES=[...CANOPY_SOURCE_TREES,...QUARTER.trees]
 .map(t=>({...t,...quarterDimensions.get(t.id)}))
 .map(t=>roadsidePoint(t,Math.max(.45,Math.min(.8,t.crown*.08)))).filter(t=>t&&pointInUrbanBounds(t,Math.max(1,t.crown/2)));
