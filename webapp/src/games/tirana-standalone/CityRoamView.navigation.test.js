import {readHistoricBundle} from '../../../scripts/materialize-tirana-historic.mjs';
// @vitest-environment node

import {readFileSync} from 'node:fs';
import * as T from 'three';
import {expect,test,vi} from 'vitest';
import {CityRoamView} from './CityRoamView.js';
import {buildMobility,initialState} from './walkDrive.mjs';
const city=JSON.parse(readFileSync(new URL('../../../public/assets/tirana-city-game/central-city.json',import.meta.url)));
const syntheticView=()=>{
  const view=Object.create(CityRoamView.prototype);
  Object.assign(view,{scene:new T.Scene(),camera:new T.PerspectiveCamera(62,1,.17,450),renderer:{render:vi.fn()},
    city,pavement:new T.MeshStandardMaterial(),chunks:[],sun:new T.DirectionalLight(),touch:{x:0,y:0,brake:false},keys:new Set(),
    radius:160,elapsed:0,frameCount:0,last:0,accumulator:0,firstFrame:false,paused:false,fps:0,emit:vi.fn(),loadDetail:vi.fn()});
  view.mobility=buildMobility(city);view.state=initialState(view.mobility);
  return view;
};
test('actual editable map builds nonempty bucketed geometry with nondegenerate asphalt UV and stable start',()=>{
  const view=syntheticView();
  view.makeCity(city);
  let roadBatches=0,sceneTriangles=0;const chunks=view.chunks.length;
  expect(chunks).toBeGreaterThan(20);expect(chunks).toBeLessThan(100);
  for(const tile of view.chunks)for(const mesh of tile.group.children){
    const g=mesh.geometry,positions=g.getAttribute('position');sceneTriangles+=positions.count/3;
    if(mesh.material!==view.pavement)continue;
    roadBatches++;
    const uv=g.getAttribute('uv');
    expect(uv.count).toBe(positions.count);
    expect(uv.getX(0)).toBeCloseTo(positions.getX(0)/2.8,3);
    const normal=g.getAttribute('normal');expect(normal.getY(0)).toBeGreaterThan(.99);
  }
  expect(roadBatches).toBeGreaterThan(20);expect(sceneTriangles).toBeGreaterThan(10_000);
  expect(sceneTriangles).toBeLessThan(70_000);
});
test('only the first actual scene render queues optional assets; battery range culls tiles',()=>{
  const view=syntheticView();view.makeCity(city);view.tick(15);view.tick(32);
  expect(view.renderer.render).toHaveBeenCalledTimes(2);expect(view.loadDetail).toHaveBeenCalledTimes(1);
  expect(view.renderer.render.mock.invocationCallOrder[0]).toBeLessThan(view.loadDetail.mock.invocationCallOrder[0]);
  const visible=view.chunks.filter(tile=>tile.group.visible).length;
  expect(visible).toBeGreaterThan(0);expect(visible).toBeLessThan(view.chunks.length);
  expect(view.camera.position.y).toBe(1.69);
});

test('historic camera solutions keep Turi out of eye view and cabin out of the chase view', ()=>{
  const view=syntheticView();
  view.follow={update:vi.fn(),reset:vi.fn()};view.walkView='eyes';view.driveView='chase';
  view.car={visible:true};view.avatar={root:{},update:vi.fn()};
  view.positionCamera(view.state,.016);
  expect(view.avatar.update.mock.calls.at(-1)[1]).toBe(false);
  view.walkView='shoulder';view.positionCamera(view.state,.016);
  expect(view.follow.update).toHaveBeenCalledOnce();expect(view.avatar.update.mock.calls.at(-1)[1]).toBe(true);
  view.state.mode='drive';view.driveView='cockpit';view.camera.aspect=.55;view.positionCamera(view.state,.016);
  expect(view.cabin.group.visible).toBe(true);expect(view.car.visible).toBe(false);expect(view.camera.fov).toBe(78);
  view.driveView='chase';view.positionCamera(view.state,.016);
  expect(view.car.visible).toBe(true);expect(view.cabin.group.visible).toBe(false);
});

