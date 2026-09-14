/** The in-chat HTML fragment is checked independently of real-game evidence.
 * Its embedded Blender models are untouched. Only importmap dependency URLs
 * are mapped to the installed React/Three packages for offline verification. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),web=join(root,'webapp'),temp=await mkdtemp(join(tmpdir(),'tirana-inline-preview-'));
const input=resolve(process.env.TIRANA_INLINE_PREVIEW||'/workspace/tirana-realism-repairs.html');
const evidence=resolve(process.env.TIRANA_PREVIEW_EVIDENCE_DIR||join(root,'docs/validation/tirana-inline-preview'));
const result={scope:'In-chat HTML fragment only; embedded Blender preview geometry; installed React/Three importmap mirror; software WebGL. This is separate from real-game verification.',input,portraits:[],errors:[],consoleErrors:[],failures:[],pass:false};
let server,browser;
try{
 await mkdir(evidence,{recursive:true});const fragment=await readFile(input,'utf8');
 assert.ok(Buffer.byteLength(fragment)<1000000,'inline fragment stays below 1 MB');result.bytes=Buffer.byteLength(fragment);result.sha256=createHash('sha256').update(fragment).digest('hex');
 await writeFile(join(temp,'react-entry.js'),"import React from 'react';export const {useEffect,useRef,useState}=React;export default React;");
 await writeFile(join(temp,'client-entry.js'),"import Client from 'react-dom/client';export const {createRoot}=Client;");
 await build({entryPoints:{react:join(temp,'react-entry.js'),client:join(temp,'client-entry.js')},bundle:true,splitting:true,format:'esm',platform:'browser',outdir:join(temp,'vendor'),nodePaths:[join(web,'node_modules')],define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
 const imports={react:'/vendor/react.js','react-dom/client':'/vendor/client.js',three:'/three/build/three.module.js','three/addons/':'/three/examples/jsm/','three/examples/jsm/':'/three/examples/jsm/'};
 const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:12px;font:14px system-ui;background:#edf2f5;color:#20343e;box-sizing:border-box}*{box-sizing:border-box}.viz-row{display:flex;justify-content:space-between;gap:10px}.viz-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.btn{padding:11px 14px;border:1px solid #92a7b5;border-radius:8px;background:white;color:#223b4a}.btn[aria-pressed="true"]{background:#d4e2ed}.text-small{font-size:12px}.text-muted{color:#597384}</style>'+fragment.replace(/<script type="importmap">[\s\S]*?<\/script>/,`<script type="importmap">${JSON.stringify({imports})}</script>`);
 await writeFile(join(temp,'index.html'),html);
 server=createServer(async(req,res)=>{try{
  const p=new URL(req.url,'http://local').pathname;
  if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=p.startsWith('/three/')?join(web,'node_modules',p.slice(1)):p==='/'?join(temp,'index.html'):join(temp,p);
  if(!existsSync(file)||!file.startsWith(temp)&&!file.startsWith(join(web,'node_modules/three'))){res.writeHead(404);res.end();return;}
  const info=await stat(file);res.setHeader('Content-Type',extname(file)==='.html'?'text/html':'text/javascript');res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res);
 }catch(error){res.writeHead(500);res.end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||process.env.EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});page.setDefaultTimeout(60000);
  page.on('pageerror',e=>{result.errors.push(e.message);console.error('PREVIEW_PAGE_ERROR',e.message);});page.on('response',r=>{if(r.status()>=400)result.failures.push({url:r.url(),status:r.status()});});
  page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:120000});
  assert.deepEqual(result.errors,[],'preview imports execute without module errors');
  const detailed=page.getByRole('button',{name:'Detailed',exact:true}),distant=page.getByRole('button',{name:'Distant',exact:true});
  await page.waitForFunction(()=>document.body.innerText.includes('Unable to open')||[...document.querySelectorAll('button')].some(b=>b.textContent==='Detailed'&&!b.disabled),null,{timeout:120000});
  assert.equal(await page.getByText('Unable to open the 3D view',{exact:true}).count(),0);
  assert.equal(await detailed.getAttribute('aria-pressed'),'true');
  await page.getByText('Original Blender recreation',{exact:true}).waitFor();
  const canvas=page.getByRole('img',{name:/Interactive Blender model/}),box=await canvas.boundingBox();assert.ok(box&&box.width>250&&box.height>=500);
  const overflow=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));assert.ok(overflow.body<=width,`horizontal overflow at ${width}px`);
  const initial=await canvas.screenshot();await page.screenshot({path:join(evidence,`preview-${width}-detailed.png`),timeout:30000});
  await distant.click();assert.equal(await distant.getAttribute('aria-pressed'),'true');
  const low=await canvas.screenshot();assert.notDeepEqual(low,initial,'LOD button changes rendered geometry');await page.screenshot({path:join(evidence,`preview-${width}-distant.png`),timeout:30000});
  await detailed.click();assert.equal(await detailed.getAttribute('aria-pressed'),'true');
  // Actual pointer movement tests the exported OrbitControls handler.
  await page.mouse.move(box.x+box.width*.42,box.y+box.height*.5);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.69,box.y+box.height*.53,{steps:10});await page.mouse.up();
  const rotated=await canvas.screenshot();assert.notDeepEqual(rotated,initial,'drag orbits the model');
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,-350);
  const zoomed=await canvas.screenshot();assert.notDeepEqual(zoomed,rotated,'zoom changes the rendered view');
  await page.screenshot({path:join(evidence,`preview-${width}-orbit-zoom.png`),timeout:30000});
  result.portraits.push({width,height:844,canvas:box,details:true,distant:true,orbit:true,zoom:true,overflow:false});
  await page.close();console.log('INLINE_PREVIEW_VERIFIED',width);
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.failures,[]);result.pass=true;console.log('INLINE_PREVIEW_PASS');
}catch(error){result.error=String(error);throw error;}
finally{
 await writeFile(join(evidence,'inline-preview-results.json'),JSON.stringify(result,null,2)+'\n').catch(()=>{});
 await browser?.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});
}
