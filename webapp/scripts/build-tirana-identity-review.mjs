/** Bundle the actual project meshes into a self-contained portrait review.
 * --out should be an absolute path to the conversation's HTML fragment. */
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),artwork={};
const records=JSON.parse(await readFile(resolve(root,'webapp/src/games/tirana-street-life/identityReliefs.json'),'utf8'));
for(const id of Object.keys(records))artwork[id]='data:image/png;base64,'+(await readFile(resolve(root,'webapp/public/assets/tirana-streets/signs/'+id+'-logo.png'))).toString('base64');
const result=await build({entryPoints:[resolve(root,'webapp/scripts/review/tirana-identity-review.tsx')],bundle:true,format:'esm',minify:true,write:false,external:['three','react','react-dom/client'],plugins:[{name:'embedded-artwork',setup(build){build.onResolve({filter:/^tirana-review-artwork$/},()=>({path:'artwork',namespace:'inline'}));build.onLoad({filter:/.*/,namespace:'inline'},()=>({contents:'export default '+JSON.stringify(artwork),loader:'js'}));}}]});
let fragment=await readFile(resolve(root,'webapp/scripts/review/tirana-identity-review.html'),'utf8');fragment=fragment.replace('/* INLINE_MODULE */',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
if(Buffer.byteLength(fragment)>1_000_000)throw Error('Review exceeds the inline size limit');
const flag=process.argv.indexOf('--out');if(flag<0||!process.argv[flag+1])throw Error('Supply --out /absolute/path.html');
await writeFile(resolve(process.argv[flag+1]),fragment);console.log('Review bytes:',Buffer.byteLength(fragment));