test('west district does not change spawn state, renders extra geometry only after fetch, and never loads on initial frame',async()=>{
  const view=syntheticView();
  view.abort=new AbortController();
  view.yieldPaint=vi.fn(async()=>{expect(view.city).toBe(city);expect(view.lanaPhase).toBe('pending');});
  const extension=JSON.parse(readFileSync(new URL('../../../public/assets/tirana-city-game/districts/lana-blloku.json',import.meta.url)));
  const originalPos={...view.state},initialChunks=0;
  const mockFetch=vi.fn(async()=>({ok:true,json:async()=>extension}));
  vi.stubGlobal('fetch',mockFetch);
  try{
    const t0=performance.now();view.makeCity(city);const centralMs=performance.now()-t0;
    expect(view.chunks.length).toBeGreaterThan(initialChunks);
    const centralChunks=view.chunks.length,geomBytes=()=>view.chunks.flatMap(t=>t.group.children)
     .reduce((n,m)=>n+Object.values(m.geometry.attributes).reduce((j,a)=>j+a.array.byteLength,0),0);
    const centerBytes=geomBytes();
    view.tick(12);
    expect(mockFetch).not.toHaveBeenCalled();
    const t1=performance.now();await view.loadLana();const loadMs=performance.now()-t1;
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/assets/tirana-city-game/districts/lana-blloku.json');
    expect(view.state).toEqual(originalPos);
    expect(view.lanaPhase).toBe('ready');expect(view.chunks.length).toBeGreaterThan(centralChunks);expect(view.yieldPaint).toHaveBeenCalled();
    expect(view.districtDecor.batches.size).toBe(0);
    expect(geomBytes()).toBeLessThan(9*1024*1024);
    if(process.env.TIRANA_QA_METRICS==='1')console.log(JSON.stringify({centralChunks,combinedChunks:view.chunks.length,centerBytes,combinedBytes:geomBytes(),centralMs,loadMs}));
  }finally{vi.unstubAllGlobals();}
});
test('unavailable extension keeps central roads/collision active, no restart',async()=>{
  const view=syntheticView(),prior=view.mobility;
  view.abort=new AbortController();
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:404})));
  try{
    await view.loadLana();expect(view.lanaPhase).toBe('unavailable');
    expect(view.city).toBe(city);expect(view.mobility).toBe(prior);expect(view.fault).toBeUndefined();
    await view.loadLana();expect(fetch).toHaveBeenCalledTimes(1);
  }finally{vi.unstubAllGlobals();}
});

test('90Hz preserves render remainder at target 60 and large/high-DPR framebuffers are bounded',async()=>{
 const {FramePacer,renderPixelRatio}=await import('../tiranastreets/renderSettings');
 const p=new FramePacer();let frames=0;
 for(let i=0;i<90;i++)if(p.shouldRender(i*1000/90,60))frames++;
 expect(frames).toBe(60);
 const ratio=renderPixelRatio(1440,2400,3,1.8);
 expect((1440*ratio)*(2400*ratio)).toBeCloseTo(2_000_000,1);
});
test('Auto can probe back from 30 FPS after measured recovery, but Battery ceiling stays Battery',async()=>{
 const {AutomaticGraphics,DynamicResolution}=await import('../tiranastreets/graphicsQuality');
 const view=syntheticView();
 view.quality='auto';view.auto=new AutomaticGraphics('balanced');view.auto.preset='battery';
 view.dpr=new DynamicResolution();view.targetFps=30;
 view.applyQuality=vi.fn(()=>{view.targetFps=view.auto.preset==='battery'?30:60;});
 for(let i=0;i<5;i++)view.adaptToFrames(30);
 expect(view.auto.preset).toBe('battery');
 view.adaptToFrames(30);expect(view.auto.preset).toBe('balanced');expect(view.targetFps).toBe(60);
 view.auto=new AutomaticGraphics('battery');view.targetFps=30;
 for(let i=0;i<20;i++)view.adaptToFrames(30);
 expect(view.auto.preset).toBe('battery');
});

const loadedHistoric=await readHistoricBundle();
const historicFile=name=>JSON.parse(loadedHistoric.get(name+'.json').text);

test('normal boot uses actual historic start, not old compact map or optional art; first loaded sector is playable',async()=>{
 const view=syntheticView();
 view.abort=new AbortController();view.schedule=vi.fn();
 const first=historicFile('start');
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>first})));
 try{
  await view.load();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/assets/tirana-city-game/historic/start.json');
  expect(view.state.x).toBe(-59.39);expect(view.state.z).toBe(126.25);
  expect(view.sectors.size).toBe(1);expect(view.chunks.length).toBeGreaterThan(8);
  expect(view.schedule).toHaveBeenCalledOnce();expect(view.loadDetail).not.toHaveBeenCalled();
 }finally{vi.unstubAllGlobals();}
});

