/** Local-only review harness. /game mounts the actual Tirana Streets route;
 * / inspects the same in-game vehicle layer with all original assets. */
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {existsSync,createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {contentSecurityPolicy} from '../bot/config/contentSecurityPolicy.js';
const root=fileURLToPath(new URL('../',import.meta.url)),webapp=join(root,'webapp'),out=await mkdtemp(join(tmpdir(),'tirana-collection-'));
const common={bundle:true,format:'esm',logLevel:'warning',absWorkingDir:root,nodePaths:[join(webapp,'node_modules')],define:{'process.env.NODE_ENV':'"production"'}};
await build({...common,entryPoints:[join(root,'test/fixtures/tiranaVehicleCollection.tsx')],outfile:join(out,'probe.js')});
await build({...common,stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import Game from './src/pages/Games/TiranaStreets.jsx';createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/games/tiranastreets'+location.search]}><Game/></MemoryRouter>);`,resolveDir:webapp,loader:'tsx'},outfile:join(out,'game.js'),plugins:[{name:'expose-local-test-runtime',setup(b){
 b.onLoad({filter:/street-career\/StreetCareerRuntime\.ts$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('    this.profile=campaign.load(storage);','    (window as any).streetRuntime=this; this.profile=campaign.load(storage);').replace('this.input=new CityInput(', 'if(new URLSearchParams(location.search).has("qaOnDemand")){const draw=this.renderer.renderer.render.bind(this.renderer.renderer);(window as any).drawGameFrame=()=>draw(this.renderer.scene,this.renderer.camera);this.renderer.renderer.render=()=>{};} this.input=new CityInput('),loader:'ts'}));
 b.onLoad({filter:/pages\/Games\/Blackwater\.jsx$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('const ready = useCallback((game) => setEngine(game), []);','const ready = useCallback((game) => {window.fpsEngine=game;setEngine(game)}, []);'),loader:'jsx'}));
}}]});
const policy=Object.entries(contentSecurityPolicy.directives).map(([k,v])=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+' '+v.join(' ')).join(';');
export const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',policy);const path=new URL(req.url,'http://local').pathname;
 if(path==='/'||path==='/game'){
  const name=path==='/game'?'game':'probe';res.setHeader('Content-Type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tirana Streets vehicle verification</title><link rel="stylesheet" href="/${name}.css"><style>html,body,#root{margin:0;width:100%;height:100%;font:14px Arial;background:#17222d;color:white}header{padding:18px}select,button{padding:10px;max-width:100%;margin:4px 4px 4px 0}</style><div id="root"></div><script>window.qaErrors=[];window.cspViolations=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));document.addEventListener('securitypolicyviolation',e=>cspViolations.push(e.effectiveDirective));</script><script type="module" src="/${name}.js"></script>`);return;
 }
 if(path==='/favicon.ico'||path==='/probe.css'){res.writeHead(204);res.end();return;}
 const f=path.startsWith('/assets/')?join(webapp,'public',path):join(out,path);
 if(!f.startsWith(webapp)&&!f.startsWith(out)||!existsSync(f)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.wasm':'application/wasm'})[extname(f)]||'application/octet-stream');createReadStream(f).pipe(res);
});await new Promise(resolve=>server.listen(4187,'127.0.0.1',resolve));
console.log('Tirana review: http://127.0.0.1:4187');
