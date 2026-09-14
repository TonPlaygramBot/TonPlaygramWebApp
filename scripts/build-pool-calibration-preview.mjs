import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { readPoolRoyalMetrics } from './read-pool-royal-metrics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  metrics = await readPoolRoyalMetrics();
const tableBytes = await readFile(
  new URL(
    '../webapp/public/models/pool-royale/showood-seven-foot/showood-4k.glb',
    import.meta.url
  )
);
const geometry = await build({
  stdin: {
    contents:
      "export * from './webapp/src/pages/Games/shared/poolRoyalTableGeometry.ts'",
    resolveDir: root
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
});
const { fitPoolRoyalTable } = await import(
  `data:text/javascript;base64,${Buffer.from(geometry.outputFiles[0].text).toString('base64')}`
);
const loader = new GLTFLoader();
loader.register(() => ({
  name: 'GeometryOnly',
  loadTexture: () => Promise.resolve(null)
}));
const parse = (bytes) =>
  loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    ''
  );
const calibration = fitPoolRoyalTable(
  (await parse(tableBytes)).scene,
  metrics.playW,
  metrics.playL,
  metrics.clothY
);
const pocket = calibration.pockets[0].center,
  direction = pocket.clone().normalize();
const cue = pocket.clone().addScaledVector(direction, -28);
const characterBytes = await readFile(
  new URL(
    '../webapp/public/assets/pool-royale/readyplayer.me.glb',
    import.meta.url
  )
);
const players = new PoolRoyalHumanPlayers(new THREE.Scene(), {
  ...metrics,
  model: (await parse(characterBytes)).scene
});
await players.ready;
const frame = {
  activeSeat: 'A',
  state: 'dragging',
  cueBall: new THREE.Vector3(cue.x, metrics.ballY, cue.y),
  aimForward: new THREE.Vector3(direction.x, 0, direction.y),
  power: 0.65,
  nowMs: 1000
};
for (let i = 0; i < 90; i++) players.update(1 / 60, frame);
const trace = [players.eyeView.position.toArray()];
for (let i = 0; i < 90; i++) {
  players.update(1 / 60, {
    ...frame,
    state: i < 8 ? 'striking' : 'idle',
    nowMs: 1000 + (i * 1000) / 60
  });
  trace.push(players.eyeView.position.toArray().map((n) => +n.toFixed(7)));
}
players.dispose();
const result = await build({
  entryPoints: [root + 'webapp/src/previews/PoolRoyalCalibrationPreview.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  minify: true,
  target: 'es2022',
  write: false,
  define: {
    POOL_TABLE_GZIP: JSON.stringify(gzipSync(tableBytes).toString('base64')),
    POOL_REVIEW_METRICS: JSON.stringify(metrics),
    POOL_EYE_TRACE: JSON.stringify(trace)
  },
  plugins: [
    {
      name: 'preview-static-imports',
      setup(api) {
        api.onResolve(
          { filter: /^(three|react|react-dom)(\/.*)?$/ },
          (args) => {
            if (args.path === 'three')
              return {
                path: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js',
                external: true
              };
            if (args.path.startsWith('three/')) return undefined;
            if (args.path === 'react-dom/client')
              return {
                path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
                external: true
              };
            return {
              path: `https://esm.sh/${args.path.replace('react', 'react@18.3.1')}`,
              external: true
            };
          }
        );
      }
    }
  ]
});
const fragment = (
  await readFile(
    new URL('./pool-calibration-preview.fragment.html', import.meta.url),
    'utf8'
  )
).replace('/* POOL_CALIBRATION_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000)
  throw new Error('Inline preview exceeds 1 MB');
const output = process.argv[2] ?? '/workspace/pool-royal-calibration.html';
await writeFile(output, fragment);
console.log(`Preview: ${output} (${Buffer.byteLength(fragment)} bytes)`);