test('historic sector is activated atomically; stale movement rejects the response before geometry',async()=>{
 const view=syntheticView();
 view.abort=new AbortController();view.schedule=vi.fn();
 const first=historicFile('start');
 const tile=historicFile('1_0');
 let response;
 const deferred=new Promise(resolve=>response=resolve);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>first}).mockReturnValueOnce(deferred).mockResolvedValueOnce({ok:true,json:async()=>tile}));
 view.yieldPaint=vi.fn(async()=>{expect(view.sectors.size).toBe(1);});
 try{
  await view.load();const sceneSize=view.chunks.length;
  Object.assign(view.state,{x:120,z:80});
  const job=view.loadHistoricSector('1_0');
  expect(view.sectors.size).toBe(1);
  Object.assign(view.state,{x:-60,z:140});response({ok:true,json:async()=>tile});
  await job;expect(view.sectors.size).toBe(1);expect(view.chunks.length).toBe(sceneSize);
  Object.assign(view.state,{x:120,z:80});
  await view.loadHistoricSector('1_0');
  expect(view.sectors.size).toBe(2);expect(view.chunks.length).toBeGreaterThan(sceneSize);
  expect(view.state.x).toBe(120);expect(view.state.z).toBe(80);
 }finally{vi.unstubAllGlobals();}
});

test('loading the tenth historic cell evicts a distant stage without dropping the asphalt material',async()=>{
 const view=syntheticView();
 view.abort=new AbortController();view.schedule=vi.fn();view.yieldPaint=vi.fn(async()=>{});
 const first=historicFile('start');
 const tile=historicFile('1_0');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>first}).mockResolvedValueOnce({ok:true,json:async()=>tile}));
 try{
  await view.load();
  Object.assign(view.state,{x:120,z:80});
  const disposals=[];
  for(let i=2;i<10;i++){
    const key=i+'_0',stage=new T.Group(),geom=new T.PlaneGeometry(1,1),discard=vi.spyOn(geom,'dispose');
    stage.add(new T.Mesh(geom,view.pavement));view.scene.add(stage);
    const data={...first.first,key,bounds:[i*384-256,-64,(i+1)*384-256,320],roads:[],buildings:[],areas:[],parks:[],water:[],neutralCivicMarks:[]};
    view.sectors.set(key,{data,geometry:{stage,chunks:[]}});
    disposals.push(discard);
  }
  const asphalt=vi.spyOn(view.pavement,'dispose');
  expect(view.sectors.size).toBe(9);
  await view.loadHistoricSector('1_0');
  expect(view.sectors.size).toBe(9);expect(view.sectors.has('1_0')).toBe(true);expect(view.sectors.has('0_0')).toBe(true);expect(view.sectors.has('9_0')).toBe(false);
  expect(disposals.reduce((n,call)=>n+call.mock.calls.length,0)).toBe(1);expect(asphalt).not.toHaveBeenCalled();
 }finally{vi.unstubAllGlobals();}
});

test('real scene controller gates Career activity until first render and on pause, then keeps free roam independent',async()=>{
 const {createCivilianCareer}=await import('./civilianCareer.mjs');
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const view=syntheticView();view.civilianCareer=createCivilianCareer(storage);
 view.startCareer();
 expect(values.size).toBe(0);
 view.firstFrame=true;view.paused=true;view.startCareer();view.interactCareer();
 expect(values.size).toBe(0);
 view.paused=false;view.startCareer();
 expect(values.size).toBe(1);
 expect(view.civilianCareer.view(view.city,view.mobility,view.state).position).toBe(1);
 view.interactCareer();
 expect(view.civilianCareer.view(view.city,view.mobility,view.state).position).toBe(1);
 const free=syntheticView();free.firstFrame=true;
 free.startCareer();free.interactCareer();
 expect(free.civilianCareer).toBeUndefined();
});

test('façade respects first frame, pause, renderer size cap, and schedules only once',()=>{
  vi.useFakeTimers();
  vi.stubGlobal('document',{hidden:false});
  try {
    const view=syntheticView();
    view.renderer.capabilities={maxTextureSize:1024};
    view.loadFacadeFinish=vi.fn(()=>{view.facadeRequested=true;});
    view.tick(15);
    vi.advanceTimersByTime(1000);
    expect(view.loadFacadeFinish).not.toHaveBeenCalled();
    view.renderer.capabilities.maxTextureSize=256;
    view.tick(31);
    vi.advanceTimersByTime(1000);
    expect(view.loadFacadeFinish).not.toHaveBeenCalled();
    view.renderer.capabilities.maxTextureSize=1024;
    view.tick(47);
    view.paused=true;
    vi.advanceTimersByTime(1000);
    expect(view.loadFacadeFinish).not.toHaveBeenCalled();
    view.paused=false;
    view.tick(63);view.tick(79);
    vi.advanceTimersByTime(949);
    expect(view.loadFacadeFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(view.loadFacadeFinish).toHaveBeenCalledOnce();
    view.tick(95);
    vi.advanceTimersByTime(1000);
    expect(view.loadFacadeFinish).toHaveBeenCalledOnce();
  } finally {vi.unstubAllGlobals();vi.useRealTimers();}
});
