import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

// This validates the exported asset viewer, NOT the running games or a physical GPU.
const assets=resolve(process.argv[2]||'artifacts/tirana-shopfronts');
const output=resolve(process.argv[3]||'artifacts/tirana-browser');
await mkdir(output,{recursive:true});
const html=await readFile(resolve(assets,'preview.html'));
const server=createServer((req,res)=>{
 if(req.url==='/'||req.url==='/preview.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);}
 else if(req.url==='/favicon.ico'){res.writeHead(204);res.end();}
 else{res.writeHead(404);res.end();}
});
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
 for(const viewport of [{width:360,height:800},{width:390,height:844},{width:430,height:932}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
   for(const name of ['KAFE LANA','FURRË DRITA','MARKETI I LAGJES','VELO TIRANA']){
    const button=page.getByRole('button',{name,exact:true});
    await button.waitFor({state:'visible',timeout:30000});await button.click();
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.startsWith('Drag to orbit'),{},{timeout:30000});
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('canvas').count(),1);
    const layout=await page.evaluate(()=>{
     const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
     return {width:r.width,height:r.height,bitmapWidth:c.width,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.ok(layout.width>250&&layout.height>=300&&layout.bitmapWidth>250,'Rendered canvas must have a usable portrait size');
    assert.ok(layout.overflow<=1,`Horizontal overflow: ${layout.overflow}`);
    assert.deepEqual(errors,[],'Do not treat failed CDN/model loads as a pass');
    await page.screenshot({path:resolve(output,`${viewport.width}-${name.replace(/[^A-Za-z0-9]+/g,'-')}.png`),fullPage:true});
    results.push({viewport,brand:name,status:'passed',layout});
   }
  }catch(e){await page.screenshot({path:resolve(output,`${viewport.width}-failure.png`),fullPage:true});results.push({viewport,status:'failed',error:String(e),errors});throw e;}
  finally{await context.close();}
 }
}finally{
 await writeFile(resolve(output,'results.json'),JSON.stringify({scope:'Exported asset viewer; software WebGL, not actual games or physical phone',results},null,2));
 await browser?.close();await new Promise(done=>server.close(done));
}
