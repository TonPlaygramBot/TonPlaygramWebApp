import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync,createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {createExploreRooms} from '../bot/services/exploreRooms.mjs';
import {exploreSimulation} from '../webapp/src/games/tirana-social/exploreSimulation.mjs';
import {MALL_GAMES} from '../webapp/src/games/tirana-mall/mallCatalog.mjs';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'racing-social-mall-'));
const out=resolve(process.env.RACING_REVIEW_OUTPUT||join(tmpdir(),'racing-social-mall-evidence'));
await mkdir(out,{recursive:true});
// Production component, transport, room authority, simulation and WebGL scene.
// Only identity lookup and friend-list HTTP replies are isolated test fixtures.
const identities=new Map([['city-test-alba','Alba'],['city-test-beni','Beni']]);
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
import Game from './src/games/kartroyale/KartRoyale';
import {PyramidGamingMall} from './src/games/tirana-mall/PyramidGamingMall';
const mall=new URLSearchParams(location.search).get('review')==='mall';
createRoot(document.getElementById('root')).render(mall?<PyramidGamingMall onClose={()=>location.assign('/?activity=explore')} onLaunch={route=>{document.getElementById('destination').textContent=route;}}/>:<Game/>);`,resolveDir:webapp,loader:'tsx'},
 bundle:true,jsx:'automatic',format:'esm',outfile:join(temp,'qa.js'),logLevel:'warning',define:{'import.meta.env':'{}'},plugins:[{
 name:'observe-live-city',setup(builder){
  builder.onLoad({filter:/tirana-social\/ExploreRuntime\.ts$/},async args=>({
   contents:(await readFile(args.path,'utf8')).replace('this.renderer=createWebGLRenderer();','(window as any).__cityRuntime=this;this.renderer=createWebGLRenderer();'),loader:'ts'}));
 }}]});
await writeFile(join(temp,'index.html'),`<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/qa.css"><style>html,body,#root{margin:0;width:100%;height:100%;background:#101820}#destination{position:fixed;bottom:0;z-index:100;color:white;background:#123;padding:8px}</style><div id="root"></div><output id="destination" aria-label="Selected destination"></output><script>localStorage.setItem('accountId',new URLSearchParams(location.search).get('person')==='beni'?'city-test-beni':'city-test-alba');</script><script type="module" src="/qa.js"></script>`);
const server=createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(['/api/social/friends','/api/social/requests'].includes(pathname)){res.writeHead(200,{'Content-Type':'application/json'});res.end('[]');return;}
 const directory=pathname.startsWith('/assets/')||pathname.startsWith('/vendor/')?join(webapp,'public'):temp;
 const file=resolve(directory,'.'+(pathname==='/'||pathname.startsWith('/games/')?'/index.html':pathname));
 if(!file.startsWith(directory+'/')||!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.css':'text/css','.html':'text/html','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');
 createReadStream(file).pipe(res);
});
const authority=createExploreRooms({engine:exploreSimulation,resolveProfile:async id=>identities.has(id)?{accountId:id,nickname:identities.get(id),telegramId:id}:null});
const io=new Server(server);
io.use((socket,next)=>{
 const accountId=String(socket.handshake.auth?.accountId||'');
 if(!identities.has(accountId)){next(Error('Only isolated test profiles are allowed'));return;}
 socket.data.auth={accountId};socket.data.playerId=accountId;next();
});
io.on('connection',socket=>{
 socket.on('register',(payload,ack)=>ack({success:payload?.tpcAccountNumber===socket.data.playerId}));
 authority.attach(socket);
});
await new Promise(r=>server.listen(Number(process.env.RACING_REVIEW_PORT)||0,'127.0.0.1',r));
const address=`http://127.0.0.1:${server.address().port}`;
if(process.argv.includes('--serve')){
 console.log(JSON.stringify({address,city:`${address}/?activity=explore`,secondPlayer:`${address}/?activity=explore&person=beni`,mall:`${address}/?review=mall`,scope:'Production components with isolated two-person test accounts. No real accounts, balances or purchases.'}));
 await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
 authority.close();await new Promise(r=>io.close(r));
}else if(process.argv.includes('--network-smoke')){
 const {io:connect}=await import('socket.io-client');
 const clients=[];
 const request=(client,action,payload={})=>new Promise((resolve,reject)=>client.socket.timeout(8000).emit('explore:request',{action,accountId:client.accountId,clientId:client.accountId,roomId:client.roomId||'',...payload},(error,result)=>error||!result?.success?reject(error||Error(result?.error)):resolve(result.data)));
 try{
  for(const accountId of identities.keys()){
   const socket=connect(address,{auth:{accountId},transports:['websocket'],reconnection:false});
   const client={socket,accountId,roomId:''};clients.push(client);
   await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
   const joined=await request(client,'join');client.roomId=joined.id;client.playerId=joined.playerId;
  }
  assert.equal(clients[0].roomId,clients[1].roomId);
  const room=await request(clients[0],'snapshot');assert.equal(room.members.length,2);assert.ok(room.state.players[clients[0].playerId]);
  await request(clients[0],'chat',{text:'Hello from the transport smoke test'});
  const received=await request(clients[1],'snapshot');assert.equal(received.messages.at(-1).text,'Hello from the transport smoke test');
  await request(clients[0],'game-invite',{to:clients[1].playerId,gameId:MALL_GAMES[0].slug});
  const invited=await request(clients[1],'snapshot'),invitation=invited.invitations[0];assert.equal(invitation.path,MALL_GAMES[0].route);
  await request(clients[1],'game-invite-response',{id:invitation.id,accept:true});
  assert.equal((await request(clients[0],'snapshot')).invitations[0].status,'accepted');
  await request(clients[1],'leave');assert.equal((await request(clients[0],'snapshot')).members.length,1);
  console.log(JSON.stringify({passed:true,checks:['Actual Socket.IO transport joins two isolated accounts into the real city simulation','Room chat crosses independent sockets','Catalogue game invitation reaches recipient and acceptance reaches sender','Leaving removes the remote avatar'],scope:'No browser, camera, microphone, friend persistence or production authentication claim.'},null,2));
 }finally{clients.forEach(client=>client.socket.disconnect());authority.close();await new Promise(r=>io.close(r));}
}else{
 let browser;
 const result={viewport:{width:390,height:844},scope:'Two local fixture identities using real city room authority, transport and WebGL. Friend services are empty-list fixtures; no friend persistence, real-device capture or production TURN verification is claimed.',checks:[],errors:[]};
 try{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:result.viewport,isMobile:true,hasTouch:true});
  const alba=await context.newPage();alba.on('pageerror',error=>result.errors.push(error.message));
  await alba.goto(`${address}/?activity=explore`);
  await alba.waitForFunction(()=>window.__cityRuntime?.state?.members?.length===1,{},{timeout:90000});
  const other=await browser.newContext({viewport:result.viewport,isMobile:true,hasTouch:true});
  const beni=await other.newPage();beni.on('pageerror',error=>result.errors.push(error.message));
  await beni.goto(`${address}/?activity=explore&person=beni`);
  await alba.waitForFunction(()=>window.__cityRuntime?.state?.members?.length===2,{},{timeout:90000});
  assert.equal(await alba.evaluate(()=>window.__cityRuntime.state.id),await beni.evaluate(()=>window.__cityRuntime.state.id));
  result.checks.push('Two independent accounts join the same server-authoritative city');
  await alba.getByRole('button',{name:/PEOPLE/}).click();
  await alba.getByRole('button',{name:'CHAT',exact:true}).click();
  await alba.getByRole('textbox',{name:'Chat message'}).fill('Hello from the Pyramid');
  await alba.getByRole('button',{name:'SEND',exact:true}).click();
  await beni.getByRole('button',{name:/PEOPLE/}).click();
  await beni.getByRole('button',{name:'CHAT',exact:true}).click();
  await beni.getByRole('log').getByText('Hello from the Pyramid',{exact:false}).waitFor();
  result.checks.push('Room chat reaches the other browser through the actual server');
  await alba.getByRole('button',{name:'INVITES',exact:true}).click();
  await alba.getByLabel('Game hall',{exact:true}).selectOption(MALL_GAMES[0].slug);
  const target=await alba.evaluate(()=>window.__cityRuntime.state.members.find(m=>m.name==='Beni').id);
  await alba.getByLabel('Invite player',{exact:true}).selectOption(target);
  await alba.getByRole('button',{name:'SEND GAME INVITATION',exact:true}).click();
  await beni.getByRole('button',{name:/^INVITES/}).click();
  await beni.getByRole('button',{name:'ACCEPT',exact:true}).click();
  await alba.getByRole('button',{name:'MEET IN LOBBY',exact:true}).waitFor();
  await beni.getByRole('button',{name:'MEET IN LOBBY',exact:true}).waitFor();
  result.checks.push('Catalogue-based invitation is delivered, accepted and visible to both people');
  await alba.screenshot({path:join(out,'01-city-invitation-portrait.png')});
  await alba.goto(`${address}/?review=mall`);
  await alba.getByLabel('TonPlayGram Pyramid Gaming Mall',{exact:true}).waitFor();
  await alba.waitForFunction(()=>!!document.querySelector('.tpg-mall-canvas canvas'),{},{timeout:30000});
  const halls=alba.locator('.tpg-mall-grid button');
  assert.equal(await halls.count(),MALL_GAMES.length,'Every live catalogue game has a hall');
  await halls.first().click();
  await alba.getByRole('button',{name:'ENTER GAME LOBBY',exact:true}).click();
  assert.equal(await alba.getByLabel('Selected destination',{exact:true}).textContent(),MALL_GAMES[0].route);
  await alba.getByRole('button',{name:/^SHOPS/}).click();
  await alba.locator('.tpg-mall-grid button').first().click();
  await alba.getByRole('button',{name:'OPEN SHOP',exact:true}).click();
  assert.equal(await alba.getByLabel('Selected destination',{exact:true}).textContent(),'/store/all');
  result.checks.push('Every active game has a hall and game/store launches use existing catalogue destinations');
  await alba.screenshot({path:join(out,'02-pyramid-mall-portrait.png')});
  assert.deepEqual(result.errors,[]);
  result.checks.push('Production Pyramid mall mounts at portrait width with a WebGL canvas');
  await writeFile(join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser?.close();authority.close();await new Promise(r=>io.close(r));}
}
