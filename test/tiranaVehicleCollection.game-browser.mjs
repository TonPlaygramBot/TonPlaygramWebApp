/** End-to-end seat handoff through the actual Tirana Streets route and buttons. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {server} from './serveTiranaVehicleCollection.mjs';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4187/game?activity=street-career&mode=ai&qaOnDemand=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.streetRuntime?.ready,{timeout:120000});console.log('Actual route ready');
 await page.getByRole('button',{name:'FREE ROAM',exact:true}).click({timeout:60000});console.log('Clicked game button');
 await page.evaluate(()=>{const r=window.streetRuntime,c=r.state.cars.find(c=>c.id==='collection-benz'),p=r.state.players.local;p.x=c.x+1.5;p.z=c.z;r.renderer.setFirstPerson(false);});
 await page.waitForFunction(()=>window.streetRuntime.renderer.collectionFleet.has('collection-benz'),{timeout:120000});
 const before=await page.evaluate(()=>{const r=window.streetRuntime,root=r.renderer.collectionFleet.getRoot('collection-benz');return{original:root.userData,children:root.children.map(c=>({name:c.name,role:c.userData.role,visible:c.visible})),errors:Object.fromEntries(r.renderer.collectionFleet.errors)};});
 assert.deepEqual(before.errors,{});assert.ok(before.children.some(c=>c.role==='npc-driver'&&c.visible));
 await page.getByRole('button',{name:'ENTER CAR',exact:true}).click({timeout:60000});console.log('Clicked game button');
 await page.waitForFunction(()=>window.streetRuntime.state.players.local.carId==='collection-benz',{timeout:30000});
 await page.waitForFunction(()=>window.streetRuntime.renderer.collectionFleet.getRoot('collection-benz').children.find(c=>c.userData.role==='npc-driver').visible===false);
 await page.waitForFunction(()=>{const r=window.streetRuntime;return r.state.elapsed-r.state.players.local.lastAction>.35;});
 await page.getByRole('button',{name:'EXIT CAR',exact:true}).click({timeout:60000});console.log('Clicked game button');
 await page.waitForFunction(()=>!window.streetRuntime.state.players.local.carId);
 const after=await page.evaluate(()=>{const r=window.streetRuntime,c=r.state.cars.find(c=>c.id==='collection-benz');r.pause();return{driver:c.driver,npcDriver:c.npcDriver,errors:Object.fromEntries(r.renderer.collectionFleet.errors),cspViolations:window.cspViolations};});
 assert.equal(after.npcDriver,false);assert.deepEqual(after.errors,{});assert.deepEqual(after.cspViolations,[]);assert.deepEqual(errors,[]);
 await writeFile('docs/validation/tirana-vehicle-collection/game-results.json',JSON.stringify({route:'/games/tiranastreets?activity=street-career&mode=ai&qaOnDemand=1',viewport:{width:390,height:844},gpuMode:'On-demand: UI, simulation and asset loading run normally; continuous GPU draws suppressed in local test hook',actualFreeRoamButton:true,actualEnterCarButton:true,actualExitCarButton:true,before,after,errors},null,2));
 console.log('Actual game NPC → player → exit PASS');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
