/** Actual React route, pointer ownership and WebGL. Account responses are fixtures.
 * Software rendering is sampled on demand; this is not a phone FPS benchmark. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync,createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),web=join(root,'webapp');
const temp=await mkdtemp(join(tmpdir(),'tirana-mobile-upgrade-')),out=join(root,'docs/validation/tirana-mobile-upgrade');
await mkdir(out,{recursive:true});
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import Game from './src/pages/Games/TiranaStreets.jsx';import * as T from 'three';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';window.reviewThree=T;window.reviewGLTFLoader=GLTFLoader;createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/games/tiranastreets'+location.search]}><Game/></MemoryRouter>);`,resolveDir:web,loader:'tsx'},bundle:true,format:'esm',jsx:'automatic',outfile:join(temp,'game.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'local-only-runtime',setup(b){
 b.onLoad({filter:/street-career\/StreetCareerRuntime\.ts$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('    this.profile = campaign.load(storage);','    (window as any).streetRuntime=this; this.profile = campaign.load(storage);').replace('this.input = new StreetInput(', 'const draw=this.renderer.renderer.render.bind(this.renderer.renderer);(window as any).drawGameFrame=()=>draw(this.renderer.scene,this.renderer.camera);this.renderer.renderer.render=()=>{}; console.log("TIRANA_QA renderer constructed"); this.input = new StreetInput('),loader:'ts'}));
 b.onLoad({filter:/pages\/Games\/Blackwater\.jsx$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('const ready = useCallback((game) => setEngine(game), []);','const ready = useCallback((game) => {window.fpsEngine=game;setEngine(game)}, []);'),loader:'jsx'}));
}}],logLevel:'warning'});
let balance=1234.5;
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path==='/api/tirana-store/account'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({balanceTPG:balance,ownedWeaponIds:[]}));return;}
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/game.css"><style>html,body,#root{margin:0;width:100%;height:100%;background:#17222d}</style><div id="root"></div><script type="module" src="/game.js"></script>');return;}
 const file=path.startsWith('/assets/')?join(web,'public',path):join(temp,path);
 if(!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.wasm':'application/wasm','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');createReadStream(file).pipe(res);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,page;const errors=[],requests=[],result={scope:'Real React route and input; mocked account balance; frozen simulation for input isolation; on-demand software WebGL, not phone performance'};
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page.on('console',m=>{if(m.text().startsWith('TIRANA_QA'))console.log(m.text());});
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message);});
 page.on('response',r=>{if(/namaz|kuvendi|albanian-forces/.test(r.url()))requests.push({url:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(`http://127.0.0.1:${server.address().port}/?activity=street-career&mode=ai`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByRole('button',{name:'Next · Choose weapons',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:/Continue as Tactical Soldier/}).click({timeout:180000});
 console.log('Player and starting loadout selected through the UI');
 await page.waitForFunction(()=>window.streetRuntime?.ready,{},{timeout:120000});console.log('Actual Career ready');
 await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.getByRole('button',{name:'FREE ROAM',exact:true}).click({timeout:60000});
 await page.waitForSelector('.tsc-stick');
 await page.evaluate(()=>{const r=window.streetRuntime;r.simulation.step=()=>{};r.state.npcs=[];r.state.players.local.health=73;r.simulation.body.action=null;r.emit();});
 const header=await page.locator('.tsc-header').boundingBox();assert.ok(Math.abs(header.x+header.width/2-195)<2);
 assert.equal(await page.locator('.tsc-header button').count(),3);
 await page.waitForFunction(()=>document.querySelector('.ts-live-hud')?.textContent.includes('1,234.5'));
 assert.ok((await page.locator('.ts-live-hud').textContent()).includes('73%'));
 balance=1100;await page.evaluate(()=>window.dispatchEvent(new Event('tpgBalanceUpdated')));
 await page.waitForFunction(()=>document.querySelector('.ts-live-hud')?.textContent.includes('1,100'));
 console.log('HUD account refresh and health PASS');
 await page.evaluate(()=>{window.pointerTrace=[];for(const event of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>window.pointerTrace.push([event,e.pointerId,e.target.className]),true);});
 const cdp=await page.context().newCDPSession(page),points=[];
 const point=async(sel,id)=>{const r=await page.locator(sel).boundingBox();assert.ok(r,sel);return{id,x:r.x+r.width/2,y:r.y+r.height/2};};
 const touch=async(type)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});
 // Chrome releases the supplied IDs on touchEnd; an empty list lifts every finger.
 const releaseLast=async()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points.pop()]});
 points.push(await point('.tsc-stick',1));await touch('touchStart');points[0].y-=30;await touch('touchMove');
 points.push(await point('.tsc-slot-primary',2));await touch('touchStart');
 const held=await page.evaluate(()=>({...window.streetRuntime.input.touch}));assert.equal(held.fire,true);assert.ok(held.y>0);
 const weaponBefore=await page.evaluate(()=>window.streetRuntime.state.players.local.weapon);
 points.push(await point('.ts-weapon-trigger',3));await touch('touchStart');await releaseLast();
 const swap=await page.evaluate(()=>({input:{...window.streetRuntime.input.touch},weapon:window.streetRuntime.state.players.local.weapon}));
 console.log('POINTER_TRACE',await page.evaluate(()=>window.pointerTrace), 'SWAP',swap);
 assert.equal(swap.input.fire,true);assert.equal(swap.input.y,held.y);assert.notEqual(swap.weapon,weaponBefore);
 assert.equal(await page.locator('dialog[open]').count(),0);
 points.push(await point('.ts-joystick-sprint',4));await touch('touchStart');await releaseLast();
 assert.equal(await page.evaluate(()=>window.streetRuntime.simulation.body.sprint),true);
 assert.equal(await page.evaluate(()=>window.streetRuntime.input.touch.fire),true);
 await releaseLast();assert.equal(await page.evaluate(()=>window.streetRuntime.input.touch.fire),false);
 assert.ok(await page.evaluate(()=>window.streetRuntime.input.touch.y)>0);
 points.length=0;await touch('touchEnd');assert.equal(await page.evaluate(()=>window.streetRuntime.input.touch.y),0);
 await page.getByRole('button',{name:'Toggle sprint',exact:true}).click();assert.equal(await page.evaluate(()=>window.streetRuntime.simulation.body.sprint),false);
 console.log('Three simultaneous fingers, quick swap and sprint toggle PASS');
 result.multitouch={held,swap,releaseIsolation:true,sprintToggle:true};
 await page.getByRole('button',{name:'MENU',exact:true}).click();
 for(const value of ['battery','balanced','high','auto']){
  await page.getByRole('combobox',{name:'Graphics quality'}).selectOption(value);
  const state=await page.evaluate(()=>({saved:window.streetRuntime.settings.quality,effective:window.streetRuntime.renderer.quality}));assert.equal(state.saved,value);if(value!=='auto')assert.equal(state.effective,value);
 }
 await page.screenshot({path:join(out,'portrait-settings.png'),timeout:60000});console.log('All quality presets PASS');
 // Close the journal through its real dialog close button.
 await page.locator('dialog[open]').getByRole('button',{name:'RESUME',exact:true}).click();
 // Review camera above the public landmark; no claim of a benchmark or player POV.
 await page.evaluate(()=>{
  const r=window.streetRuntime,renderer=r.renderer;
  renderer.render(r.state,'local',0,false);renderer.render=()=>{};
  const center=new window.reviewThree.Vector3();renderer.scene.getObjectByName('Blender Namazgah exterior').getWorldPosition(center);
  renderer.camera.position.copy(center).add(new window.reviewThree.Vector3(100,58,135));
  renderer.camera.lookAt(center.clone().add(new window.reviewThree.Vector3(0,18,0)));
  renderer.referenceFacades.update(renderer.camera.position,false);renderer.urbanRoads.update(renderer.clock,renderer.camera.position,false);
  window.drawGameFrame();
 });
 await page.screenshot({path:join(out,'portrait-gameplay.png'),timeout:60000});
 await page.setViewportSize({width:320,height:740});
 await page.evaluate(()=>window.drawGameFrame());
 const small=await page.locator('.tsc-header').boundingBox();assert.ok(Math.abs(small.x+small.width/2-160)<2);
 for(const sel of ['.tsc-header','.ts-live-hud','.ts-weapon-trigger','.ts-joystick-sprint']){const b=await page.locator(sel).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=320&&b.y>=0&&b.y+b.height<=740,`${sel}: ${JSON.stringify(b)}`);}
 await page.screenshot({path:join(out,'portrait-320.png'),timeout:60000});
 result.viewportChecks=[{width:390,height:844},{width:320,height:740}];result.errors=errors;result.requests=requests;
 assert.deepEqual(errors,[]);assert.ok(!requests.some(r=>r.url.includes('city-mobility/namazgjah')));
 await writeFile(join(out,'browser-results.json'),JSON.stringify(result,null,2));
 console.log('MOBILE_UPGRADE_PASS');
}catch(e){console.error(e);if(page)await page.screenshot({path:join(out,'failure.png'),timeout:30000}).catch(()=>{});throw e;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
