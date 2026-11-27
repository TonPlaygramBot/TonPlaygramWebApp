import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const {chromium}=await import(process.env.TABLE_TENNIS_PLAYWRIGHT_MODULE || 'playwright');
const base=resolve('.');
const tag=process.argv[2]||'candidate';
const dist=resolve(process.env.TABLE_TENNIS_BROWSER_OUTPUT_DIR || resolve(base,tag));
await mkdir(dist,{recursive:true});
await build({ stdin:{contents:`import React from 'react';
import { createRoot } from 'react-dom/client';
import TableTennisGame from './Game';
import { previewServices } from './career';
import './game.css';
const services=previewServices();
const launch={mode:'ai', arena:'dancingHall',character:'athlete-male',difficulty:1,format:'quick'};
Math.random=()=>0.2;
createRoot(document.getElementById('root')!).render(
  <TableTennisGame services={services} launch={launch} onLobby={()=>{document.body.dataset.lobby='returned'}} />
);
`,resolveDir:resolve(base,'webapp/src/games/tabletennis'),loader:'tsx',sourcefile:'portrait-fixture.tsx'}, bundle:true,
  platform:'browser',format:'esm',outfile:resolve(dist,'game.js'),
  define:{'process.env.NODE_ENV':'"production"'}, jsx:'automatic'});
await writeFile(resolve(dist,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/game.css"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/game.js"></script></body></html>');
const b=await chromium.launch({executablePath:process.env.TABLE_TENNIS_BROWSER_EXECUTABLE || undefined,
  args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[], assets=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='table-tennis.test')return route.abort();
    const p=url.pathname;
    const f=p.startsWith('/assets/table-tennis/')?resolve(process.env.TABLE_TENNIS_ASSET_DIR || 'webapp/public')+p:dist+(p==='/'?'/index.html':p);
    try{
      await route.fulfill({body:await readFile(f),contentType:p.endsWith('.glb')?'model/gltf-binary':p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html'});
      if(p.endsWith('.glb'))assets.push(p);
    }catch{return route.fulfill({status:404,body:'Missing fixture asset'});}
  });
  await page.addInitScript(()=>{
    window.ttWebGLContexts=0;
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const value=original.call(this,kind,...args);
      if(kind.startsWith('webgl')&&value)window.ttWebGLContexts++;
      return value;
    };
  });
  await page.goto('http://table-tennis.test/');
  const court=page.getByLabel('Table tennis touch court');
  await court.waitFor();
  await page.waitForFunction(()=>window.ttWebGLContexts>=1);
  await page.waitForFunction(()=>document.querySelector('.tt-call')?.textContent.includes('Your serve'));
  for(let i=0;assets.length<2&&i<30;i++)await page.waitForTimeout(200); assert.ok(assets.length>=2);
  await page.screenshot({path:resolve(dist,'portrait-match.png')});
  const pause=page.getByRole('button',{name:'Pause and settings'}), resume=page.getByRole('button',{name:'RESUME',exact:true});
  const rect=await pause.boundingBox();
  assert.ok(rect.width>=44&&rect.height>=44&&rect.x+rect.width<=390,'pause control stays in the portrait viewport');
  await page.touchscreen.tap(190,560);
  await page.waitForFunction(()=>!!document.querySelector('.tt-touch-feedback'));
  assert.match(await page.locator('.tt-touch-feedback').innerText(),/drive · 10%/i);
  await page.waitForFunction(()=>!document.querySelector(".tt-call")?.textContent.includes("Your serve"));
  await pause.tap();
  await resume.waitFor();
  await page.screenshot({path:resolve(dist,'portrait-settings.png')});
  // Space on the focused lobby button must activate it, not resume a paused game.
  await page.getByRole('button',{name:'Return to lobby'}).press('Space');
  const returned=await page.locator('body').getAttribute('data-lobby');
  console.log(JSON.stringify({returned,webgl:await page.evaluate(()=>window.ttWebGLContexts),assets,errors}));
  assert.equal(returned,'returned','paused court must not intercept Space from the lobby button');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.tt-call')?.textContent.includes('Your serve'));
  await page.setViewportSize({width:320,height:568});
  await pause.press('Space');
  await resume.waitFor();
  assert.ok(await resume.evaluate(el=>el===document.activeElement),'moves keyboard focus into settings');
  assert.ok(await page.getByRole('dialog',{name:'Take a breather.'}).isVisible());
  await resume.press('Space');
  await resume.waitFor({state:'detached'});
  assert.ok(await court.evaluate(el=>el===document.activeElement),'restores focus to court');
  await court.press('Space');
  await page.waitForFunction(()=>!!document.querySelector('.tt-touch-feedback'));
  assert.match(await page.locator('.tt-touch-feedback').innerText(),/drive · 10%/i);
  await page.waitForFunction(()=>!document.querySelector(".tt-call")?.textContent.includes("Your serve"));
  assert.deepEqual(errors,[]);
  console.log('Portrait checks passed: 390x844 touch serve and lobby action; 320x568 keyboard pause, resume, focus and serve.');
}finally{await b.close();}
