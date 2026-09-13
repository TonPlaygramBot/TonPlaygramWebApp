const { buildSync } = require('../webapp/node_modules/esbuild');
const path = require('node:path');
const result = buildSync({
  stdin: {
    contents: `export * from './webapp/src/games/snooker/TailugePhysics';
    export * from './webapp/src/games/snooker/TailugeSnookerRules';
    export { mapTailugeTableVertex, createTailugeTable } from './webapp/src/games/snooker/TailugeTable';
    export { Group } from './webapp/node_modules/three/build/three.module.js';
    export { GLTFLoader } from './webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
    export { State } from './webapp/src/games/snooker/vendor/tailuge/model/ball';`,
    resolveDir: path.resolve(__dirname, '..'),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs'
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  require,
  compiled,
  compiled.exports
);
module.exports = compiled.exports;
