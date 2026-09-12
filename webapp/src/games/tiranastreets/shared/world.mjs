import {BUSINESS_BUILDING_PARTS} from '../../tirana-city-source/businessBuildingProfiles.mjs';
// Source-backed east/south neighbourhood extension; central snapshot retained verbatim.
import {WORLD as CENTRAL_WORLD} from './centralWorld.mjs';
import {NEIGHBOURHOOD} from '../../tirana-neighbourhood/data.mjs';
import {extendNeighbourhood} from '../../tirana-neighbourhood/worldExtension.mjs';
import {OBSERVED_HEIGHTS} from '../../tirana-city-source/neighbourhoodProfiles.mjs';
export const WORLD=extendNeighbourhood(CENTRAL_WORLD,NEIGHBOURHOOD);
// Keep rendering and collision on the same visual height; preserve raw source
// provenance instead of changing or inventing an OSM measured-height tag.
WORLD.buildings=WORLD.buildings.map(b=>{const observed=OBSERVED_HEIGHTS[b.id];return observed?{...b,h:observed.height,originalHeight:b.h,heightBasis:observed.basis,visualHeightSource:observed.source}:b;});

WORLD.buildings.push(...BUSINESS_BUILDING_PARTS);
