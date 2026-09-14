import {WORLD} from '../tiranastreets/shared/world.mjs';
import {streetLampPlacements} from './urbanLightingCore.mjs';
import {onCarriageway,SHOP} from '../tiranastreets/shared/streetLayout.mjs';
export const LAMPS=streetLampPlacements(WORLD).filter(p=>!onCarriageway(p.x,p.z,.25)&&Math.hypot(p.x-SHOP.x,p.z-SHOP.z)>12);
