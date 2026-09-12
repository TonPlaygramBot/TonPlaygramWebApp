import {WORLD} from '../tiranastreets/shared/world.mjs';
import {roadSurfaceIndex, type Polygon} from './roadSurfaceCore.mjs';
let index:ReturnType<typeof roadSurfaceIndex>|undefined;
export function prepareRoadSurfaceIndex(){return index??=roadSurfaceIndex(WORLD.roads);}
export function cutRoads(polygon:Polygon){return prepareRoadSurfaceIndex()(polygon);}

