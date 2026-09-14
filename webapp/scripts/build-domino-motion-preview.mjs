import { build } from 'esbuild';
import postcss from 'postcss';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const output = resolve(process.argv[2] || '/tmp/domino-royal-motion-preview.html');
const inlineOutput = resolve(process.argv[3] || '/workspace/domino-royal-motion.html');
const model = await readFile(resolve(app, 'public/assets/table-tennis/chess-human.glb'));
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
const rootId = 'domino-royal-motion-root';
const cssSource = `*{box-sizing:border-box}button{font:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.motion-review{display:grid;grid-template-rows:58px minmax(0,1fr) auto;height:100%;max-width:520px;margin:auto;background:#07100f}header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #294033}header strong{display:block;color:#eed697;font-size:12px;letter-spacing:.13em}header small{display:block;margin-top:3px;color:#9ab4a5;font-size:10px}button{min-height:44px;border:1px solid #3c5544;border-radius:11px;background:#11281e;color:#f0ead8;padding:0 10px;font-size:11px;font-weight:650}button:focus-visible{outline:2px solid #e5cf92;outline-offset:2px}button:disabled{opacity:.4}button:active{background:#345440}.motion-stage{min-height:0;position:relative;overflow:hidden}.motion-stage canvas{display:block;width:100%;height:100%;touch-action:none}footer{padding:0 10px max(10px,env(safe-area-inset-bottom,0px));background:#0b1b15;border-top:1px solid #294033}footer p{height:32px;display:flex;align-items:center;justify-content:center;text-align:center;margin:0;font-size:11px;color:#cad9cd}.hand-options{display:grid;grid-template-columns:68px repeat(5,1fr);gap:5px;margin-bottom:7px;align-items:center}.hand-options span{color:#adbeaf;font-size:11px}.hand-options button{padding:0;min-height:44px}.hand-options button[aria-pressed=true]{background:#e2cd8f;border-color:#e2cd8f;color:#152b1d}.motion-actions{display:grid;grid-template-columns:1.15fr 1.35fr .75fr .75fr;gap:5px}.motion-actions button{padding:0 4px}.motion-actions button:nth-child(2){background:#e2cd8f;border-color:#e2cd8f;color:#152b1d}@media(max-width:350px){header{padding:7px 10px}.hand-options{grid-template-columns:60px repeat(5,1fr)}button{font-size:10px}}@media(min-height:850px){.motion-review{grid-template-rows:64px minmax(0,1fr) auto}footer{padding-top:4px}.hand-options button{min-height:44px}}`;
const css = postcss.parse(cssSource);
css.walkRules((rule) => {
  rule.selector = rule.selector.split(',').map((selector) => `#${rootId} ${selector.trim()}`).join(',');
});
const rootStyle = `#${rootId}{margin:0 auto;width:100%;max-width:520px;height:760px;overflow:hidden;background:#07100f;color:#edf4e9;font-family:Inter,system-ui,-apple-system,sans-serif}`;
const fragment = `<div id="${rootId}"></div><style>${rootStyle}${css.toString()}</style><script type="importmap">${JSON.stringify({ imports })}</script><script type="module">${js}</script>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Domino Royal · Visual Motion Preview</title><style>html,body{margin:0;height:100%;background:#07100f}#${rootId}{height:100dvh!important}</style></head><body>${fragment}</body></html>`;
if (Buffer.byteLength(fragment) >= 1_048_576) throw new Error(`Preview exceeds 1 MiB: ${Buffer.byteLength(fragment)} bytes.`);
await mkdir(dirname(output), { recursive: true }); await writeFile(output, html);
await mkdir(dirname(inlineOutput), { recursive: true }); await writeFile(inlineOutput, fragment);
console.log(JSON.stringify({ output, inlineOutput, bytes: Buffer.byteLength(html), inlineBytes: Buffer.byteLength(fragment), originalModelBytes: model.length, packedModelCharacters: packed.length }));
