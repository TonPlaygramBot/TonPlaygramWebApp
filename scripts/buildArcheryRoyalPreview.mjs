import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const urls = {
  react: 'https://esm.sh/react@18.3.1',
  'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime',
  'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
  'react-router-dom': 'https://esm.sh/react-router-dom@6.30.1?deps=react@18.3.1,react-dom@18.3.1',
  three: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js',
  'three/examples/jsm/loaders/GLTFLoader.js': 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/loaders/GLTFLoader.js',
  'three/examples/jsm/loaders/RGBELoader.js': 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/loaders/RGBELoader.js'
};

const result = await build({
  entryPoints: ['webapp/src/games/archeryroyal/standalone.tsx'],
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'archery-preview',
    setup(builder) {
      builder.onResolve({ filter: /\/online$/ }, () => ({ path: 'online-stub', namespace: 'archery-stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'archery-stub' }, () => ({ contents: 'export class OnlineArcherySession { constructor(){ throw new Error("Online mode is available in TonPlaygramWebApp.") } }', loader: 'js' }));
      builder.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom\/client|react-router-dom|three|three\/examples\/jsm\/loaders\/(GLTFLoader|RGBELoader)\.js)$/ }, (args) => ({ path: urls[args.path], external: true }));
      builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'empty', namespace: 'css-empty' }));
      builder.onLoad({ filter: /.*/, namespace: 'css-empty' }, () => ({ contents: '', loader: 'js' }));
    }
  }]
});

const css = await readFile('webapp/src/games/archeryroyal/archery-royal.css', 'utf8');
const js = result.outputFiles[0].text;
const fragment = `<div id="archery-royal-preview"></div>\n<style>\n${css}\n#archery-royal-preview{height:760px;max-height:88vh;min-height:620px;overflow:hidden}\n#archery-royal-preview .ar-game{height:100%;min-height:100%}\n</style>\n<script type="module">\n${js}\n</script>\n`;
if (Buffer.byteLength(fragment) > 1_000_000) throw new Error('Preview exceeds 1 MB');
await writeFile('/workspace/archery-royal.html', fragment);
console.log(`Preview bytes ${Buffer.byteLength(fragment)}`);
