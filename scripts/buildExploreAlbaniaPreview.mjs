import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const urls={
  react:'https://esm.sh/react@18.3.1',
  'react/jsx-runtime':'https://esm.sh/react@18.3.1/jsx-runtime',
  'react-dom/client':'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
  three:'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js'
};
const result=await build({entryPoints:['webapp/src/games/explorealbania/standalone.tsx'],bundle:true,write:false,minify:true,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'preview',setup(b){b.onResolve({filter:/^(react|react\/jsx-runtime|react-dom\/client|three)$/},a=>({path:urls[a.path],external:true}));b.onResolve({filter:/\.css$/},()=>({path:'empty',namespace:'css-empty'}));b.onLoad({filter:/.*/,namespace:'css-empty'},()=>({contents:'',loader:'js'}));}}]});
const css=await readFile('webapp/src/games/explorealbania/explore-albania.css','utf8'),js=result.outputFiles[0].text;
const fragment=`<div id="explore-albania-preview"></div>\n<style>\n${css}\n</style>\n<script type="module">\n${js}\n</script>\n`;
if(Buffer.byteLength(fragment)>1_000_000)throw Error('Preview exceeds 1 MB');
await writeFile('/workspace/explore-albania.html',fragment);
console.log(`Preview bytes ${Buffer.byteLength(fragment)}`);
