import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync,createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const {chromium}=createRequire(import.meta.url)('playwright');
const webapp=fileURLToPath(new URL('../webapp/',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'racing-combat-career-'));
const out=resolve(process.argv[2]||join(tmpdir(),'racing-combat-career-evidence'));
await mkdir(out,{recursive:true});

// Bundle the production UI/renderer without replacing WebGL, assets or physics.
// The only test hook exposes the live renderer for assertions and fixture setup.
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
import Game from './src/games/kartroyale/KartRoyale';
createRoot(document.getElementById('root')).render(<Game/>);`,resolveDir:webapp,loader:'tsx'},
 bundle:true,format:'esm',outfile:join(temp,'qa.js'),logLevel:'warning',plugins:[{
 name:'observe-live-racing-engine',setup(builder){
  builder.onLoad({filter:/kartroyale\/renderer\.ts$/},async args=>({
   contents:(await readFile(args.path,'utf8')).replace('this.raf = requestAnimationFrame(this.animate);','(window as any).__racingEngine = this; this.raf = requestAnimationFrame(this.animate);'),loader:'ts'}));
 }}]});
await writeFile(join(temp,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/qa.css"><style>html,body,#root{margin:0;width:100%;height:100%;background:#101820}</style><div id="root"></div><script type="module" src="/qa.js"></script>');
const server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 const directory=pathname.startsWith('/assets/')||pathname.startsWith('/vendor/')?join(webapp,'public'):temp;
 const file=resolve(directory,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(directory+'/')||!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.css':'text/css','.html':'text/html','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');
 createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const result={viewport:{width:390,height:844},scope:'Production UI and WebGL renderer. Combat countdown skipped; career tests dismount at the starting location. This is not a complete mission playthrough or physical-phone FPS benchmark.',checks:[],errors:[],assetErrors:[]};
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:result.viewport,isMobile:true,hasTouch:true});
 const page=await context.newPage();
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&/\.(glb|gltf)(\?|$)/.test(r.url()))result.assetErrors.push({url:r.url(),status:r.status()});});
 const address=`http://127.0.0.1:${server.address().port}`;
 await page.goto(address);
 await page.getByRole('button',{name:'Next kart',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Next kart"]')?.disabled,{},{timeout:90000});
 const graphics=await page.evaluate(()=>{const g=window.__racingEngine;g.setQuality('performance');return {meshes:g.showroom.children[0]?.getObjectByProperty('isMesh',true)?.name,canvas:!!g.renderer.getContext()};});
 assert.ok(graphics.meshes&&graphics.canvas,'Real kart meshes and WebGL context must load');
 result.checks.push('Garage loaded original kart/driver GLBs with a WebGL context');
 await page.screenshot({path:join(out,'01-garage-portrait.png')});
 const savedBefore=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await page.getByRole('button',{name:/COMBAT RACE/}).click();
 await page.getByRole('button',{name:'START COMBAT RACE',exact:true}).click();
 await page.waitForFunction(()=>!!window.__racingEngine.combat);
 await page.evaluate(()=>{const g=window.__racingEngine;g.countdown=0;g.state='racing';});
 await page.getByLabel('Combat status').waitFor();
 const ammoBefore=await page.evaluate(()=>window.__racingEngine.combat.player.ammo);
 const cdp=await context.newCDPSession(page);
 const centre=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
 const fire=await centre(page.getByRole('button',{name:'Hold fire to shoot ahead',exact:true}));
 const gas=await centre(page.getByRole('button',{name:'Hold gas to accelerate; slide up to boost',exact:true}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...fire,id:1},{...gas,id:2}]});
 await page.waitForFunction(n=>window.__racingEngine.combat.player.ammo<n,ammoBefore);
 assert.deepEqual(await page.evaluate(()=>({fire:window.__racingEngine.input.fire,gas:window.__racingEngine.input.throttle})),{fire:true,gas:true});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.getByRole('button',{name:'Pause menu',exact:true}).click();
 const pause=await page.evaluate(()=>({time:window.__racingEngine.time,input:window.__racingEngine.input}));
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>window.__racingEngine.time),pause.time);
 assert.equal(pause.input.fire,false);assert.equal(pause.input.throttle,false);
 result.checks.push('Simultaneous touch FIRE + GAS, ammo consumption, pause freezes simulation and clears held inputs');
 await page.screenshot({path:join(out,'02-combat-paused-portrait.png')});
 await page.getByRole('button',{name:'RETURN TO GARAGE',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),savedBefore,'Combat cannot alter normal career or paid progress');
 result.checks.push('Abandoned combat race leaves persistent career/TPG progress unchanged');
 await page.getByRole('button',{name:/^CAREER/}).click();
 await page.getByRole('button',{name:'ACTION MISSIONS',exact:true}).click();
 await page.getByRole('button',{name:'ACCEPT MISSION',exact:true}).first().click();
 await page.waitForFunction(()=>!!window.__racingEngine.actionCareer);
 const exit=await centre(page.getByRole('button',{name:'Stop and exit kart',exact:true}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...exit,id:3}]});
 await page.waitForFunction(()=>window.__racingEngine.actionCareer.mode==='onfoot');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.getByLabel('On foot mission controls',{exact:true}).waitFor();
 const actorBefore=await page.evaluate(()=>({...window.__racingEngine.actionCareer.actor}));
 await page.keyboard.down('w');await page.keyboard.down('Shift');
 await page.waitForFunction(p=>Math.hypot(window.__racingEngine.actionCareer.actor.x-p.x,window.__racingEngine.actionCareer.actor.z-p.z)>.2,actorBefore);
 await page.keyboard.up('w');await page.keyboard.up('Shift');
 await page.keyboard.down('Space');
 await page.waitForFunction(()=>window.__racingEngine.actionCareer.actor.jumpHeight>0);
 await page.keyboard.up('Space');
 result.checks.push('Career mission opens, dismounts, walks/sprints, and jumps with production simulation');
 await page.getByRole('button',{name:'PAUSE',exact:true}).click();
 await page.screenshot({path:join(out,'03-onfoot-paused-portrait.png')});
 const actionPause=await page.evaluate(()=>({elapsed:window.__racingEngine.actionCareer.elapsed,input:{...window.__racingEngine.actionInput}}));
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>window.__racingEngine.actionCareer.elapsed),actionPause.elapsed);
 assert.equal(actionPause.input.fire,false);assert.equal(actionPause.input.moveZ,0);
 await page.getByRole('button',{name:'JOB BOARD',exact:true}).click();
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.assetErrors,[]);
 result.checks.push('Action pause clears controls; job board return succeeds; no fatal page or GLB errors');
 await writeFile(join(out,'results.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{
 await browser?.close();await new Promise(r=>server.close(r));
}
