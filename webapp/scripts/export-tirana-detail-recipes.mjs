import {writeFile} from 'node:fs/promises';
import {RECIPES,PALETTE} from '../src/games/tirana-detail-kit/recipes.mjs';
const file=process.argv[2];
if(!file)throw Error('Usage: node webapp/scripts/export-tirana-detail-recipes.mjs output.json');
await writeFile(file,JSON.stringify({schemaVersion:1,units:'metres',coordinateSystem:'three-y-up',provenance:'Original artistic urban modules; not surveyed fixture positions or Google models',palette:PALETTE,assets:RECIPES},null,2)+'\n');
