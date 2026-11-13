import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

// Run against the real Vite app, not a simplified scene:
// TIRANA_BASE_URL=http://127.0.0.1:5178 BROWSER_PATH=/usr/bin/chromium node scripts/verify-tirana-gameplay.mjs
// Requires a browser-enabled host. Software WebGL results are not phone FPS measurements.
const base=process.env.TIRANA_BASE_URL||'http://127.0.0.1:5178';
const output=resolve(process.env.TIRANA_TEST_OUTPUT||'artifacts/tirana-gameplay');
const timeout=Number(process.env.TIRANA_TEST_TIMEOUT_MS)||120000;
await mkdir(output,{recursive:true});
const result={scope:'Actual Turi picker and Street Career; portrait software WebGL smoke test',viewport:{width:390,height:844},status:'failed',timings:{},errors:[],failedRequests:[],httpErrors:[]};
let browser,page;
try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  page=await browser.newPage({viewport:result.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>result.errors.push(String(e)));
  page.on('requestfailed',r=>result.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
  const started=performance.now();
  await page.goto(new URL('/tirana-gameplay-review.html?activity=street-career',base).href,{waitUntil:'domcontentloaded',timeout});
  await page.getByRole('group',{name:'Available players'}).getByRole('button',{name:/Turi$/}).click({timeout});
  await page.waitForFunction(()=>{const next=document.querySelector('.player-continue');return next&&!next.disabled;},null,{timeout});
  result.timings.turiPreviewMs=Math.round(performance.now()-started);
  await page.screenshot({path:resolve(output,'turi-picker.png'),fullPage:true});
  await page.getByRole('button',{name:'Next · Choose weapons',exact:true}).click();
  const entering=performance.now();
  await page.getByRole('button',{name:/Continue as Turi/}).click();
  await page.waitForFunction(()=>document.querySelector('.tsc-error')||document.querySelector('.tsc-street-status'),null,{timeout});
  assert.equal(await page.locator('.tsc-error').count(),0,await page.locator('.tsc-error').allTextContents());
  result.timings.firstPlayableMs=Math.round(performance.now()-entering);
  result.webgl=await page.locator('.tsc-world canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    const debug=gl?.getExtension('WEBGL_debug_renderer_info');
    return {active:!!gl&&!gl.isContextLost(),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,width:canvas.width,height:canvas.height};
  });
  assert.ok(result.webgl.active,'The real career canvas must have an active WebGL context');
  assert.ok(result.webgl.width>0&&result.webgl.height>0,'The career canvas must be sized');
  assert.ok(await page.getByRole('button',{name:'Change walking camera view'}).isVisible());
  await page.getByRole('button',{name:'Change walking camera view'}).click();
  await page.screenshot({path:resolve(output,'turi-career-camera.png'),fullPage:true});
  const weapon=page.getByRole('button',{name:/Quick swap weapon:/});
  const before=await weapon.getAttribute('aria-label');
  await weapon.press('ArrowRight');
  await page.waitForFunction(previous=>document.querySelector('.ts-weapon-trigger')?.getAttribute('aria-label')!==previous,before,{timeout:10000});
  // Exercise actual movement input for a short interval; this is not a visual grip accuracy assertion.
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.getByRole('dialog',{name:'Career journal'}).waitFor();
  await page.getByRole('button',{name:'RESUME',exact:true}).click();
  await page.getByRole('dialog',{name:'Career journal'}).waitFor({state:'hidden'});
  await page.screenshot({path:resolve(output,'turi-career-playing.png'),fullPage:true});
  assert.equal(await page.locator('.tsc-error').count(),0,'No graphics/game error after interactions');
  assert.deepEqual(result.errors,[],'Uncaught browser errors must fail the test');
  result.status='passed';
}catch(error){
  result.failure=String(error);
  if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
  process.exitCode=1;
}finally{
  await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));
  await browser?.close();
  console.log(JSON.stringify(result,null,2));
}
