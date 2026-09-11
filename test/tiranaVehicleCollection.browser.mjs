import assert from 'node:assert/strict';
import {server} from './serveTiranaVehicleCollection.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
const out=resolve(process.argv[2]||'docs/validation/tirana-vehicle-collection');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4187',{waitUntil:'domcontentloaded'});
 for(const a of VEHICLE_COLLECTION){
  await page.getByRole('combobox',{name:'Vehicle'}).selectOption(a.id);
  await page.waitForFunction(id=>window.collectionProbe?.stats()?.ready&&window.collectionProbe.stats().id===id,a.id,{timeout:60000});
  const s=await page.evaluate(()=>window.collectionProbe.stats());
  assert.deepEqual(s.errors,{},a.id);assert.equal(s.driver.role,'npc-driver');assert.equal(s.driver.seated,true);assert.equal(s.driverVisible,true);
  assert.ok(Math.abs(s.size[0]-a.length)<.005&&Math.abs(s.size[1]-a.height)<.005&&Math.abs(s.size[2]-a.width)<.005,a.id+' preserves original dimensions');
  assert.ok(s.triangles>28000);assert.ok(s.driverBounds[1]>.7&&s.driverBounds[1]<1.5,'seated human, not standing through the roof');
  await page.screenshot({path:resolve(out,a.id+'.png')});results.push(s);console.log('BROWSER',a.id,JSON.stringify(s));
 }
 await page.getByRole('combobox',{name:'Vehicle'}).selectOption('ferrari');
 await page.waitForFunction(()=>window.collectionProbe.stats().ready&&window.collectionProbe.stats().id==='ferrari');
 await page.getByRole('button',{name:'Inspect seated driver'}).click();
 await page.screenshot({path:resolve(out,'seated-driver.png')});
 await page.evaluate(()=>window.collectionProbe.occupy(true));
 await page.waitForFunction(()=>window.collectionProbe.stats().driverVisible===false);
 await page.evaluate(()=>window.collectionProbe.occupy(false));
 await page.waitForFunction(()=>window.collectionProbe.stats().driverVisible===true);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.cspViolations),[]);
 await writeFile(resolve(out,'browser-results.json'),JSON.stringify({scope:'Actual in-game vehicle layer in portrait software WebGL; production CSP; original GLBs and game human',viewport:{width:390,height:844},models:results,playerSeatHandoff:true,errors,cspViolations:[]},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
