/** Actual production visual classes and original local GLBs in a single
 * portrait software-WebGL scene. Run with PLAYWRIGHT_MODULE and
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (or EXECUTABLE) where required. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,stat} from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,extname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {build} from '../webapp/node_modules/vite/dist/node/index.js';
import react from '../webapp/node_modules/@vitejs/plugin-react/dist/index.js';
import {BIKE_TYPES} from '../webapp/src/games/tiranastreets/shared/bikeCatalog.mjs';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),web=join(root,'webapp');
const source=await mkdtemp(join(web,'.tirana-realism-assets-')),temp=await mkdtemp(join(tmpdir(),'tirana-realism-assets-')),dist=join(temp,'dist');
const evidence=resolve(process.env.TIRANA_ASSET_EVIDENCE_DIR||join(root,'docs/validation/tirana-realism-assets'));
const result={scope:'Actual production visual layers and original local assets, on-demand software WebGL. This is not a physical-phone frame-rate benchmark.',viewport:{width:390,height:844},models:[],errors:[],consoleErrors:[],failures:[],pass:false};
const allModels=['renea_officer','fnsh_officer','shqiponja_officer','tirana-citizen-0','tirana-citizen-1','athlete-female','mixamo-soldier',...BIKE_TYPES.map(a=>a.id),'articulated-bus',...VEHICLE_COLLECTION.map(a=>a.id)];
const requested=(process.env.TIRANA_ASSET_MODELS||allModels.join(',')).split(',');
assert.ok(requested.length&&requested.every(id=>allModels.includes(id)));
let server,browser;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm'};
const readStats=async page=>JSON.parse(await page.getByTestId('probe-json').textContent());
const waitRevision=async(page,revision)=>page.waitForFunction(previous=>JSON.parse(document.querySelector('[data-testid="probe-json"]').textContent).revision>previous,revision,{timeout:60000});
const delta=(a,b,axis)=>{
 // q(b)*inverse(q(a)): signed axle angle, independent of rest orientation.
 const x=b[3]*-a[0]+b[0]*a[3]+b[1]*-a[2]-b[2]*-a[1];
 const y=b[3]*-a[1]-b[0]*-a[2]+b[1]*a[3]+b[2]*-a[0];
 const z=b[3]*-a[2]+b[0]*-a[1]-b[1]*-a[0]+b[2]*a[3];
 const w=b[3]*a[3]+b[0]*a[0]+b[1]*a[1]+b[2]*a[2];
 return 2*Math.atan2(x*axis[0]+y*axis[1]+z*axis[2],w);
};
try{
 await mkdir(evidence,{recursive:true});
 await writeFile(join(source,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tirana original asset regression</title><style>html,body,#root{margin:0;width:100%;height:100%;font:13px system-ui;background:#162b35;color:#fff}header{height:215px;box-sizing:border-box;padding:16px}.controls{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}select,button{padding:10px;border:1px solid #536873;border-radius:8px;background:#274653;color:white}select:first-child{width:100%}footer{padding:8px;font-size:11px}canvas{display:block}</style><div id="root"></div><script type="module" src="./entry.tsx"></script>');
 await writeFile(join(source,'entry.tsx'),"import '../../test/fixtures/tiranaRealismAssets.tsx';");
 await build({root:web,configFile:false,plugins:[react()],publicDir:false,logLevel:'warn',resolve:{dedupe:['react','react-dom','three'],alias:{react:join(web,'node_modules/react'), 'react-dom':join(web,'node_modules/react-dom'),three:join(web,'node_modules/three')}},build:{outDir:dist,emptyOutDir:true,rollupOptions:{input:join(source,'index.html')}}});
 const html=join(dist,relative(web,join(source,'index.html')));
 server=createServer(async(req,res)=>{
  try{const pathname=new URL(req.url,'http://local').pathname;
   if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
   const file=pathname==='/'?html:pathname.startsWith('/assets/')&&existsSync(join(dist,pathname))?join(dist,pathname):join(web,'public',pathname);
   if(!existsSync(file)||!file.startsWith(dist)&&!file.startsWith(join(web,'public'))){res.writeHead(404);res.end();return;}
   const info=await stat(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res);
  }catch(error){res.writeHead(500);res.end(String(error));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 console.log('ASSET_REVIEW_SERVER',`http://127.0.0.1:${server.address().port}`);
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||process.env.EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:result.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});page.setDefaultTimeout(90000);
 page.on('pageerror',error=>{result.errors.push(error.message);console.error('ASSET_PAGE_ERROR',error.message);});
 page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)result.failures.push({url:new URL(response.url()).pathname,status:response.status()});});
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:120000});
 for(const id of requested){
  await page.getByRole('combobox',{name:'Model',exact:true}).selectOption(id);
  await page.waitForFunction(id=>{const p=document.querySelector('[data-testid="probe-json"]');if(!p)return false;const s=JSON.parse(p.textContent);return s.id===id&&(s.ready||s.timeout||Object.keys(s.errors||{}).length);},id,{timeout:120000});
  const initial=await readStats(page);assert.ok(initial.ready,`${id}: ${JSON.stringify(initial)}`);
  assert.ok(initial.finite&&initial.triangles>500);assert.equal(Object.keys(initial.errors).length,0,id);assert.deepEqual(initial.warnings,[],id);
  const sourceBytes=await readFile(join(web,'public',new URL(initial.sourceURL,'http://local').pathname));
  const record={id,sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),sourceBytes:sourceBytes.length,initial,poses:[]};result.models.push(record);
  if(['force','human'].includes(initial.kind)){
   assert.ok(initial.skinned>0&&initial.bones>15&&initial.textures>0,`${id} uses original skinned textured meshes`);
   if(initial.kind==='force')assert.ok(initial.triangles>20000,`${id} did not load a low-poly stand-in`);
   for(const action of ['walk','run','aim',...(initial.kind==='human'?['fight']:[])]){
    const before=await readStats(page);await page.getByRole('combobox',{name:'Action',exact:true}).selectOption(action);await waitRevision(page,before.revision);
    const pose=await readStats(page);assert.ok(pose.finite,`${id}/${action} finite transforms`);assert.ok(pose.weaponReady,`${id}/${action} original held weapon is ready`);
    assert.ok(pose.rigs.length>0&&pose.rigs.every(r=>r.upright===null||r.upright>.86),`${id}/${action}: upright torso ${JSON.stringify(pose.rigs.map(r=>r.upright))}`);
    assert.notDeepEqual(pose.rigs.map(r=>r.signature),initial.rigs.map(r=>r.signature),`${id}/${action} animates the skeleton`);
    record.poses.push(pose);await page.screenshot({path:join(evidence,`${id}-${action}.png`),timeout:30000});
    if(initial.kind==='force'&&action==='aim'){
     await page.getByRole('button',{name:'Change view',exact:true}).click();await waitRevision(page,pose.revision);
     await page.screenshot({path:join(evidence,`${id}-aim-side.png`),timeout:30000});
    }
   }
  }else{
   assert.ok(initial.wheels.length>=2,`${id}: rolling wheels present`);
   const before=await readStats(page);await page.getByRole('button',{name:'Forward step',exact:true}).click();await waitRevision(page,before.revision);const forward=await readStats(page);
   await page.screenshot({path:join(evidence,`${id}-forward.png`),timeout:30000});
   await page.getByRole('button',{name:'Reverse step',exact:true}).click();await waitRevision(page,forward.revision);const reverse=await readStats(page);
   record.wheelChecks=initial.wheels.map((wheel,i)=>{
    const angle=delta(wheel.quaternion,forward.wheels[i].quaternion,wheel.axis),returned=delta(wheel.quaternion,reverse.wheels[i].quaternion,wheel.axis);
    assert.ok(angle>.001,`${id}/${wheel.name}: forward angle ${angle}`);assert.ok(Math.abs(returned)<1e-5,`${id}/${wheel.name}: reverse returns ${returned}`);
    assert.ok(wheel.contactForwardDot<0,`${id}/${wheel.name}: contact must roll opposite forward travel`);
    return {name:wheel.name,forwardAngle:angle,reverseResidual:returned,contactForwardDot:wheel.contactForwardDot};
   });
   record.poses.push(forward,reverse);
  }
  await writeFile(join(evidence,'asset-browser-progress.json'),JSON.stringify(result,null,2)+'\n');
  console.log('ASSET_VERIFIED',id,JSON.stringify({triangles:initial.triangles,textures:initial.textures,wheels:initial.wheels.length,poses:record.poses.length}));
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.failures,[]);result.pass=true;console.log('REALISM_ASSETS_PASS',result.models.length);
}catch(error){result.error=String(error);throw error;}
finally{
 await writeFile(join(evidence,result.pass?'asset-browser-results.json':'asset-browser-failure.json'),JSON.stringify(result,null,2)+'\n').catch(()=>{});
 await browser?.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));
 await rm(source,{recursive:true,force:true});await rm(temp,{recursive:true,force:true});
}
