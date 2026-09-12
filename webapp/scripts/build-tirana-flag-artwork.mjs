import {readdir,readFile,writeFile} from 'node:fs/promises';
const folder=new URL('../public/assets/tirana-streets/flags/',import.meta.url),artwork={};
for(const file of (await readdir(folder)).filter(f=>f.endsWith('.svg')).sort())artwork[file.slice(0,-4).toUpperCase()]='data:image/svg+xml;base64,'+(await readFile(new URL(file,folder))).toString('base64');
await writeFile(new URL('../src/games/tirana-city-source/flagArtwork.mjs',import.meta.url),'// Bundled copies of the attributed local SVG flags; see public/assets/tirana-streets/flags/ATTRIBUTION.md.\nexport const FLAG_ARTWORK='+JSON.stringify(artwork)+';\n');
