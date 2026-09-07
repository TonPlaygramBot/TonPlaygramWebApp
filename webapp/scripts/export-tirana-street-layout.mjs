import { writeFileSync } from 'node:fs';
import { WORLD } from '../src/games/tiranastreets/shared/world.mjs';
import { SIGNALS, SHOP } from '../src/games/tiranastreets/shared/streetLayout.mjs';
import { RIVER_PATHS } from '../src/games/tiranastreets/shared/landscape.mjs';
if (!process.argv[2]) throw Error('Provide an output JSON path for Blender.');
writeFileSync(
  process.argv[2],
  JSON.stringify({
    roads: WORLD.roads,
    buildings: WORLD.buildings,
    parks: WORLD.parks,
    signals: SIGNALS,
    shop: SHOP,
    water: RIVER_PATHS
  })
);
