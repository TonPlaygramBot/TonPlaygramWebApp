/** Production Vite chunks, real game routes, PlayerPicker and WebGL rendering.
 * Only account responses are fixtures. Missing public assets may be read from
 * the deployed origin; neither game code, simulation nor rendering is mocked.
 * Run with PLAYWRIGHT_MODULE and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH if needed.
 */
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, readdir, stat} from 'node:fs/promises';
import {createReadStream, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, extname, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from '../webapp/node_modules/vite/dist/node/index.js';
import react from '../webapp/node_modules/@vitejs/plugin-react/dist/index.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),web=join(root,'webapp');
const source=await mkdtemp(join(web,'.tirana-production-loading-'));
const temp=await mkdtemp(join(tmpdir(),'tirana-production-loading-')),dist=join(temp,'dist');
const evidence=resolve(process.env.TIRANA_LOADING_EVIDENCE_DIR||join(root,'docs/validation/tirana-loading-fix'));
const assetOrigin=process.env.TIRANA_TEST_ASSET_ORIGIN||'https://tonplaygram-bot.onrender.com';
const records={scope:'Vite production split route; actual player/models and continuous software WebGL; account fixture; optional Namazgah downloads blocked. Not a physical-device FPS benchmark.',build:{},modes:[],assets:[],previewRecovery:null};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.wasm':'application/wasm','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const pendingAssets=new Map();
let browser,server;
try {
  // Core downloads must use the real checkout. An upstream proxy can queue a
  // missing mandatory gun behind optional city assets and falsify its timeout.
  for(const path of ['players/manifest.json','players/tactical.glb','city.glb','living/operator.glb','living/ak47.glb','weapons/adaptiveCombatRifleAttack.glb']){
    assert.ok(existsSync(join(web,'public/assets/tirana-streets',path)),`Restore the required runtime asset before testing: ${path}`);
  }
  await mkdir(evidence,{recursive:true});
  await writeFile(join(source,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;background:#17222d}</style><div id="root"></div><script type="module" src="./entry.jsx"></script>');
  await writeFile(join(source,'entry.jsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import Blackwater from '../src/pages/Games/Blackwater.jsx';createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/games/tiranastreets'+location.search]}><Blackwater/></MemoryRouter>);`);
  const started=performance.now();
  await build({root:web,configFile:false,plugins:[react()],publicDir:false,logLevel:'warn',resolve:{alias:{splaytree:join(web,'node_modules/splaytree/dist/splaytree.js')}},build:{outDir:dist,emptyOutDir:true,manifest:true,rollupOptions:{input:join(source,'index.html')}}});
  const scripts=(await readdir(join(dist,'assets'))).filter(p=>p.endsWith('.js'));
  const optional=scripts.find(p=>/^namazgah-far-/.test(p));
  assert.ok(optional,'Namazgah detail is emitted as an independent optional chunk');
  assert.ok(scripts.some(p=>/^operationUi-/.test(p)),'Operation remains a separate production chunk');
  assert.ok(scripts.some(p=>/^StreetCareerGame-/.test(p)),'Street Career remains a separate production chunk');
  const manifest=JSON.parse(await readFile(join(dist,'manifest.json'),'utf8'));
  const htmlEntry=Object.values(manifest).find(p=>p.isEntry&&p.src.endsWith('index.html'));
  assert.ok(htmlEntry);
  const builtHtml=join(dist,relative(web,join(source,'index.html')));
  records.build={durationMs:Math.round(performance.now()-started),scriptCount:scripts.length,optionalChunk:optional};
  console.log('PRODUCTION_BUILD',JSON.stringify(records.build));

  async function publicAsset(path) {
    const local=join(web,'public',path);
    if(existsSync(local))return local;
    const cached=join(temp,'public',path);
    if(existsSync(cached))return cached;
    if(!pendingAssets.has(path))pendingAssets.set(path,(async()=>{
      const response=await fetch(new URL(path,assetOrigin),{signal:AbortSignal.timeout(45000)});
      const contentType=response.headers.get('content-type')||'';
      if(!response.ok||contentType.includes('text/html'))throw Error(`Asset ${path}: HTTP ${response.status} ${contentType}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      await mkdir(resolve(cached,'..'),{recursive:true});await writeFile(cached,bytes);
      records.assets.push({path,bytes:bytes.length,source:'deployed public asset'});
      return cached;
    })());
    return pendingAssets.get(path);
  }
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://local').pathname;
    try {
      if(path.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(path.includes('tirana-store/account')?{balanceTPG:1234.5,ownedWeaponIds:[]}:{accountId:'tirana-loading-test'}));return;}
      if(path.startsWith('/socket.io/')){res.writeHead(503);res.end();return;}
      let file=path.startsWith('/assets/')&&existsSync(join(dist,path))?join(dist,path):null;
      if(!file&&path.startsWith('/assets/'))file=await publicAsset(path);
      if(!file&&['/','/games/tiranastreets','/games/blackwater'].includes(path))file=builtHtml;
      if(!file){res.writeHead(404);res.end();return;}
      const info=await stat(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Content-Length',info.size);
      createReadStream(file).pipe(res);
    }catch(error){res.writeHead(404);res.end(String(error));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const requestedModes=(process.env.TIRANA_LOADING_MODES||'operation,street-career').split(',');
  assert.ok(requestedModes.length&&requestedModes.every(mode=>['operation','street-career'].includes(mode)));
  for(const mode of requestedModes) {
    const context=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const page=await context.newPage(),loadEvents=[],errors=[],blocked=[],failures=[];
    const profiler=process.env.TIRANA_PROFILE_CPU==='1'?await context.newCDPSession(page):null;
    if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
    page.setDefaultTimeout(60000);
    await page.addInitScript(()=>{
      localStorage.setItem('accountId','tirana-loading-test');
      localStorage.setItem('bw-settings',JSON.stringify({quality:'battery',targetFps:30,volume:0}));
      localStorage.setItem('tirana-streets:street-settings:v1',JSON.stringify({quality:'battery',targetFps:30,volume:0}));
      window.__loadingProbe={ticks:0,maxGapMs:0,last:performance.now()};
      setInterval(()=>{const p=window.__loadingProbe,now=performance.now();p.maxGapMs=Math.max(p.maxGapMs,now-p.last);p.last=now;p.ticks++;},50);
    });
    await page.route(`**/assets/${optional}`,route=>{blocked.push('far');return route.abort('failed');});
    await page.route('**/landmark-rebuild/namazgah-near.glb',route=>{blocked.push('near');return route.abort('failed');});
    page.on('console',message=>{
      if(!message.text().startsWith('[tirana:load]'))return;
      void(async()=>{
        const value=await message.args()[1]?.jsonValue();
        if(value?.status==='failed')value.error=await message.args()[2]?.evaluate(error=>({message:error?.message,stack:error?.stack}));
        loadEvents.push(value);console.log('MODULE',mode,JSON.stringify(value));
      })().catch(()=>{/* Remote console handles expire when this test closes the page. */});
    });
    page.on('pageerror',error=>{errors.push(error.message);console.log('PAGEERROR',mode,error.message);});
    page.on('response',response=>{if(response.status()>=400)failures.push({url:new URL(response.url()).pathname,status:response.status()});});
    page.on('requestfailed',request=>{if(!/namazgah-(far|near)/.test(request.url()))failures.push({url:request.url(),error:request.failure()?.errorText});});
    const modeStart=performance.now();
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/games/tiranastreets?activity=${mode}&mode=ai`,{waitUntil:'domcontentloaded',timeout:120000});
      await page.getByRole('button',{name:'Next · Choose weapons',exact:true}).click({timeout:120000});
      await page.getByRole('button',{name:/Continue as Tactical Soldier/}).click({timeout:120000});
      const selectedMs=Math.round(performance.now()-modeStart);console.log('PLAYER_SELECTED',mode,selectedMs);
      if(mode==='operation'){
        await page.locator('.bw-scope .menu-layer').waitFor({state:'visible',timeout:120000});
        await page.getByRole('button',{name:'Game settings',exact:true}).click({timeout:120000});
        await page.getByRole('combobox',{name:'Graphics quality',exact:true}).waitFor({state:'visible'});
      }else{
        await page.locator('.tsc,[role="alert"]').first().waitFor({state:'visible',timeout:120000});
        assert.equal(await page.locator('[role="alert"]').count(),0,await page.locator('body').innerText());
        await page.waitForFunction(()=>!document.querySelector('.tsc-loading')||!!document.querySelector('.tsc-error'),{},{timeout:120000});
        assert.equal(await page.locator('.tsc-error').count(),0,await page.locator('body').innerText());
        await page.locator('.tsc-stick').waitFor({state:'visible'});
        await page.locator('.ts-live-hud').waitFor({state:'visible'});
        await page.getByRole('button',{name:'MENU',exact:true}).click({timeout:120000});
        await page.getByRole('combobox',{name:'Graphics quality',exact:true}).waitFor({state:'visible'});
      }
      const responsiveMs=Math.round(performance.now()-modeStart);
      await page.getByRole('combobox',{name:'Graphics quality',exact:true}).selectOption('battery');
      if(mode==='street-career'){
        await page.locator('dialog[open]').getByRole('button',{name:'RESUME',exact:true}).click();
        await page.locator('.tsc-stick').waitFor({state:'visible'});
        assert.equal(await page.locator('.tsc-loading,.tsc-error').count(),0);
      }
      assert.ok(loadEvents.some(e=>e?.mode===mode&&e?.status==='ready'),`${mode} module reports ready`);
      assert.ok(blocked.includes('far'),`${mode} attempted the optional far detail without gating entry`);
      assert.deepEqual(errors,[]);
      const result={mode,selectedMs,responsiveMs,readyAndResumed:mode==='street-career',loadEvents,blocked,errors,failures,heartbeat:await page.evaluate(()=>window.__loadingProbe)};
      records.modes.push(result);
      await writeFile(join(evidence,'production-loading.json'),JSON.stringify(records,null,2)+'\n');
      console.log('MODE_OPENED',JSON.stringify(result));
      if(process.env.TIRANA_LOADING_SCREENSHOTS==='1')await page.screenshot({path:join(evidence,`${mode}-opened.png`),timeout:5000}).catch(error=>{result.screenshotError=error.message;});
    }catch(error){if(process.env.TIRANA_LOADING_SCREENSHOTS==='1')await page.screenshot({path:join(evidence,`${mode}-failure.png`),timeout:5000}).catch(()=>{});console.error('MODE_FAILED',mode,JSON.stringify({loadEvents,blocked,errors,failures,body:await page.locator('body').innerText({timeout:10000}).catch(()=>'<unresponsive>')}));throw error;}
    finally{
      if(profiler)try {const {profile}=await profiler.send('Profiler.stop');await writeFile(join(temp,`${mode}.cpuprofile`),JSON.stringify(profile));console.log('CPU_PROFILE',join(temp,`${mode}.cpuprofile`));}catch{}
      await context.close();
    }
  }
  const preview=scripts.find(p=>/^PlayerPreview-/.test(p));assert.ok(preview);
  const previewContext=await browser.newContext(),previewPage=await previewContext.newPage();
  try {
    await previewPage.route(`**/assets/${preview}`,route=>route.abort('failed'));
    await previewPage.goto(`http://127.0.0.1:${server.address().port}/games/tiranastreets?mode=ai`,{waitUntil:'domcontentloaded'});
    await previewPage.getByRole('alert').waitFor({state:'visible'});
    await previewPage.getByRole('button',{name:'Back to game menu',exact:true}).waitFor({state:'visible'});
    records.previewRecovery={blockedChunk:preview,errorVisible:true,backVisible:true};
    console.log('PREVIEW_RECOVERY_PASS',JSON.stringify(records.previewRecovery));
  }finally{await previewContext.close();}
  await writeFile(join(evidence,'production-loading.json'),JSON.stringify(records,null,2)+'\n');
  console.log('PRODUCTION_LOADING_PASS');
}finally{
  await browser?.close();
  server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));
  await rm(source,{recursive:true,force:true});
}
