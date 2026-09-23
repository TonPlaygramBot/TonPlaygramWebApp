import {URBAN_MONUMENTS} from '../../tirana-landmarks/urbanMonuments.mjs';
import {urbanTrafficGraph} from '../../tirana-neighbourhood/urbanRoutingCore.mjs';
import {ROOFTOP_HEIGHT_ESTIMATES} from './rooftopSiteConfig.mjs';
import {BUSINESS_BUILDING_PARTS} from '../../tirana-city-source/businessBuildingProfiles.mjs';
// Source-backed east/south neighbourhood extension; central snapshot retained verbatim.
import {WORLD as CENTRAL_WORLD} from './centralWorld.mjs';
import {NEIGHBOURHOOD} from '../../tirana-neighbourhood/data.mjs';
import {extendNeighbourhood} from '../../tirana-neighbourhood/worldExtension.mjs';
import {OBSERVED_HEIGHTS} from '../../tirana-city-source/neighbourhoodProfiles.mjs';
import {VERIFIED_LANDMARK_HEIGHTS} from '../../tirana-city-source/verifiedLandmarkHeights.mjs';
import {EAST} from '../../tirana-east/data.mjs';
export const WORLD=extendNeighbourhood(extendNeighbourhood(CENTRAL_WORLD,NEIGHBOURHOOD),EAST);
WORLD.graph=urbanTrafficGraph(WORLD.graph);
// Keep rendering and collision on the same visual height; preserve raw source
// provenance instead of changing or inventing an OSM measured-height tag.
WORLD.buildings=WORLD.buildings.map(b=>{const observed=VERIFIED_LANDMARK_HEIGHTS[b.id]||OBSERVED_HEIGHTS[b.id]||ROOFTOP_HEIGHT_ESTIMATES[b.id];return observed?{...b,h:observed.height,originalHeight:b.h,heightBasis:observed.basis,visualHeightSource:observed.source}:b;});

WORLD.buildings.push(...BUSINESS_BUILDING_PARTS);

// The map uses the same retained square anchors as the static sculptures.
WORLD.landmarks=[...WORLD.landmarks,...URBAN_MONUMENTS.map(({id,name,x,z})=>({id,name,x,z}))];
