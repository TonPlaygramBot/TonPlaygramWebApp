// Source-backed east/south neighbourhood extension; central snapshot retained verbatim.
import {WORLD as CENTRAL_WORLD} from './centralWorld.mjs';
import {NEIGHBOURHOOD} from '../../tirana-neighbourhood/data.mjs';
import {extendNeighbourhood} from '../../tirana-neighbourhood/worldExtension.mjs';
export const WORLD=extendNeighbourhood(CENTRAL_WORLD,NEIGHBOURHOOD);
