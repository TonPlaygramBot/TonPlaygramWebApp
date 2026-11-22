import { build } from 'esbuild';
await build({entryPoints:['src/main.tsx'], bundle:true, outfile:process.argv[2] || '../../webapp/public/assets/optika-3d-v1/game.js', format:'iife', jsx:'automatic', minify:true, target:['es2020'], define:{'process.env.NODE_ENV':'"production"'}, legalComments:'eof'});
