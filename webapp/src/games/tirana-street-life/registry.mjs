import {STREET_LIFE} from './streetLifeData.mjs';
import {CANOPY_TREES} from './canopyRegistry.mjs';
export {FUEL_CANOPY_IDS} from './fuelCollision.mjs';
export {STREET_LIFE};
export const REAL_STOREFRONT_BUILDING_IDS=new Set(STREET_LIFE.storefronts.map(f=>f.buildingId));
export const MATURE_TREE_IDS=new Set(CANOPY_TREES.map(t=>t.id));
