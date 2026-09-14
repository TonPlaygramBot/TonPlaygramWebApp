import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { loadCheckersHumanTemplate } from '../test/checkersHumanFixture.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = await loadCheckersHumanTemplate();
template.traverse((node) => {
  if (!node.isMesh) return;
  node.castShadow = true;
  node.receiveShadow = true;
  node.frustumCulled = false;
  for (const material of Array.isArray(node.material)
    ? node.material
    : [node.material]) {
    for (const key of [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap'
    ])
      material[key] = null;
    const name = `${node.name} ${material.name}`.toLowerCase();
    if (/skin|body|head/.test(name)) material.color.set('#cda284');
    if (/shirt|top|outfit/.test(name)) material.color.set('#375a68');
    if (/pant|bottom/.test(name)) material.color.set('#243747');
    if (/hair|shoe|hat/.test(name)) material.color.set('#39291e');
    material.roughness = 0.75;
    material.metalness = 0.05;
  }
  node.geometry.morphAttributes = {};
  node.morphTargetInfluences = undefined;
  node.morphTargetDictionary = undefined;
});
const modelData = gzipSync(JSON.stringify(template.toJSON())).toString(
  'base64'
);
const output = process.argv[2] || '/workspace/backgammon-royal.html';
const cssPath = resolve(
  root,
  'webapp/node_modules/.cache/backgammon-preview.css'
);
const cssInput = resolve(
  root,
  'webapp/node_modules/.cache/backgammon-input.css'
);
await (
  await import('node:fs/promises')
).mkdir(dirname(cssPath), { recursive: true });
await writeFile(
  cssInput,
  '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'
);
execFileSync(
  resolve(root, 'webapp/node_modules/.bin/tailwindcss'),
  [
    '--input',
    cssInput,
    '--output',
    cssPath,
    '--content',
    resolve(root, 'webapp/src/pages/Games/TavullBattleRoyal.jsx'),
    '--minify'
  ],
  { cwd: resolve(root, 'webapp'), stdio: 'pipe' }
);
const result = await build({
  entryPoints: [
    resolve(root, 'webapp/src/previews/backgammon/inlineEntry.tsx')
  ],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  write: false,
  jsx: 'automatic',
  define: {
    BACKGAMMON_PREVIEW_HUMAN: JSON.stringify(modelData),
    'process.env.NODE_ENV': '"production"'
  },
  plugins: [
    {
      name: 'inline-resources',
      setup(api) {
        api.onResolve({ filter: /seatedHumanModel\.js$/ }, () => ({
          path: resolve(root, 'webapp/src/previews/backgammon/inlineHuman.ts')
        }));
        api.onResolve({ filter: /backgammon\/environment\.ts$/ }, () => ({
          path: resolve(
            root,
            'webapp/src/previews/backgammon/inlineEnvironment.ts'
          )
        }));
        api.onResolve(
          {
            filter:
              /(BottomLeftIcons|AvatarTimer|QuickMessagePopup|GiftPopup)\.jsx$|useTelegramBackButton\.js$/
          },
          () => ({ path: 'empty', namespace: 'preview' })
        );
        api.onLoad({ filter: /.*/, namespace: 'preview' }, () => ({
          contents:
            'export default function PreviewOnlyOmission(){ return null; }',
          loader: 'js'
        }));
        api.onResolve(
          { filter: /^(three|react|react-dom)(\/.*)?$/ },
          (args) => {
            if (args.path === 'three')
              return {
                path: 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',
                external: true
              };
            if (args.path === 'react-dom/client')
              return {
                path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
                external: true
              };
            if (args.path === 'react/jsx-runtime')
              return {
                path: 'https://esm.sh/react@18.3.1/jsx-runtime',
                external: true
              };
            if (args.path === 'react')
              return { path: 'https://esm.sh/react@18.3.1', external: true };
          }
        );
      }
    }
  ]
});
const fragment = await readFile(
  resolve(root, 'scripts/backgammon-preview.fragment.html'),
  'utf8'
);
const html = fragment
  .replace('/* BACKGAMMON_CSS */', () => readCss())
  .replace('/* BACKGAMMON_CODE */', () => result.outputFiles[0].text);
function readCss() {
  return execFileSync('cat', [cssPath], { encoding: 'utf8' });
}
if (Buffer.byteLength(html) > 1000000)
  throw new Error(`Inline preview too large: ${Buffer.byteLength(html)}`);
await writeFile(output, html);
console.log(`Built ${output} (${Buffer.byteLength(html)} bytes)`);
