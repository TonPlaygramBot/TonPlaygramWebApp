import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {existsSync,createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
const webapp=fileURLToPath(new URL('../webapp/',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'kart-fleet-'));
const out=resolve(process.argv[2]||'docs/validation/kart-fleet');await mkdir(out,{recursive:true});
await build({stdin:{contents:`import {KartRenderer} from './src/games/kartroyale/renderer';
window.game=new KartRenderer(document.getElementById('root'),()=>{},()=>{},s=>{throw Error(s)});
window.ready=window.game.load();`,resolveDir:webapp,loader:'ts'},bundle:true,format:'esm',outfile:join(temp,'qa.js'),logLevel:'warning'});
await writeFile(join(temp,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;background:#101820}</style><div id="root"></div><script type="module" src="/qa.js"></script>');
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 const file=pathname.startsWith('/assets/')?join(webapp,'public',pathname):join(temp,pathname==='/'?'index.html':pathname);
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');createReadStream(file).pipe(res);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/karts/'))requests.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(()=>window.ready);
 const rigs=[];
 for(const id of ['apex','oobi','oodi','ooli','oopi']){
  await page.evaluate(id=>window.game.setKart(id),id);
  await page.waitForTimeout(200);
  rigs.push(await page.evaluate(()=>{const g=window.game,v=g.showroom.children[0],r=g.rigs.get(v);return {id:g.kartId,wheels:r.wheels.length,steering:r.front.length,body:r.body.name};}));
  await page.screenshot({path:join(out,`${id}.png`)});
 }
 assert.ok(rigs.every(r=>r.wheels===4&&r.steering===2&&r.body==='body'));
 await page.evaluate(()=>{const g=window.game;g.setKart('apex');g.setCameraMode('chase');g.setQuality('performance');g.startLocal('skanderbeg','rookie');g.countdown=0;g.state='racing';g.input.reverse=true;});
 await page.waitForFunction(()=>window.game.racers.find(r=>r.id===window.game.me)?.speed < -2);
 const reverse=await page.evaluate(()=>window.game.racers.find(r=>r.id===window.game.me).speed);
 await page.evaluate(()=>window.game.paused=true);
 await page.screenshot({path:join(out,'reverse.png'),timeout:60000});
 await page.evaluate(()=>window.game.paused=false);
 await page.evaluate(()=>{const g=window.game,r=g.racers.find(r=>r.id===g.me);r.rollTime=2.2;r.rollDirection=1;g.input.reverse=false;});
 await page.waitForFunction(()=>Math.abs(window.game.racers.find(r=>r.id===window.game.me)?.rollAngle)>3);
 await page.evaluate(()=>window.game.paused=true);
 await page.screenshot({path:join(out,'overturned.png'),timeout:60000});
 await page.evaluate(()=>window.game.paused=false);
 await page.waitForFunction(()=>window.game.racers.find(r=>r.id===window.game.me)?.rollTime===0);
 assert.deepEqual(errors,[]);assert.ok(requests.length>=10&&requests.every(r=>r.status===200));
 await writeFile(join(out,'results.json'),JSON.stringify({viewport:{width:390,height:844},scope:'Actual KartRenderer, software WebGL; rollover visual check seeds server-owned timer. No physical-phone benchmark.',rigs,reverse,requests,errors},null,2));
 console.log('Portrait fleet, reverse and recovery verified:',out);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
