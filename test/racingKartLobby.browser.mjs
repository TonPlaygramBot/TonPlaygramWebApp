import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
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
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Game from './src/games/kartroyale/BaseKartRoyale';createRoot(document.getElementById('root')).render(<Game/>);`,resolveDir:webapp,loader:'tsx'},bundle:true,format:'esm',outfile:join(temp,'qa.js'),logLevel:'warning',plugins:[{name:'browser-test-engine',setup(build){build.onLoad({filter:/kartroyale\/renderer\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('this.raf = requestAnimationFrame(this.animate);','(window as any).game = this; this.raf = requestAnimationFrame(this.animate);'),loader:'ts'}));}}]});
await writeFile(join(temp,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/qa.css"><style>html,body,#root{margin:0;width:100%;height:100%;background:#101820}</style><div id="root"></div><script type="module" src="/qa.js"></script>');
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 const file=pathname.startsWith('/assets/')?join(webapp,'public',pathname):join(temp,pathname==='/'?'index.html':pathname);
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.css':'text/css','.html':'text/html','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');createReadStream(file).pipe(res);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/karts/'))requests.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const next=page.getByRole('button',{name:'Next vehicle',exact:true});
 await next.waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="Next vehicle"]').disabled,{},{timeout:60000});
 await page.evaluate(()=>window.game.setQuality('performance'));
 assert.equal(await page.locator('select.kr-vehicle-select').count(),0);
 const seen=[];
 for(let i=0;i<9;i++){
  const id=await page.evaluate(()=>window.game.kartId);
  const rig=await page.evaluate(()=>{const g=window.game,r=g.rigs.get(g.showroom.children[0]);return {wheels:r.wheels.length,steering:r.front.length};});
  assert.equal(rig.wheels,4,id);assert.equal(rig.steering,2,id);seen.push(id);
  await next.click();
 }
 assert.equal(new Set(seen).size,9);
 const panel=await page.locator('.kr-vehicle-info').boundingBox();
 const cdp=await page.context().newCDPSession(page);
 const x=panel.x+Math.min(panel.width-10,160),y=panel.y+8;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-85,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>window.game.kartId==='oobi');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-85,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>window.game.kartId==='apex');
 await page.screenshot({path:join(out,'lobby-swipe.png'),timeout:60000});
 await page.getByRole('button',{name:/LET.S RACE/}).click();
 await page.waitForFunction(()=>window.game.state==='countdown'||window.game.state==='racing');
 const start=await page.evaluate(()=>({id:window.game.racers.find(r=>r.id===window.game.me).kartId,count:window.game.visuals.size}));
 assert.equal(start.id,'apex');assert.equal(start.count,6);
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.status===200));
 await writeFile(join(out,'lobby-results.json'),JSON.stringify({viewport:{width:390,height:844},vehicles:seen,swipeLeft:'apex → oobi',swipeRight:'oobi → apex',start,errors},null,2));
 console.log('All nine lobby vehicles load, both touch swipe directions work, and the race button starts the chosen kart.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
