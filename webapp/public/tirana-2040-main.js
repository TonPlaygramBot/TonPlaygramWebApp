document.title = 'Tirana 2040 • Last Man Standing';

export async function startTirana2040(){
  window.__phase='boot';
  try {
  const $ = (id)=>document.getElementById(id);
  const wrap = $('wrap');
  let armoryDiv;
  let armorySlider;
  let armorySliderWrap;
  let armoryPrev;
  let armoryNext;
  let syncArmorySlider;
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
  const isMobile = isTouch || /Android|webOS|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
  const gate = $('gate');
  const ctxlost = $('ctxlost');
  // The mobile layout gate was originally used to block phones from loading the
  // experience while the responsive controls were incomplete. The game is now
  // fully touch compatible, so the overlay needs to stay hidden regardless of
  // the device or the user would be stuck on a blank "Mobile layout gate"
  // screen. Keep the element for potential future notices but don't display it
  // automatically.
  if (gate) {
    gate.style.display = 'none';
    gate.setAttribute('hidden', 'hidden');
    gate.style.pointerEvents = 'none';
  }

  window.isMobile = isMobile;
  window.gate = gate;

  const SCALE={ FLOOR_H:3.4, TRAFFIC_LIGHT_H:2.8 };
  const PERF={ bots:10 };
  // Fast boot trades visual fidelity for stability on mobile. Explicitly disable it
  // so every client uses the full-detail pipeline.
  const FAST_BOOT=false;
  window.SCALE=SCALE;
  window.PERF=PERF;
  window.FAST_BOOT=FAST_BOOT;

  const CURATED=[{ urls:['https://example.com/fallback.glb'] }];
  window.CURATED=CURATED;
  async function loadWithRetry(urls){ return Array.isArray(urls) && urls.length>0; }
  window.loadWithRetry=loadWithRetry;

  const TREE_LIBRARY = [];

  function withTimeout(promise, ms=8000){
    return new Promise((resolve, reject)=>{
      const timer=setTimeout(()=>reject(new Error('timeout')), ms);
      promise.then((val)=>{ clearTimeout(timer); resolve(val); })
             .catch((err)=>{ clearTimeout(timer); reject(err); });
    });
  }

  window.__frameCapMs = 1000/60;
  window.__forceStubFallback = ()=>location.reload();
  const usingStub=false;
  const ktx2Enabled=false;
  window.usingStub=usingStub;
  window.ktx2Enabled=ktx2Enabled;
  function addSceneChunked(){ return Promise.resolve(); }
  window.addSceneChunked=addSceneChunked;

  const params = new URLSearchParams(window.location.search);
  const entrants = parseInt(params.get('players') || '10', 10);
  const stakeToken = params.get('token') || 'TPC';
  const stakeAmount = params.get('amount');
  if(!Number.isNaN(entrants)){
    $('br').textContent = `Entrants: ${entrants} • AI`;
  }
  if(stakeAmount){
    $('status').textContent = `Tirana 2040 • ${stakeAmount} ${stakeToken}`;
  } else {
    $('status').textContent = 'Tirana 2040 • Last Man Standing';
  }

  window.__phase='dom-wired';

  function updateStatus(message){
    const statusEl = $('status');
    if(statusEl) statusEl.textContent = message;
  }

  window.addEventListener('unhandledrejection',(evt)=>{ console.error('Unhandled promise in Tirana 2040', evt.reason); updateStatus('Riprovo pas nderprerjes…'); });

  async function importWithFallback(label, sources){
    for(const url of sources){
      try {
        const mod = await import(url);
        console.info(`${label} loaded from ${url}`);
        return mod;
      } catch(err){
        console.warn(`${label} failed from ${url}`, err);
      }
    }
    throw new Error(`${label} could not be loaded`);
  }

  updateStatus('Tirana 2040 • Loading engine…');
  const [
    THREE,
    CANNON,
    gltfLoaderMod,
    dracoLoaderMod,
    waterMod,
    SkeletonUtils
  ] = await Promise.all([
    importWithFallback('THREE', [
      'https://esm.sh/three@0.160.0',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
    ]),
    importWithFallback('CANNON', [
      'https://esm.sh/cannon-es@0.20.0',
      'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js'
    ]),
    importWithFallback('GLTFLoader', [
      'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
    ]),
    importWithFallback('DRACOLoader', [
      'https://esm.sh/three@0.160.0/examples/jsm/loaders/DRACOLoader.js',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js'
    ]),
    importWithFallback('Water', [
      'https://esm.sh/three@0.160.0/examples/jsm/objects/Water2.js',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/objects/Water2.js'
    ]),
    importWithFallback('SkeletonUtils', [
      'https://esm.sh/three@0.160.0/examples/jsm/utils/SkeletonUtils.js',
      'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js'
    ])
  ]);
  const { GLTFLoader } = gltfLoaderMod;
  const { DRACOLoader } = dracoLoaderMod;
  const { Water } = waterMod;

  function makeRendererOpts(quality='high'){ return {
    antialias: quality==='high' && !isMobile,
    powerPreference: isMobile ? 'low-power' : (quality==='high'?'high-performance':'low-power'),
    alpha: false,
    stencil: false,
    depth: true,
    precision: quality==='high'?'mediump':'lowp'
  }; }
  function createRenderer(){
    try {
      return new THREE.WebGLRenderer(makeRendererOpts('high'));
    } catch(err){
      console.warn('Primary renderer failed, retrying with safer mobile defaults', err);
      updateStatus('Lowering quality for the mobile device…');
      try {
        return new THREE.WebGLRenderer(makeRendererOpts('safe'));
      } catch(inner){
        console.error('Renderer fallback also failed', inner);
        throw inner;
      }
    }
  }
  const renderer = createRenderer();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.85;
  const allowShadows = !isMobile;
  renderer.shadowMap.enabled = allowShadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const loadingManager=new THREE.LoadingManager();
  loadingManager.setURLModifier((url)=>{ if(url?.startsWith('data:')||url?.startsWith('blob:')) return url; return url; });
  loadingManager.onError = (url)=>console.warn('Asset load error:', url);
  const gltfLoader=new GLTFLoader(loadingManager);
  const draco=new DRACOLoader(loadingManager);
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  gltfLoader.setDRACOLoader(draco);
  gltfLoader.setCrossOrigin('anonymous');
  gltfLoader.register((parser)=>{ const c=document.createElement('canvas'); c.width=c.height=1; const ctx=c.getContext('2d'); ctx.fillStyle='#888'; ctx.fillRect(0,0,1,1); const blank=new THREE.CanvasTexture(c); blank.colorSpace=THREE.SRGBColorSpace; blank.needsUpdate=true; const orig=parser.getDependency.bind(parser); parser.getDependency=function(type,index){ if(type==='texture') return orig(type,index).catch(()=>blank); return orig(type,index); }; return {name:'TextureFallbackIfMissing'}; });

  const prefabKit={ ready:false, unit:null };
  function normalizePrefab(root){ const box=new THREE.Box3().setFromObject(root); const center=new THREE.Vector3(); box.getCenter(center); root.position.sub(center); const minY=box.min.y-center.y; root.position.y -= minY; root.updateMatrixWorld(true); }
  function applyPrefabMaterial(root, material){ const mats=new WeakSet(); root.traverse((o)=>{ if(!o.isMesh) return; if(material){ o.material=material.clone(); } else if(!o.material){ o.material=new THREE.MeshStandardMaterial({ color:0x9ca3af }); } if(!mats.has(o.material)){ o.material.side=THREE.DoubleSide; o.material.needsUpdate=true; mats.add(o.material); } o.castShadow=allowShadows; o.receiveShadow=allowShadows; }); return root; }
  async function loadPrefabGLB(urls, timeoutMs=FAST_BOOT?3200:6200){ let lastErr=null; for(const url of urls){ try { const gltf=await withTimeout(gltfLoader.loadAsync(url), timeoutMs); return gltf; } catch(err){ lastErr=err; } } throw lastErr || new Error('prefab load fail'); }
  async function ensurePrefabKit(){ if(prefabKit.ready) return prefabKit; try { const gltf=await loadPrefabGLB([
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb',
      'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Box/glTF-Binary/Box.glb'
    ]); const root=(gltf.scene||gltf.scenes?.[0])?.clone?.()||null; prefabKit.unit=root || new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color:0x9ca3af })); normalizePrefab(prefabKit.unit); prefabKit.ready=true; return prefabKit; } catch(err){ console.warn('Prefab kit failed, using procedural boxes', err); prefabKit.unit=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color:0x9ca3af })); normalizePrefab(prefabKit.unit); prefabKit.ready=true; return prefabKit; } }
  function makePrefabBox(w,h,d, material){ const base=(prefabKit.unit?.clone?.()||new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color:0x9ca3af }))); applyPrefabMaterial(base, material); base.scale.set(w,h,d); base.position.y += h/2; base.userData.prefab='box'; return base; }
  wrap.appendChild(renderer.domElement);
  if (ctxlost) {
    renderer.domElement.addEventListener('webglcontextlost',(e)=>{ e.preventDefault(); ctxlost.style.display='grid'; });
    renderer.domElement.addEventListener('webglcontextrestored',()=>{ ctxlost.style.display='none'; fit(); });
    ctxlost.addEventListener('click', ()=>location.reload());
  } else {
    renderer.domElement.addEventListener('webglcontextlost',(e)=>{ e.preventDefault(); fit(); });
    renderer.domElement.addEventListener('webglcontextrestored',()=>{ fit(); });
  }
  renderer.domElement.addEventListener('mousedown', onMouseDownAudio, {once:true});
  window.renderer=renderer;
  THREE.Cache.enabled = true;

  const skyTexture = makeSkyTexture();

  const scene = new THREE.Scene();
  scene.background = skyTexture;
  scene.fog = new THREE.Fog('#f5e7cf', 900, 3500);
  window.scene=scene;

  const camera = new THREE.PerspectiveCamera(64, (innerWidth||1)/(innerHeight||1), 0.01, 10000);
  camera.position.set(0,1.7,5.6); scene.add(camera);
  window.camera=camera;

  const CAMERA_MODES={ FOLLOW:'follow', COCKPIT:'cockpit' };
  let cameraMode=CAMERA_MODES.FOLLOW;

  // Mobile handsets were failing to allocate a WebGL context when the canvas was
  // initialized at the device's full DPR, leaving the screen blank. Keep the
  // full-fidelity pipeline (FAST_BOOT stays off) but cap the render density on
  // phones so the renderer reliably starts.
  const maxMobileDpr = 1.3;
  const minVisualDpr = isMobile ? 1.0 : 1.1;
  let dprBase = Math.max(minVisualDpr, Math.min(window.devicePixelRatio||1.1, isMobile ? maxMobileDpr : 2.4));
  let dprScale = isMobile ? 0.95 : 1.05;
  const DPR_MIN = isMobile ? 0.95 : 0.9;
  const DPR_MAX_SCALE = isMobile ? 1.15 : 1.25;
  const PERF_TARGET_FPS = 50;
  let lowFpsTime = 0;
  let perfBoosted = false;
  function fit(){
    const w=wrap.clientWidth||innerWidth, h=wrap.clientHeight||innerHeight;
    const targetDpr=Math.max(minVisualDpr, Math.min(dprBase*dprScale, isMobile?maxMobileDpr:3.0));
    try {
      renderer.setPixelRatio(targetDpr);
      renderer.setSize(w,h,false);
    } catch(err){
      if(isMobile && targetDpr>1){
        const fallbackDpr=Math.max(minVisualDpr, targetDpr-0.4);
        console.warn('Renderer resize failed at DPR', targetDpr, 'retrying with', fallbackDpr, err);
        dprBase=Math.min(dprBase, fallbackDpr);
        renderer.setPixelRatio(fallbackDpr);
        renderer.setSize(w,h,false);
      } else {
        throw err;
      }
    }
    camera.aspect=w/h; camera.updateProjectionMatrix(); syncArmorySlider?.();
  }
  addEventListener('resize', fit); fit();

  const hemi = new THREE.HemisphereLight(0xfff3d6, 0x8a7a6a, 0.55);
  const key  = new THREE.DirectionalLight(0xffd6a0, allowShadows?1.25:1.0); key.position.set(220, 350, 180); key.castShadow=allowShadows;
  if(allowShadows){ key.shadow.mapSize.set(isMobile?1024:2048,isMobile?1024:2048); key.shadow.camera.near=1; key.shadow.camera.far=3000; key.shadow.camera.left=-900; key.shadow.camera.right=900; key.shadow.camera.top=900; key.shadow.camera.bottom=-900; }
  const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(-320, 140, -260);
  const rim  = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(120, 200, -520);
  scene.add(hemi, key, fill, rim);
  function applyPerformanceBoost(){
    if(perfBoosted) return;
    perfBoosted=true;
    renderer.shadowMap.enabled=false;
    [key,fill,rim].forEach((l)=>{ l.castShadow=false; if(l.shadow?.mapSize){ l.shadow.mapSize.set(512,512); } });
    dprBase=Math.min(dprBase,1.0);
    dprScale=Math.max(DPR_MIN, dprScale-0.15);
    fit();
    updateStatus('Tirana 2040 • Performance boost (50fps)');
  }
  const muzzleLight = new THREE.PointLight(0xfff1c6, 0.0, 2.0); scene.add(muzzleLight);

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.81,0) });
  world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true;
  const PHYSICS_STEP = 1/90;
  const matGround=new CANNON.Material('ground'), matPlayer=new CANNON.Material('player'), matEnemy=new CANNON.Material('enemy'), matCar=new CANNON.Material('car');
  world.addContactMaterial(new CANNON.ContactMaterial(matGround, matPlayer, { friction:.2, restitution:0 }));
  world.addContactMaterial(new CANNON.ContactMaterial(matGround, matCar, { friction:.9, restitution:0 }));

  const groundBody = new CANNON.Body({ mass:0, material:matGround, shape:new CANNON.Plane() });
  groundBody.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(groundBody);

  function makeAsphalt(size=1024){
    const c=document.createElement("canvas");
    c.width=c.height=size;
    const x=c.getContext('2d');
    x.fillStyle='#1d1d1d';
    x.fillRect(0,0,size,size);
    for(let i=0;i<1400;i++){
      const r=Math.random()*2+0.6;
      const a=0.14+Math.random()*0.16;
      x.fillStyle=`rgba(255,255,255,${a})`;
      x.beginPath();
      x.arc(Math.random()*size,Math.random()*size,r,0,Math.PI*2);
      x.fill();
    }
    for(let i=0;i<1100;i++){
      x.strokeStyle='rgba(0,0,0,0.52)';
      x.lineWidth=Math.random()*5.2+1.8;
      x.beginPath();
      const sx=Math.random()*size, sy=Math.random()*size;
      const ex=sx+(Math.random()*48-24), ez=sy+(Math.random()*48-24);
      x.moveTo(sx,sy);
      x.lineTo(ex,ez);
      x.stroke();
    }
    for(let i=0;i<880;i++){
      x.strokeStyle='rgba(0,0,0,0.72)';
      x.lineWidth=Math.random()*3.2+1.2;
      x.beginPath();
      const sx=Math.random()*size, sy=Math.random()*size;
      const ex=sx+(Math.random()*26-13), ez=sy+(Math.random()*26-13);
      x.moveTo(sx,sy);
      x.lineTo(ex,ez);
      x.stroke();
    }
    for(let i=0;i<12000;i++){
      const a=0.12+Math.random()*0.16;
      x.fillStyle=`rgba(255,255,255,${a})`;
      const sizeDot=1+Math.random()*0.9;
      x.fillRect(Math.random()*size,Math.random()*size,sizeDot,sizeDot);
    }
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(9,9);
    t.anisotropy=Math.min(16,maxAniso);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }
  function makeSidewalk(size=512){ const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'); x.fillStyle='#c9ced6'; x.fillRect(0,0,size,size); x.strokeStyle='#9aa0a8'; x.lineWidth=6; for(let s=0;s<size;s+=64){ x.beginPath(); x.moveTo(s,0); x.lineTo(s,size); x.stroke(); x.beginPath(); x.moveTo(0,s); x.lineTo(size,s); x.stroke(); } const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(32,32); t.anisotropy=8; t.colorSpace=THREE.SRGBColorSpace; return t; }
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 4, isMobile ? 6 : 16);
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin?.('anonymous');
  function makeFlatNormalTexture(size=8){
    const data = new Uint8Array(size*size*4);
    for(let i=0;i<size*size;i++){
      const base=i*4;
      data[base]=128; // X
      data[base+1]=128; // Y
      data[base+2]=255; // Z
      data[base+3]=255; // A
    }
    const tex=new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace=THREE.LinearSRGBColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(4,4);
    tex.needsUpdate=true;
    return tex;
  }
  const waterNormalTile = makeFlatNormalTexture();
  function makeTreeFallback(){
    const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');
    x.fillStyle='#4e7f56'; x.fillRect(0,48,128,80);
    x.fillStyle='#2f5a36'; x.beginPath(); x.moveTo(64,12); x.lineTo(18,90); x.lineTo(110,90); x.closePath(); x.fill();
    x.fillStyle='#8c6239'; x.fillRect(58,90,12,24);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.needsUpdate=true; tex.anisotropy=4;
    return new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false });
  }
  const treeTextureLoader = textureLoader;
  function loadTreeBillboard(){ return Promise.resolve(null); }
  function loadTiledTexture(url, repeatX=1, repeatY=1){ return new Promise((resolve)=>{ textureLoader.load(url, (tex)=>{ tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(repeatX, repeatY); tex.anisotropy=Math.min(12,maxAniso); tex.colorSpace=THREE.SRGBColorSpace; resolve(tex); }, ()=>resolve(null)); }); }
  async function buildTreePalette(){ return []; }
  function nextTreeMaterial(){ return null; }
  function grassProcedural(size=1024){ const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'); x.fillStyle='#6fa863'; x.fillRect(0,0,size,size); for(let i=0;i<2600;i++){ x.fillStyle=`rgba(0,80,0,${Math.random()*0.12})`; x.fillRect(Math.random()*size,Math.random()*size,1,1);} const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(6,6); t.anisotropy=8; t.colorSpace=THREE.SRGBColorSpace; return t; }
  function grassTex(){
    return new Promise((resolve)=>{
      const failover = grassProcedural();
      let settled=false;
      const finish=(tex)=>{ if(settled) return; settled=true; resolve(tex); };
      const timeout=setTimeout(()=>finish(failover), 2600);
      textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
        (tex)=>{ clearTimeout(timeout); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(6,6); tex.anisotropy=Math.min(12,maxAniso); tex.colorSpace=THREE.SRGBColorSpace; finish(tex); },
        undefined,
        ()=>{ clearTimeout(timeout); finish(failover); }
      );
    });
  }
  function makeSkyTexture(){ const c=document.createElement('canvas'); c.width=2048; c.height=1024; const ctx=c.getContext('2d'); const grd=ctx.createLinearGradient(0,0,0,c.height); grd.addColorStop(0,'#9dd5ff'); grd.addColorStop(0.35,'#bfe3ff'); grd.addColorStop(1,'#f5e7cf'); ctx.fillStyle=grd; ctx.fillRect(0,0,c.width,c.height); for(let i=0;i<1200;i++){ const x=Math.random()*c.width; const y=Math.random()*c.height*0.5; const size=Math.random()*2+0.5; ctx.fillStyle=`rgba(255,255,255,${0.15+Math.random()*0.35})`; ctx.fillRect(x,y,size,size*0.6); } const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.mapping=THREE.EquirectangularReflectionMapping; tex.needsUpdate=true; return tex; }
  function makeBrickTexture(){ const c=document.createElement('canvas'); c.width=512; c.height=512; const ctx=c.getContext('2d'); ctx.fillStyle='#c26b44'; ctx.fillRect(0,0,512,512); const rows=16, cols=32; ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=2; for(let r=0;r<=rows;r++){ const y=(r/rows)*c.height; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); } for(let r=0;r<rows;r++){ const offset=(r%2?0.5:0)*c.width/cols; for(let cix=0;cix<=cols;cix++){ const x=(cix/cols)*c.width+offset; ctx.beginPath(); ctx.moveTo(x%c.width, r*c.height/rows); ctx.lineTo(x%c.width, (r+1)*c.height/rows); ctx.stroke(); } } for(let i=0;i<2600;i++){ const alpha=Math.random()*0.2; ctx.fillStyle=`rgba(0,0,0,${alpha})`; ctx.fillRect(Math.random()*c.width, Math.random()*c.height, 1, 1); } const tex=new THREE.CanvasTexture(c); tex.anisotropy=8; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4,4); tex.colorSpace=THREE.SRGBColorSpace; return tex; }
  function makePlasterTexture(){ const c=document.createElement('canvas'); c.width=512; c.height=512; const ctx=c.getContext('2d'); ctx.fillStyle='#d6d0c4'; ctx.fillRect(0,0,512,512); const noise=ctx.createImageData(c.width,c.height); for(let i=0;i<noise.data.length;i+=4){ const v=210+Math.random()*30; noise.data[i]=v; noise.data[i+1]=v; noise.data[i+2]=v-8; noise.data[i+3]=255; } ctx.putImageData(noise,0,0); for(let i=0;i<900;i++){ ctx.fillStyle=`rgba(0,0,0,${Math.random()*0.08})`; const x=Math.random()*c.width; const y=Math.random()*c.height; const w=Math.random()*3+1; const h=Math.random()*9+1; ctx.fillRect(x,y,w,h); } const tex=new THREE.CanvasTexture(c); tex.anisotropy=8; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4,4); tex.colorSpace=THREE.SRGBColorSpace; return tex; }
  function makeLambertAngleMat(baseTex){ const mat=new THREE.MeshStandardMaterial({ map:baseTex, roughness:0.7, metalness:0.08 }); mat.onBeforeCompile=(shader)=>{ shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat facing=max(0.2,dot(normalize(vNormal),vec3(0.0,1.0,0.0)));\nvec3 cool=vec3(0.92,0.94,0.98);\nvec3 warm=vec3(1.08,1.04,0.98);\ndiffuseColor.rgb*=mix(cool,warm,facing);'); }; return mat; }
  function makeGlassStdMat(){ return new THREE.MeshPhysicalMaterial({ color:0xffffff, roughness:0.08, metalness:0.0, transmission:0.95, thickness:0.08, transparent:true, opacity:0.1, envMapIntensity:0.35, depthWrite:false }); }
  function makeWaterMaterial(){ const tex = new THREE.CanvasTexture((()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const ctx=c.getContext('2d'); const grd=ctx.createRadialGradient(128,128,20,128,128,128); grd.addColorStop(0,'rgba(80,180,255,0.95)'); grd.addColorStop(1,'rgba(30,90,140,0.65)'); ctx.fillStyle=grd; ctx.fillRect(0,0,256,256); return c; })()); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2); return new THREE.MeshStandardMaterial({ map:tex, transparent:true, opacity:0.9, roughness:0.2, metalness:0.15, side:THREE.DoubleSide }); }
  function trackTex(w=1024,h=1024){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.fillStyle='#b33a2c'; g.fillRect(0,0,w,h); const dots=Math.floor(w*h*0.004); for(let i=0;i<dots;i++){ const x=Math.random()*w, y=Math.random()*h, r=Math.random()*1.6+0.2; g.fillStyle=Math.random()<0.5?'rgba(255,190,180,0.35)':'rgba(40,12,10,0.35)'; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill(); } const t=new THREE.CanvasTexture(c); t.anisotropy=Math.min(16,maxAniso); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.repeat.set(1,1); return t; }
  function makeBikeLaneTexture(){ const c=document.createElement('canvas'); c.width=256; c.height=1024; const g=c.getContext('2d'); g.fillStyle='#b91c1c'; g.fillRect(0,0,c.width,c.height); g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=10; const dash=72, gap=54; for(let y=gap; y<c.height; y+=dash+gap){ g.beginPath(); g.moveTo(c.width/2, y); g.lineTo(c.width/2, y+dash); g.stroke(); } const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1,8); tex.anisotropy=Math.min(8,maxAniso); tex.colorSpace=THREE.SRGBColorSpace; return tex; }

  const brickTex = makeBrickTexture();
  const plasterTex = makePlasterTexture();

  const asphaltTex = makeAsphalt(), sidewalkTex = makeSidewalk(), redTrackTex = trackTex();
  const bikeLaneTex = makeBikeLaneTexture();
  const tennisGrassTex = await grassTex();
  const naturalParkTex = grassProcedural(1024); naturalParkTex.repeat.set(10,10); naturalParkTex.needsUpdate=true;
  const turfTex = naturalParkTex;
  const parkLawnTex = naturalParkTex;
  const waterMat = makeWaterMaterial();
  function makeStoneTilesTexture(){
    const c=document.createElement('canvas'); c.width=c.height=512; const ctx=c.getContext('2d');
    ctx.fillStyle='#bfc4c9'; ctx.fillRect(0,0,512,512);
    for(let i=0;i<42;i++){
      const x=(i%7)*72 + 12; const y=Math.floor(i/7)*72 + 8; const w=60 + Math.random()*10; const h=60 + Math.random()*8;
      ctx.fillStyle=i%2?'#cdd2d8':'#d8dde2'; ctx.fillRect(x,y,w,h);
      ctx.strokeStyle='rgba(80,90,100,0.35)'; ctx.lineWidth=2.2; ctx.strokeRect(x+1,y+1,w-2,h-2);
      for(let n=0;n<6;n++){ ctx.fillStyle='rgba(60,70,80,0.16)'; ctx.beginPath(); ctx.arc(x+Math.random()*w, y+Math.random()*h, Math.random()*3.6+0.4,0,Math.PI*2); ctx.fill(); }
    }
    const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(6,2); tex.anisotropy=Math.min(12,maxAniso); tex.colorSpace=THREE.SRGBColorSpace; return tex;
  }
  const naturalStoneTex = makeStoneTilesTexture();
  const turfMat = new THREE.MeshStandardMaterial({ map:parkLawnTex, roughness:0.65, metalness:0.02, side:THREE.DoubleSide });

  let treePalette = [];
  treePalette = await buildTreePalette();

  await ensurePrefabKit();

  window.__phase='textures-ready';

  const city = new THREE.Group(); city.userData.kind='city'; scene.add(city);
  const buildings=[];
  const buildingBoxes=[];
  const plotRegistry=new Map();
  const perimeterWalls=[];
  const institutions=[];
  const bots=[];
  window.city=city;
  window.buildings=buildings;
  window.buildingBoxes=buildingBoxes;
  window.plotRegistry=plotRegistry;
  window.perimeterWalls=perimeterWalls;
  window.institutions=institutions;
  window.bots=bots;
  const mapRoads=[]; const mapBuildings=[]; const mapParks=[]; const mapLandmarks=[];
  const BLOCKS_X=6, BLOCKS_Z=6; const CELL=120; const ROAD=28; const PLOT=CELL-ROAD*2; const startX = -(BLOCKS_X*CELL)/2 + CELL/2; const startZ = -(BLOCKS_Z*CELL)/2 + CELL/2; const cityHalfX = BLOCKS_X*CELL*0.5; const cityHalfZ = BLOCKS_Z*CELL*0.5;
  const northSouthStreets=['Kombinat Street','Kavaja Street','Martyrs Street','Myslym Shyri Street','Ismail Qemali Street','Abdyl Frasheri Street','Bajram Curri Street'];
  const eastWestStreets=['Mother Teresa Blvd','Skanderbeg Street','Ismail Ndroqi Street','Ali Demi Street','Petro Nini Street','Teuta Street','Don Bosko Street'];
  const ringRoadName='Tirana 2040 Ring Road';

  const groundGeo = new THREE.PlaneGeometry((CELL)*BLOCKS_X + ROAD*2, (CELL)*BLOCKS_Z + ROAD*2);
  const groundMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness:0.95, metalness:0.08, side:THREE.DoubleSide });
  const gnd = new THREE.Mesh(groundGeo, groundMat); gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=allowShadows; city.add(gnd);

  const ROAD_SURFACE_Y = 0.035;
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness:0.92, metalness:0.05, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-0.8, polygonOffsetUnits:-2 });
  const intersectionMat = new THREE.MeshStandardMaterial({ map: asphaltTex, color:0x1f1f1f, roughness:0.86, metalness:0.05, transparent:false, opacity:1.0, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-0.6, polygonOffsetUnits:-1.5 });
  window.roadMat = roadMat;
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, color:0xd7dce2, roughness:0.9, metalness:0.04, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-0.6, polygonOffsetUnits:-0.6 });
  const bikeLaneMat = new THREE.MeshStandardMaterial({ map: bikeLaneTex, color:0xb91c1c, roughness:0.7, metalness:0.04, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-0.4, polygonOffsetUnits:-0.4 });
  const curbMat = new THREE.MeshStandardMaterial({ color:0xbfc5cf, roughness:0.65, metalness:0.12 });
  const crosswalks=new THREE.Group(); crosswalks.userData={kind:'markings'}; city.add(crosswalks);
  const laneMarkings=new THREE.Group(); laneMarkings.userData={kind:'lane_markings'}; city.add(laneMarkings);
  const streetLights=new THREE.Group(); streetLights.userData={kind:'street_bulb'}; city.add(streetLights);
  const guardrails=new THREE.Group(); guardrails.userData={kind:'guardrails'}; city.add(guardrails);
  const roadsideFences=new THREE.Group(); roadsideFences.userData={kind:'roadside_fence_group'}; city.add(roadsideFences);
  const intersectionPatches=new THREE.Group(); intersectionPatches.userData={kind:'interPatches'}; city.add(intersectionPatches);
  const busStopsGroup=new THREE.Group(); busStopsGroup.userData={kind:'bus_stop_group'}; city.add(busStopsGroup);
  const benchesGroup=new THREE.Group(); benchesGroup.userData={kind:'bench_group'}; city.add(benchesGroup);
  const fountainWaters=[];
  const fountainJets=[];

  const guardRailMat=new THREE.MeshStandardMaterial({ color:0xb8c4cf, metalness:0.88, roughness:0.3 });
  const guardRailGeoZ=new THREE.BoxGeometry(0.18,0.16,1);
  const guardRailGeoX=new THREE.BoxGeometry(1,0.16,0.18);
  const postGeo=new THREE.CylinderGeometry(0.12,0.12,1.05,10);
  const fenceMatMetal=new THREE.MeshStandardMaterial({ color:0x8c929c, metalness:0.62, roughness:0.34 });
  const fenceLift=1.0, fenceH=2.8;
  const pavementHeight=0.16;
  const pavementWidth=3.2;
  const bikeLaneWidth=2.1;
  const dashMat=new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.9 });
  const edgeMat=new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.65 });
  const dashGeoZ=new THREE.PlaneGeometry(0.35,2.8);
  const dashGeoX=new THREE.PlaneGeometry(2.8,0.35);
  function paintRoadMarkings(x1,z1,x2,z2,orient='vertical'){
    const dashLen=2.8, gap=3.2; const length=Math.abs((orient==='vertical'? z2-z1 : x2-x1)); const dir=Math.sign((orient==='vertical'? z2-z1 : x2-x1))||1; const dashGeo=orient==='vertical'?dashGeoZ:dashGeoX; const count=Math.floor(length/(dashLen+gap)); for(let i=0;i<count;i++){ const offset=dashLen*0.5 + i*(dashLen+gap); const dash=new THREE.Mesh(dashGeo, dashMat); dash.rotation.x=-Math.PI/2; if(orient==='vertical'){ dash.position.set(x1, ROAD_SURFACE_Y+0.003, z1 + dir*offset); } else { dash.position.set(x1 + dir*offset, ROAD_SURFACE_Y+0.003, z1); } laneMarkings.add(dash); }
    const edgeLen=Math.max(1,length-gap*0.25); const edgeGeo=orient==='vertical'? new THREE.PlaneGeometry(0.16, edgeLen): new THREE.PlaneGeometry(edgeLen,0.16);
    const edgeA=new THREE.Mesh(edgeGeo, edgeMat); const edgeB=edgeA.clone(); edgeA.rotation.x=edgeB.rotation.x=-Math.PI/2; if(orient==='vertical'){ const midZ=(z1+z2)/2; edgeA.position.set(x1 - ROAD*0.25, ROAD_SURFACE_Y+0.002, midZ); edgeB.position.set(x1 + ROAD*0.25, ROAD_SURFACE_Y+0.002, midZ); }
    else { const midX=(x1+x2)/2; edgeA.position.set(midX, ROAD_SURFACE_Y+0.002, z1 - ROAD*0.25); edgeB.position.set(midX, ROAD_SURFACE_Y+0.002, z1 + ROAD*0.25); }
    laneMarkings.add(edgeA,edgeB);
  }
  function addGuardrailSegment(cx,cz,len,dir='z'){
    const seg=new THREE.Group();
    const railTop=new THREE.Mesh(dir==='z'? guardRailGeoZ.clone():guardRailGeoX.clone(), guardRailMat);
    const railMid=new THREE.Mesh(dir==='z'? guardRailGeoZ.clone():guardRailGeoX.clone(), guardRailMat);
    if(dir==='z') railTop.scale.set(1,1,len); else railTop.scale.set(len,1,1);
    if(dir==='z') railMid.scale.set(1,1,len); else railMid.scale.set(len,1,1);
    railTop.position.y=0.92; railMid.position.y=0.62;
    seg.add(railTop,railMid);
    const posts=Math.max(2, Math.round(len/6));
    for(let i=0;i<=posts;i++){
      const t=i/posts; const offset=len*(t-0.5);
      const p=new THREE.Mesh(postGeo, guardRailMat);
      p.position.set(dir==='z'?0:offset,0.52, dir==='z'?offset:0);
      p.castShadow=allowShadows; p.receiveShadow=allowShadows;
      seg.add(p);
    }
    seg.position.set(cx,0.02,cz);
    guardrails.add(seg);
  }
  function addRoadFenceSegment(cx,cz,len,dir='z'){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(len, fenceH), fenceMatMetal);
    mesh.position.set(cx, fenceH/2 + fenceLift, cz);
    if(dir==='z') mesh.rotation.y=Math.PI/2;
    mesh.userData={kind:'roadside_fence'};
    roadsideFences.add(mesh);
  }
  function addRoadsideBands(x,z,len,orient='vertical'){
    const pavGeo=new THREE.BoxGeometry(orient==='vertical'? pavementWidth : len, pavementHeight, orient==='vertical'? len : pavementWidth);
    const bikeGeo=new THREE.BoxGeometry(orient==='vertical'? bikeLaneWidth : len, pavementHeight*0.7, orient==='vertical'? len : bikeLaneWidth);
    const orientLift = orient==='vertical' ? 0 : 0.01;
    const baseY=pavementHeight/2 + orientLift;
    if(orient==='vertical'){
      const leftPav=new THREE.Mesh(pavGeo, sidewalkMat); leftPav.position.set(x - ROAD/2 - pavementWidth/2, baseY, z);
      const rightPav=leftPav.clone(); rightPav.position.x = x + ROAD/2 + pavementWidth/2;
      const innerY=orientLift + pavementHeight*0.35;
      const leftBike=new THREE.Mesh(bikeGeo, bikeLaneMat); leftBike.position.set(x - ROAD/2 + bikeLaneWidth/2, innerY, z);
      const rightBike=leftBike.clone(); rightBike.position.x = x + ROAD/2 - bikeLaneWidth/2;
      leftPav.receiveShadow=rightPav.receiveShadow=allowShadows;
      leftPav.castShadow=rightPav.castShadow=allowShadows;
      leftBike.receiveShadow=rightBike.receiveShadow=allowShadows;
      city.add(leftPav,rightPav,leftBike,rightBike);
    } else {
      const topPav=new THREE.Mesh(pavGeo, sidewalkMat); topPav.position.set(x, baseY, z - ROAD/2 - pavementWidth/2);
      const bottomPav=topPav.clone(); bottomPav.position.z = z + ROAD/2 + pavementWidth/2;
      const innerY=orientLift + pavementHeight*0.35;
      const topBike=new THREE.Mesh(bikeGeo, bikeLaneMat); topBike.position.set(x, innerY, z - ROAD/2 + bikeLaneWidth/2);
      const bottomBike=topBike.clone(); bottomBike.position.z = z + ROAD/2 - bikeLaneWidth/2;
      topPav.receiveShadow=bottomPav.receiveShadow=allowShadows;
      topPav.castShadow=bottomPav.castShadow=allowShadows;
      topBike.receiveShadow=bottomBike.receiveShadow=allowShadows;
      city.add(topPav,bottomPav,topBike,bottomBike);
    }
  }

  function addBikeCorridor(x1,z1,x2,z2,{width=3.6,label=null}={}){
    const dx=x2-x1, dz=z2-z1; const len=Math.hypot(dx,dz); if(len<1) return;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(len,width), bikeLaneMat.clone());
    mesh.rotation.x=-Math.PI/2;
    mesh.rotation.y=Math.atan2(dz,dx);
    mesh.position.set((x1+x2)/2, ROAD_SURFACE_Y + 0.004, (z1+z2)/2);
    mesh.material.opacity=0.82; mesh.material.transparent=true;
    city.add(mesh);
    if(label) mapLandmarks.push({x:(x1+x2)/2, z:(z1+z2)/2, label});
  }

  for(let ix=0; ix<=BLOCKS_X; ix++){
    const geo=new THREE.PlaneGeometry(ROAD,(CELL)*BLOCKS_Z + ROAD);
    const m=new THREE.Mesh(geo, roadMat);
    const xPos=ix*CELL-(BLOCKS_X*CELL)/2;
    const zPos=ROAD*0.5-(BLOCKS_Z*CELL)/2;
    m.rotation.x=-Math.PI/2;
    m.position.set(xPos, ROAD_SURFACE_Y, zPos);
    m.receiveShadow=allowShadows; city.add(m);
    const halfLen=(CELL)*BLOCKS_Z*0.5 + ROAD*0.5;
    mapRoads.push({name:northSouthStreets[ix]||`Rruga ${ix+1}`, from:{x:xPos, z:-halfLen}, to:{x:xPos, z:halfLen}, width:ROAD});
    addRoadsideBands(xPos, zPos, (CELL)*BLOCKS_Z + ROAD, 'vertical');
    paintRoadMarkings(xPos, -halfLen, xPos, halfLen, 'vertical');
    if(northSouthStreets[ix]){ const label=makeLabel(northSouthStreets[ix],0.55); label.position.set(xPos,0.12,-(BLOCKS_Z*CELL)/2 - 18); label.rotation.y=Math.PI; city.add(label); }
  }
  for(let iz=0; iz<=BLOCKS_Z; iz++){
    const geo=new THREE.PlaneGeometry((CELL)*BLOCKS_X + ROAD, ROAD);
    const m=new THREE.Mesh(geo, roadMat);
    const zPos=iz*CELL-(BLOCKS_Z*CELL)/2;
    const xPos=ROAD*0.5-(BLOCKS_X*CELL)/2;
    m.rotation.x=-Math.PI/2;
    m.position.set(xPos, ROAD_SURFACE_Y, zPos);
    m.receiveShadow=allowShadows; city.add(m);
    const halfLen=(CELL)*BLOCKS_X*0.5 + ROAD*0.5;
    mapRoads.push({name:eastWestStreets[iz]||`Bulevardi ${iz+1}`, from:{x:-halfLen, z:zPos}, to:{x:halfLen, z:zPos}, width:ROAD});
    addRoadsideBands(xPos, zPos, (CELL)*BLOCKS_X + ROAD, 'horizontal');
    paintRoadMarkings(-halfLen, zPos, halfLen, zPos, 'horizontal');
    if(eastWestStreets[iz]){ const label=makeLabel(eastWestStreets[iz],0.55); label.position.set(-(BLOCKS_X*CELL)/2 - 18,0.12,zPos); label.rotation.y=Math.PI/2; city.add(label); }
  }

  const guardOffset=ROAD/2 + 0.6;
  const guardLen=Math.max(18, PLOT*0.9);
  for(let ix=0; ix<=BLOCKS_X; ix++){
    const xPos=ix*CELL-(BLOCKS_X*CELL)/2;
    for(let iz=0; iz<BLOCKS_Z; iz++){
      const zSeg=startZ + iz*CELL;
      addGuardrailSegment(xPos+guardOffset, zSeg, guardLen, 'z');
      addGuardrailSegment(xPos-guardOffset, zSeg, guardLen, 'z');
    }
  }
  for(let iz=0; iz<=BLOCKS_Z; iz++){
    const zPos=iz*CELL-(BLOCKS_Z*CELL)/2;
    for(let ix=0; ix<BLOCKS_X; ix++){
      const xSeg=startX + ix*CELL;
      addGuardrailSegment(xSeg, zPos+guardOffset, guardLen, 'x');
      addGuardrailSegment(xSeg, zPos-guardOffset, guardLen, 'x');
    }
  }

  const fenceOffset=ROAD/2 + 1.4;
  const fenceLen=Math.max(18, PLOT*0.92);
  for(let ix=0; ix<=BLOCKS_X; ix++){
    const xPos=ix*CELL-(BLOCKS_X*CELL)/2;
    for(let iz=0; iz<BLOCKS_Z; iz++){
      const zSeg=startZ + iz*CELL;
      addRoadFenceSegment(xPos+fenceOffset, zSeg, fenceLen, 'z');
      addRoadFenceSegment(xPos-fenceOffset, zSeg, fenceLen, 'z');
    }
  }
  for(let iz=0; iz<=BLOCKS_Z; iz++){
    const zPos=iz*CELL-(BLOCKS_Z*CELL)/2;
    for(let ix=0; ix<BLOCKS_X; ix++){
      const xSeg=startX + ix*CELL;
      addRoadFenceSegment(xSeg, zPos+fenceOffset, fenceLen, 'x');
      addRoadFenceSegment(xSeg, zPos-fenceOffset, fenceLen, 'x');
    }
  }

  for(let ix=0; ix<=BLOCKS_X; ix++){
    for(let iz=0; iz<=BLOCKS_Z; iz++){
      const crossX=ix*CELL-(BLOCKS_X*CELL)/2;
      const crossZ=iz*CELL-(BLOCKS_Z*CELL)/2;
      addCrosswalk(crossX, crossZ, 0);
      addCrosswalk(crossX, crossZ, 1);
      addIntersectionPatch(crossX, crossZ);
      if((ix+iz)%2===0){ addStreetLight(crossX+ROAD*0.5, crossZ+ROAD*0.5); }
    }
  }

  buildPerimeterWalls();
  addBusStop(-cityHalfX*0.6, cityHalfZ+ROAD*0.8, 0);
  addBusStop(cityHalfX*0.6, -cityHalfZ-ROAD*0.8, Math.PI);
  addBikeCorridor(-cityHalfX, startZ + CELL*2.5, cityHalfX, startZ + CELL*2.5, {label:'Main east-west bike lane'});
  addBikeCorridor(startX + CELL*1.5, -cityHalfZ, startX + CELL*1.5, cityHalfZ, {label:'North-south bicycle spine'});
  addBikeCorridor(startX + CELL*4.5, -cityHalfZ, startX + CELL*4.5, cityHalfZ, {label:'Perimeter greenway'});

  const windowGeo=new THREE.PlaneGeometry(1.2,1.8);
  const windowMat=new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.12, depthWrite:false });
  const windowVoidGeo=new THREE.PlaneGeometry(1.34,2.02);
  const windowVoidMat=new THREE.MeshBasicMaterial({ color:0xffffff, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1.2, polygonOffsetUnits:-0.8, depthWrite:false, transparent:true, opacity:0.02 });
  const windowInstances=new THREE.InstancedMesh(windowGeo, windowMat, 4000);
  const windowVoids=new THREE.InstancedMesh(windowVoidGeo, windowVoidMat, 4000);
  windowInstances.count=0;
  windowVoids.count=0;
  windowInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  windowVoids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  windowInstances.userData={isGlass:true};
  windowVoids.renderOrder=1;
  windowInstances.renderOrder=2;
  city.add(windowVoids);
  city.add(windowInstances);
  let windowCount=0;
  function pushWindow(pos,rotY){ if(windowCount>=windowInstances.instanceMatrix.count) return; const m=new THREE.Matrix4(); const quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rotY,0)); m.compose(pos,quat,new THREE.Vector3(1,1,1)); windowVoids.setMatrixAt(windowCount, m); windowInstances.setMatrixAt(windowCount++, m); }
  function commitWindows(){ windowInstances.count=windowCount; windowVoids.count=windowCount; windowInstances.instanceMatrix.needsUpdate=true; windowVoids.instanceMatrix.needsUpdate=true; }
  function addWindowsForBuilding(xc,zc,w,d,h){ const usableHeight=Math.max(1, h - SCALE.FLOOR_H*1.2); const rows=Math.max(2,Math.floor(usableHeight/3.0)); const colsFront=Math.max(2,Math.floor(w/4)); const colsSide=Math.max(2,Math.floor(d/4)); const yStart=SCALE.FLOOR_H + 0.9; for(let c=0;c<colsFront;c++){ const x=xc - w/2 + (c+0.5)*(w/colsFront); for(let r=0;r<rows;r++){ const y=yStart + (r+0.5)*(usableHeight/(rows+1)); pushWindow(new THREE.Vector3(x,y,zc + d/2 + 0.52), 0); pushWindow(new THREE.Vector3(x,y,zc - d/2 - 0.52), Math.PI); } } for(let c=0;c<colsSide;c++){ const z=zc - d/2 + (c+0.5)*(d/colsSide); for(let r=0;r<rows;r++){ const y=yStart + (r+0.5)*(usableHeight/(rows+1)); pushWindow(new THREE.Vector3(xc + w/2 + 0.52,y,z), Math.PI/2); pushWindow(new THREE.Vector3(xc - w/2 - 0.52,y,z), -Math.PI/2); } } }
  function addSidewalk(xc,zc){
    const outer=CELL-ROAD;
    const inner=PLOT;
    const band=(outer-inner)/2;
    const h=0.18;
    const curbH=0.08;
    const group=new THREE.Group();
    const mkBand=(w,d,px,pz)=>{ const geo=new THREE.BoxGeometry(w,h,d); const mesh=new THREE.Mesh(geo, sidewalkMat); mesh.position.set(xc+px,h/2,zc+pz); mesh.receiveShadow=allowShadows; group.add(mesh); };
    mkBand(outer, band, 0, inner/2 + band/2);
    mkBand(outer, band, 0, -(inner/2 + band/2));
    mkBand(band, inner, -(inner/2 + band/2), 0);
    mkBand(band, inner, inner/2 + band/2, 0);
    const curb=()=>{ const geo=new THREE.BoxGeometry(outer+0.6, curbH, 0.6); const mesh=new THREE.Mesh(geo, curbMat); mesh.position.set(xc, curbH/2, zc + (outer/2 + 0.3)); mesh.receiveShadow=allowShadows; group.add(mesh); const back=mesh.clone(); back.position.z=zc-(outer/2 + 0.3); group.add(back); const sideGeo=new THREE.BoxGeometry(0.6, curbH, outer+0.6); const left=new THREE.Mesh(sideGeo, curbMat); left.position.set(xc-(outer/2 + 0.3), curbH/2, zc); const right=left.clone(); right.position.x=xc+(outer/2 + 0.3); group.add(left,right); };
    curb();
    city.add(group);
  }

  const plotKey=(ix,iz)=>`${ix},${iz}`;
  function rectsOverlap(a,b){ if(!a||!b) return false; return !(a.x1<b.x0 || a.x0>b.x1 || a.z1<b.z0 || a.z0>b.z1); }
  function reservePlotRect(ix,iz,rect){ const key=plotKey(ix,iz); if(!plotRegistry.has(key)) plotRegistry.set(key,{rects:[]}); const entry=plotRegistry.get(key); for(const other of entry.rects){ if(rectsOverlap(rect,other)) return false; } entry.rects.push(rect); return true; }
  const registerPlotArea=(ix,iz,cx,cz,w,d)=>reservePlotRect(ix,iz,{x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2});

  function addCrosswalk(x,z,dir=0){ const stripes=8; for(let i=0;i<stripes;i++){ const stripe=new THREE.Mesh(new THREE.PlaneGeometry(4,0.8), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.92})); stripe.rotation.x=-Math.PI/2; const offset=(i-stripes/2)*1.2; if(dir===0){ stripe.position.set(x+offset,0.022,z); } else { stripe.position.set(x,0.022,z+offset); stripe.rotation.z=Math.PI/2; } crosswalks.add(stripe); } }

  function addStreetLight(x,z){ const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,6,12), new THREE.MeshStandardMaterial({color:0x5b5b65})); pole.position.set(x,3,z); const head=new THREE.Mesh(new THREE.SphereGeometry(0.4,16,12), new THREE.MeshBasicMaterial({color:0xfff6d0})); head.position.set(x,5.6,z+0.5); const arm=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,1.2), new THREE.MeshStandardMaterial({color:0x5b5b65})); arm.position.set(x,5.2,z+0.4); const g=new THREE.Group(); g.add(pole,arm,head); g.userData={kind:'street_bulb'}; streetLights.add(g); }

  function addIntersectionPatch(x,z){ const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.2,5.2), intersectionMat); mesh.rotation.x=-Math.PI/2; mesh.position.set(x,0.016,z); mesh.userData={kind:'interPatches'}; intersectionPatches.add(mesh); }

  function addBench(x,z,dir=0){ const seat=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.15,0.5), new THREE.MeshStandardMaterial({color:0x8b5a2b, roughness:0.7})); const back=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.8,0.1), seat.material.clone()); back.position.set(0,0.5,-0.2); const legs=new THREE.Group(); for(const sx of [-0.9,0.9]){ const leg=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.8,0.1), new THREE.MeshStandardMaterial({color:0x4b5563})); leg.position.set(sx,-0.4,0); legs.add(leg); } const bench=new THREE.Group(); bench.add(seat,back,legs); bench.position.set(x,0.6,z); bench.rotation.y=dir; bench.castShadow=allowShadows; benchesGroup.add(bench); }

  function addBusStop(x,z,dir=0){ const roof=new THREE.Mesh(new THREE.BoxGeometry(3,0.2,1.2), new THREE.MeshStandardMaterial({color:0x374151, roughness:0.6})); roof.position.set(0,2.1,0); const poleL=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.2,12), new THREE.MeshStandardMaterial({color:0x9ca3af})); poleL.position.set(-1.2,1.1,0.4); const poleR=poleL.clone(); poleR.position.x=1.2; const glass=new THREE.Mesh(new THREE.PlaneGeometry(3,1.6), makeGlassStdMat()); glass.position.set(0,1.2,-0.4); const signPole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.4,12), poleL.material); signPole.position.set(-1.9,1.2,-0.35); const signTex=(function(){ const c=document.createElement('canvas'); c.width=128; c.height=128; const g=c.getContext('2d'); g.fillStyle='#0f172a'; g.fillRect(0,0,c.width,c.height); g.fillStyle='#facc15'; g.font='700 68px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('🚍', c.width/2, c.height/2); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })(); const sign=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9), new THREE.MeshBasicMaterial({ map:signTex, transparent:true })); sign.position.set(-1.9,2.0,-0.35); sign.rotation.y=Math.PI; const stop=new THREE.Group(); stop.add(roof,poleL,poleR,glass,signPole,sign); stop.position.set(x,0,z); stop.rotation.y=dir; stop.userData={kind:'bus_stop_group'}; busStopsGroup.add(stop); }

  function buildPerimeterWalls(){ const spanX=BLOCKS_X*CELL, spanZ=BLOCKS_Z*CELL; const wallMat=new THREE.MeshStandardMaterial({color:0x474b57, roughness:0.8}); const heights=[11,11,11,11]; const configs=[{w:spanX+ROAD*2+14,d:2.4,x:0,z:-spanZ/2-ROAD-5},{w:spanX+ROAD*2+14,d:2.4,x:0,z:spanZ/2+ROAD+5},{w:2.4,d:spanZ+ROAD*2+14,x:-spanX/2-ROAD-5,z:0},{w:2.4,d:spanZ+ROAD*2+14,x:spanX/2+ROAD+5,z:0}]; configs.forEach((cfg,idx)=>{ const mesh=new THREE.Mesh(new THREE.BoxGeometry(cfg.w,heights[idx],cfg.d), wallMat); mesh.position.set(cfg.x,heights[idx]/2,cfg.z); mesh.receiveShadow=allowShadows; mesh.castShadow=allowShadows; city.add(mesh); perimeterWalls.push(mesh); }); }

  function buildCoast(){ const group=new THREE.Group(); group.userData={kind:'coast'}; const sea=new THREE.Mesh(new THREE.PlaneGeometry(cityHalfZ*3, cityHalfX*1.4), new THREE.MeshBasicMaterial({color:0x7ec4ff, transparent:true, opacity:0.85})); sea.rotation.x=-Math.PI/2; sea.position.set(cityHalfX+260,0.001,0); const beach=new THREE.Mesh(new THREE.PlaneGeometry(cityHalfZ*1.4, cityHalfX*0.8), new THREE.MeshStandardMaterial({color:0xf6d7a8, roughness:0.85})); beach.rotation.x=-Math.PI/2; beach.position.set(cityHalfX+80,0.002,0); group.add(sea,beach); city.add(group); return group; }

  function buildMountains(){
    const group=new THREE.Group(); group.userData={kind:'mountains'};
    const stoneTex=naturalStoneTex?.clone?.(); if(stoneTex){ stoneTex.repeat.set(4,2); stoneTex.wrapS=stoneTex.wrapT=THREE.RepeatWrapping; stoneTex.needsUpdate=true; }
    const roughRockMat=new THREE.MeshStandardMaterial({ map:stoneTex||undefined, color:0x8b939f, roughness:0.85, metalness:0.08 });
    function crag(radius,height,segments){ const geo=new THREE.IcosahedronGeometry(radius, 2); const arr=geo.attributes.position; for(let i=0;i<arr.count;i++){ const v=new THREE.Vector3().fromBufferAttribute(arr,i); const noise=(Math.random()*0.45+0.75); v.multiplyScalar(noise); arr.setXYZ(i,v.x,v.y*1.15,v.z); } geo.computeVertexNormals(); return new THREE.Mesh(geo, roughRockMat.clone()); }
    const peaks=14;
    for(let i=0;i<peaks;i++){
      const angle=(i/peaks)*Math.PI*2;
      const radius=Math.max(cityHalfX,cityHalfZ)*1.65 + Math.sin(i)*12;
      const rock=crag(44+Math.random()*18, 120, 12);
      rock.position.set(Math.cos(angle)*radius, 34+Math.random()*8, Math.sin(angle)*radius - 200);
      rock.rotation.y=Math.random()*Math.PI*2;
      rock.castShadow=allowShadows; rock.receiveShadow=allowShadows;
      group.add(rock);
      const rubbleCount=4+Math.floor(Math.random()*3);
      for(let r=0;r<rubbleCount;r++){
        const debris=crag(12+Math.random()*6, 24, 8);
        const offsetRadius=radius + 18 + Math.random()*24;
        const offAng=angle + (Math.random()*0.4-0.2);
        debris.position.set(Math.cos(offAng)*offsetRadius, 9+Math.random()*4, Math.sin(offAng)*offsetRadius - 200);
        debris.rotation.y=Math.random()*Math.PI*2;
        debris.castShadow=allowShadows; debris.receiveShadow=allowShadows;
        group.add(debris);
      }
    }
    city.add(group); return group;
  }

  function buildRiver(){ const group=new THREE.Group(); group.userData={kind:'river'}; const extra=80; const samples=28; const path=[]; for(let i=0;i<=samples;i++){ const t=i/samples; const x=THREE.MathUtils.lerp(-cityHalfX-extra, cityHalfX+extra, t); const z=Math.sin(t*Math.PI*1.1)*40 + THREE.MathUtils.lerp(-60,60,t); path.push({x,z}); } const halfWidth=18; const offsetPoints=(scale)=>{ const res=[]; for(let i=0;i<path.length;i++){ const prev=path[Math.max(0,i-1)], next=path[Math.min(path.length-1,i+1)]; const tx=next.x-prev.x, tz=next.z-prev.z; const len=Math.hypot(tx,tz)||1; const nx=-tz/len, nz=tx/len; res.push({x:path[i].x+nx*scale, z:path[i].z+nz*scale}); } return res; };
    const loopShape=(outerLeft, outerRight)=>{
      const shape=new THREE.Shape();
      outerLeft.forEach((p,idx)=>{ if(idx===0) shape.moveTo(p.x,p.z); else shape.lineTo(p.x,p.z); });
      for(let i=outerRight.length-1;i>=0;i--){ const p=outerRight[i]; shape.lineTo(p.x,p.z); }
      return shape;
    };
    const left=offsetPoints(halfWidth), right=offsetPoints(-halfWidth);
    const riverShape=loopShape(left,right);
    const riverMesh=new THREE.Mesh(new THREE.ShapeGeometry(riverShape, 64), new THREE.MeshStandardMaterial({color:0x38a3d6, transparent:true, opacity:0.92, roughness:0.35, metalness:0.05}));
    riverMesh.rotation.x=-Math.PI/2; riverMesh.position.y=0.01; riverMesh.renderOrder=2; group.add(riverMesh);
    const bankLeft=offsetPoints(halfWidth+6), bankRight=offsetPoints(-(halfWidth+6));
    const bankShape=loopShape(bankLeft, bankRight);
    const riverHole=new THREE.Path(); left.forEach((p,idx)=>{ if(idx===0) riverHole.moveTo(p.x,p.z); else riverHole.lineTo(p.x,p.z); }); for(let i=right.length-1;i>=0;i--){ const p=right[i]; riverHole.lineTo(p.x,p.z); }
    bankShape.holes.push(riverHole);
    const bankMat=new THREE.MeshStandardMaterial({map:turfTex, roughness:0.7, metalness:0.02, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-0.8, polygonOffsetUnits:-0.4});
    const bankMesh=new THREE.Mesh(new THREE.ShapeGeometry(bankShape,64), bankMat); bankMesh.rotation.x=-Math.PI/2; bankMesh.position.y=0.005; bankMesh.userData={kind:'river_banks'}; bankMesh.renderOrder=1; group.add(bankMesh);
    const segments=[]; for(let i=0;i<path.length-1;i++){ const a=path[i], b=path[i+1]; const len=Math.hypot(b.x-a.x,b.z-a.z)||1; segments.push({a,b,len,dirX:(b.x-a.x)/len,dirZ:(b.z-a.z)/len}); }
    const distance=(px,pz)=>{ let best=Infinity; for(const seg of segments){ const vx=px-seg.a.x, vz=pz-seg.a.z; const proj=THREE.MathUtils.clamp(vx*seg.dirX + vz*seg.dirZ, 0, seg.len); const cx=seg.a.x + seg.dirX*proj; const cz=seg.a.z + seg.dirZ*proj; const dist=Math.hypot(px-cx,pz-cz); if(dist<best) best=dist; } return {d:best, hw:halfWidth}; };
    city.add(group);
    const bridgesGroup=new THREE.Group(); bridgesGroup.userData={kind:'bridges'}; const placements=[-cityHalfX*0.5, 0, cityHalfX*0.5]; placements.forEach((px)=>{ const t=(px + cityHalfX + extra)/(2*(cityHalfX+extra)); const pz=Math.sin(t*Math.PI*1.1)*40 + THREE.MathUtils.lerp(-60,60,t); const bridge=new THREE.Mesh(new THREE.BoxGeometry(40,2,6), new THREE.MeshStandardMaterial({color:0xb3bac6, roughness:0.6})); bridge.position.set(px,1.5,pz); bridge.castShadow=allowShadows; bridgesGroup.add(bridge); }); city.add(bridgesGroup);
    return {group, distance, bridges:bridgesGroup}; }

  // Disable distant coast and mountain backdrops to keep park views clear of large grey forms.
  const coast=null;
  const mountains=null;
  const riverDistance=()=>({ d:Infinity, hw:0 });
  window.river=null;
  window.riverDistance=riverDistance;
  window.bridges=null;

  function facadeTex(hue=200){ const W=256,H=512; const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d'); ctx.fillStyle=`hsl(${hue},16%,74%)`; ctx.fillRect(0,0,W,H); for(let i=0;i<1800;i++){ const a=Math.random()*0.08; ctx.fillStyle=`rgba(0,0,0,${a})`; ctx.fillRect(Math.random()*W,Math.random()*H,1,1);} const cols=6+Math.floor(Math.random()*4), rows=14+Math.floor(Math.random()*6); const padX=12,padY=16; const cellW=(W-2*padX)/cols, cellH=(H-2*padY)/rows; for(let r=0;r<rows;r++){ for(let cix=0;cix<cols;cix++){ const x=padX+cix*cellW+6, y=padY+r*cellH+6, w=cellW-12, h=cellH-12; const g=ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,'rgba(240,245,255,0.95)'); g.addColorStop(0.5,'rgba(150,180,220,0.92)'); g.addColorStop(1,'rgba(60,80,120,0.9)'); ctx.fillStyle=g; ctx.fillRect(x,y,w,h); ctx.strokeStyle='rgba(24,28,38,0.9)'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h); } } const tex=new THREE.CanvasTexture(c); tex.anisotropy=2; tex.colorSpace=THREE.SRGBColorSpace; return tex; }

  const ladders=[];
  const climbMarkerTex=(function(){ const c=document.createElement('canvas'); c.width=c.height=256; const ctx=c.getContext('2d'); const grad=ctx.createLinearGradient(0,0,0,256); grad.addColorStop(0,'rgba(17,24,39,0.92)'); grad.addColorStop(1,'rgba(37,99,235,0.92)'); ctx.fillStyle=grad; ctx.fillRect(0,0,256,256); ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=10; ctx.strokeRect(14,14,228,228); ctx.fillStyle='#ffffff'; ctx.font='900 88px system-ui,Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('CLIMB',128,132); return new THREE.CanvasTexture(c); })();
  function makeClimbMarker(){ const mat=new THREE.MeshBasicMaterial({ map:climbMarkerTex, transparent:true, opacity:0.92, depthWrite:false }); const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6), mat); mesh.rotation.x=-Math.PI/2; mesh.position.y=0.05; return mesh; }
  function addLadder(x,z,y0,y1){ const railMat=new THREE.MeshBasicMaterial({ color:0x9aa3ad }); const stepMat=new THREE.MeshBasicMaterial({ color:0x8a929c }); const g=new THREE.Group(); const railL=new THREE.Mesh(new THREE.BoxGeometry(0.08, y1-y0, 0.08), railMat); const railR=railL.clone(); railL.position.set(-0.25, (y0+y1)/2, 0); railR.position.set(0.25, (y0+y1)/2, 0); g.add(railL,railR); for(let y=y0+0.3;y<y1;y+=0.35){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.05,0.08), stepMat); s.position.set(0,y,0); g.add(s); } const arrow=new THREE.Mesh(new THREE.ConeGeometry(0.25,0.6,12), new THREE.MeshBasicMaterial({ color:0x1f6feb })); arrow.position.set(0,y1+0.6,0); g.add(arrow); const marker=makeClimbMarker(); marker.position.set(0,0.02,-0.9); g.add(marker); g.position.set(x,0,z); city.add(g); ladders.push({x,z,y0,y1,marker}); }

  function addRoofStair(x,z,y){ const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.5,1.2), new THREE.MeshLambertMaterial({ color:0x444b55 })); m.position.set(x,y+0.4,z); city.add(m); return m; }

  const structuralMat=new THREE.MeshStandardMaterial({ color:0xcad0d8, roughness:0.84, metalness:0.06 });
  const columnMat=makeLambertAngleMat(plasterTex);
  function addInteriorFrames(xc,zc,w,d,floors){
    const slabGeo=new THREE.BoxGeometry(w*0.92,0.18,d*0.92);
    for(let i=0;i<=floors;i++){ const slab=new THREE.Mesh(slabGeo, structuralMat); slab.position.set(xc, i*SCALE.FLOOR_H + 0.09, zc); slab.receiveShadow=allowShadows; city.add(slab); }
    const colGeo=new THREE.CylinderGeometry(0.32,0.36, floors*SCALE.FLOOR_H+0.01, 12);
    const positions=[
      [-w/2+1.2,-d/2+1.2], [w/2-1.2,-d/2+1.2], [-w/2+1.2,d/2-1.2], [w/2-1.2,d/2-1.2],
      [0,-d/2+1.2], [0,d/2-1.2], [-w/2+1.2,0], [w/2-1.2,0]
    ];
    positions.forEach(([px,pz])=>{ const c=new THREE.Mesh(colGeo,columnMat); c.position.set(xc+px, (floors*SCALE.FLOOR_H)/2, zc+pz); c.castShadow=allowShadows; c.receiveShadow=allowShadows; city.add(c); });
    const bandMat=new THREE.MeshStandardMaterial({ color:0xd7dce5, roughness:0.8, metalness:0.04 });
    for(let i=1;i<=floors;i++){ const y=i*SCALE.FLOOR_H - 0.6; const header=new THREE.Mesh(new THREE.BoxGeometry(w*0.98,0.16,0.55), bandMat); header.position.set(xc, y, zc + d/2 + 0.28); const headerBack=header.clone(); headerBack.position.z=zc - d/2 - 0.28; city.add(header, headerBack); const headerSide=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.16,d*0.98), bandMat); headerSide.position.set(xc + w/2 + 0.28, y, zc); const headerSideB=headerSide.clone(); headerSideB.position.x=xc - w/2 - 0.28; city.add(headerSide, headerSideB); }
  }

  function addSideEntrance(xc,zc,w,d){
    const frameMat=new THREE.MeshStandardMaterial({ color:0x1f2937, metalness:0.35, roughness:0.5 });
    const awningMat=new THREE.MeshStandardMaterial({ color:0x374151, roughness:0.7 });
    const entryWidth=Math.min(4.2, Math.max(2.8, w*0.22));
    const entryDepth=1.6;
    const sideOffset=-w/2 - 0.2;
    const jambGeo=new THREE.BoxGeometry(0.32,3.2,0.7);
    const jambFront=new THREE.Mesh(jambGeo, frameMat); jambFront.position.set(xc+sideOffset-0.16,1.6,zc+entryWidth/2-0.35); jambFront.castShadow=allowShadows;
    const jambBack=jambFront.clone(); jambBack.position.z=zc-entryWidth/2+0.35;
    const header=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.42,entryWidth-0.14), frameMat); header.position.set(xc+sideOffset-0.17,3.1,zc); header.castShadow=allowShadows;
    const awning=new THREE.Mesh(new THREE.BoxGeometry(entryDepth+0.7,0.14,entryWidth+0.4), awningMat); awning.position.set(xc+sideOffset-entryDepth/2,3.5,zc); awning.rotation.y=Math.PI/2; awning.castShadow=allowShadows;
    const foyerPad=new THREE.Mesh(new THREE.PlaneGeometry(entryDepth+0.6, entryWidth+0.6), new THREE.MeshStandardMaterial({ color:0xcbd5e1, roughness:0.82 }));
    foyerPad.rotation.x=-Math.PI/2; foyerPad.position.set(xc+sideOffset-entryDepth/2,0.025,zc);
    const entryLabelTex=(function(){ const c=document.createElement('canvas'); c.width=256; c.height=96; const g=c.getContext('2d'); g.fillStyle='#111827'; g.fillRect(0,0,c.width,c.height); g.fillStyle='#facc15'; g.font='700 44px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('Hyrje', c.width/2, c.height/2); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
    const entryLabel=new THREE.Mesh(new THREE.PlaneGeometry(entryDepth,0.7), new THREE.MeshBasicMaterial({ map:entryLabelTex, transparent:true })); entryLabel.rotation.y=Math.PI/2; entryLabel.position.set(xc+sideOffset-0.18,2.4,zc);
    const voidMat=makeGlassStdMat(); voidMat.opacity=0.08; voidMat.roughness=0.08; voidMat.transmission=0.95;
    const entryVoid=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.6), voidMat); entryVoid.rotation.y=Math.PI/2; entryVoid.position.set(xc+sideOffset-0.22,1.6,zc);
    const group=new THREE.Group();
    group.add(jambFront,jambBack,header,awning,foyerPad,entryLabel,entryVoid);
    city.add(group);
  }

  function addGroundShops(xc,zc,w,d,sign){
    const glassMat=makeGlassStdMat(); glassMat.opacity=0.14; glassMat.roughness=0.06;
    const columnGeo=new THREE.BoxGeometry(0.7, SCALE.FLOOR_H, 0.9);
    const panelGeo=new THREE.PlaneGeometry(Math.max(2.2, w/Math.max(3,Math.floor(w/5))) - 0.8, SCALE.FLOOR_H*0.8);
    const shopNames=['Café','Restaurant','Market','Bakery','Lounge','Bookshop'];
    const label=sign || shopNames[Math.floor(Math.random()*shopNames.length)];
    const colCount=Math.max(2, Math.floor(w/6));
    const start=-w/2 + w/(colCount*2);
    for(let i=0;i<colCount;i++){
      const offset=start + i*(w/colCount);
      const colFront=new THREE.Mesh(columnGeo,columnMat); colFront.position.set(xc+offset, SCALE.FLOOR_H/2, zc + d/2 + 0.46); colFront.castShadow=allowShadows; city.add(colFront);
      const colBack=colFront.clone(); colBack.position.z=zc - d/2 - 0.46; city.add(colBack);
      if(i<colCount-1){ const glass=new THREE.Mesh(panelGeo, glassMat); glass.position.set(xc + offset + w/colCount/2, SCALE.FLOOR_H*0.55, zc + d/2 + 0.55); glass.rotation.y=0; city.add(glass); const glassBack=glass.clone(); glassBack.position.z=zc - d/2 - 0.55; glassBack.rotation.y=Math.PI; city.add(glassBack); }
    }
    const marqueeTex=(function(){ const c=document.createElement('canvas'); c.width=256; c.height=96; const g=c.getContext('2d'); g.fillStyle='#111827'; g.fillRect(0,0,c.width,c.height); g.fillStyle='#facc15'; g.font='700 44px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label, c.width/2, c.height/2); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
    const marquee=new THREE.Mesh(new THREE.PlaneGeometry(6,1.2), new THREE.MeshBasicMaterial({ map:marqueeTex, transparent:true })); marquee.position.set(xc,2.4, zc + d/2 + 0.9); city.add(marquee); const marqueeBack=marquee.clone(); marqueeBack.rotation.y=Math.PI; marqueeBack.position.z=zc - d/2 - 0.9; city.add(marqueeBack);
    addTerraceSeating(xc,zc,w,d);
  }

  function addTerraceSeating(xc,zc,w,d){
    const tableTopGeo=new THREE.CylinderGeometry(0.55,0.55,0.08,14);
    const tableLegGeo=new THREE.CylinderGeometry(0.12,0.16,0.9,10);
    const chairSeatGeo=new THREE.BoxGeometry(0.5,0.08,0.48);
    const chairBackGeo=new THREE.BoxGeometry(0.5,0.45,0.08);
    const tableMat=new THREE.MeshStandardMaterial({ color:0xd8d9dc, roughness:0.42, metalness:0.4 });
    const chairMat=new THREE.MeshStandardMaterial({ color:0x9ba3ad, roughness:0.38, metalness:0.28 });
    const groups=Math.max(2, Math.floor(w/10));
    const start=-w/2 + w/(groups*2);
    for(let i=0;i<groups;i++){
      const offset=start + i*(w/groups);
      const placeTerrace=(zOffset)=>{
        const table=new THREE.Group();
        const top=new THREE.Mesh(tableTopGeo, tableMat); top.position.y=1.0;
        const leg=new THREE.Mesh(tableLegGeo, tableMat); leg.position.y=0.5;
        table.add(top,leg); table.position.set(xc+offset,0.04,zc+zOffset);
        const chair=(sign)=>{ const g=new THREE.Group(); const seat=new THREE.Mesh(chairSeatGeo, chairMat); seat.position.set(0,0.55,0); const back=new THREE.Mesh(chairBackGeo, chairMat); back.position.set(0,0.85,-0.18); g.add(seat,back); g.position.set(xc+offset + sign*0.7,0.04,zc+zOffset+0.12*sign); g.rotation.y=Math.PI*0.5*sign; return g; };
        city.add(table, chair(1), chair(-1));
      };
      placeTerrace(d/2 + 1.2);
      placeTerrace(-(d/2 + 1.2));
    }
  }

  function addInteriorStairs(xc,zc,w,d,floors){
    const stairMat=new THREE.MeshStandardMaterial({ color:0x9ba3ad, roughness:0.7, metalness:0.1 });
    const stepGeo=new THREE.BoxGeometry(1.8,0.12,0.36);
    const landingGeo=new THREE.BoxGeometry(2.2,0.14,1.4);
    const stairGroup=new THREE.Group();
    for(let f=0; f<floors; f++){
      const baseY=f*SCALE.FLOOR_H + 0.08;
      const dir=(f%2===0)?1:-1;
      const baseX=xc - w*0.2*dir;
      const baseZ=zc - d*0.22*dir;
      for(let s=0;s<14;s++){ const step=new THREE.Mesh(stepGeo, stairMat); step.position.set(baseX, baseY + s*0.11, baseZ + s*0.16*dir); step.castShadow=allowShadows; stairGroup.add(step); }
      const landing=new THREE.Mesh(landingGeo, stairMat); landing.position.set(baseX, baseY + 14*0.11 + 0.06, baseZ + (14*0.16 + 0.7)*dir); landing.castShadow=allowShadows; stairGroup.add(landing);
    }
    city.add(stairGroup);
    addRoofDeck(xc,zc,w,d,floors);
  }

  function addRoofDeck(xc,zc,w,d,floors){
    const deckY=floors*SCALE.FLOOR_H + 0.12;
    const deck=new THREE.Mesh(new THREE.BoxGeometry(w*0.7,0.12,d*0.7), new THREE.MeshStandardMaterial({ color:0xbcc4ce, roughness:0.42, metalness:0.32 }));
    deck.position.set(xc,deckY,zc);
    deck.receiveShadow=allowShadows;
    city.add(deck);
    const shade=new THREE.Mesh(new THREE.BoxGeometry(w*0.72,0.22,d*0.18), new THREE.MeshStandardMaterial({ color:0x8f98a3, roughness:0.5, metalness:0.45 }));
    shade.position.set(xc,deckY+1.9,zc - d*0.16);
    city.add(shade);
    addRoofStair(xc,zc,deckY+0.06);
  }

  function addBuilding(xc,zc,opts={}){
    if(typeof riverDistance==='function'){ const dist=riverDistance(xc,zc); if(dist && dist.d<=dist.hw+1) return null; }
    const floors=opts.floors??(6+Math.floor(Math.random()*12)); const height=floors*(SCALE.FLOOR_H); const w=opts.w??(30+Math.random()*20), d=opts.d??(30+Math.random()*20);
    const kind=opts.kind || (Math.random()<0.5?'bricks':'plaster');
    const baseTex = kind==='bricks'? brickTex : plasterTex;
    const wallMat = makeLambertAngleMat(baseTex);
    const roofMat = new THREE.MeshStandardMaterial({ color:0x4a4f59, roughness:0.8 });
    const rect={x0:xc-w/2,x1:xc+w/2,z0:zc-d/2,z1:zc+d/2};
    if(opts.plot && !reservePlotRect(opts.plot.ix, opts.plot.iz, rect)) return null;
    const shell=makePrefabBox(w,height,d, wallMat);
    shell.position.set(xc,height/2,zc);
    const roof=makePrefabBox(w*0.94,0.6,d*0.94, roofMat);
    roof.position.set(xc,height+0.3,zc);
    const podium=makePrefabBox(w+2.4,0.5,d+2.4, wallMat.clone()); podium.position.set(xc,0.25,zc);
    const mesh=new THREE.Group();
    mesh.add(podium,shell,roof);
    mesh.traverse((o)=>{ if(o.isMesh){ o.castShadow=allowShadows; o.receiveShadow=allowShadows; } });
    city.add(mesh);
    addInteriorFrames(xc,zc,w,d,floors);
    addGroundShops(xc,zc,w,d,opts.sign);
    addSideEntrance(xc,zc,w,d);
    addInteriorStairs(xc,zc,w,d,floors);
    buildings.push({mesh,cx:xc,cz:zc,w,d,h:height,kind});
    buildingBoxes.push({min:{x:xc-w/2,z:zc-d/2}, max:{x:xc+w/2,z:zc+d/2}});
    mapBuildings.push({x:xc,z:zc,w,d,h:height,floors,kind});
    if(opts.sign && opts.landmark!==false){ mapLandmarks.push({x:xc,z:zc,label:opts.sign}); }
    const body=new CANNON.Body({mass:0}); body.addShape(new CANNON.Box(new CANNON.Vec3(w/2,height/2,d/2))); body.position.set(xc,height/2,zc); world.addBody(body);
    addLadder(xc, zc + d/2 + 0.12, 0.3, height+0.6);
    addRoofStair(xc + (Math.random()*0.6-0.3)*w*0.6, zc + (Math.random()*0.6-0.3)*d*0.6, height);
    addWindowsForBuilding(xc,zc,w,d,height);
    if(opts.sign){ const s=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(18,w*0.8),4), new THREE.MeshBasicMaterial({ color:0xffffff })); s.position.set(xc, Math.min(height*0.65, 14), zc + d/2 + 0.51); city.add(s); const tcv=document.createElement('canvas'); tcv.width=512; tcv.height=128; const gx=tcv.getContext('2d'); gx.fillStyle='#111827'; gx.fillRect(0,0,512,128); gx.fillStyle='#fff'; gx.font='900 62px system-ui,Segoe UI'; gx.textAlign='center'; gx.textBaseline='middle'; gx.fillText(opts.sign, 256, 64); const tex=new THREE.CanvasTexture(tcv); tex.colorSpace=THREE.SRGBColorSpace; s.material.map=tex; s.material.needsUpdate=true; }
    return {mesh, dims:{w,d,h:height}, kind};
  }

  function courtLinesTex(courtW,courtL){ const w=2048, h=4096; const s=h/courtL; const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.clearRect(0,0,w,h); const lineW=12; g.strokeStyle='#ffffff'; g.lineWidth=lineW; g.lineJoin='round'; g.lineCap='round'; const halfW=courtW/2, halfL=courtL/2; const X=(x)=>(w/2+x*s), Z=(z)=>(h/2+z*s); const line=(x1,z1,x2,z2)=>{ g.beginPath(); g.moveTo(X(x1),Z(z1)); g.lineTo(X(x2),Z(z2)); g.stroke(); }; const box=(x1,z1,x2,z2)=>{ line(x1,z1,x2,z1); line(x2,z1,x2,z2); line(x2,z2,x1,z2); line(x1,z2,x1,z1); };
    const serviceZ=6.4; box(-halfW,-halfL,halfW,halfL); line(-halfW,-serviceZ,halfW,-serviceZ); line(-halfW,serviceZ,halfW,serviceZ); line(0,-serviceZ,0,serviceZ); const t=new THREE.CanvasTexture(c); t.anisotropy=Math.min(16,maxAniso); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.needsUpdate=true; return t; }
  function basketLinesTex(wm=28,hm=15){ const w=2048,h=1024; const c=document.createElement('canvas'); c.width=w;c.height=h; const g=c.getContext('2d'); g.clearRect(0,0,w,h); g.strokeStyle='#ffffff'; g.lineWidth=10; g.lineJoin='round'; g.lineCap='round'; const sX=w/wm, sY=h/hm; const R=(x,y)=>[x*sX+w*0.5 - (wm*sX)/2, y*sY+h*0.5 - (hm*sY)/2]; const rect=(x,y,w2,h2)=>{ const [X,Y]=R(x,y); g.strokeRect(X,Y,w2*sX,h2*sY); }; const arc=(cx,cy,r,a0,a1)=>{ const [X,Y]=R(cx,cy); g.beginPath(); g.arc(X+0, Y+0, r*sX, a0, a1); g.stroke(); };
    rect(0,0,wm,hm); rect(0.5,0.5,wm-1,hm-1);
    rect(0.5, hm*0.5-2.4, 4.6, 4.8); rect(wm-0.5-4.6, hm*0.5-2.4, 4.6, 4.8);
    arc(wm*0.5, 0.5, 2.4, 0, Math.PI); arc(wm*0.5, hm-0.5, 2.4, Math.PI, Math.PI*2);
    const t=new THREE.CanvasTexture(c); t.anisotropy=Math.min(16,maxAniso); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.needsUpdate=true; return t; }


  function treesPerimeter(){ return; }

  function scatterFlowers(cx,cz,scale=1){
    // Flower decals were overlapping with nearby park textures and have been removed
    // for a cleaner ground layout.
    return;
  }
  const bleacherSeatMat=new THREE.MeshStandardMaterial({ color:0x38bdf8, roughness:0.35, metalness:0.05 });
  const bleacherRiserMat=new THREE.MeshStandardMaterial({ color:0x6b7280, roughness:0.72, metalness:0.06 });
  const bleacherStairMat=new THREE.MeshStandardMaterial({ color:0x9ca3af, roughness:0.64, metalness:0.05 });
  function makeBleacherSection(width=26, rows=5, stepDepth=0.9){
    const g=new THREE.Group();
    const totalDepth=rows*stepDepth + 0.8;
    for(let r=0;r<rows;r++){
      const step=new THREE.Mesh(new THREE.BoxGeometry(width,0.32,stepDepth), bleacherRiserMat);
      step.position.set(0, 0.16 + r*0.32, -totalDepth/2 + r*stepDepth + stepDepth/2);
      step.castShadow=allowShadows; step.receiveShadow=allowShadows;
      g.add(step);
      const seats=Math.max(8, Math.floor(width/1.4));
      for(let i=0;i<seats;i++){
        const seat=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.12,0.5), bleacherSeatMat);
        const x=-width/2 + (i+0.5)*(width/seats);
        seat.position.set(x, step.position.y + 0.14, step.position.z - stepDepth*0.18);
        seat.castShadow=allowShadows; seat.receiveShadow=allowShadows;
        g.add(seat);
      }
    }
    const stair=new THREE.Mesh(new THREE.BoxGeometry(1.3, rows*0.32, totalDepth), bleacherStairMat);
    stair.position.set(0, rows*0.32*0.5, 0);
    stair.castShadow=allowShadows; stair.receiveShadow=allowShadows;
    g.add(stair);
    return {mesh:g, depth:totalDepth};
  }
  function addParkGrass(cx,cz,scale=1.0){ const g=new THREE.Mesh(new THREE.PlaneGeometry(PLOT*0.9*scale,PLOT*0.9*scale), turfMat); g.rotation.x=-Math.PI/2; g.position.set(cx,0.015,cz); g.receiveShadow=allowShadows; g.userData={kind:'park_grassOriginal'}; city.add(g); const gardenBed=new THREE.Mesh(new THREE.CircleGeometry(PLOT*0.34*scale,32), new THREE.MeshStandardMaterial({ map:parkLawnTex, color:0x7fab63, roughness:0.55, metalness:0.03 })); gardenBed.rotation.x=-Math.PI/2; gardenBed.position.set(cx,0.018,cz); gardenBed.receiveShadow=allowShadows; city.add(gardenBed); scatterFlowers(cx,cz,scale); addBench(cx+PLOT*0.25, cz+PLOT*0.25); addBench(cx-PLOT*0.25, cz-PLOT*0.25, Math.PI); addBench(cx+PLOT*0.25, cz-PLOT*0.25, Math.PI/2); addBench(cx-PLOT*0.25, cz+PLOT*0.25, -Math.PI/2); }

  function addTennisCourt(cx,cz){
    const courtW=10.97, courtL=23.77, apron=4.2;
    const concourseW=courtW+apron*2+10, concourseL=courtL+apron*2+12;
    const concourse=new THREE.Mesh(new THREE.BoxGeometry(concourseW,0.18, concourseL), new THREE.MeshStandardMaterial({ map:naturalStoneTex||undefined, color:0xbfc5cf, roughness:0.78, metalness:0.06 }));
    concourse.position.set(cx,0.09,cz); concourse.receiveShadow=allowShadows; concourse.castShadow=allowShadows; city.add(concourse);
    const apronMat=new THREE.MeshStandardMaterial({ color:0x2f855a, roughness:0.62, metalness:0.05, side:THREE.DoubleSide });
    const apronMesh=new THREE.Mesh(new THREE.BoxGeometry(courtW+apron*2,0.12,courtL+apron*2), apronMat);
    apronMesh.position.set(cx,0.21,cz); apronMesh.receiveShadow=allowShadows; apronMesh.castShadow=allowShadows; city.add(apronMesh);
    const surface=new THREE.Mesh(new THREE.BoxGeometry(courtW,0.08,courtL), new THREE.MeshStandardMaterial({ color:0x1d4ed8, map:courtLinesTex(courtW,courtL), roughness:0.48, metalness:0.05, side:THREE.DoubleSide }));
    surface.position.set(cx,0.31,cz); surface.receiveShadow=allowShadows; surface.castShadow=allowShadows; city.add(surface);
    const centerLine=new THREE.Mesh(new THREE.PlaneGeometry(0.32,courtW), new THREE.MeshBasicMaterial({ color:0xf8fafc, transparent:true, opacity:0.82 }));
    centerLine.rotation.x=-Math.PI/2; centerLine.rotation.z=Math.PI/2; centerLine.position.set(cx,0.351,cz); centerLine.renderOrder=3; city.add(centerLine);
    const bleacherInnerW=courtW+apron*2+2.2, bleacherInnerL=courtL+apron*2+2.2; const bleacherOffset=bleacherInnerL*0.5 + 2.4;
    const longSection=makeBleacherSection(bleacherInnerW+6,6); const shortSection=makeBleacherSection(bleacherInnerL+4,5,0.85);
    const placeBleachers=(section,x,z)=>{ const m=section.mesh.clone(true); m.position.set(x,0.012,z); m.lookAt(new THREE.Vector3(cx,0,cz)); m.rotateY(Math.PI); city.add(m); };
    placeBleachers(longSection, cx, cz+bleacherOffset);
    placeBleachers(longSection, cx, cz-bleacherOffset);
    const sideOffset=bleacherInnerW*0.5 + 2.8;
    placeBleachers(shortSection, cx+sideOffset, cz);
    placeBleachers(shortSection, cx-sideOffset, cz);
    const tunnelMat=new THREE.MeshStandardMaterial({ color:0x9ca3af, roughness:0.64, metalness:0.08 });
    const tunnelShell=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.4,4.4), tunnelMat);
    const tunnelVoid=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.1,4.5), new THREE.MeshStandardMaterial({ color:0x0f172a, transparent:true, opacity:0.28 }));
    function placeTunnel(x,z,rot){ const shell=tunnelShell.clone(); shell.position.set(x,1.2,z); shell.rotation.y=rot; const hollow=tunnelVoid.clone(); hollow.position.copy(shell.position); hollow.rotation.copy(shell.rotation); city.add(shell,hollow); }
    placeTunnel(cx + concourseW/2 - 1.2, cz, Math.PI/2);
    placeTunnel(cx - concourseW/2 + 1.2, cz, -Math.PI/2);
    mapParks.push({type:'tennis',x:cx,z:cz,w:concourseW,d:concourseL});
  }

  function addBasketCourt(cx,cz){
    addParkGrass(cx,cz,1.05);
    const wm=28, hm=15, apron=2.6;
    const base=new THREE.Mesh(new THREE.PlaneGeometry(wm+apron*2,hm+apron*2), new THREE.MeshStandardMaterial({ map:redTrackTex, roughness:0.9, metalness:0.04 }));
    base.rotation.x=-Math.PI/2; base.position.set(cx,0.02,cz); city.add(base);
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(wm,hm), new THREE.MeshStandardMaterial({ color:0xc47838, map:basketLinesTex(wm,hm), roughness:0.58, metalness:0.03, side:THREE.DoubleSide }));
    surface.rotation.x=-Math.PI/2; surface.position.set(cx,0.021,cz); city.add(surface);
    const hoopMat=new THREE.MeshBasicMaterial({ color:0xffffff }); const postMat=new THREE.MeshBasicMaterial({ color:0xff3c3c });
    const makeHoop=(sx)=>{ const g=new THREE.Group(); const board=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.1,0.08), hoopMat); board.position.set(0,2.9,-0.25); const rim=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.06,12,32), postMat); rim.rotation.x=Math.PI/2; rim.position.set(0,2.3,0.42); const post=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.6,16), postMat); post.position.y=1.3; const arm=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.9), postMat); arm.position.set(0,2.5,0.1); const brace=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.0,0.12), postMat); brace.position.set(0,1.9,0.05); g.add(post,board,rim,arm,brace); g.position.set(cx+sx*(wm*0.5-1.2),0,cz); city.add(g); };
    makeHoop(-1); makeHoop(1);
    for(let i=0;i<3;i++){ const ball=new THREE.Mesh(new THREE.SphereGeometry(0.3,20,16), new THREE.MeshStandardMaterial({ color:0xff8a00, roughness:0.65 })); ball.position.set(cx + (Math.random()*2-1)*4, 0.3, cz + (Math.random()*2-1)*3); city.add(ball); }
    treesPerimeter(cx,cz);
    mapParks.push({type:'basket',x:cx,z:cz,w:wm+apron*2,d:hm+apron*2});
  }

  function addFountain(){ return; }

  const trafficLights=[];
  function addTrafficLight(x,z,dir=0){ const h=SCALE.TRAFFIC_LIGHT_H; const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,h,10), new THREE.MeshStandardMaterial({ color:0x666 })); pole.position.set(x,h/2,z); city.add(pole); const box=new THREE.Mesh(new THREE.BoxGeometry(0.4,1,0.3), new THREE.MeshStandardMaterial({ color:0x222 })); box.position.set(x,h-1.4,z); box.rotation.y=dir; box.userData={kind:'traffic_head'}; city.add(box);
    const mkLamp=(c,dy)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(0.14,12,12), new THREE.MeshBasicMaterial({ color:c })); m.position.set(x+Math.sin(dir)*0.15,3.6+dy,z+Math.cos(dir)*0.15); city.add(m); return m; };
    const Lg=mkLamp(0x2ecc71,0.28), Ly=mkLamp(0xf1c40f,0), Lr=mkLamp(0xe74c3c,-0.28);
    trafficLights.push({pos:new THREE.Vector3(x,0,z), dir, state:'green', timer:0, lamps:{Lg,Ly,Lr}});
  }

  const POIS=[];
  function addInstitution(kind, x, z){
    let sign = kind==='hospital'?'HOSPITAL': kind==='police'?'POLICE': kind==='fire'?'FIRE': kind==='school'?'SCHOOL':'MALL';
    const b=addBuilding(x,z,{floors: (kind==='mall'?6:7), w: (kind==='mall'?70:48), d:(kind==='mall'?60:40), hue: kind==='hospital'?5: (kind==='police'?210: (kind==='fire'?8: (kind==='school'?40:80))), sign, landmark:false});
    if(kind==='hospital'){ const pad=new THREE.Mesh(new THREE.CircleGeometry(8,32), new THREE.MeshBasicMaterial({ color:0xffffff })); pad.rotation.x=-Math.PI/2; pad.position.set(x, b.dims.h+0.2, z- b.dims.d/2 + 10); city.add(pad); const H=new THREE.Mesh(new THREE.TorusGeometry(6,0.6,8,32), new THREE.MeshBasicMaterial({ color:0xff0000 })); H.rotation.x=-Math.PI/2; H.position.copy(pad.position).setY(b.dims.h+0.5); city.add(H); }
    const icon = kind==='hospital'?'🏥': kind==='police'?'🚓': kind==='fire'?'🧯': kind==='school'?'🏫':'🛍';
    POIS.push({type:kind, pos:new THREE.Vector3(x,0,z), label:icon, dims:b.dims});
    mapLandmarks.push({x,z,label:`${icon} ${sign}`});
    institutions.push({type:kind, pos:new THREE.Vector3(x,0,z)});
  }

  function addAirport(x,z){ const runway=new THREE.Mesh(new THREE.PlaneGeometry(400,26), new THREE.MeshBasicMaterial({ color:0x2f2f2f })); runway.rotation.x=-Math.PI/2; runway.position.set(x,0.02,z); city.add(runway); const stripe=new THREE.Mesh(new THREE.PlaneGeometry(400*0.9,3), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.7 })); stripe.rotation.x=-Math.PI/2; stripe.position.set(x,0.03,z); city.add(stripe); const tower=new THREE.Mesh(new THREE.CylinderGeometry(4,4,28,16), new THREE.MeshStandardMaterial({ color:0x9aa0a8 })); tower.position.set(x+40,14,z-20); city.add(tower); const top=new THREE.Mesh(new THREE.SphereGeometry(6,16,12), new THREE.MeshStandardMaterial({ color:0xbfc6cf, metalness:0.2, roughness:0.6 })); top.position.set(x+40,28,z-20); city.add(top); POIS.push({type:'airport', pos:new THREE.Vector3(x,0,z), label:'🛫'}); mapLandmarks.push({x,z,label:'🛫 Airport'}); }
  function addTrainStation(x,z){ const plat=new THREE.Mesh(new THREE.PlaneGeometry(160,8), new THREE.MeshBasicMaterial({ color:0x666b73 })); plat.rotation.x=-Math.PI/2; plat.position.set(x,0.02,z); city.add(plat); const rails=new THREE.Group(); for(let i=0;i<4;i++){ const r=new THREE.Mesh(new THREE.PlaneGeometry(160,0.3), new THREE.MeshBasicMaterial({ color:0x444 })); r.rotation.x=-Math.PI/2; r.position.set(x,0.021,z-2+i*1.2); rails.add(r);} city.add(rails); addBuilding(x+30,z-8,{floors:5,w:50,d:16,hue:48,sign:'STATION', landmark:false}); POIS.push({type:'station', pos:new THREE.Vector3(x,0,z), label:'🚉'}); mapLandmarks.push({x,z,label:'🚉 Station'}); }

  const blockPlan=[
    ['res_high','green','civic','civic','green','res_high'],
    ['res_mid','green','res_mid','res_mid','green','res_mid'],
    ['gateway','green','plaza','plaza','green','campus'],
    ['gateway','green','plaza','plaza','green','campus'],
    ['res_mid','green','res_mid','res_mid','green','res_mid'],
    ['res_high','green','civic','civic','green','res_high']
  ];
  const parkKinds=['tennis','basket'];
  const parkOverrides=new Map([
    ['2,2','basket'],
    ['3,2','basket'],
    ['2,3','basket'],
    ['3,3','tennis']
  ]);
  function pickPark(ix,iz){ return parkOverrides.get(`${ix},${iz}`) || parkKinds[(ix+iz)%parkKinds.length]; }
  function addCivicBenches(cx,cz){ addBench(cx+PLOT*0.32, cz, Math.PI/2); addBench(cx-PLOT*0.32, cz, -Math.PI/2); addBench(cx, cz+PLOT*0.32, 0); addBench(cx, cz-PLOT*0.32, Math.PI); }
  function layoutResidentialCluster(ix,iz,{density='mid'}={}){
    const cx=startX+ix*CELL, cz=startZ+iz*CELL;
    addSidewalk(cx,cz);
    const slotSpread=density==='high'? PLOT*0.32 : PLOT*0.26;
    const slots=density==='high'
      ? [ [-slotSpread, -PLOT*0.18], [slotSpread, -PLOT*0.1], [0, PLOT*0.16], [0, -PLOT*0.36] ]
      : [ [-slotSpread, -PLOT*0.14], [slotSpread, 0], [0, PLOT*0.2] ];
    const baseFloors=density==='high'?10:7;
    slots.forEach((slot,idx)=>{ addBuilding(cx+slot[0], cz+slot[1], {plot:{ix,iz}, floors:baseFloors+idx, w: density==='high'?38:32, d:density==='high'?30:26}); });
    treesPerimeter(cx,cz);
  }
  function placeCivicCore(ix,iz,label){
    const cx=startX+ix*CELL, cz=startZ+iz*CELL;
    registerPlotArea(ix,iz,cx,cz,PLOT*0.95,PLOT*0.95);
    addSidewalk(cx,cz);
    addParkGrass(cx,cz,1.0);
    mapParks.push({type:'green',x:cx,z:cz,w:PLOT*0.9,d:PLOT*0.9});
    addBuilding(cx, cz-8, {plot:{ix,iz}, floors:9, w:58, d:42, sign:label, landmark:true});
    addCivicBenches(cx,cz);
  }
  function placeCampus(ix,iz){
    const cx=startX+ix*CELL, cz=startZ+iz*CELL;
    registerPlotArea(ix,iz,cx,cz,PLOT*0.9,PLOT*0.9);
    addSidewalk(cx,cz);
    addBuilding(cx-PLOT*0.18, cz-10, {plot:{ix,iz}, floors:6, w:40, d:24, sign:'LAB', landmark:false});
    addBuilding(cx+PLOT*0.14, cz+12, {plot:{ix,iz}, floors:5, w:34, d:26, sign:'DORMS', landmark:false});
    addBasketCourt(cx,cz);
  }
  function placeGateway(ix,iz){
    const cx=startX+ix*CELL, cz=startZ+iz*CELL;
    registerPlotArea(ix,iz,cx,cz,PLOT*0.9,PLOT*0.9);
    addSidewalk(cx,cz);
    addBasketCourt(cx,cz);
    addBuilding(cx-PLOT*0.18, cz+PLOT*0.22, {plot:{ix,iz}, floors:8, w:36, d:32});
    addBuilding(cx+PLOT*0.2, cz-PLOT*0.16, {plot:{ix,iz}, floors:7, w:32, d:24});
  }
  function placePark(ix,iz){
    const cx=startX+ix*CELL, cz=startZ+iz*CELL;
    registerPlotArea(ix,iz,cx,cz,PLOT*0.9,PLOT*0.9);
    const pick=pickPark(ix,iz);
    if(pick==='tennis') addTennisCourt(cx,cz);
    else if(pick==='basket') addBasketCourt(cx,cz);
    else { addParkGrass(cx,cz,1.0); mapParks.push({type:'green',x:cx,z:cz,w:PLOT*0.9,d:PLOT*0.9}); }
    addCivicBenches(cx,cz);
  }

  for(let ix=0; ix<BLOCKS_X; ix++){
    for(let iz=0; iz<BLOCKS_Z; iz++){
      const type=blockPlan[iz]?.[ix] || (((ix+iz)%2===0)?'green':'res_mid');
      if(type==='green') placePark(ix,iz);
      else if(type==='civic') placeCivicCore(ix,iz,'CIVIC');
      else if(type==='plaza') placeCivicCore(ix,iz,'PLAZA');
      else if(type==='campus') placeCampus(ix,iz);
      else if(type==='gateway') placeGateway(ix,iz);
      else if(type==='res_high') layoutResidentialCluster(ix,iz,{density:'high'});
      else layoutResidentialCluster(ix,iz,{density:'mid'});
    }
  }
  addParkGrass(startX + CELL*0.6, startZ + CELL*0.6, 1.0); mapParks.push({type:'green',x:startX + CELL*0.6,z:startZ + CELL*0.6,w:PLOT*0.9,d:PLOT*0.9});
  addParkGrass(startX + CELL*4.6, startZ + CELL*4.6, 1.0); mapParks.push({type:'green',x:startX + CELL*4.6,z:startZ + CELL*4.6,w:PLOT*0.9,d:PLOT*0.9});
  addBasketCourt(startX + CELL*2.4, startZ - CELL*1.2);
  addBasketCourt(startX + CELL*3.6, startZ + CELL*1.2);
  commitWindows();
  for(let i=-BLOCKS_X;i<=BLOCKS_X;i+=2){ addTrafficLight(i*CELL*0.5, -BLOCKS_Z*CELL*0.5, 0); addTrafficLight(i*CELL*0.5, BLOCKS_Z*CELL*0.5, Math.PI); }

  const ringR = Math.max(BLOCKS_X,BLOCKS_Z)*CELL*0.65;
  const ringRoadWidth = ROAD*1.2;
  const ringRoad=new THREE.Mesh(new THREE.RingGeometry(ringR-ringRoadWidth*0.5, ringR+ringRoadWidth*0.5, 128), new THREE.MeshStandardMaterial({ map:asphaltTex, side:THREE.DoubleSide, roughness:0.86 })); ringRoad.rotation.x=-Math.PI/2; ringRoad.position.y=0.011; city.add(ringRoad);
  const ringStripe=new THREE.Mesh(new THREE.RingGeometry(ringR-2, ringR-1.4, 128), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.22, side:THREE.DoubleSide })); ringStripe.rotation.x=-Math.PI/2; ringStripe.position.y=0.012; city.add(ringStripe);
  mapRoads.push({type:'ring', name:ringRoadName, from:{x:0,z:0}, to:{x:0,z:0}, width:ringRoadWidth, radius:ringR});
  mapLandmarks.push({x:ringR*0.75,z:0,label:`🛣 ${ringRoadName}`});
  const connectorTargets=[
    {from:{x:cityHalfX+ROAD*0.5, z:0}, to:{x:ringR-8, z:0}},
    {from:{x:-cityHalfX-ROAD*0.5, z:0}, to:{x:-ringR+8, z:0}},
    {from:{x:0, z:cityHalfZ+ROAD*0.5}, to:{x:0, z:ringR-8}},
    {from:{x:0, z:-cityHalfZ-ROAD*0.5}, to:{x:0, z:-ringR+8}},
    {from:{x:cityHalfX+ROAD*0.5, z:cityHalfZ*0.6}, to:{x:ringR-10, z:ringR*0.6}},
    {from:{x:-cityHalfX-ROAD*0.5, z:-cityHalfZ*0.6}, to:{x:-ringR+10, z:-ringR*0.6}},
    {from:{x:cityHalfX*0.25, z:cityHalfZ+ROAD*0.5}, to:{x:ringR*0.25, z:ringR-10}},
    {from:{x:-cityHalfX*0.25, z:-cityHalfZ-ROAD*0.5}, to:{x:-ringR*0.25, z:-ringR+10}}
  ];
  connectorTargets.forEach((c)=>{ const dx=c.to.x-c.from.x, dz=c.to.z-c.from.z; const len=Math.hypot(dx,dz); if(len<1) return; const mesh=new THREE.Mesh(new THREE.PlaneGeometry(len, ROAD), roadMat); mesh.rotation.x=-Math.PI/2; mesh.rotation.y=Math.atan2(dz,dx); mesh.position.set((c.from.x+c.to.x)/2, ROAD_SURFACE_Y + 0.001, (c.from.z+c.to.z)/2); city.add(mesh); mapRoads.push({name:ringRoadName, from:c.from, to:c.to, width:ROAD}); });
  addAirport(ringR*0.9,  -ringR*0.6);
  addTrainStation(-ringR*0.6, ringR*0.85);

  addInstitution('police',   startX+CELL*0.6, startZ+CELL*0.8);
  addInstitution('hospital', startX+CELL*4.6, startZ+CELL*3.0);
  addInstitution('school',   startX+CELL*2.4, startZ+CELL*4.4);
  addInstitution('fire',     startX+CELL*0.8, startZ+CELL*4.8);
  addInstitution('mall',     startX+CELL*3.6, startZ+CELL*1.4);

  const playerRadius=0.32; const player=new CANNON.Body({ mass:72, material:matPlayer, shape:new CANNON.Sphere(playerRadius), position:new CANNON.Vec3(0,0.94,10), linearDamping:0.18, angularDamping:0.9 });
  player.fixedRotation=true; player.allowSleep=false; world.addBody(player);
  let yaw=0;
  // Start with a slight downward pitch so the city grid is visible immediately
  // on load without requiring the player to drag the aim pad.
  let pitch=-Math.PI*0.08;
  const PITCH_LIMIT=Math.PI*0.49;
  function clampPitch(){ pitch=Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch)); }
  let camDist=4.2;
  function cacheVehicleBounds(mesh){
    if(!mesh) return { size:new THREE.Vector3(4.6,1.6,2.1), center:new THREE.Vector3() };
    if(!mesh.userData.bounds){
      const box=new THREE.Box3().setFromObject(mesh);
      const size=new THREE.Vector3(); box.getSize(size);
      const center=new THREE.Vector3(); box.getCenter(center);
      mesh.userData.bounds={ size, center };
    }
    return mesh.userData.bounds;
  }
  function camFollow(pos,distMul=1,headingOverride=null){
    const heading = headingOverride==null ? yaw : headingOverride;
    const forward=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
    let followDist = camDist*distMul;
    let eyeHeight = pos.y + 1.6;
    let lookHeight = pos.y + 1.05 + Math.sin(pitch)*0.7;
    let lookOffset = forward.clone().multiplyScalar(1.6*distMul);
    let offset = forward.clone().multiplyScalar(-followDist);
    if(driveState.active){
      const bounds=cacheVehicleBounds(driveState.vehicle||null);
      const vehHeight=bounds.size?.y || 1.6;
      const vehLength=bounds.size?.z || 3.0;
      if(cameraMode===CAMERA_MODES.COCKPIT){
        followDist=Math.max(1.2, vehLength*0.22);
        offset = forward.clone().multiplyScalar(0.15);
        eyeHeight = pos.y + vehHeight*0.72;
        lookHeight = pos.y + vehHeight*0.68;
        lookOffset = forward.clone().multiplyScalar(Math.max(2.2, vehLength*0.6));
      } else {
        followDist=Math.max(camDist*1.4, vehLength*1.3);
        offset = forward.clone().multiplyScalar(-followDist);
        offset.y += vehHeight*0.32;
        eyeHeight = pos.y + Math.max(1.2, vehHeight*0.8);
        lookOffset = forward.clone().multiplyScalar(Math.max(2.4, vehLength*0.75));
      }
    }
    const eye=new THREE.Vector3(pos.x, eyeHeight, pos.z).add(offset);
    const look=new THREE.Vector3(pos.x, lookHeight, pos.z).add(lookOffset);
    camera.position.lerp(eye,0.25);
    camera.lookAt(look);
  }
  function grounded(){ return player.position.y < 0.34 && Math.abs(player.velocity.y) < 0.05; }
  function jump(){ if(grounded()){ player.velocity.y = 5.2; } }

  const aimGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0,0,-50)]);
  const aimMatDark=new THREE.LineBasicMaterial({ color:0x222222, transparent:true, opacity:0.9 });
  const aimLine=new THREE.Line(aimGeo,aimMatDark); aimLine.renderOrder=9; scene.add(aimLine);
  const aimDotTex=(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.fillStyle='rgba(255,255,255,0.0)'; x.fillRect(0,0,64,64); x.beginPath(); x.arc(32,32,14,0,Math.PI*2); x.fillStyle='rgba(255,60,60,0.95)'; x.fill(); x.lineWidth=3; x.strokeStyle='rgba(255,255,255,0.9)'; x.stroke(); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const aimDotMat=new THREE.SpriteMaterial({ map:aimDotTex, depthWrite:false, color:0xffffff }); const aimDot=new THREE.Sprite(aimDotMat); aimDot.scale.set(0.7,0.7,1); scene.add(aimDot);
  const crosshairEl=$('crosshair'); crosshairEl.style.setProperty('--aimColor','#ff3c3c');
  const aimPoint=new THREE.Vector2(0,0);
  function updateCrosshairScreen(){ const xPercent=((aimPoint.x+1)/2)*100; const yPercent=((1-aimPoint.y)/2)*100; crosshairEl.style.setProperty('--aim-x', `${xPercent}%`); crosshairEl.style.setProperty('--aim-y', `${yPercent}%`); }
  updateCrosshairScreen();

  const smokeTex=(function(){ const c=document.createElement('canvas'); c.width=c.height=128; const ctx=c.getContext('2d'); const grad=ctx.createRadialGradient(64,64,12,64,64,64); grad.addColorStop(0,'rgba(255,255,255,0.28)'); grad.addColorStop(0.45,'rgba(148,163,184,0.22)'); grad.addColorStop(1,'rgba(15,23,42,0)'); ctx.fillStyle=grad; ctx.fillRect(0,0,128,128); const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex; })();
  const scorchTex=(function(){ const c=document.createElement('canvas'); c.width=c.height=128; const ctx=c.getContext('2d'); ctx.fillStyle='rgba(0,0,0,0)'; ctx.fillRect(0,0,128,128); ctx.translate(64,64); const grd=ctx.createRadialGradient(0,0,6,0,0,60); grd.addColorStop(0,'rgba(64,64,64,0.9)'); grd.addColorStop(0.55,'rgba(40,40,40,0.65)'); grd.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,60,0,Math.PI*2); ctx.fill(); const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex; })();
  const grenadeFallbackGeo=new THREE.SphereGeometry(0.18,18,18);
  const grenadeFallbackMat=new THREE.MeshStandardMaterial({ color:0x4a4f59, metalness:0.32, roughness:0.58 });

  const ARMORY=[
    { key:'Glock',  name:'Glock', urls:[
      'https://raw.githubusercontent.com/webaverse/pistol/master/glock.glb',
      'https://raw.githubusercontent.com/webaverse/pistol/main/glock.glb'
    ], s:0.6, stats:{ rpm:380, dmg:24, spread:0.013, mag:17, reload:1.2 }, auto:false },
    { key:'Pistol', name:'Pistol', urls:[
      'https://raw.githubusercontent.com/webaverse/pistol/master/pistol.glb',
      'https://raw.githubusercontent.com/webaverse/pistol/main/pistol.glb'
    ], s:0.6, stats:{ rpm:320, dmg:22, spread:0.014, mag:15, reload:1.3 }, auto:false },
    { key:'Uzi',    name:'Uzi',    urls:[
      'https://raw.githubusercontent.com/webaverse/uzi/main/uzi.glb',
      'https://raw.githubusercontent.com/webaverse-mmo/uzi/main/uzi.glb'
    ], s:0.6, stats:{ rpm:900, dmg:18, spread:0.02,  mag:32, reload:1.6 }, auto:true },
    { key:'AK47',   name:'AK-47', urls:[
      'https://raw.githubusercontent.com/LazerMaker/gun-models-ak47-and-supprest-pistol-/master/ak47.glb'
    ], s:0.8, stats:{ rpm:650, dmg:32, spread:0.012, mag:30, reload:1.9 }, auto:true },
    { key:'MP5',    name:'MP5', urls:[
      'https://raw.githubusercontent.com/webaverse/uzi/main/uzi.glb',
      'https://raw.githubusercontent.com/webaverse-mmo/uzi/main/uzi.glb'
    ], s:0.75, stats:{ rpm:780, dmg:20, spread:0.016, mag:30, reload:1.6 }, auto:true },
    { key:'Grenade',name:'Grenade',urls:[
      'https://raw.githubusercontent.com/friuns2/bingextension/main/grenade.glb'
    ], s:2.0, stats:{ rpm:60,  dmg:120, spread:0.03,  mag:1,  reload:2.4 }, auto:false },
    { key:'BattleRifle', name:'Battle Rifle', urls:[
      'https://raw.githubusercontent.com/Sinojouni/games/main/battle_rifle_animated.glb'
    ], s:0.9, stats:{ rpm:620, dmg:34, spread:0.011, mag:28, reload:2.0 }, auto:true },
    { key:'InfantryRifle', name:'Infantry Rifle', urls:[
      'https://raw.githubusercontent.com/ssdeanx/glb-textures/main/infantry_automatic_rifle.glb'
    ], s:0.9, stats:{ rpm:680, dmg:28, spread:0.012, mag:30, reload:1.8 }, auto:true },
    { key:'WebaverseRifle', name:'Rifle', urls:[
      'https://raw.githubusercontent.com/webaverse/assets/master/rifle.glb'
    ], s:0.9, stats:{ rpm:640, dmg:27, spread:0.012, mag:28, reload:1.7 }, auto:true },
    { key:'Gun', name:'Gun', urls:[
      'https://raw.githubusercontent.com/codewithtom/godot-fps/master/Assets/gun.glb'
    ], s:0.85, stats:{ rpm:320, dmg:24, spread:0.014, mag:16, reload:1.4 }, auto:false },
    { key:'Air908Rifle', name:'Rifle 908', urls:[
      'https://raw.githubusercontent.com/Air908/3dmodels/main/GunRifle.glb'
    ], s:0.9, stats:{ rpm:610, dmg:29, spread:0.012, mag:30, reload:1.9 }, auto:true },
    { key:'SniperAWP', name:'Sniper AWP', urls:[
      'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb'
    ], s:0.9, stats:{ rpm:45, dmg:120, spread:0.006, mag:7, reload:2.6 }, auto:false },
  ];
  const FIRE_MODES=new Map(); ARMORY.forEach(a=>FIRE_MODES.set(a.key, a.auto?'auto':'single'));
  const STARTING_WEAPONS=['Glock','Uzi','AK47'];
  const unlockedWeapons=new Set(STARTING_WEAPONS);
  const weaponPickups=[];

  const weaponRoot=new THREE.Group(); camera.add(weaponRoot);
  window.weaponAnchor=weaponRoot;
  const weaponCache=new Map();
  async function loadWeaponGLTF(urls, timeoutMs=FAST_BOOT?3200:7000){
    let lastErr=null;
    for(const url of urls){
      try{
        const gltf=await withTimeout(gltfLoader.loadAsync(url), timeoutMs);
        return gltf;
      }catch(err){
        lastErr=err;
      }
    }
    throw lastErr || new Error('weapon load failed');
  }
  const metalTex=(()=>{ const S=256,c=document.createElement('canvas'); c.width=c.height=S; const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,S,S); g.addColorStop(0,'#2e2e2e'); g.addColorStop(1,'#4a4a4a'); x.fillStyle=g; x.fillRect(0,0,S,S); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=2; return t; })();
  const matMetal=new THREE.MeshLambertMaterial({ color:'#3b3b3b', map:metalTex }), matWood =new THREE.MeshLambertMaterial({ color:'#7b5331' });
  const WEAPON_TYPES={ Glock:'pistol', Pistol:'pistol', Gun:'pistol', Uzi:'smg', MP5:'smg', AK47:'rifle', BattleRifle:'rifle', InfantryRifle:'rifle', WebaverseRifle:'rifle', Air908Rifle:'rifle', SniperAWP:'sniper', Grenade:'grenade' };
  function makeSight(){ const s=new THREE.Group(); const ring=new THREE.Mesh(new THREE.TorusGeometry(0.015,0.004,8,12), new THREE.MeshBasicMaterial({ color:'#222' })); ring.rotation.x=Math.PI/2; ring.position.set(0,0,0.02); const post=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.02,0.004), new THREE.MeshBasicMaterial({ color:'#444' })); post.position.set(0,0,0.03); s.add(ring,post); return s; }
  function makeAK47Mesh(){ const g=new THREE.Group(); const rec=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.11,0.45), matMetal); const hand=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.08,0.28), matWood); hand.position.set(0.07,-0.02,-0.22); const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.38,18), matMetal); barrel.rotation.z=Math.PI/2; barrel.position.set(0.12,-0.02,-0.41); const stock=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.09,0.25), matWood); stock.position.set(-0.06,-0.01,0.16); const mag=new THREE.Mesh(new THREE.CapsuleGeometry(0.04,0.12,8,16), matMetal); mag.rotation.x=Math.PI/2; mag.position.set(0.02,-0.08,0.02); g.add(rec,hand,barrel,stock,mag,makeSight()); return g; }
  function makePistolMesh(){ const g=new THREE.Group(); const slide=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.05,0.18), matMetal); slide.position.set(0.02,0.02,-0.09); const frame=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.07,0.14), new THREE.MeshLambertMaterial({color:'#444'})); const grip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.1,0.06), new THREE.MeshLambertMaterial({color:'#2b2b2b'})); grip.position.set(-0.02,-0.05,0.02); const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.14,10), matMetal); barrel.rotation.z=Math.PI/2; barrel.position.set(0.07,0.02,-0.18); g.add(frame,slide,grip,barrel,makeSight()); return g; }
  function normalizeAndCenter(root, targetLen=0.6){ const box=new THREE.Box3().setFromObject(root); const size=new THREE.Vector3(); box.getSize(size); const center=new THREE.Vector3(); box.getCenter(center); root.position.sub(center); const maxDim=Math.max(size.x,size.y,size.z)||1; const s=targetLen/maxDim; root.scale.setScalar(s); return root; }
  function quickWeaponModel(key){ const type=WEAPON_TYPES[key]||'pistol'; if(type==='rifle'||type==='sniper'||type==='smg') return makeAK47Mesh(); if(type==='grenade') return buildGrenadeMesh(); return makePistolMesh(); }
  async function loadWeapon(key){ const entry=ARMORY.find(a=>a.key===key); if(!entry){ return new THREE.Group(); } if(weaponCache.has(key)){ const v=weaponCache.get(key); return (v.clone? v.clone(true) : v); }
    if(FAST_BOOT){ const alt=quickWeaponModel(key); normalizeAndCenter(alt, entry.s||0.6); weaponCache.set(key, alt); return (alt.clone? alt.clone(true) : alt); }
    const urls=Array.isArray(entry.urls)?entry.urls.filter(Boolean): (entry.url?[entry.url]:[]);
    try{
      const gltf=await loadWeaponGLTF(urls);
      const base=(gltf.scene||gltf.scenes?.[0]||null);
      let use = base || makePistolMesh();
      normalizeAndCenter(use, entry.s);
      use.traverse?.(o=>{ if(o.isMesh){ o.castShadow=allowShadows; o.receiveShadow=allowShadows; const m=o.material; o.material = new THREE.MeshLambertMaterial({ color:(m?.color||new THREE.Color('#888')), map:m?.map||null, transparent:!!m?.transparent, opacity:(m?.opacity??1) }); }});
      weaponCache.set(key, use);
      return (use.clone? use.clone(true) : use);
    }catch(err){
      console.warn(`Weapon ${key} failed to stream GLB, using quick mesh`, err);
    }
    const alt=quickWeaponModel(key); normalizeAndCenter(alt, entry.s||0.6); weaponCache.set(key, alt); return (alt.clone? alt.clone(true) : alt); }
  let grenadeProjectileTemplate=null; let grenadeProjectileLoading=false;
  async function ensureGrenadeTemplate(){ if(grenadeProjectileTemplate || grenadeProjectileLoading) return; grenadeProjectileLoading=true; try{ const model=await loadWeapon('Grenade'); const holder=new THREE.Group(); const instance=model.clone(true); holder.add(instance); holder.traverse?.(o=>{ if(o.isMesh){ o.castShadow=allowShadows; o.receiveShadow=allowShadows; } }); grenadeProjectileTemplate=holder; }catch(_){ grenadeProjectileTemplate=null; }finally{ grenadeProjectileLoading=false; } }
  function buildGrenadeMesh(){ if(grenadeProjectileTemplate){ const inst=grenadeProjectileTemplate.clone(true); inst.traverse?.(o=>{ if(o.isMesh){ o.castShadow=allowShadows; o.receiveShadow=allowShadows; } }); return inst; } const fallback=new THREE.Mesh(grenadeFallbackGeo, grenadeFallbackMat.clone()); fallback.castShadow=allowShadows; fallback.receiveShadow=allowShadows; return fallback; }

  armoryDiv=$('armory'); armorySlider=$('armorySlider'); armorySliderWrap=$('armorySliderWrap'); armoryPrev=$('armoryPrev'); armoryNext=$('armoryNext'); if(armorySliderWrap){ armorySliderWrap.style.display='flex'; armorySliderWrap.removeAttribute('aria-hidden'); armorySlider?.removeAttribute('tabindex'); }
  const thumbCache=new Map();

  const defaultWeapon = ARMORY.find(a=>STARTING_WEAPONS.includes(a.key)) || ARMORY[0] || {};
  let currentKey = defaultWeapon.key || null;
  let currentStats = defaultWeapon.stats || null;
  let weaponModel = null;
  const ammo = new Map();
  ARMORY.forEach((a) => {
    const starter=STARTING_WEAPONS.includes(a.key);
    ammo.set(a.key, { mag: starter? a.stats.mag : 0, reserve: starter? a.stats.mag * 3 : 0 });
  });
    function weaponIconURL(key){ const svg=(b)=>'data:image/svg+xml;utf8,'+encodeURIComponent(b); const base=(body)=>`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 112 68'><rect width='112' height='68' rx='8' ry='8' fill='rgba(0,0,0,0.18)'/><g fill='none' stroke='#e6eefc' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'>${body}</g></svg>`; switch(key){ case 'Glock': return svg(base(`<path d='M14 32h58l8 8H14z'/><path d='M64 32v-8h20l8 10'/>`)); case 'Pistol': case 'Gun': return svg(base(`<path d='M12 34h62l10 8H12z'/>`)); case 'Uzi': case 'MP5': return svg(base(`<path d='M10 34h52l8 6H10z'/>`)); case 'AK47': case 'BattleRifle': case 'InfantryRifle': case 'WebaverseRifle': case 'Air908Rifle': return svg(base(`<path d='M8 38h88l8 6H8z'/>`)); case 'SniperAWP': return svg(base(`<path d='M8 34h90l8 6H8z'/><path d='M74 26h10'/>`)); case 'Grenade': return svg(base(`<circle cx='42' cy='36' r='12'/>`)); default: return svg(base(`<path d='M16 34h80'/>`)); } }
  function weaponPreviewURL(key){ return thumbCache.get(key) || weaponIconURL(key); }
  async function generateThumb(key){ try{ if(thumbCache.has(key)) return thumbCache.get(key); const size={w:224,h:136}; const rt=new THREE.WebGLRenderTarget(size.w,size.h); const sc=new THREE.Scene(); const cam=new THREE.PerspectiveCamera(40, size.w/size.h, 0.01, 10); const amb=new THREE.AmbientLight(0xffffff,0.9); const dir=new THREE.DirectionalLight(0xffffff,0.9); dir.position.set(2,3,2); sc.add(amb,dir); const model=await loadWeapon(key); const g=new THREE.Group(); if(model) g.add(model); normalizeAndCenter(g,0.9); g.rotation.y=Math.PI*0.85; sc.add(g); const prev=new THREE.Color(); renderer.getClearColor(prev); const prevA=renderer.getClearAlpha(); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000,0); cam.position.set(0.6,0.3,1.2); cam.lookAt(0,0,0); renderer.render(sc,cam); const px=new Uint8Array(size.w*size.h*4); renderer.readRenderTargetPixels(rt,0,0,size.w,size.h,px); const cv=document.createElement('canvas'); cv.width=size.w; cv.height=size.h; const ctx=cv.getContext('2d'); const img=ctx.createImageData(size.w,size.h); for(let y=0;y<size.h;y++){ const sy=size.h-1-y; img.data.set(px.subarray(sy*size.w*4, sy*size.w*4+size.w*4), y*size.w*4);} ctx.putImageData(img,0,0); const url=cv.toDataURL('image/png'); renderer.setRenderTarget(null); renderer.setClearColor(prev,prevA); rt.dispose(); thumbCache.set(key,url); return url; }catch(_){ return weaponIconURL(key); } }
  function enableDragScroll(el){ let isDown=false; let startX=0; let scrollLeft=0; let moved=false; el.addEventListener('pointerdown',(e)=>{ isDown=true; moved=false; startX=e.clientX; scrollLeft=el.scrollLeft; el.classList.add('dragging'); try{ el.setPointerCapture(e.pointerId); }catch(_){ } }); el.addEventListener('pointermove',(e)=>{ if(!isDown) return; const dx=e.clientX-startX; if(Math.abs(dx)>6) moved=true; el.scrollLeft=scrollLeft-dx; }); const stop=(e)=>{ if(isDown){ try{ el.releasePointerCapture(e.pointerId); }catch(_){ } } isDown=false; el.classList.remove('dragging'); }; el.addEventListener('pointerup',stop); el.addEventListener('pointercancel',stop); el.addEventListener('click',(e)=>{ if(moved){ e.preventDefault(); e.stopPropagation(); }}); }
  function availableArmory(){ return ARMORY.filter((a)=>unlockedWeapons.has(a.key)); }
  function getArmoryList(){ const list=availableArmory(); return list.length? list : []; }
  function unlockWeapon(key, grantAmmo=true){ const entry=ARMORY.find((a)=>a.key===key); if(!entry) return; const wasLocked=!unlockedWeapons.has(key); unlockedWeapons.add(key); const slot=ammo.get(key); if(slot && grantAmmo){ if(slot.mag===0 && slot.reserve===0){ slot.mag=entry.stats.mag; slot.reserve=entry.stats.mag*3; } else { slot.reserve=Math.min(slot.reserve + entry.stats.mag*2, entry.stats.mag*5); } }
    if(wasLocked){ buildGallery(); syncArmorySlider?.(); selectWeapon(key); }
    updateAmmoHUD?.();
  }
  syncArmorySlider=function(){
    if(!armoryDiv || !armorySlider) return;
    const list=getArmoryList();
    const maxScroll=Math.max(0, armoryDiv.scrollWidth - armoryDiv.clientWidth);
    const steps=Math.max(0, list.length-1);
    armorySlider.max=steps;
    armorySlider.disabled=steps<=0 || (!isMobile && maxScroll<=0);
    if(armorySlider.disabled){ armorySlider.value=0; setArmoryNavState(getCurrentWeaponIndex()); return; }
    const frac=maxScroll>0? Math.min(1, armoryDiv.scrollLeft / maxScroll):0;
    armorySlider.value=Math.round(frac*(steps||1));
    setArmoryNavState(getCurrentWeaponIndex());
  };
  function getCurrentWeaponIndex(){ const list=getArmoryList(); return Math.max(0, list.findIndex(a=>a.key===currentKey)); }
  function setArmoryNavState(idx){ const list=getArmoryList(); if(armoryPrev) armoryPrev.disabled=idx<=0; if(armoryNext) armoryNext.disabled=idx>=Math.max(0,list.length-1); }
  function setArmoryIndex(idx,{instant=false}={}){
    const list=getArmoryList();
    if(!list.length) return;
    const clamped=Math.max(0, Math.min(idx, list.length-1));
    const pick=list[clamped];
    if(!pick) return;
    const steps=Math.max(1, list.length-1);
    const maxScroll=Math.max(0, armoryDiv.scrollWidth - armoryDiv.clientWidth);
    const target=maxScroll*(steps>0? clamped/steps:0);
    armoryDiv.scrollTo({left:target, behavior:instant?'auto':'smooth'});
    if(armorySlider) armorySlider.value=clamped;
    setArmoryNavState(clamped);
    selectWeapon(pick.key);
  }
  function snapWeaponToScroll(){ const list=getArmoryList(); if(!list.length) return; const maxScroll=Math.max(1, armoryDiv.scrollWidth - armoryDiv.clientWidth); const frac=Math.min(1, armoryDiv.scrollLeft / maxScroll); const steps=Math.max(1, list.length-1); const idx=Math.min(list.length-1, Math.round(frac*steps)); setArmoryIndex(idx,{instant:true}); }
  function buildGallery(){ armoryDiv.innerHTML=''; const list=getArmoryList(); list.forEach((a)=>{ const b=document.createElement('button'); b.className='armBtn'; b.id='arm_'+a.key; b.innerHTML = `<img alt="${a.name}" src="${weaponPreviewURL(a.key)}"><span>${a.name}</span>`; b.addEventListener('click',()=>selectWeapon(a.key)); if(a.auto){ const t=document.createElement('button'); t.className='modeToggle'; t.textContent=(FIRE_MODES.get(a.key)==='auto')?'AUTO':'SINGLE'; t.addEventListener('click',(ev)=>{ ev.stopPropagation(); FIRE_MODES.set(a.key, FIRE_MODES.get(a.key)==='auto'?'single':'auto'); t.textContent=(FIRE_MODES.get(a.key)==='auto')?'AUTO':'SINGLE'; }); b.appendChild(t); } armoryDiv.appendChild(b); generateThumb(a.key).then(url=>{ const img=b.querySelector('img'); if(img) img.src=url; }); }); enableDragScroll(armoryDiv); syncArmorySlider(); }
  armoryDiv.addEventListener('scroll',()=>syncArmorySlider());
  armorySlider.addEventListener('input',(e)=>{ const steps=Math.max(1, getArmoryList().length-1); const idx=Math.max(0, Math.min(steps, Number(e.target.value||0))); setArmoryIndex(idx); });
  armorySlider.addEventListener('change', snapWeaponToScroll);
  armoryPrev?.addEventListener('click',()=>setArmoryIndex(getCurrentWeaponIndex()-1));
  armoryNext?.addEventListener('click',()=>setArmoryIndex(getCurrentWeaponIndex()+1));
  buildGallery();

    const ammoLabel=$('ammo');
    const weaponBadge=$('weaponName');
    function updateAmmoHUD(){ const a=ammo.get(currentKey); if(!currentKey||!a) return; const label=ARMORY.find(x=>x.key===currentKey)?.name||currentKey; if(ammoLabel) ammoLabel.textContent=`${label} — ${a.mag}/${a.reserve}`; if(weaponBadge) weaponBadge.textContent=`Weapon: ${label}`; document.querySelectorAll('.armBtn').forEach(el=>el.classList.remove('active')); const ab=$('arm_'+currentKey); if(ab) ab.classList.add('active'); }
  const MUZZLE_OFF={
    Glock:[0.0,-0.02,-0.74], Pistol:[0.0,-0.02,-0.74], Gun:[0.0,-0.02,-0.74],
    Uzi:[0.0,-0.03,-0.78], MP5:[0.0,-0.03,-0.78],
    AK47:[0.0,-0.04,-0.82], BattleRifle:[0.0,-0.04,-0.82], InfantryRifle:[0.0,-0.04,-0.82], WebaverseRifle:[0.0,-0.04,-0.82], Air908Rifle:[0.0,-0.04,-0.82],
    SniperAWP:[0.0,-0.05,-0.90],
    Grenade:[0,0,0]
  };
  const EJECT_OFF={
    Glock:[0.06,-0.05,-0.36], Pistol:[0.06,-0.05,-0.36], Gun:[0.06,-0.05,-0.36],
    Uzi:[0.06,-0.04,-0.40], MP5:[0.06,-0.04,-0.40],
    AK47:[0.09,-0.05,-0.44], BattleRifle:[0.09,-0.05,-0.44], InfantryRifle:[0.09,-0.05,-0.44], WebaverseRifle:[0.09,-0.05,-0.44], Air908Rifle:[0.09,-0.05,-0.44],
    SniperAWP:[0.085,-0.05,-0.48],
    Grenade:[0,0,0]
  };
  const SHELL_SPECS={
    Glock:{radius:0.006,length:0.14,color:0xd6b064},
    Pistol:{radius:0.006,length:0.14,color:0xd6b064},
    Gun:{radius:0.006,length:0.14,color:0xd6b064},
    Uzi:{radius:0.0055,length:0.13,color:0xd0a050},
    MP5:{radius:0.0058,length:0.14,color:0xd0a050},
    AK47:{radius:0.007,length:0.22,color:0xc58f3d},
    BattleRifle:{radius:0.007,length:0.22,color:0xc58f3d},
    InfantryRifle:{radius:0.0066,length:0.20,color:0xcfa443},
    WebaverseRifle:{radius:0.0066,length:0.20,color:0xcfa443},
    Air908Rifle:{radius:0.0066,length:0.21,color:0xc58f3d},
    SniperAWP:{radius:0.008,length:0.25,color:0xcfa443}
  };
  const BASE_HAND_OFFSET={pos:[0.2,-0.1,-0.5], rot:[-0.03,Math.PI,-0.12]};
  const HAND_OFFSETS={
    Glock:BASE_HAND_OFFSET,
    Pistol:BASE_HAND_OFFSET,
    Gun:BASE_HAND_OFFSET,
    Uzi:BASE_HAND_OFFSET,
    MP5:BASE_HAND_OFFSET,
    AK47:BASE_HAND_OFFSET,
    BattleRifle:BASE_HAND_OFFSET,
    InfantryRifle:BASE_HAND_OFFSET,
    WebaverseRifle:BASE_HAND_OFFSET,
    Air908Rifle:BASE_HAND_OFFSET,
    SniperAWP:BASE_HAND_OFFSET,
    Grenade:BASE_HAND_OFFSET
  };

  async function mountPlayerWeapon(key){ if(weaponModel){ weaponRoot.remove(weaponModel); weaponModel.traverse(o=>{ o.geometry?.dispose?.(); if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.()); else o.material?.dispose?.(); }); weaponModel=null; }
    const model=await loadWeapon(key); const g=new THREE.Group(); if(model) g.add(model);
    const hoff=HAND_OFFSETS[key]||HAND_OFFSETS.Pistol; g.position.set(hoff.pos[0], hoff.pos[1], hoff.pos[2]); g.rotation.set(hoff.rot[0], hoff.rot[1], hoff.rot[2]);
    weaponModel=g; weaponRoot.add(g);
    const muzzleAnchor=new THREE.Object3D(); const ejectAnchor=new THREE.Object3D(); weaponModel.add(muzzleAnchor); weaponModel.add(ejectAnchor);
    const mo=MUZZLE_OFF[key]||MUZZLE_OFF.Glock; const eo=EJECT_OFF[key]||EJECT_OFF.Glock; muzzleAnchor.position.set(mo[0],mo[1],mo[2]); ejectAnchor.position.set(eo[0],eo[1],eo[2]);
    weaponModel.userData.muzzleAnchor=muzzleAnchor; weaponModel.userData.ejectAnchor=ejectAnchor; }
  async function selectWeapon(key){ if(!unlockedWeapons.has(key)) return; currentKey=key; currentStats=ARMORY.find(a=>a.key===key)?.stats||currentStats; updateAmmoHUD(); await mountPlayerWeapon(key); updateZoomUI(); }
  await selectWeapon(currentKey);
  window.equipWeapon = selectWeapon;
  ensureGrenadeTemplate();

  const impactTargets=[city];
  const activeGrenades=[]; const explosionFX=[];
  const raycaster=new THREE.Raycaster(); const tracers=[]; function tracer(from,to,color=0xfff1b1,life=0.12){ const g=new THREE.BufferGeometry().setFromPoints([from,to]); const m=new THREE.LineBasicMaterial({color,transparent:true}); const l=new THREE.Line(g,m); l.userData.life=life; scene.add(l); tracers.push(l);} function updateTracers(dt){ for(let i=0;i<tracers.length;i++){ const l=tracers[i]; l.userData.life-=dt; l.material.opacity=Math.max(0,l.userData.life/0.12); if(l.userData.life<=0){ scene.remove(l); l.geometry.dispose(); l.material.dispose(); tracers.splice(i,1); i--; } } }
  const decalTex=(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.clearRect(0,0,64,64); x.fillStyle='rgba(0,0,0,0.9)'; x.beginPath(); x.arc(32,32,18,0,Math.PI*2); x.fill(); x.fillStyle='rgba(0,0,0,0.4)'; for(let i=0;i<10;i++){ const r=22+Math.random()*6; x.beginPath(); x.arc(32+(Math.random()-0.5)*6,32+(Math.random()-0.5)*6,r,0,Math.PI*2); x.fill(); } const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=2; return t; })();
  function addDecal(point, normal){ const s=0.22; const g=new THREE.PlaneGeometry(s,s); const m=new THREE.MeshBasicMaterial({ map:decalTex, transparent:true, depthWrite:false }); const q=new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0,0,1), normal.clone().normalize()); const mesh=new THREE.Mesh(g,m); mesh.position.copy(point); mesh.quaternion.copy(q); mesh.renderOrder=10; scene.add(mesh); setTimeout(()=>{ scene.remove(mesh); g.dispose(); m.dispose(); }, 15000); }
  const bloodTex=(function(){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.fillStyle='rgba(160,0,0,0.0)'; x.fillRect(0,0,64,64); x.fillStyle='rgba(210,20,20,0.9)'; x.beginPath(); x.arc(32,32,20,0,Math.PI*2); x.fill(); x.fillStyle='rgba(120,0,0,0.9)'; for(let i=0;i<5;i++){ x.beginPath(); x.arc(32+(Math.random()-0.5)*16,32+(Math.random()-0.5)*16,6+Math.random()*6,0,Math.PI*2); x.fill(); } const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  function addBlood(point, normal=new THREE.Vector3(0,1,0)){ const s=0.42; const g=new THREE.PlaneGeometry(s,s); const m=new THREE.MeshBasicMaterial({ map:bloodTex, transparent:true, depthWrite:false }); const mesh=new THREE.Mesh(g,m); const dir=normal.clone().normalize(); const quat=new THREE.Quaternion(); quat.setFromUnitVectors(new THREE.Vector3(0,0,1), dir); mesh.quaternion.copy(quat); mesh.rotateZ(Math.random()*Math.PI*2); mesh.position.copy(point).addScaledVector(dir,0.02); scene.add(mesh); }

  const pickupGeo=new THREE.CapsuleGeometry(0.18,0.24,8,14);
  const pickupMat=new THREE.MeshStandardMaterial({ color:0x2ecc71, emissive:0x1b5e20, emissiveIntensity:0.6, metalness:0.35, roughness:0.35 });
  function makePickupLabel(key){ const g=new THREE.SpriteMaterial({ color:0xffffff }); const s=new THREE.Sprite(g); s.scale.set(0.8,0.25,1); const tex=document.createElement('canvas'); tex.width=256; tex.height=64; const x=tex.getContext('2d'); x.fillStyle='rgba(0,0,0,0.65)'; x.fillRect(0,0,256,64); x.fillStyle='#8bd3ff'; x.font='bold 26px sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(key,128,32); const t=new THREE.CanvasTexture(tex); t.colorSpace=THREE.SRGBColorSpace; g.map=t; return s; }
  function spawnWeaponPickupAt(pos,key,highlight=false){ const mesh=new THREE.Mesh(pickupGeo, pickupMat.clone()); mesh.material.emissiveIntensity=highlight?0.9:0.6; mesh.position.copy(pos); mesh.position.y=Math.max(ROAD_SURFACE_Y+0.08, mesh.position.y); mesh.userData.weaponKey=key; mesh.userData.spin=0.9+Math.random()*0.6; const label=makePickupLabel(key); label.position.set(0,0.6,0); mesh.add(label); scene.add(mesh); weaponPickups.push(mesh); }
  function randomCityPoint(){ const margin=ROAD*0.75; const x=(Math.random()-0.5)*2*(cityHalfX-margin); const z=(Math.random()-0.5)*2*(cityHalfZ-margin); return new THREE.Vector3(x, ROAD_SURFACE_Y+0.08, z); }
  function shuffled(arr){ const copy=[...arr]; for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; } return copy; }
  function weaponPool(){ return ARMORY.filter((a)=>!STARTING_WEAPONS.includes(a.key)); }
  function roofPickupSpots(){
    const spots=[];
    buildings.forEach((b)=>{
      const roofY=b.h + 0.32;
      const count = b.h>36 ? 2 : 1;
      for(let i=0;i<count;i++){
        const offX=(Math.random()-0.5)*b.w*0.42;
        const offZ=(Math.random()-0.5)*b.d*0.42;
        spots.push(new THREE.Vector3(b.cx+offX, roofY, b.cz+offZ));
      }
    });
    return spots;
  }
  function parkPickupSpots(){
    const spots=[];
    mapParks.forEach((p)=>{
      const drops=Math.max(1, Math.round((p.w*p.d)/1400));
      for(let i=0;i<drops;i++){
        const px=p.x + (Math.random()-0.5)*p.w*0.5;
        const pz=p.z + (Math.random()-0.5)*p.d*0.5;
        spots.push(new THREE.Vector3(px, ROAD_SURFACE_Y+0.08, pz));
      }
    });
    return spots;
  }
  function scatterCityPickups(){
    const pool=weaponPool();
    if(pool.length===0) return;
    const keys=shuffled(pool.map((a)=>a.key));
    let idx=0; const nextKey=()=>keys[idx++ % keys.length];
    roofPickupSpots().forEach((pos)=>{ spawnWeaponPickupAt(pos, nextKey(), true); });
    parkPickupSpots().forEach((pos)=>{ spawnWeaponPickupAt(pos, nextKey()); });
    const extraDrops=Math.max(pool.length, 12);
    for(let i=0;i<extraDrops;i++){ spawnWeaponPickupAt(randomCityPoint(), nextKey()); }
  }
  function collectWeaponPickup(mesh){ if(!mesh) return; const key=mesh.userData?.weaponKey; scene.remove(mesh); mesh.geometry?.dispose?.(); mesh.material?.dispose?.(); mesh.children.forEach((c)=>{ if(c.material?.map){ c.material.map.dispose?.(); } c.material?.dispose?.(); }); const idx=weaponPickups.indexOf(mesh); if(idx>=0) weaponPickups.splice(idx,1); if(key) unlockWeapon(key); }

  let reloading=false; function reload(){ const a=ammo.get(currentKey); const st=currentStats; if(reloading || !a) return; const need=st.mag-a.mag; if(need<=0||a.reserve<=0) return; const take=Math.min(need,a.reserve); reloading=true; setTimeout(()=>{ a.mag+=take; a.reserve-=take; reloading=false; updateAmmoHUD(); sfxReload(); }, st.reload*1000); }

  function sfxGrenadeThrow(){ burstNoise({dur:0.12,freq:900,gain:0.1}); click({freq:520,dur:0.06,gain:0.04}); }
  function sfxExplosion(){ burstNoise({dur:0.65,freq:220,gain:0.28}); setTimeout(()=>burstNoise({dur:0.35,freq:320,gain:0.18}),110); }

  function throwGrenade(){ if(!grenadeProjectileTemplate && !grenadeProjectileLoading){ ensureGrenadeTemplate(); }
    const spawn=camera.position.clone(); const dir=new THREE.Vector3(); camera.getWorldDirection(dir); const aimDir=dir.clone().normalize(); const start=spawn.clone().add(aimDir.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0,-0.05,0));
    const mesh=buildGrenadeMesh(); mesh.position.copy(start); scene.add(mesh);
    const body=new CANNON.Body({ mass:1.1, shape:new CANNON.Sphere(0.18), material:matPlayer, linearDamping:0.02, angularDamping:0.1 });
    body.position.set(start.x,start.y,start.z);
    const vel=aimDir.multiplyScalar(15.8); vel.y += 5.6; body.velocity.set(vel.x, vel.y, vel.z);
    body.angularVelocity.set((Math.random()-0.5)*6,(Math.random()-0.5)*6,(Math.random()-0.5)*6);
    world.addBody(body);
    activeGrenades.push({mesh, body, fuse:2.6});
    sfxGrenadeThrow(); }

  function createExplosionFX(pos){ const core=new THREE.Mesh(new THREE.SphereGeometry(0.6,24,16), new THREE.MeshBasicMaterial({ color:0xffc857, transparent:true, opacity:0.98 })); core.position.copy(pos); scene.add(core); const ring=new THREE.Mesh(new THREE.RingGeometry(0.3,0.35,48), new THREE.MeshBasicMaterial({ color:0xff9f1c, transparent:true, opacity:0.9, side:THREE.DoubleSide })); ring.rotation.x=-Math.PI/2; ring.position.set(pos.x,0.04,pos.z); scene.add(ring); const flash=new THREE.PointLight(0xffd27a, 18, 52); flash.position.set(pos.x, pos.y+2.4, pos.z); scene.add(flash);
    const smoke=new THREE.Sprite(new THREE.SpriteMaterial({ map:smokeTex, transparent:true, opacity:0.82, depthWrite:false })); smoke.position.copy(pos).setY(pos.y+1.4); smoke.scale.set(5.6,5.6,1); scene.add(smoke);
    const shards=[]; const shardGeo=new THREE.ConeGeometry(0.12,0.52,12); const shardMat=new THREE.MeshStandardMaterial({ color:0xffa94d, emissive:0xff922b, emissiveIntensity:0.8, roughness:0.55, metalness:0.2, transparent:true, opacity:0.95 });
    for(let i=0;i<22;i++){ const shard=new THREE.Mesh(shardGeo, shardMat.clone()); shard.position.copy(pos); shard.castShadow=allowShadows; shard.receiveShadow=allowShadows; const dir=new THREE.Vector3((Math.random()*2-1),(Math.random()*1.2+0.2),(Math.random()*2-1)).normalize(); const speed=6.5+Math.random()*5.5; shards.push({mesh:shard, velocity:dir.multiplyScalar(speed), spin:new THREE.Vector3((Math.random()-0.5)*6,(Math.random()-0.5)*6,(Math.random()-0.5)*6)}); scene.add(shard); }
    const scorch=new THREE.Mesh(new THREE.CircleGeometry(1.8,28), new THREE.MeshBasicMaterial({ map:scorchTex, transparent:true, opacity:0.85, depthWrite:false })); scorch.rotation.x=-Math.PI/2; scorch.position.set(pos.x,0.025,pos.z); scorch.rotation.z=Math.random()*Math.PI*2; scene.add(scorch); setTimeout(()=>{ scene.remove(scorch); scorch.geometry.dispose(); scorch.material.dispose(); }, 20000);
    explosionFX.push({core, ring, light:flash, smoke, shards, life:1.2, maxLife:1.2}); }

  function applyExplosionDamage(center,radius,power){ enemies.forEach((enemy)=>{ if(enemy.dead) return; const dx=enemy.body.position.x-center.x; const dz=enemy.body.position.z-center.z; const dy=enemy.body.position.y-center.y; const dist=Math.sqrt(dx*dx + dy*dy + dz*dz); if(dist<radius){ const impact=(1 - dist/radius); const hitPoint=new THREE.Vector3(enemy.body.position.x, enemy.body.position.y+1.2, enemy.body.position.z); woundEnemy(enemy, power*impact, 0.35, hitPoint, new THREE.Vector3(0,1,0)); if(!enemy.dead){ enemy.body.velocity.x += (dx/dist||0)*impact*6; enemy.body.velocity.z += (dz/dist||0)*impact*6; } } }); const pdx=player.position.x-center.x; const pdz=player.position.z-center.z; const pdist=Math.hypot(pdx,pdz); if(pdist<radius*0.9){ const hurt=Math.max(6, power*0.35*(1 - pdist/(radius*0.9))); hurtPlayer(hurt); if(pdist>0.1){ player.velocity.x += (pdx/pdist)*3; player.velocity.z += (pdz/pdist)*3; } }
    for(const car of trafficCars){ const dx=car.mesh.position.x-center.x; const dz=car.mesh.position.z-center.z; const dist=Math.hypot(dx,dz); if(dist<radius*1.3){ const push=(1-dist/(radius*1.3))*8; const dirX=(dx/dist)||0, dirZ=(dz/dist)||0; let newX=car.mesh.position.x + dirX*push; let newZ=car.mesh.position.z + dirZ*push; const ang=Math.atan2(newZ,newX); const clampR=Math.max(ringR-4, Math.min(ringR+4, Math.hypot(newX,newZ))); newX=Math.cos(ang)*clampR; newZ=Math.sin(ang)*clampR; car.mesh.position.set(newX,0,newZ); car.angle=ang; } }
  }

  function explodeGrenade(grenade){ if(grenade.exploded) return; grenade.exploded=true; const pos=new THREE.Vector3(grenade.body.position.x, grenade.body.position.y, grenade.body.position.z); world.removeBody(grenade.body); if(grenade.mesh){ scene.remove(grenade.mesh); grenade.mesh.traverse?.((child)=>{ if(child.isMesh){ child.geometry?.dispose?.(); if(Array.isArray(child.material)){ child.material.forEach((m)=>m?.dispose?.()); } else { child.material?.dispose?.(); } } }); } createExplosionFX(pos); applyExplosionDamage(pos, 12, 160); dispatchEmergency(pos); sfxExplosion(); }

  function fireRay(off2){ const target=off2? off2.clone() : aimPoint.clone(); target.x=Math.max(-1, Math.min(1, target.x)); target.y=Math.max(-1, Math.min(1, target.y)); raycaster.setFromCamera(target, camera); const from=camera.position.clone(); const to=raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 8000); const pos = aimGeo.attributes.position; pos.setXYZ(0, from.x, from.y, from.z); pos.setXYZ(1, to.x, to.y, to.z); pos.needsUpdate=true; const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); const hit = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, hit); if(hit){ aimDot.position.copy(hit); } else { aimDot.position.copy(to); } return {from,to}; }

  function makeShellInstance(key){
    const spec=SHELL_SPECS[key]||SHELL_SPECS.Glock;
    if(!spec) return null;
    const group=new THREE.Group();
    const materials=new Set();
    const parts=[];
    const brass=new THREE.MeshStandardMaterial({ color:spec.color, metalness:0.65, roughness:0.38 });
    materials.add(brass);
    const bodyLen=spec.length*0.7;
    const neckLen=spec.length*0.2;
    const rimLen=spec.length*0.1;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(spec.radius, spec.radius*0.95, bodyLen, 14), brass);
    body.rotation.z=Math.PI/2;
    parts.push(body);
    const neckMat=brass.clone(); materials.add(neckMat);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(spec.radius*0.72, spec.radius*0.9, neckLen, 14), neckMat);
    neck.rotation.z=Math.PI/2; neck.position.x=bodyLen*0.5 + neckLen*0.5;
    parts.push(neck);
    const rimMat=brass.clone(); materials.add(rimMat);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(spec.radius*1.12, spec.radius*1.02, rimLen, 14), rimMat);
    rim.rotation.z=Math.PI/2; rim.position.x=-(bodyLen*0.5 + rimLen*0.5);
    parts.push(rim);
    parts.forEach(p=>group.add(p));
    group.userData.dispose=()=>{
      parts.forEach(p=>p.geometry.dispose());
      materials.forEach(m=>m.dispose?.());
    };
    group.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    return group;
  }
    function ejection(anc,key){
      if(!anc) return;
      const shell=makeShellInstance(key);
      if(!shell) return;
      const wp=new THREE.Vector3(); anc.getWorldPosition(wp);
      shell.position.copy(wp);
      scene.add(shell);
      const type=WEAPON_TYPES[key]||'pistol';
      const power = type==='rifle'||type==='sniper'?1.25: type==='smg'?1.1:1.0;
      const v=new THREE.Vector3((Math.random()*0.22+0.12)*power, (Math.random()*0.34+0.14), (Math.random()*0.24-0.12));
      const spin=new THREE.Vector3((Math.random()*0.2+0.04)*power, (Math.random()*0.18+0.06), (Math.random()*0.2+0.04));
    const t0=performance.now();
    const id=setInterval(()=>{
      const t=(performance.now()-t0)/1000;
      shell.position.x += v.x;
      shell.position.y += v.y - 9.81*0.5*t*t*0.045;
      shell.position.z += v.z;
      shell.rotation.x += spin.x;
      shell.rotation.y += spin.y;
      shell.rotation.z += spin.z;
      v.y -= 0.018;
      if(t>1.2){
        clearInterval(id);
        scene.remove(shell);
        shell.userData.dispose?.();
      }
    },16);
  }

  function doShot(){ const st=currentStats; if(!st) return; const a=ammo.get(currentKey); if(!a||a.mag<=0){ return; }
    if(currentKey==='Grenade'){
      a.mag--;
      if(a.reserve>0) a.reserve--;
      updateAmmoHUD();
      throwGrenade();
      return;
    }
    muzzleLight.intensity=1.6; setTimeout(()=>muzzleLight.intensity=0,45); sfxGun(currentKey);
    const spread=st.spread; const off=new THREE.Vector2((Math.random()-0.5)*spread*2,(Math.random()-0.5)*spread*2); const {from,to}=fireRay(aimPoint.clone().add(off));
    tracer(from,to,0xfff1b1);
    const hits = raycaster.intersectObjects(impactTargets, true).filter(h=>h.object!==weaponModel && h.object !== aimLine);
    if(hits.length){ const h=hits[0]; const normal = h.face?.normal?.clone()?.transformDirection(h.object.matrixWorld)||new THREE.Vector3(0,0,1); addDecal(h.point, normal); }
    const hitsEnemy = raycaster.intersectObjects(enemyRoots(), true);
    if(hitsEnemy.length){ const h=hitsEnemy[0]; const root=(function find(o){ let p=o; while(p && !p.userData?.enemy){ p=p.parent; } return p; })(h.object); const e=enemies.get(root.uuid); if(e && !e.dead){ const hitNormal=h.face?.normal?.clone()?.transformDirection(h.object.matrixWorld)||new THREE.Vector3(0,1,0); const relY=h.point.y - e.body.position.y; const isHead=relY>1.35; const dmg=isHead? e.hp: st.dmg*1.1; if(isHead){ addBlood(h.point.clone(), hitNormal); knockDownEnemy(e, h.point, hitNormal); e.hp=0; } else { woundEnemy(e, dmg, 0.45, h.point, hitNormal); } } }
    if(weaponModel?.userData?.ejectAnchor && currentKey!=='Grenade'){ ejection(weaponModel.userData.ejectAnchor, currentKey); }
    a.mag--; updateAmmoHUD();
  }

  const audio={ ctx:null, muted:false };
  function ac(){ if(audio.muted) return null; try{ audio.ctx = audio.ctx || new (window.AudioContext||window.webkitAudioContext)(); return audio.ctx; }catch(_){ return null; } }
  function onMouseDownAudio(){ try{ ac()?.resume?.(); }catch(_){} }
  function withAC(fn){ const ctx=ac(); if(!ctx) return; return fn(ctx); }
  const GUN_PROFILES={
    pistol:{ envelope:[1,0.82,0.58,0.35,0.2,0.12,0.08,0.05,0.03,0.015], color:1900, body:320, tail:0.65, gain:0.9, cacheKey:'pistol'},
    smg:{ envelope:[1,0.78,0.55,0.32,0.18,0.1,0.05,0.03], color:2100, body:360, tail:0.5, gain:0.85, cacheKey:'smg'},
    rifle:{ envelope:[1,0.86,0.7,0.46,0.28,0.16,0.08,0.04,0.02], color:1500, body:240, tail:0.8, gain:1.0, cacheKey:'rifle'},
    sniper:{ envelope:[1,0.9,0.76,0.5,0.32,0.18,0.1,0.05,0.03], color:1100, body:180, tail:1.0, gain:1.05, cacheKey:'sniper'}
  };
  const shotCache=new Map();
  function profileForWeapon(key){ const type=WEAPON_TYPES[key]||'pistol'; if(type==='smg') return GUN_PROFILES.smg; if(type==='rifle') return GUN_PROFILES.rifle; if(type==='sniper') return GUN_PROFILES.sniper; return GUN_PROFILES.pistol; }
  function buildGunLayer(ctx, profile){ const duration=profile.tail; const len=Math.max(1, Math.floor(ctx.sampleRate*duration)); const env=profile.envelope; const buffer=ctx.createBuffer(1,len,ctx.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<len;i++){ const t=i/(len-1); const scaled=t*(env.length-1); const idx=Math.floor(scaled); const frac=scaled-idx; const a=env[idx]??env[env.length-1]; const b=env[idx+1]??a; const shaped=(a+(b-a)*frac)*Math.exp(-t*3.2); data[i]=(Math.random()*2-1)*shaped; } return buffer; }
  function playShot(kind){ const profile=profileForWeapon(kind); withAC((ctx)=>{ const cacheKey=profile.cacheKey; let layer=shotCache.get(cacheKey); if(!layer){ layer=buildGunLayer(ctx, profile); shotCache.set(cacheKey, layer); }
      const noise=ctx.createBufferSource(); noise.buffer=layer; const band=ctx.createBiquadFilter(); band.type='bandpass'; band.Q.value=1.1; band.frequency.value=profile.color; const body=ctx.createOscillator(); body.type='triangle'; body.frequency.value=profile.body; const bodyGain=ctx.createGain(); bodyGain.gain.setValueAtTime(0, ctx.currentTime); bodyGain.gain.linearRampToValueAtTime(profile.gain*0.35, ctx.currentTime+0.012); bodyGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+profile.tail);
      const out=ctx.createGain(); out.gain.value=profile.gain; const air=ctx.createBiquadFilter(); air.type='highshelf'; air.frequency.value=4200; air.gain.value=-3; const echo=ctx.createDelay(); echo.delayTime.value=0.08; const echoGain=ctx.createGain(); echoGain.gain.value=0.2; noise.connect(band); band.connect(out); body.connect(bodyGain); bodyGain.connect(out); out.connect(air); air.connect(ctx.destination); out.connect(echo); echo.connect(echoGain); echoGain.connect(out); noise.start(); noise.stop(ctx.currentTime+profile.tail); body.start(); body.stop(ctx.currentTime+profile.tail); }); }
  function sfxGun(kind){ playShot(kind); }
  function sfxReload(){ withAC((ctx)=>{ const steps=[0,0.14,0.3]; steps.forEach((t,i)=>{ const osc=ctx.createOscillator(); osc.type='square'; osc.frequency.value=260 + i*120; const g=ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime+t); g.gain.linearRampToValueAtTime(0.26, ctx.currentTime+t+0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+t+0.18); osc.connect(g); g.connect(ctx.destination); osc.start(ctx.currentTime+t); osc.stop(ctx.currentTime+t+0.22); }); }); }
  $('muteBtn').addEventListener('click',(e)=>{ audio.muted=!audio.muted; e.target.textContent=audio.muted?'🔇':'🔊'; });

  const keys=new Set(); addEventListener('keydown',e=>{ keys.add(e.code); if(e.code==='Space'){ if(driveState.active){ driveInput.throttle=1; } else { doShot(); } } if(e.code==='KeyR'){ if(driveState.active){ driveInput.brake=1; } else { reload(); } } if(e.code==='ArrowRight'){ e.preventDefault(); setArmoryIndex(getCurrentWeaponIndex()+1); } if(e.code==='ArrowLeft'){ e.preventDefault(); setArmoryIndex(getCurrentWeaponIndex()-1); } }); addEventListener('keyup',e=>{ if(e.code==='Space' && driveState.active){ driveInput.throttle=0; } if(e.code==='KeyR' && driveState.active){ driveInput.brake=0; } keys.delete(e.code); });
  const joyMove=$('joyMove'), knobMove=joyMove.querySelector('.knob');
  const R=150, K=85, DEAD=0.16;
  const mv={active:false,id:null,vx:0,vz:0, tapStart:0, moved:false, dx:0, dy:0};
  function centerOf(el){ const r=el.getBoundingClientRect(); return { cx:r.left + r.width/2, cy:r.top + r.height/2 }; }
  joyMove.addEventListener('touchstart',e=>{ if(mv.active) return; const t=e.changedTouches[0]; mv.active=true; mv.id=t.identifier; mv.tapStart=performance.now(); mv.moved=false; e.preventDefault(); },{passive:false});
    joyMove.addEventListener('touchmove', e=>{ for(const t of e.changedTouches){ if(mv.active&&t.identifier===mv.id){ const {cx,cy}=centerOf(joyMove); let dx=t.clientX-cx, dy=t.clientY-cy; const len=Math.hypot(dx,dy)||1; const nlen=Math.min(len/R,1); mv.moved = mv.moved || (nlen>DEAD*1.2); const nz=nlen<DEAD?0:(nlen-DEAD)/(1-DEAD); const scale = nz/(nlen||1); dx*=scale; dy*=scale; if(nlen>1){ dx/=nlen; dy/=nlen; } knobMove.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; mv.vx = -dx/K; mv.vz = -dy/K; mv.dx=mv.vx; mv.dy=mv.vz; } } e.preventDefault(); },{passive:false});
  function mvEnd(){ knobMove.style.transform='translate(-50%,-50%)'; const tap=(performance.now()-mv.tapStart)<220 && !mv.moved; mv.active=false; mv.vx=0; mv.vz=0; mv.dx=0; mv.dy=0; if(tap) jump(); }
  joyMove.addEventListener('touchend', mvEnd, {passive:false}); joyMove.addEventListener('touchcancel', mvEnd, {passive:false});
  joyMove.addEventListener('pointerdown', (e)=>{ if(mv.active) return; mv.active=true; mv.id=e.pointerId; mv.tapStart=performance.now(); mv.moved=false; const r=joyMove.getBoundingClientRect(); mv.cx=r.left+r.width/2; mv.cy=r.top+r.height/2; try{ joyMove.setPointerCapture(e.pointerId); }catch(_){ } e.preventDefault(); });
    joyMove.addEventListener('pointermove', (e)=>{ if(!mv.active||e.pointerId!==mv.id) return; let dx=e.clientX-mv.cx, dy=e.clientY-mv.cy; const len=Math.hypot(dx,dy)||1; const nlen=Math.min(len/R,1); if(!mv.moved && nlen>DEAD*1.2) mv.moved=true; const nz=nlen<DEAD?0:(nlen-DEAD)/(1-DEAD); const scale=nz/(nlen||1); dx*=scale; dy*=scale; if(nlen>1){ dx/=nlen; dy/=nlen; } knobMove.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; mv.vx = -dx/K; mv.vz = -dy/K; mv.dx=mv.vx; mv.dy=mv.vz; e.preventDefault(); });
  function mvRelease(e){ if(!mv.active||e.pointerId!==mv.id) return; mvEnd(); try{ joyMove.releasePointerCapture(e.pointerId); }catch(_){ } e.preventDefault(); }
  joyMove.addEventListener('pointerup', mvRelease); joyMove.addEventListener('pointercancel', mvRelease);

  const shootPad=$('shootPad');
  const reloadBtn=$('reloadMini');
  const controlLabels={ shoot: shootPad?.textContent||'Shoot', reload: reloadBtn?.textContent||'Reload' };
  const driveInput={ throttle:0, brake:0 };
  let fireHeld=false;
  function shootDown(){ if(driveState.active){ driveInput.throttle=1; return; } if(FIRE_MODES.get(currentKey)==='auto'){ fireHeld=true; } else { doShot(); } }
  function shootUp(){ fireHeld=false; if(driveState.active){ driveInput.throttle=0; } }
  function brakeDown(){ if(driveState.active){ driveInput.brake=1; return; } reload(); }
  function brakeUp(){ if(driveState.active){ driveInput.brake=0; } }
  function setDrivePedals(){ if(!shootPad||!reloadBtn) return; if(driveState.active){ shootPad.textContent='Accelerate'; reloadBtn.textContent='Brake'; } else { shootPad.textContent=controlLabels.shoot; reloadBtn.textContent=controlLabels.reload; driveInput.throttle=0; driveInput.brake=0; } }
  shootPad.addEventListener('pointerdown', (e)=>{ if(inputMode!=='A') return; shootDown(); e.preventDefault(); });
  shootPad.addEventListener('pointerup', (e)=>{ if(inputMode!=='A') return; shootUp(); e.preventDefault(); });
  shootPad.addEventListener('pointercancel', (e)=>{ if(inputMode!=='A') return; shootUp(); e.preventDefault(); });
  shootPad.addEventListener('touchstart', (e)=>{ if(inputMode!=='A') return; shootDown(); e.preventDefault(); }, {passive:false});
  shootPad.addEventListener('touchend', (e)=>{ if(inputMode!=='A') return; shootUp(); e.preventDefault(); }, {passive:false});
  reloadBtn?.addEventListener('pointerdown', (e)=>{ if(inputMode!=='A') return; brakeDown(); e.preventDefault(); });
  reloadBtn?.addEventListener('pointerup', (e)=>{ if(inputMode!=='A') return; brakeUp(); e.preventDefault(); });
  reloadBtn?.addEventListener('pointercancel', (e)=>{ if(inputMode!=='A') return; brakeUp(); e.preventDefault(); });


  const canvasEl=renderer.domElement; canvasEl.style.touchAction='none';
  const look={active:false,id:null,lastX:0,lastY:0};
  let lookAccumX=0, lookAccumY=0; let aimSmoothX=0, aimSmoothY=0;
  const LOOK_SENS_A  = isMobile ? 0.22 : 0.18;
  const AIM_RATE_A   = 1.05;
  const AIM_SMOOTH_A = 4.6;
  function pointerToNDC(e){ const rect=canvasEl.getBoundingClientRect(); return { x: ((e.clientX-rect.left)/rect.width)*2-1, y: -((e.clientY-rect.top)/rect.height)*2+1 }; }
  function findPickup(hit){ let obj=hit?.object||null; while(obj && !obj.userData?.weaponKey && obj.parent){ obj=obj.parent; } return (obj&&obj.userData?.weaponKey)? obj : null; }
  function tryPickupByClick(e){ if(isUIBlock(e.target)) return false; const ndc=pointerToNDC(e); raycaster.setFromCamera(ndc, camera); const pickup=raycaster.intersectObjects(weaponPickups,true).map(findPickup).find(Boolean); if(!pickup) return false; const dist=Math.hypot(pickup.position.x-player.position.x, pickup.position.z-player.position.z); if(dist>6) return false; collectWeaponPickup(pickup); return true; }
  function setAimFromEvent(e){ if(isUIBlock(e.target)) return; aimPoint.set(0,0); updateCrosshairScreen(); }
  function isUIBlock(el){ return el.closest('#joyMove')||el.closest('#shootPad')||el.closest('#armory')||el.closest('#reloadMini')||el.closest('#climbBtn')||el.closest('#driveBtn')||el.closest('#zoomBox'); }
  canvasEl.addEventListener('pointerdown',(e)=>{ if(inputMode!=='A') return; if(isUIBlock(e.target)) return; if(tryPickupByClick(e)){ e.preventDefault(); return; } setAimFromEvent(e); if(look.active) return; look.active=true; look.id=e.pointerId; look.lastX=e.clientX; look.lastY=e.clientY; try{ canvasEl.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); });
  canvasEl.addEventListener('pointermove',(e)=>{ if(inputMode!=='A') return; setAimFromEvent(e); if(!look.active||e.pointerId!==look.id) return; const dx=e.clientX-look.lastX; const dy=e.clientY-look.lastY; look.lastX=e.clientX; look.lastY=e.clientY; lookAccumX += dx; lookAccumY += dy; e.preventDefault(); });
  function lookRelease(e){ if(inputMode!=='A') return; if(!look.active||e.pointerId!==look.id) return; look.active=false; try{ canvasEl.releasePointerCapture(e.pointerId); }catch(_){} e.preventDefault(); }
  canvasEl.addEventListener('pointerup', lookRelease); canvasEl.addEventListener('pointercancel', lookRelease);

  let hp=100; function updateHealth(){ const f=$('healthfill'); f.style.width=Math.max(0,hp)+'%'; f.style.background = hp>60? 'linear-gradient(90deg,#29ff9a,#00c876)': hp>30? 'linear-gradient(90deg,#ffd966,#ff9f1a)' : 'linear-gradient(90deg,#ff6b6b,#ff2e2e)'; }
  updateHealth();
  function hurtPlayer(amount){ hp=Math.max(0, hp-amount); updateHealth(); }

  /* Vehicles (GLTF fleet) */
  const URLS = {
    Sedan: [
      'https://assets.babylonjs.com/meshes/car.glb',
      'https://raw.githubusercontent.com/BabylonJS/Assets/master/meshes/car.glb'
    ],
    CarConcept: [
      'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CarConcept/glTF-Binary/CarConcept.glb',
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb'
    ],
    MilkTruck: [
      'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb'
    ],
    FireTruck: [
      'https://raw.githubusercontent.com/Kenney-CCO/Kenney-CCO.glb/main/firetruck.glb',
      'https://cdn.jsdelivr.net/gh/Kenney-CCO/Kenney-CCO.glb@main/firetruck.glb',
      'https://raw.githubusercontent.com/MonuYadav05/Astrikos-gc-project/main/public/FireTruck.glb'
    ],
    Bus: [
      'https://raw.githubusercontent.com/jade0815/my-3d-bus-models/main/Bus.glb',
      'https://raw.githubusercontent.com/IHyeonii/PythonStudy/main/free_school_bus_-_low_poly.glb',
      'https://raw.githubusercontent.com/haelimk/project/8c50930d7f283f345c46a0dcdf2a984286c3b4c0/bus.glb'
    ],
    Motorcycle: [
      'https://raw.githubusercontent.com/shosuz-evangelist/3dObjects4Apps/main/Motorcycle.glb',
      'https://raw.githubusercontent.com/jade12855/3D_model/main/Motorcycle.glb'
    ]
  };

  function makeLabel(text, scale=1){ const cnv=document.createElement('canvas'); const ctx=cnv.getContext('2d'); const pad=28, fs=64, font=`${fs}px system-ui,Arial`; ctx.font=font; const w=Math.ceil(ctx.measureText(text).width); cnv.width=w+pad*2; cnv.height=fs+pad*2; ctx.font=font; ctx.fillStyle='#111827'; ctx.fillRect(0,0,cnv.width,cnv.height); ctx.strokeStyle='#1f2937'; ctx.lineWidth=4; ctx.strokeRect(2,2,cnv.width-4,cnv.height-4); ctx.fillStyle='#e5e7eb'; ctx.textBaseline='top'; ctx.fillText(text,pad,pad); const tex=new THREE.CanvasTexture(cnv); tex.colorSpace=THREE.SRGBColorSpace; const mat=new THREE.MeshBasicMaterial({ map:tex, transparent:true }); return new THREE.Mesh(new THREE.PlaneGeometry(cnv.width/240*scale, cnv.height/240*scale), mat); }
  function centerXZ(root){ const box=new THREE.Box3().setFromObject(root); const c=new THREE.Vector3(); box.getCenter(c); root.position.x -= c.x; root.position.z -= c.z; }
  function placeOnGround(root,y=0){ const box=new THREE.Box3().setFromObject(root); const dy=y - box.min.y; root.position.y += dy; }
  function scaleToLength(root, L){ const box=new THREE.Box3().setFromObject(root); const size=new THREE.Vector3(); box.getSize(size); const len=Math.max(size.x,size.z)||1; const s=L/len; root.scale.multiplyScalar(s); root.updateMatrixWorld(true); }
  function stripGroundMeshes(root){ const rootBox=new THREE.Box3().setFromObject(root); const rootSize=new THREE.Vector3(); rootBox.getSize(rootSize); const rootArea=rootSize.x*rootSize.z; const rm=[]; root.traverse(o=>{ if(!o.isMesh) return; const b=new THREE.Box3().setFromObject(o); const sz=new THREE.Vector3(); b.getSize(sz); const area=sz.x*sz.z; const flat=sz.y/Math.max(0.0001, Math.max(sz.x,sz.z)); const nearBottom=(b.min.y-rootBox.min.y)<=Math.max(0.05, rootSize.y*0.06); const byName=/ground|plane|cloth|board|shadow|table|grid|floor/i.test(o.name||'')||/shadow/i.test(o.material?.name||''); if(nearBottom && area>=rootArea*0.18 && (flat<0.12 || byName)){ rm.push(o); } }); for(const m of rm){ m.parent?.remove(m);} root.updateMatrixWorld(true); }

  const vehicleCache=new Map();
  async function robustLoad(urls, timeoutMs=FAST_BOOT?3200:7000){
    let lastErr=null;
    for(const u of urls){
      try{
        const gltf=await withTimeout(gltfLoader.loadAsync(u), timeoutMs);
        return gltf;
      }catch(err){
        lastErr=err;
      }
    }
    throw lastErr || new Error('load fail');
  }
  async function getVehicle(key){
    const normalized=key?.toLowerCase?.()||key;
    if(vehicleCache.has(normalized)) return vehicleCache.get(normalized);
    window.__phase=`vehicle:${normalized}`;
    let urls=[];
    if(normalized==='ambulance'||normalized==='police') urls=URLS.MilkTruck;
    else if(normalized==='fire'||normalized==='firetruck') urls=URLS.FireTruck;
    else if(normalized==='bus') urls=URLS.Bus;
    else if(normalized==='motorcycle'||normalized==='moto'||normalized==='bike') urls=URLS.Motorcycle;
    else if(normalized==='sedan'||normalized==='car') urls=URLS.Sedan;
    else urls=URLS.CarConcept;
    if(FAST_BOOT){
      const sizeQuick = (normalized==='motorcycle'||normalized==='moto'||normalized==='bike')? {w:1.2,h:1.4,l:2.2}:{w:4.4,h:1.4,l:1.9};
      const geomQuick=new THREE.BoxGeometry(sizeQuick.w,sizeQuick.h,sizeQuick.l);
      const matQuick=new THREE.MeshLambertMaterial({ color:0x8892a6 });
      const quick=new THREE.Mesh(geomQuick, matQuick); quick.position.y=sizeQuick.h/2;
      const groupQuick=new THREE.Group(); groupQuick.add(quick); vehicleCache.set(normalized,groupQuick); window.__phase=`vehicle-quick:${normalized}`; return groupQuick;
    }
    try{
      const gltf=await robustLoad(urls);
      const root=(gltf.scene||gltf.scenes?.[0]);
      stripGroundMeshes(root);
      vehicleCache.set(normalized, root);
      window.__phase=`vehicle-done:${normalized}`;
      return root;
    }catch(_){
      const size = (normalized==='motorcycle'||normalized==='moto'||normalized==='bike')? {w:1.2,h:1.4,l:2.2}:{w:4.4,h:1.4,l:1.9};
      const geom=new THREE.BoxGeometry(size.w,size.h,size.l);
      const mat=new THREE.MeshLambertMaterial({ color:0x8892a6 });
      const base=new THREE.Mesh(geom, mat);
      base.position.y=size.h/2;
      const group=new THREE.Group();
      group.add(base);
      vehicleCache.set(normalized,group);
      window.__phase=`vehicle-fallback:${normalized}`;
      return group;
    }
  }

  function tintVehicle(root,hex){ const col=new THREE.Color(hex); root.traverse(o=>{ if(o.isMesh&&o.material&&o.material.color){ o.material.color.lerp(col,0.9); o.material.needsUpdate=true; } }); }
  function addSideLabels(root,text){ const b=new THREE.Box3().setFromObject(root); const s=new THREE.Vector3(); b.getSize(s); const y=b.min.y+s.y*0.6; const midZ=(b.min.z+b.max.z)/2; const L=makeLabel(text,0.9); const R=makeLabel(text,0.9); L.rotation.y=Math.PI/2; R.rotation.y=-Math.PI/2; L.position.set(b.min.x-0.02,y,midZ); R.position.set(b.max.x+0.02,y,midZ); root.add(L,R); }
  function attachSiren(root){ const box=new THREE.Box3().setFromObject(root); const spanX=(box.max.x-box.min.x); const top=box.max.y+0.18; const offset=spanX*0.28; const geo=new THREE.SphereGeometry(0.14,14,12); const leftMat=new THREE.MeshBasicMaterial({ color:0xef4444, transparent:true, opacity:0.28 }); const rightMat=new THREE.MeshBasicMaterial({ color:0x3b82f6, transparent:true, opacity:0.28 }); const left=new THREE.Mesh(geo,leftMat); const right=new THREE.Mesh(geo,rightMat); left.position.set(-offset, top, 0); right.position.set(offset, top, 0); const grp=new THREE.Group(); grp.add(left,right); root.add(grp); const light=new THREE.PointLight(0xff6b6b, 0, 18); light.position.set(0, top+0.2, 0); root.add(light); return {group:grp,left,right,light,phase:Math.random()*Math.PI*2}; }

  const parked=[]; const trafficCars=[]; const emergencyUnits=[]; const driveableVehicles=[];
  const driveState={ active:false, vehicle:null, speed:0, heading:0 };
  function labelDriveable(vehicle){ if(!vehicle) return; const box=new THREE.Box3().setFromObject(vehicle); const height=box.max.y - box.min.y; const lbl=makeLabel('DRIVE',0.6); lbl.position.set(0, box.max.y - vehicle.position.y + 0.6 + height*0.1, 0); lbl.material.depthTest=false; lbl.userData.billboard=true; vehicle.add(lbl); driveableVehicles.push({mesh:vehicle,label:lbl}); }
  async function spawnParkedEmergency(){
    const hosp=POIS.find(p=>p.type==='hospital'); const pol=POIS.find(p=>p.type==='police'); const fire=POIS.find(p=>p.type==='fire');
    if(hosp){ const v=(await getVehicle('ambulance')).clone(true); centerXZ(v); scaleToLength(v,4.4); placeOnGround(v,0); addSideLabels(v,'AMBULANCE'); tintVehicle(v,'#ef4444'); v.position.set(hosp.pos.x,0, hosp.pos.z + hosp.dims.d/2 + 6); setHeading(v,Math.PI); scene.add(v); const siren=attachSiren(v); emergencyUnits.push({mesh:v, base:v.position.clone(), baseHeading:v.rotation.y, target:null, state:'idle', siren, speed:12, type:'ambulance'}); parked.push(v); labelDriveable(v); }
    if(pol){ const v=(await getVehicle('police')).clone(true); centerXZ(v); scaleToLength(v,4.4); placeOnGround(v,0); addSideLabels(v,'POLICE'); tintVehicle(v,'#1e3a8a'); v.position.set(pol.pos.x-4,0, pol.pos.z + pol.dims.d/2 + 6); setHeading(v,Math.PI); scene.add(v); const siren=attachSiren(v); emergencyUnits.push({mesh:v, base:v.position.clone(), baseHeading:v.rotation.y, target:null, state:'idle', siren, speed:13, type:'police'}); parked.push(v); labelDriveable(v); }
    if(fire){ const v=(await getVehicle('fire')).clone(true); centerXZ(v); scaleToLength(v,5.1); placeOnGround(v,0); addSideLabels(v,'FIRE'); tintVehicle(v,'#dc2626'); v.position.set(fire.pos.x+4,0, fire.pos.z + fire.dims.d/2 + 6); setHeading(v,Math.PI); scene.add(v); const siren=attachSiren(v); emergencyUnits.push({mesh:v, base:v.position.clone(), baseHeading:v.rotation.y, target:null, state:'idle', siren, speed:11, type:'fire'}); parked.push(v); labelDriveable(v); }
  }

  function setHeading(mesh,angle){ mesh.rotation.y = angle + Math.PI/2; }

  async function spawnParkedCommons(){
    const palette=['#64748b','#9ca3af','#475569','#7f5539','#ef8354','#14b8a6'];
    const spots=[
      {kind:'sedan', x:startX+CELL*0.9,  z:startZ+CELL*1.3, heading:Math.PI*0.18},
      {kind:'car',   x:startX+CELL*1.6,  z:startZ+CELL*1.1, heading:-Math.PI*0.22},
      {kind:'motorcycle', x:startX+CELL*1.95, z:startZ+CELL*1.55, heading:-Math.PI*0.12, color:'#f97316'},
      {kind:'sedan', x:startX+CELL*2.3,  z:startZ+CELL*1.8, heading:Math.PI*0.36},
      {kind:'bus',   x:startX+CELL*3.1,  z:startZ+CELL*2.35, heading:-Math.PI*0.48, color:'#facc15'},
      {kind:'car',   x:startX+CELL*2.4,  z:startZ+CELL*3.1, heading:Math.PI*0.52},
      {kind:'sedan', x:startX+CELL*4.0,  z:startZ+CELL*1.6, heading:-Math.PI*0.12},
      {kind:'motorcycle', x:startX+CELL*4.2, z:startZ+CELL*2.05, heading:Math.PI*0.08, color:'#38bdf8'},
      {kind:'sedan', x:startX+CELL*1.2, z:startZ+CELL*2.85, heading:-Math.PI*0.38, color:'#0ea5e9'},
      {kind:'car', x:startX+CELL*3.65, z:startZ+CELL*3.25, heading:Math.PI*0.72, color:'#22c55e'},
      {kind:'car', x:startX+CELL*5.0, z:startZ+CELL*2.6, heading:-Math.PI*0.08, color:'#f97316'},
      {kind:'motorcycle', x:startX+CELL*5.2, z:startZ+CELL*1.35, heading:Math.PI*0.28, color:'#e11d48'},
      {kind:'sedan', x:startX+CELL*2.85, z:startZ+CELL*0.9, heading:Math.PI*0.12, color:'#a3e635'},
      {kind:'bus', x:startX+CELL*0.6, z:startZ+CELL*3.6, heading:-Math.PI*0.58, color:'#fde047'}
    ];
    for(let i=0;i<spots.length;i++){
      const spot=spots[i];
      const template=await getVehicle(spot.kind||'car');
      if(!template) continue;
      const base=template.clone(true);
      centerXZ(base);
      const targetLen = spot.kind==='bus'?9.2 : spot.kind==='motorcycle'?2.3 : 4.6;
      scaleToLength(base,targetLen);
      placeOnGround(base,0);
      tintVehicle(base, spot.color || palette[i%palette.length]);
      setHeading(base, spot.heading||0);
      base.position.set(spot.x, 0, spot.z);
      scene.add(base);
      parked.push(base);
      labelDriveable(base);
    }

    const mall=POIS.find(p=>p.type==='mall');
    if(mall){
      const shuttle=(await getVehicle('bus'))?.clone?.(true);
      if(shuttle){
        centerXZ(shuttle); scaleToLength(shuttle,9.4); placeOnGround(shuttle,0);
        tintVehicle(shuttle,'#fde047');
        setHeading(shuttle, Math.PI/2);
        shuttle.position.set(mall.pos.x + (mall.dims?.w||32)/2 + 6, 0, mall.pos.z - 6);
        scene.add(shuttle);
        parked.push(shuttle);
        labelDriveable(shuttle);
      }
    }
    const station=POIS.find(p=>p.type==='station');
    if(station){
      for(let i=0;i<3;i++){
        const bike=(await getVehicle('motorcycle'))?.clone?.(true);
        if(!bike) break;
        centerXZ(bike); scaleToLength(bike,2.4); placeOnGround(bike,0);
        tintVehicle(bike,['#22d3ee','#f43f5e','#a855f7'][i%3]);
        const ang=-Math.PI/2;
        setHeading(bike, ang);
        bike.position.set(station.pos.x - 6 + i*2.8, 0, station.pos.z + (station.dims?.d||18)/2 + 3.5);
        scene.add(bike);
        parked.push(bike);
        labelDriveable(bike);
      }
    }
  }

  async function spawnTraffic(n=18){
    for(let i=0;i<n;i++){
      const r=Math.random();
      let kind;
      if(r<0.18) kind='bus';
      else if(r<0.42) kind='motorcycle';
      else if(r<0.68) kind='car';
      else kind='sedan';
      const template=await getVehicle(kind);
      if(!template) continue;
      const v=template.clone(true);
      centerXZ(v);
      const len = kind==='bus'?9.2 : kind==='motorcycle'?2.4 : 4.6;
      scaleToLength(v,len);
      placeOnGround(v,0);
      if(kind==='bus'){ tintVehicle(v,'#facc15'); }
      else if(kind==='motorcycle'){ tintVehicle(v,'#ec4899'); }
      else { tintVehicle(v,new THREE.Color().setHSL(Math.random(),0.45,0.5).getHex()); }
      const a=Math.random()*Math.PI*2;
      const x=Math.cos(a)*ringR, z=Math.sin(a)*ringR;
      v.position.set(x,ROAD_SURFACE_Y,z);
      setHeading(v,a);
      scene.add(v);
      trafficCars.push({mesh:v, angle:a, speed:0, kind});
    }
  }

  window.__phase='pre-emergency';
  await spawnParkedEmergency();
  window.__phase='after-emergency';
  await spawnParkedCommons();
  window.__phase='after-commons';
  await spawnTraffic(18);
  window.__phase='after-traffic';

  function dispatchEmergency(pos){ const total=Math.max(1, emergencyUnits.length); emergencyUnits.forEach((unit,idx)=>{ const offsetAngle=(idx/total)*Math.PI*2; const offset=new THREE.Vector3(Math.cos(offsetAngle)*2.4,0,Math.sin(offsetAngle)*2.4); unit.target=pos.clone().add(offset); unit.state='responding'; unit.arrivalTimer=0; if(unit.siren){ unit.siren.phase=0; unit.siren.left.material.opacity=0.9; unit.siren.right.material.opacity=0.9; if(unit.siren.light){ unit.siren.light.intensity=14; } } }); }

  const MOVE_SPEED_MULT = 3.6;
  const ARM_SPEED_BASE = 4.8 * MOVE_SPEED_MULT;
  const SPEED_RUN = 7.2 * MOVE_SPEED_MULT;
  const trafficTarget = 3 * SPEED_RUN; // 3x run speed

  const rayEnemies=new Map();
  const modelCache=new Map();
  const CHAR_PRESETS={
    Soldier:['https://threejs.org/examples/models/gltf/Soldier.glb'],
    Xbot:['https://threejs.org/examples/models/gltf/Xbot.glb'],
    Ybot:['https://threejs.org/examples/models/gltf/Ybot.glb'],
    RobotExpressive:['https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb'],
    Stormtrooper:['https://threejs.org/examples/models/gltf/Stormtrooper.glb'],
    Astronaut:['https://modelviewer.dev/shared-assets/models/Astronaut.glb'],
    HVGirl:['https://cdn.jsdelivr.net/gh/BabylonJS/Assets@master/meshes/HVGirl.glb'],
    Fox:['https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Fox/glTF-Binary/Fox.glb']
  };
  async function robustLoadChar(urls, timeoutMs=7000){
    let last=null;
    for(const u of urls){
      try{
        return await withTimeout(gltfLoader.loadAsync(u), timeoutMs);
      }catch(e){
        last=e;
      }
    }
    throw last||new Error('Load fail');
  }
  function normalizeRoot(root){ const box=new THREE.Box3().setFromObject(root); const size=new THREE.Vector3(); box.getSize(size); const scale=1.75/(size.y||1); root.scale.setScalar(scale); return root; }
  function makeCapsulePlaceholder(){ const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.9,8,16), new THREE.MeshLambertMaterial({ color:0x556b8a })); g.add(body); return g; }
  async function getCharacter(key){ if(modelCache.has(key)) return modelCache.get(key); try{ const gltf=await robustLoadChar(CHAR_PRESETS[key]||CHAR_PRESETS.Soldier); const baseRoot=(gltf.scene||gltf.scenes?.[0]||null); const root = baseRoot? normalizeRoot(baseRoot) : makeCapsulePlaceholder(); root.traverse?.(o=>{ if(o.isMesh){ o.castShadow=allowShadows; o.receiveShadow=allowShadows; o.material = new THREE.MeshLambertMaterial({ color:0x9fb1c6 }); }}); modelCache.set(key,{root,clips:gltf.animations||[]}); return modelCache.get(key); }catch(_){ const ph=makeCapsulePlaceholder(); modelCache.set(key,{root:ph,clips:[]}); return modelCache.get(key); } }
  const enemies=new Map();
  const ENEMY_WEAPONS_POOL=['Uzi','AK47','MP5','BattleRifle','InfantryRifle'];
  const ENEMY_BASE_HP=72;
  function dropEnemyWeapon(e){ if(!e?.weaponKey) return; const pos=new THREE.Vector3(e.body.position.x, Math.max(ROAD_SURFACE_Y+0.06,e.body.position.y+0.1), e.body.position.z); spawnWeaponPickupAt(pos, e.weaponKey, true); }
  async function safeCloneSkinned(src){ try{ if(src && SkeletonUtils?.clone){ return SkeletonUtils.clone(src); } if(src?.clone){ return src.clone(true); } }catch(_){ } return makeCapsulePlaceholder(); }
  async function spawnEnemy(x,z,key='Soldier'){ if(enemies.size>=12) return null; const base=await getCharacter(key); const clone=await safeCloneSkinned(base?.root); clone.traverse(o=>{ o.castShadow=allowShadows; }); clone.position.set(x,0,z); clone.userData.enemy=true; scene.add(clone); const r=0.32,h=1.45; const shape=new CANNON.Cylinder(r,r,h,8); const q=new CANNON.Quaternion(); q.setFromEuler(Math.PI/2,0,0); const body=new CANNON.Body({ mass:80, material:matEnemy, linearDamping:0.3, angularDamping:0.9 }); body.fixedRotation=true; body.addShape(shape,new CANNON.Vec3(0,h/2,0),q); body.position.set(x,0.82,z); world.addBody(body); const hpBar=makeBillboardBar(); scene.add(hpBar); const weaponKey = ENEMY_WEAPONS_POOL[Math.floor(Math.random()*ENEMY_WEAPONS_POOL.length)] || 'Uzi'; enemies.set(clone.uuid,{root:clone, body, hp:ENEMY_BASE_HP, dead:false, hpBar, cooldown:0, bleed:0, bleedTimer:0, weaponKey}); return clone; }
  function enemyRoots(){ return Array.from(enemies.values()).map(e=>e.root); }
  function knockDownEnemy(e, hitPoint=null, hitNormal=new THREE.Vector3(0,1,0)){ if(!e) return; e.dead=true; e.downTimer=1.4; e.body.mass=0; e.body.updateMassProperties(); e.body.velocity.set(0,0,0); e.body.angularVelocity.set(0,0,0); if(e.hpBar) e.hpBar.visible=false; const basePos=new THREE.Vector3(e.body.position.x, Math.max(0,e.body.position.y-0.1), e.body.position.z); e.root.position.copy(basePos); e.root.rotation.set(-Math.PI/2, e.root.rotation.y, 0); if(hitPoint) addBlood(hitPoint.clone(), hitNormal||new THREE.Vector3(0,1,0)); dropEnemyWeapon(e); }
  function woundEnemy(e, dmg, bleed=0.25, hitPoint=null, hitNormal=new THREE.Vector3(0,1,0)){ if(!e||e.dead) return; e.hp -= dmg; e.bleed=Math.max(e.bleed||0, bleed); e.bleedTimer=0; if(hitPoint) addBlood(hitPoint, hitNormal||new THREE.Vector3(0,1,0)); if(e.hp<=0){ knockDownEnemy(e, hitPoint, hitNormal); return; } updateBillboardBar(e.hpBar, e.hp/ENEMY_BASE_HP); }
  function enemyPos(e){ return new THREE.Vector3(e.body.position.x, e.body.position.y, e.body.position.z); }
  function findTargetForEnemy(e){ const selfPos=enemyPos(e); const playerPos=new THREE.Vector3(player.position.x, player.position.y, player.position.z); let best={ type:'player', pos:playerPos, dist:selfPos.distanceTo(playerPos) }; enemies.forEach((other)=>{ if(other===e || other.dead) return; const p=enemyPos(other); const d=selfPos.distanceTo(p); if(d<best.dist*0.85){ best={ type:'enemy', pos:p, dist:d, ref:other }; } }); return best; }
  function enemyTryFire(e, dt, target){ if(e.dead||!target) return; e.cooldown -= dt; if(target.dist>55) return; if(e.cooldown>0) return; const origin = new THREE.Vector3(e.body.position.x, e.body.position.y+1.1, e.body.position.z); const aimPos = target.pos.clone(); aimPos.y += 0.9; const dir = aimPos.clone().sub(origin).normalize(); dir.x += (Math.random()-0.5)*0.02; dir.y += (Math.random()-0.5)*0.01; dir.z += (Math.random()-0.5)*0.02; dir.normalize(); const to = origin.clone().addScaledVector(dir, 150); tracer(origin,to,0xff8888); const weaponStats=ARMORY.find((a)=>a.key===e.weaponKey)?.stats; const shotDmg=Math.max(12, (weaponStats?.dmg||18)*0.75); if(target.type==='player'){ const luckyHead=Math.random()<0.08; hurtPlayer(luckyHead? 120 : shotDmg); } else if(target.ref){ woundEnemy(target.ref, (weaponStats?.dmg||14), 0.35, target.pos.clone(), new THREE.Vector3(0,1,0)); }
    const rpm=weaponStats?.rpm||620; e.cooldown = Math.max(0.24, 60/(rpm||600)) + Math.random()*0.18; }

  function makeBillboardBar(){ const c=document.createElement('canvas'); c.width=128; c.height=16; const t=new THREE.CanvasTexture(c); const m=new THREE.SpriteMaterial({ map:t, depthWrite:false }); const s=new THREE.Sprite(m); s.scale.set(0.9, 0.12, 1); s.userData.canvas=c; s.userData.tex=t; updateBillboardBar(s,1); return s; }
  function updateBillboardBar(s,ratio){ const c=s.userData.canvas; const x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); x.fillStyle='rgba(0,0,0,0.6)'; x.fillRect(0,0,c.width,c.height); x.fillStyle= ratio>0.6? '#29ff9a' : ratio>0.3? '#ffd966':'#ff4d4f'; x.fillRect(2,2,(c.width-4)*Math.max(0,Math.min(1,ratio)), c.height-4); s.userData.tex.needsUpdate=true; }

  function startBR(){ for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; const r=ringR*0.6; spawnEnemy(Math.cos(a)*r, Math.sin(a)*r, ['Soldier','Xbot','Ybot','RobotExpressive'][i%4]); } }
  scatterCityPickups();
  startBR();
  updateStatus('Tirana 2040 • Ready');
  window.__phase='ready';

  let inputMode='A';
  function applyMode(){
    shootPad.style.display='block';
    if(reloadBtn) reloadBtn.style.display='block';
    updateZoomUI();
  }
  applyMode();

  const zoomSlider=$('zoomSlider');
  const MIN_ZOOM_FOV=12;
  function applyZoomFromSlider(){
    if(!zoomSlider) return;
    const v=parseFloat(zoomSlider.value||'1');
    const zoomedFov = 70 / v;
    camera.fov = THREE.MathUtils.clamp(zoomedFov, MIN_ZOOM_FOV, 70);
    camera.updateProjectionMatrix();
  }
  if(zoomSlider){
    zoomSlider.value = zoomSlider.value || '3';
    zoomSlider.addEventListener('input', applyZoomFromSlider);
    applyZoomFromSlider();
  }
  function updateZoomUI(){ const box=$('zoomBox'); if(!box) return; if(currentKey==='AK47' && inputMode==='A'){ box.style.display='flex'; } else { box.style.display='none'; } }

  const climbBtn=$('climbBtn');
  const ladderState={ active:false, index:-1 };
  function detachFromLadder(){ if(!ladderState.active) return; ladderState.active=false; ladderState.index=-1; climbBtn.textContent='⬆ Use/Climb Ladder'; }
  function nearestLadder(){ if(ladderState.active && ladderState.index>=0) return {idx:ladderState.index, dist:0}; let best=-1, bd=1e9; for(let i=0;i<ladders.length;i++){ const L=ladders[i]; const dx=player.position.x-L.x; const dz=player.position.z-L.z; const d=Math.hypot(dx,dz); if(d<bd){ bd=d; best=i; } } return {idx:best, dist:bd}; }
  function snapToLadder(idx){ const L=ladders[idx]; if(!L) return; ladderState.active=true; ladderState.index=idx; player.velocity.x=player.velocity.z=0; player.angularVelocity.set(0,0,0); player.position.x=L.x; player.position.z=L.z; player.position.y=Math.max(player.position.y, L.y0+0.6); climbBtn.textContent='⬇ Leave Ladder'; }
  function setClimbUI(){ const n=nearestLadder(); ladders.forEach((L,i)=>{ if(L.marker){ const close = ladderState.active? (i===ladderState.index) : (i===n.idx && n.dist<2.2); L.marker.material.opacity = close?0.98:0.78; L.marker.scale.setScalar(close?1.04:0.9); } }); const show = ladderState.active || n.dist<1.6; climbBtn.style.display = show? 'block':'none'; climbBtn.textContent = ladderState.active? '⬇ Leave Ladder' : '⬆ Use/Climb Ladder'; }
  climbBtn.addEventListener('click', ()=>{ if(ladderState.active){ detachFromLadder(); return; } const n=nearestLadder(); if(n.dist<1.2 && n.idx>=0){ snapToLadder(n.idx); vib(16); } });

  const driveBtn=$('driveBtn');
  const cameraModeBtn=$('cameraModeBtn');
  function updateCameraModeButton(){
    if(!cameraModeBtn) return;
    cameraModeBtn.style.display = driveState.active ? 'block' : 'none';
    cameraModeBtn.textContent = cameraMode===CAMERA_MODES.COCKPIT? '🎥 Inside' : '🎥 Behind';
  }
  function setCameraMode(mode){
    cameraMode = mode===CAMERA_MODES.COCKPIT ? CAMERA_MODES.COCKPIT : CAMERA_MODES.FOLLOW;
    updateCameraModeButton();
  }
  function nearestDriveable(){ let best=null, bd=1e9; driveableVehicles.forEach(({mesh})=>{ const dx=(player.position.x||0)-(mesh.position.x||0); const dz=(player.position.z||0)-(mesh.position.z||0); const d=Math.hypot(dx,dz); if(d<bd){ bd=d; best=mesh; } }); return {mesh:best, dist:bd}; }
  function enterVehicle(mesh){ if(!mesh) return; driveState.active=true; driveState.vehicle=mesh; driveState.speed=0; driveState.heading=(mesh.rotation.y||0)-Math.PI/2; player.velocity.set(0,0,0); player.position.set(mesh.position.x, player.position.y, mesh.position.z); driveBtn.textContent='⬅ Exit Car'; driveBtn.style.display='block'; setDrivePedals(); setCameraMode(CAMERA_MODES.FOLLOW); }
  function exitVehicle(){ if(!driveState.active) return; const vehicle=driveState.vehicle; const dir=new THREE.Vector3(Math.cos(driveState.heading),0,Math.sin(driveState.heading)); player.position.set(vehicle?.position.x || 0, 0.94, (vehicle?.position.z||0)); player.position.x += -dir.z*1.8; player.position.z += dir.x*1.8; driveState.active=false; driveState.vehicle=null; driveState.speed=0; driveInput.throttle=0; driveInput.brake=0; driveBtn.textContent='🚗 Drive'; driveBtn.style.display='none'; setDrivePedals(); setCameraMode(CAMERA_MODES.FOLLOW); }
  function setDriveUI(){ if(driveState.active){ driveBtn.style.display='block'; driveBtn.textContent='⬅ Exit Car'; setDrivePedals(); updateCameraModeButton(); return; } const n=nearestDriveable(); const show=n.mesh && n.dist<4.2; driveBtn.style.display = show? 'block':'none'; driveBtn.textContent='🚗 Drive'; driveBtn.dataset.target = show? (n.mesh.uuid||'') : ''; setDrivePedals(); updateCameraModeButton(); }
  driveBtn.addEventListener('click', ()=>{ if(driveState.active){ exitVehicle(); return; } const n=nearestDriveable(); if(n.mesh && n.dist<4.2){ enterVehicle(n.mesh); vib(18); } });
  cameraModeBtn?.addEventListener('click', ()=>{ if(!driveState.active) return; setCameraMode(cameraMode===CAMERA_MODES.COCKPIT?CAMERA_MODES.FOLLOW:CAMERA_MODES.COCKPIT); vib(10); });

  function updateClimbMovement(moveInput,dt){ const idx=ladderState.index; const L=ladders[idx]; if(!ladderState.active || !L) return; const climbSpeed=2.6*MOVE_SPEED_MULT; const nextY = THREE.MathUtils.clamp(player.position.y + moveInput*climbSpeed*dt, L.y0+0.6, L.y1+1.1); player.position.y = nextY; player.position.x = L.x; player.position.z = L.z; player.velocity.set(0,0,0); player.angularVelocity.set(0,0,0); if(nextY>=L.y1+0.95 && moveInput>0.1){ detachFromLadder(); player.position.y = L.y1+1.0; player.position.x += Math.sin(yaw)*1.1; player.position.z += Math.cos(yaw)*1.1; }
    if(nextY<=L.y0+0.6 && moveInput<-0.1){ detachFromLadder(); player.position.y = L.y0+0.6; }
  }

  const mapOverlay=$('mapOverlay'), mapCanvas=$('mapCanvas'), mctx=mapCanvas?.getContext('2d');
  const mapZoomSlider=$('mapZoom'); const mapZoomLabel=$('mapZoomLabel');
  const MAP_ZOOM_MIN=parseFloat(mapZoomSlider?.min||'0.75'), MAP_ZOOM_MAX=parseFloat(mapZoomSlider?.max||'3');
  let mapZoom=1;
  function setMapZoom(v){ const clamped=THREE.MathUtils.clamp(v||1, MAP_ZOOM_MIN, MAP_ZOOM_MAX); mapZoom=clamped; if(mapZoomSlider) mapZoomSlider.value=String(clamped); if(mapZoomLabel) mapZoomLabel.textContent=`Zoom ${clamped.toFixed(2)}x`; }
  setMapZoom(1);
  function resizeMap(){ if(!mapCanvas||!mctx) return; mapCanvas.width=mapCanvas.clientWidth; mapCanvas.height=mapCanvas.clientHeight; }
  function mapProjection(){ if(!mapCanvas||!mctx) return null; resizeMap(); const w=mapCanvas.width,h=mapCanvas.height; const cx=w/2, cy=h/2; const extent=Math.max(BLOCKS_X,BLOCKS_Z)*CELL*0.5 + ringR*0.7; const baseScale=Math.min(w,h)/(extent*2.05); const zoomedScale=baseScale*mapZoom; const focusX=player?.position?.x||0; const focusZ=player?.position?.z||0; return {w,h,cx,cy,zoomedScale,focusX,focusZ}; }
  function drawMap(){ if(!mapCanvas||!mctx) return; const proj=mapProjection(); if(!proj) return; const grad=mctx.createLinearGradient(0,0,0,proj.h); grad.addColorStop(0,'#0f172a'); grad.addColorStop(1,'#111827'); mctx.fillStyle=grad; mctx.fillRect(0,0,proj.w,proj.h); const toScreen=(x,z)=>({x:proj.cx + (x-proj.focusX)*proj.zoomedScale, y:proj.cy + (z-proj.focusZ)*proj.zoomedScale});
    const ringCenter=toScreen(0,0); mctx.strokeStyle='rgba(57,66,88,0.9)'; mctx.lineWidth=ROAD*proj.zoomedScale*2; mctx.beginPath(); mctx.arc(ringCenter.x, ringCenter.y, ringR*proj.zoomedScale, 0, Math.PI*2); mctx.stroke();
    mapRoads.forEach((road)=>{ const p1=toScreen(road.from.x, road.from.z); const p2=toScreen(road.to.x, road.to.z); mctx.strokeStyle='rgba(76,86,106,0.92)'; mctx.lineWidth=Math.max(3, (road.width||ROAD)*proj.zoomedScale*1.15); mctx.beginPath(); mctx.moveTo(p1.x,p1.y); mctx.lineTo(p2.x,p2.y); mctx.stroke(); mctx.strokeStyle='rgba(255,255,255,0.16)'; mctx.lineWidth=Math.max(1, (road.width||ROAD)*proj.zoomedScale*0.35); mctx.beginPath(); mctx.moveTo(p1.x,p1.y); mctx.lineTo(p2.x,p2.y); mctx.stroke(); });
    mctx.font='13px 600 system-ui'; mctx.fillStyle='rgba(226,232,240,0.86)'; mapRoads.forEach((road)=>{ if(!road.name) return; const p1=toScreen(road.from.x, road.from.z); const p2=toScreen(road.to.x, road.to.z); if(Math.hypot(p2.x-p1.x,p2.y-p1.y)<12) return; const midX=(p1.x+p2.x)/2; const midY=(p1.y+p2.y)/2; const ang=Math.atan2(p2.y-p1.y,p2.x-p1.x); mctx.save(); mctx.translate(midX,midY); mctx.rotate(ang); const textW=mctx.measureText(road.name).width; mctx.fillText(road.name,-textW/2,-6); mctx.restore(); });
    mapParks.forEach((park)=>{ const center=toScreen(park.x, park.z); const wpx=park.w*proj.zoomedScale; const hpx=park.d*proj.zoomedScale; mctx.fillStyle=park.type==='fountain'?'rgba(59,130,246,0.35)': park.type==='basket'?'rgba(239,68,68,0.32)':'rgba(34,197,94,0.32)'; mctx.fillRect(center.x-wpx/2, center.y-hpx/2, wpx, hpx); mctx.strokeStyle='rgba(255,255,255,0.12)'; mctx.strokeRect(center.x-wpx/2, center.y-hpx/2, wpx, hpx); });
    mapBuildings.forEach((b)=>{ const center=toScreen(b.x, b.z); const wpx=b.w*proj.zoomedScale, hpx=b.d*proj.zoomedScale; mctx.fillStyle='rgba(148,163,184,0.32)'; mctx.fillRect(center.x-wpx/2, center.y-hpx/2, wpx, hpx); });
    mctx.font='17px 700 system-ui'; mctx.fillStyle='#facc15'; mapLandmarks.forEach((L)=>{ const p=toScreen(L.x, L.z); mctx.fillText(L.label, p.x - mctx.measureText(L.label).width/2, p.y-8); });
    POIS.forEach((p)=>{ const pos=toScreen(p.pos.x, p.pos.z); mctx.fillText(p.label, pos.x-6, pos.y-6); });
    if(waypoint){ const wpt=toScreen(waypoint.x, waypoint.z); const playerScreen=toScreen(player.position.x, player.position.z); mctx.strokeStyle='rgba(102,204,255,0.9)'; mctx.lineWidth=3; mctx.setLineDash([18,10]); mctx.beginPath(); mctx.moveTo(playerScreen.x, playerScreen.y); mctx.lineTo(wpt.x,wpt.y); mctx.stroke(); mctx.setLineDash([]); mctx.fillStyle='#38bdf8'; mctx.beginPath(); mctx.arc(wpt.x,wpt.y,8,0,Math.PI*2); mctx.fill(); mctx.fillStyle='#38bdf8'; mctx.fillText('Waypoint', wpt.x-38, wpt.y-12); }
    const playerScreen=toScreen(player.position.x, player.position.z); mctx.fillStyle='#7dd3fc'; mctx.beginPath(); mctx.arc(playerScreen.x, playerScreen.y, 8, 0, Math.PI*2); mctx.fill(); mctx.strokeStyle='#38bdf8'; mctx.lineWidth=2.4; mctx.beginPath(); mctx.moveTo(playerScreen.x, playerScreen.y); mctx.lineTo(playerScreen.x + Math.sin(yaw)*32, playerScreen.y + Math.cos(yaw)*32); mctx.stroke();
  }
  resizeMap(); addEventListener('resize', resizeMap);
  $('mapBtn').addEventListener('click', ()=>{ mapOverlay.style.display='flex'; requestAnimationFrame(()=>drawMap()); });
  $('mapClose').addEventListener('click', ()=>{ mapOverlay.style.display='none'; });
  mapZoomSlider?.addEventListener('input', ()=>{ setMapZoom(parseFloat(mapZoomSlider.value||'1')); drawMap(); });
  $('mapZoomIn')?.addEventListener('click', ()=>{ setMapZoom(mapZoom*1.12); drawMap(); });
  $('mapZoomOut')?.addEventListener('click', ()=>{ setMapZoom(mapZoom/1.12); drawMap(); });
  mapCanvas?.addEventListener('wheel', (e)=>{ const dir=Math.sign(e.deltaY||0); setMapZoom(mapZoom*(dir>0?0.92:1.08)); drawMap(); e.preventDefault(); }, {passive:false});
  const mapPinch={active:false, start:0, baseZoom:1};
  mapCanvas?.addEventListener('touchstart', (e)=>{ if(e.touches.length===2){ mapPinch.active=true; mapPinch.start=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); mapPinch.baseZoom=mapZoom; } }, {passive:false});
  mapCanvas?.addEventListener('touchmove', (e)=>{ if(mapPinch.active && e.touches.length===2){ const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY)||1; const scale=dist/(mapPinch.start||dist); setMapZoom(mapPinch.baseZoom*scale); drawMap(); e.preventDefault(); } }, {passive:false});
  mapCanvas?.addEventListener('touchend', ()=>{ mapPinch.active=false; });

  let waypoint=null; let navGuide=null;
  function updateNavGuide(){ if(navGuide){ scene.remove(navGuide); navGuide.geometry.dispose(); navGuide.material.dispose(); navGuide=null; } if(!waypoint) return; const guideGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(player.position.x,0.1,player.position.z), new THREE.Vector3(waypoint.x,0.1,waypoint.z)]); const guideMat=new THREE.LineDashedMaterial({ color:0x66ccff, dashSize:2.2, gapSize:1.2, linewidth:1 }); navGuide=new THREE.Line(guideGeo, guideMat); navGuide.computeLineDistances(); scene.add(navGuide); }
  mapCanvas?.addEventListener('click', (e)=>{ const proj=mapProjection(); if(!proj) return; const r=mapCanvas.getBoundingClientRect(); const sx=e.clientX-r.left, sy=e.clientY-r.top; const wx = (sx - proj.cx)/proj.zoomedScale + proj.focusX; const wz = (sy - proj.cy)/proj.zoomedScale + proj.focusZ; const candidate=new THREE.Vector3(wx,0,wz); if(waypoint && waypoint.distanceTo(candidate)<8){ waypoint=null; } else { waypoint=candidate; } updateNavGuide(); drawMap(); });

  function updateEmergencyUnits(dt){ for(const unit of emergencyUnits){ const mesh=unit.mesh; if(!mesh) continue; if(unit.state==='responding' || unit.state==='returning'){ if(unit.target){ const dir=new THREE.Vector3(unit.target.x-mesh.position.x,0,unit.target.z-mesh.position.z); const dist=dir.length(); if(dist>0.4){ dir.normalize(); const sp=(unit.state==='responding'?unit.speed:unit.speed*0.7); mesh.position.x += dir.x*sp*dt; mesh.position.z += dir.z*sp*dt; setHeading(mesh, Math.atan2(dir.x, dir.z)); } else { if(unit.state==='responding'){ unit.state='onsite'; unit.arrivalTimer=0; } else { unit.state='idle'; unit.target=null; mesh.position.copy(unit.base); setHeading(mesh, unit.baseHeading||0); } } } } else if(unit.state==='onsite'){ unit.arrivalTimer=(unit.arrivalTimer||0)+dt; if(unit.arrivalTimer>14){ unit.state='returning'; unit.target=unit.base.clone(); } } else if(unit.state==='idle'){ const drift=Math.hypot(mesh.position.x-unit.base.x, mesh.position.z-unit.base.z); if(drift>0.6){ unit.state='returning'; unit.target=unit.base.clone(); } }
      if(unit.siren){ unit.siren.phase += dt*6; const active=(unit.state==='responding'||unit.state==='onsite'); const pulse=Math.abs(Math.sin(unit.siren.phase)); const low=Math.max(0.16,0.18- dt*0.5); const leftIntensity=active?(0.45+0.55*pulse):low; const rightIntensity=active?(0.45+0.55*Math.abs(Math.sin(unit.siren.phase+Math.PI/2))):low; unit.siren.left.material.opacity=leftIntensity; unit.siren.right.material.opacity=rightIntensity; if(unit.siren.light){ const tint=unit.type==='fire'?0xff6b6b: unit.type==='ambulance'?0xffc857:0x60a5fa; unit.siren.light.intensity = active ? 8 + pulse*6 : 0; unit.siren.light.color.set(active ? tint : 0xffffff); } } }
  }

  let last=performance.now(); let frameCount=0,fpsTimer=0; let fireCd=0; const mini=$('mini'); updateAmmoHUD();
  function loop(now){
    try{
    const dt=Math.min((now-last)/1000,0.05); last=now;
    frameCount++; fpsTimer+=dt; if(fpsTimer>=0.5){ const fps=(frameCount/fpsTimer)|0; mini.textContent='fps: '+fps; if(fps<55 && dprScale>DPR_MIN){ dprScale=Math.max(DPR_MIN,dprScale-0.05); fit(); } else if(fps>70 && dprScale<DPR_MAX_SCALE){ dprScale=Math.min(DPR_MAX_SCALE,dprScale+0.04); fit(); } if(fps<PERF_TARGET_FPS){ lowFpsTime+=fpsTimer; if(lowFpsTime>1.2) applyPerformanceBoost(); } else { lowFpsTime=Math.max(0, lowFpsTime-0.5); } frameCount=0; fpsTimer=0; }

    if(inputMode==='A'){ const k = Math.min(1, dt*AIM_SMOOTH_A); const ax = lookAccumX * LOOK_SENS_A; const ay = lookAccumY * LOOK_SENS_A; lookAccumX=0; lookAccumY=0; aimSmoothX += (ax - aimSmoothX)*k; aimSmoothY += (ay - aimSmoothY)*k; yaw   -= aimSmoothX * AIM_RATE_A * dt; pitch -= aimSmoothY * AIM_RATE_A * dt; clampPitch(); }

    const {from,to}=fireRay(aimPoint);
    if(navGuide && waypoint){ const posAttr=navGuide.geometry.attributes.position; posAttr.setXYZ(0, player.position.x, 0.1, player.position.z); posAttr.setXYZ(1, waypoint.x, 0.1, waypoint.z); posAttr.needsUpdate=true; navGuide.computeLineDistances(); const mat=navGuide.material; if(mat){ mat.dashOffset=(mat.dashOffset||0)-dt*2.1; } }
    const hitsEnemy = raycaster.intersectObjects(enemyRoots(), true);
    const onEnemy = hitsEnemy.length>0;
    crosshairEl.style.setProperty('--aimColor', onEnemy? '#2fe56b' : '#ff3c3c');
    aimDotMat.color.set(onEnemy? 0x2fe56b : 0xff3c3c);

    if(driveState.active && !driveState.vehicle){ driveState.active=false; driveBtn.textContent='🚗 Drive'; setDrivePedals(); }
    driveableVehicles.forEach(({label})=>{ if(label){ label.lookAt(camera.position); } });

    const move={x:0,z:0}; if(keys.has('KeyW')) move.z+=1; if(keys.has('KeyS')) move.z-=1; if(keys.has('KeyA')) move.x-=1; if(keys.has('KeyD')) move.x+=1; move.x += mv.vx; move.z += driveState.active ? 0 : mv.vz; if(driveState.active){ move.z += driveInput.throttle*1.2; move.z -= driveInput.brake*1.3; } let l=Math.hypot(move.x,move.z); if(l>1){ move.x/=l; move.z/=l; }
    const speedBase = ARM_SPEED_BASE; const speedRun = SPEED_RUN;
    if(driveState.active && driveState.vehicle){
      const carAccel=trafficTarget*0.9; const carMax=trafficTarget*1.35;
      driveState.speed = THREE.MathUtils.clamp(driveState.speed + move.z*carAccel*dt, -carMax*0.55, carMax);
      driveState.speed *= 0.986;
      driveState.heading += move.x * 1.8 * dt * (0.5 + Math.min(1, Math.abs(driveState.speed)/carMax));
      yaw = THREE.MathUtils.lerp(yaw, driveState.heading, dt*3.2);
      const vx=Math.cos(driveState.heading)*driveState.speed;
      const vz=Math.sin(driveState.heading)*driveState.speed;
      const vehicle=driveState.vehicle;
      vehicle.position.set(vehicle.position.x + vx*dt, ROAD_SURFACE_Y, vehicle.position.z + vz*dt);
      setHeading(vehicle, driveState.heading);
      player.velocity.x=player.velocity.z=0; player.position.set(vehicle.position.x, player.position.y, vehicle.position.z); camFollow(vehicle.position,1.6, driveState.heading);
    } else if(!ladderState.active){ const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)); const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)); const sprint = (l>0.9 ? speedRun : speedBase); const vx=forward.x*move.z + right.x*move.x; const vz=forward.z*move.z + right.z*move.x; player.velocity.x=vx*sprint; player.velocity.z=vz*sprint; player.wakeUp(); camFollow(player.position,1.0); } else { player.velocity.x=player.velocity.z=0; updateClimbMovement(move.z, dt); camFollow(player.position,1.0); }

    setClimbUI();
    setDriveUI();

    if(fireHeld){ const per=60.0/(currentStats.rpm); fireCd-=dt; while(fireCd<=0){ doShot(); fireCd+=per; } }

    for(let i=0;i<weaponPickups.length;i++){ const w=weaponPickups[i]; if(!w) continue; w.rotation.y += dt*(w.userData.spin||1); const dx=w.position.x-player.position.x; const dz=w.position.z-player.position.z; if(Math.hypot(dx,dz)<1.1){ collectWeaponPickup(w); i--; } }

    enemies.forEach((e)=>{ if(e.dead){ e.root.position.set(e.body.position.x, Math.max(0,e.body.position.y-0.1), e.body.position.z); if(e.downTimer!=null){ const tilt=Math.min(Math.PI/2, (1 - Math.max(0,(e.downTimer||0))/1.4)*Math.PI/2); e.root.rotation.x = -tilt; e.downTimer=Math.max(0,(e.downTimer||0)-dt); } return; } if(e.bleed>0){ e.bleedTimer=(e.bleedTimer||0)+dt; e.hp -= e.bleed*dt*18; if(e.bleedTimer>0.55){ e.bleedTimer=0; addBlood(new THREE.Vector3(e.body.position.x, Math.max(0.18,e.body.position.y+0.2), e.body.position.z), new THREE.Vector3(0,1,0)); } if(e.hp<=0){ knockDownEnemy(e, new THREE.Vector3(e.body.position.x, e.body.position.y+0.2, e.body.position.z)); return; } updateBillboardBar(e.hpBar, e.hp/ENEMY_BASE_HP); }
      const target=findTargetForEnemy(e); const toT = target? new THREE.Vector3(target.pos.x-e.body.position.x, 0, target.pos.z-e.body.position.z):new THREE.Vector3(); const d = toT.length(); if(d>0.01){ toT.normalize(); const sp=d>12?2.4:1.6; e.body.velocity.x = toT.x*sp; e.body.velocity.z = toT.z*sp; } enemyTryFire(e, dt, target); e.root.position.set(e.body.position.x, 0, e.body.position.z); e.hpBar.position.set(e.body.position.x, 1.9, e.body.position.z); e.hpBar.lookAt(camera.position); });

    // traffic move: v = 3x run speed
    for(const c of trafficCars){ if(!c.speed){ c.speed = trafficTarget*(0.8+Math.random()*0.4); } const radPerSec = c.speed / ringR; c.angle = (c.angle + radPerSec*dt)%(Math.PI*2); const nx=Math.cos(c.angle)*ringR, nz=Math.sin(c.angle)*ringR; // obey red
      let blocked=false; for(const tl of trafficLights){ const d=Math.hypot(nx-tl.pos.x, nz-tl.pos.z); if(d<6 && tl.state!=='green'){ blocked=true; break; } }
      if(!blocked){ c.mesh.position.set(nx,ROAD_SURFACE_Y,nz); setHeading(c.mesh, c.angle); }
    }
    trafficLights.forEach(tl=>{ tl.timer+=dt; if(tl.timer>6){ tl.timer=0; tl.state = tl.state==='green'?'yellow': tl.state==='yellow'?'red':'green'; tl.lamps.Lg.material.color.set(tl.state==='green'?0x2ecc71:0x222222); tl.lamps.Ly.material.color.set(tl.state==='yellow'?0xf1c40f:0x222222); tl.lamps.Lr.material.color.set(tl.state==='red'?0xe74c3c:0x222222); } });

    updateEmergencyUnits(dt);

    if(!waypoint && navGuide){ updateNavGuide(); }

    const maxSubSteps = dt>0.022 ? 1 : 3;
    world.step(PHYSICS_STEP, dt, maxSubSteps);
    updateTracers(dt);
    fountainWaters.forEach((w)=>{ const uniforms=w.material?.uniforms; if(uniforms?.time){ uniforms.time.value += dt; } });
    fountainJets.forEach((jet)=>{ jet.phase += dt*jet.speed; const pulse=0.7 + Math.abs(Math.sin(jet.phase))*1.3; jet.mesh.scale.set(1, pulse, 1); jet.mesh.position.y = jet.baseY + pulse*0.42; });

    for(let i=0;i<activeGrenades.length;i++){ const g=activeGrenades[i]; g.fuse-=dt; const bp=g.body.position; g.mesh.position.set(bp.x,bp.y,bp.z); g.mesh.quaternion.set(g.body.quaternion.x,g.body.quaternion.y,g.body.quaternion.z,g.body.quaternion.w); if(bp.y<0.2 && g.body.velocity.length()<0.8){ g.fuse=Math.min(g.fuse,0.45); } if(g.fuse<=0){ explodeGrenade(g); activeGrenades.splice(i,1); i--; } }
    for(let i=0;i<explosionFX.length;i++){ const fx=explosionFX[i]; fx.life-=dt; const norm=Math.max(0,fx.life/fx.maxLife||0); const prog=1-norm;
      if(fx.core){ fx.core.scale.setScalar(1+prog*7.5); const mat=fx.core.material; if(mat){ mat.opacity=Math.max(0,0.98-prog*1.1); mat.needsUpdate=true; } }
      if(fx.ring){ fx.ring.scale.setScalar(1+prog*18); const mat=fx.ring.material; if(mat){ mat.opacity=Math.max(0,0.9-prog); mat.needsUpdate=true; } }
      if(fx.light){ fx.light.intensity=Math.max(0, fx.light.intensity - dt*32); }
      if(fx.smoke){ const mat=fx.smoke.material; if(mat){ mat.opacity=Math.max(0,0.82-prog*0.82); } fx.smoke.scale.setScalar(5.6+prog*4.8); }
      if(fx.shards){ for(const shard of fx.shards){ const vel=shard.velocity; vel.y -= 9.81*dt*0.6; shard.mesh.position.x += vel.x*dt; shard.mesh.position.y += vel.y*dt; shard.mesh.position.z += vel.z*dt; shard.mesh.rotation.x += shard.spin.x*dt; shard.mesh.rotation.y += shard.spin.y*dt; shard.mesh.rotation.z += shard.spin.z*dt; const mat=shard.mesh.material; if(mat){ mat.opacity=Math.max(0, mat.opacity - dt*1.2); mat.needsUpdate=true; } } }
      if(fx.life<=0){ if(fx.core){ scene.remove(fx.core); fx.core.geometry.dispose(); fx.core.material.dispose(); }
        if(fx.ring){ scene.remove(fx.ring); fx.ring.geometry.dispose(); fx.ring.material.dispose(); }
        if(fx.light){ scene.remove(fx.light); }
        if(fx.smoke){ scene.remove(fx.smoke); fx.smoke.material.dispose(); }
        if(fx.shards){ fx.shards.forEach((sh)=>{ scene.remove(sh.mesh); sh.mesh.geometry.dispose(); sh.mesh.material.dispose(); }); }
        explosionFX.splice(i,1); i--; }
    }

    try{ renderer.render(scene,camera); }catch(err){ }
    } catch(err){ console.error('Render loop failure', err); window.__phase=`loop-error:${err?.message||err}`; updateStatus('Engine hiccup resolved'); }
  }
  window.loop = loop;
  renderer.setAnimationLoop(loop);

  renderer.getContext().canvas.addEventListener('webglcontextlost', (e)=>{ e.preventDefault(); });
  renderer.getContext().canvas.addEventListener('webglcontextrestored', ()=>{ });

  setTimeout(()=>{
    console.assert(!!document.getElementById('shootPad'), 'shootPad exists');
    console.assert(typeof BLOCKS_X==='number' && typeof BLOCKS_Z==='number', 'grid dims defined');
    console.assert(ARMORY.length>=6 && FIRE_MODES.size===ARMORY.length, 'armory + firemodes init');
    console.assert(getComputedStyle(document.getElementById('crosshair')).getPropertyValue('--aimColor').trim()!=='', 'crosshair color var');
    console.assert(typeof GLTFLoader==='function', 'GLTFLoader OK');
  }, 800);
  } catch(err){
    console.error('Tirana 2040 failed to bootstrap', err);
    window.__phase = `error:${err?.message||err}`;
    try { updateStatus('Tirana 2040 • Failed to load'); } catch(_){ }
    throw err;
  }
}
