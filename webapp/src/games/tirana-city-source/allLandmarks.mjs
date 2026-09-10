import {LANDMARK_DATA as BASE} from './landmarkData.mjs';
import {CITY_BUILDING_DATA} from './cityBuildingData.mjs';
export const LANDMARK_DATA={...BASE,buildings:[...BASE.buildings,...CITY_BUILDING_DATA.buildings],sources:[...BASE.sources,...CITY_BUILDING_DATA.sources]};
