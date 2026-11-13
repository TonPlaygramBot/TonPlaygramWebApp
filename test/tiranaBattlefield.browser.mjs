// Actual Battlefield Game + GameEngine in portrait WebGL, without account/API wrappers.
// AI is frozen and one existing opponent is moved into view for deterministic captures.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {existsSync, createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';

const webapp = fileURLToPath(new URL('../webapp/', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'tirana-forces-browser-'));
const output = resolve(process.argv[2] || join(temp, 'screenshots'));
await mkdir(output, {recursive: true});
await build({stdin: {contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import {Game} from './src/games/blackwater/ui';
createRoot(document.getElementById('root')).render(<Game mode="ai" initialWeapon="ar"
initialDifficulty="recruit" initialMap="skanderbeg" onExit={()=>{}}
onEngine={game=>{window.game=game;}}/>);`, loader: 'tsx', resolveDir: webapp},
  bundle:true, format:'esm', jsx:'automatic', outfile:join(temp,'qa.js'),
  loader:{'.svg':'dataurl','.png':'dataurl','.jpg':'dataurl'},logLevel:'warning'});
await writeFile(join(temp,'index.html'), '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/qa.css"><style>html,body,#root{margin:0;width:100%;height:100%;background:#101820}</style><div id="root"></div><script type="module" src="/qa.js"></script>');
const server = createServer((req,res)=>{
  const pathname = new URL(req.url, 'http://local').pathname;
  const asset = pathname.startsWith('/assets/');
  let file = join(asset ? join(webapp,'public') : temp, pathname);
  if (!existsSync(file)) {
    if (asset) {res.writeHead(404);res.end();return;}
    file = join(temp,'index.html');
  }
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[extname(file)] || 'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser = await chromium.launch({headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[], requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/albanian-forces/glb/')) requests.push({url:new URL(r.url()).pathname,status:r.status()});});
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tiranastreets?mode=ai`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.game?.forces,{},{timeout:60000});
  console.log('Actual Battlefield GameEngine mounted in portrait WebGL');
  await page.evaluate(()=>{
    const g=window.game;g.physics=()=>{};g.setSettings({quality:'high'});g.phase='playing';
    const e=g.enemies[0];e.group.position.set(g.player.x+1,0,g.player.z-6);e.group.rotation.y=Math.PI;
    g.enemies.slice(1).forEach(e=>e.group.visible=false);
    g.yaw=g.pitch=0;g.camera.position.set(g.player.x,1.68,g.player.z);g.camera.rotation.set(0,0,0);
  });
  await page.waitForFunction(()=>window.game.forces.visuals.group.children.some(o=>o.getObjectByProperty('type','SkinnedMesh')),{},{timeout:60000});
  await page.waitForFunction(()=>window.game.scene.children.find(o=>o.name==='Tirana:Albanian-Forces')?.children.some(c=>c.name==='battlefield-fleet-0'),{},{timeout:60000});
  const visible=await page.evaluate(()=>({fallbackHidden:!window.game.enemies[0].body.visible,
    errors:[...window.game.forces.visuals.errors],
    groups:window.game.scene.children.filter(o=>o.name==='Tirana:Albanian-Forces').map(o=>o.children.map(c=>c.name))}));
  assert.equal(visible.fallbackHidden,true);assert.deepEqual(visible.errors,[]);assert.deepEqual(errors,[]);
  assert.ok(requests.length>=2 && requests.every(r=>r.status===200));
  await page.screenshot({path:join(output,'original-officer.png'),timeout:30000});
  await page.evaluate(()=>{
    const g=window.game,car=g.scene.children.find(o=>o.name==='Tirana:Albanian-Forces').children.find(o=>o.name==='battlefield-fleet-0');
    g.player.x=car.position.x+5;g.player.z=car.position.z+7;
    g.camera.position.set(g.player.x,1.68,g.player.z);g.yaw=Math.atan2(5,7);g.pitch=-.03;
    g.camera.rotation.set(-.03,g.yaw,0,'YXZ');
  });
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:join(output,'original-patrol.png'),timeout:30000});
  await writeFile(join(output,'results.json'),JSON.stringify({viewport:{width:390,height:844},scope:'Actual Battlefield Game/engine, frozen AI, software WebGL; not physical-phone performance',visible,requests,errors},null,2));
  console.log('Original uniform and patrol vehicle rendered:',output);
} finally {
  await browser?.close();await new Promise(r=>server.close(r));
  // Preserve screenshots when using the default temporary output folder.
  if (!output.startsWith(temp)) await rm(temp,{recursive:true,force:true});
}
