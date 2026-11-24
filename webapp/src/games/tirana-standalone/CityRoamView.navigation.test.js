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
