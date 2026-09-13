import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {ORIGIN} from './layout.mjs';
/** Battlefield uses the same metre datum as Streets, with an X/Z translation. */
export function battleGround(x,z){return groundHeight(x+ORIGIN.x,z+ORIGIN.z);}
