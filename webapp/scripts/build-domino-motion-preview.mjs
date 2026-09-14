import { build } from 'esbuild';
import postcss from 'postcss';
import { compactPreviewModel } from './domino-royal-preview-model.mjs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const output = resolve(process.argv[2] || '/tmp/domino-royal-motion-preview.html');
const inlineOutput = resolve(process.argv[3] || '/workspace/domino-royal-hands-reviewed.html');
// Fail closed if a gameplay fix has not been copied into the review extracts.
const sourceMotion = await readFile(resolve(app, 'public/domino-royal-game.js'), 'utf8');
const extractedMotion = await readFile(resolve(here, 'domino-royal-production-motion.ts'), 'utf8');
const expected = JSON.parse(extractedMotion.match(/functions: Object\.freeze\((\{[\s\S]*?\})\)/)?.[1] || '{}');
const sourceFunctions = new Map(parse(sourceMotion, { sourceType: 'module' }).program.body.filter((node) => node.type === 'FunctionDeclaration').map((node) => [node.id.name, sourceMotion.slice(node.start, node.end)]));
const stale = Object.entries(expected).filter(([name, hash]) => createHash('sha256').update(sourceFunctions.get(name) || '').digest('hex') !== hash).map(([name]) => name);
if (!Object.keys(expected).length || stale.length) throw new Error(`Production motion extracts need refreshing: ${stale.join(', ') || 'missing source hashes'}. Run node webapp/scripts/refresh-domino-review-motion.mjs, then node webapp/scripts/check-domino-review-parity.mjs.`);

const sourceModel = await readFile(resolve(app, 'public/assets/pool-royale/readyplayer.me.glb'));
const { model, geometrySha256 } = await compactPreviewModel(sourceModel);
const packed = gzipSync(model, { level: 9 }).toString('base64');
const result = await build({
  entryPoints: [resolve(here, 'domino-royal-motion-preview.tsx')], bundle: true, write: false,
  format: 'esm', platform: 'browser', target: 'es2022', minify: true, treeShaking: true,
  external: ['react', 'react-dom/client', 'three', 'three/*'],
  define: { __DOMINO_REVIEW_MODEL_GZIP__: JSON.stringify(packed) },
  logLevel: 'warning'
});
const js = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const imports = {
  react: 'https://esm.sh/react@18.3.1',
  'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime?external=react',
  'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?external=react',
  three: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js',
  'three/': 'https://cdn.jsdelivr.net/npm/three@0.164.0/'
};
const rootId = 'domino-royal-hands-reviewed-root';
const cssSource = `
*{box-sizing:border-box}button,select,input{font:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.motion-review{display:grid;grid-template-rows:60px minmax(0,1fr) auto;height:100%;max-width:520px;margin:auto;background:#07100f}header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #294033;gap:8px}header strong{display:block;color:#eed697;font-size:12px;letter-spacing:.08em}header small{display:block;margin-top:3px;color:#aec4b7;font-size:11px}.review-top-actions{display:flex;gap:5px}button,select{min-height:44px;border:1px solid #3c5544;border-radius:10px;background:#11281e;color:#f0ead8;padding:0 10px;font-size:12px;font-weight:500}button:disabled,input:disabled,select:disabled{opacity:.4}button:active{background:#345440}.motion-stage{min-height:0;position:relative;overflow:hidden}.motion-stage canvas{display:block;width:100%;height:100%;touch-action:none}footer{padding:0 10px 10px;background:#0b1b15;border-top:1px solid #294033}footer p{min-height:34px;display:flex;align-items:center;justify-content:center;text-align:center;margin:0;font-size:12px;line-height:1.3;color:#d8e2d9}.motion-selection{display:grid;grid-template-columns:48px minmax(0,1fr) 66px;gap:6px;align-items:center}.motion-selection label,.motion-scrub label,.hand-options span{color:#b7cbbc;font-size:12px}.motion-selection select{width:100%;font-size:16px;padding:0 6px}.motion-scrub{display:grid;grid-template-columns:48px minmax(0,1fr);gap:6px;align-items:center}.motion-scrub input{width:100%;min-height:44px;margin:0;accent-color:#e2cd8f}.hand-options{display:grid;grid-template-columns:68px repeat(5,1fr);gap:5px;align-items:center}.hand-options button{padding:0;min-height:44px}.hand-options button[aria-pressed=true]{background:#e2cd8f;border-color:#e2cd8f;color:#152b1d}@media(max-width:350px){header{padding:7px 8px}.hand-options{grid-template-columns:60px repeat(5,1fr)}.review-top-actions button{padding:0 7px;font-size:11px}}
`;
const css = postcss.parse(cssSource);
css.walkRules((rule) => {
  rule.selector = rule.selector.split(',').map((selector) => `#${rootId} ${selector.trim()}`).join(',');
});
const rootStyle = `#${rootId}{margin:0 auto;width:100%;max-width:520px;height:760px;overflow:hidden;background:#07100f;color:#edf4e9;font-family:Inter,system-ui,-apple-system,sans-serif}`;
const fragment = `<div id="${rootId}"></div><style>${rootStyle}${css.toString()}</style><script type="importmap">${JSON.stringify({ imports })}</script><script type="module">${js}</script>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Domino Royal · Hands Review</title><style>html,body{margin:0;height:100%;background:#07100f}#${rootId}{height:100dvh!important}</style></head><body>${fragment}</body></html>`;
if (Buffer.byteLength(fragment) >= 1_000_000) throw new Error(`Preview exceeds 1 MB: ${Buffer.byteLength(fragment)} bytes.`);
await mkdir(dirname(output), { recursive: true }); await writeFile(output, html);
await mkdir(dirname(inlineOutput), { recursive: true }); await writeFile(inlineOutput, fragment);
console.log(JSON.stringify({ output, inlineOutput, bytes: Buffer.byteLength(html), inlineBytes: Buffer.byteLength(fragment), originalModelBytes: sourceModel.length, compactModelBytes: model.length, geometrySha256, packedModelCharacters: packed.length }));
