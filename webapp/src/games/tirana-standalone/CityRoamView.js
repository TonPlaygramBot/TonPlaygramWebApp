import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createWebGLRenderer} from '../tiranastreets/createWebGLRenderer';
import {AutomaticGraphics, DynamicResolution, GRAPHICS_PROFILES} from '../tiranastreets/graphicsQuality';
import {buildMobility, initialState, stepRoam, vehicleAction} from './walkDrive.mjs';

import {FramePacer,renderPixelRatio} from '../tiranastreets/renderSettings';
import {FollowCamera} from './FollowCamera';
import {fixedStepBudget} from '../tiranastreets/shared/frameBudget.mjs';
import {nextView,viewLabel,useAvatar,mapSvg,waypoint,TOUR_NAMES} from './roamPresentation.mjs';
import {buildCityCabin,prepareSedanWheels} from './cityCarVisuals.js';

import {LANA_DISTRICT,approachLana,appendDistrict,districtPlacements} from './district.mjs';

export const ASSETS='/assets/tirana-city-game/';
const N=100;
const paint=(color,roughness=.94)=>new T.MeshStandardMaterial({color,roughness});
const polygon=(p,y)=>{
  const g=new T.ShapeGeometry(new T.Shape(p.map(([x,z])=>new T.Vector2(x,-z))));
  return g.rotateX(-Math.PI/2).translate(0,y,0);
};
const strip=({a,b,w},y)=>{
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<.02)return null;
  const dx=(b[1]-a[1])*w/(2*length),dz=(a[0]-b[0])*w/(2*length);
  return polygon([[a[0]+dx,a[1]+dz],[b[0]+dx,b[1]+dz],[b[0]-dx,b[1]-dz],[a[0]-dx,a[1]-dz]],y);
};
function wall(p,h){
  const g=new T.ExtrudeGeometry(new T.Shape(p.map(([x,z])=>new T.Vector2(x,-z))),{depth:h,bevelEnabled:false});
  return g.rotateX(-Math.PI/2);
}
function worldUv(g){
  const pts=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pts.count;i++)uv.setXY(i,pts.getX(i)/2.8,pts.getZ(i)/2.8);
  return g;
}
const signPoint=((p)=>[p.reduce((a,c)=>a+c[0],0)/p.length,p.reduce((a,c)=>a+c[1],0)/p.length]);
const shadowSize=150;
const disposeScene=(scene)=>{
  const meshes=new Set(),mats=new Set(),imgs=new Set();
  scene.traverse(o=>{
    if(!o.isMesh)return;
    meshes.add(o.geometry);
    for(const m of [o.material].flat()){
      mats.add(m);
      for(const key of Object.keys(m))if(m[key]?.isTexture)imgs.add(m[key]);
    }
  });
  for(const g of meshes)g.dispose();for(const m of mats)m.dispose();for(const i of imgs)i.dispose();
};
const nearestName=(state,landmarks)=>{
  const labels=TOUR_NAMES;
  let name='',distance=Infinity;
  for(const p of landmarks){const d=Math.hypot(p.x-state.x,p.z-state.z);if(d<distance){name=labels[p.id];distance=d;}}
  return {name,distance:Math.round(distance)};
};

export class CityRoamView{
  scene=new T.Scene();
  camera=new T.PerspectiveCamera(62,1,.17,560);
  follow=new FollowCamera();
  framePacer=new FramePacer();
  walkView='eyes';
  driveView='chase';
  touch={x:0,y:0,brake:false};
  keys=new Set();
  chunks=[];
  pavement=paint('#68696b');
  auto=new AutomaticGraphics();
  dpr=new DynamicResolution();
  elapsed=0; frameCount=0; last=0; accumulator=0; firstFrame=false; fps=0; quality='auto'; paused=false;
  constructor(root,publish){
    this.root=root;this.publish=publish;
    this.renderer=createWebGLRenderer();
    this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.14;
    this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.domElement.addEventListener('webglcontextlost',this.lost);
    root.append(this.renderer.domElement);
    this.scene.background=new T.Color('#aebfc7');
    this.scene.fog=new T.Fog('#aebfc7',85,390);
    this.scene.add(new T.HemisphereLight('#d7eaff','#74675d',2.0));
    this.sun=new T.DirectionalLight('#ffe0ba',2.45);
    this.sun.castShadow=true;
    this.sun.shadow.normalBias=.18;
    this.sun.shadow.bias=-.0005;
    Object.assign(this.sun.shadow.camera,{left:-shadowSize/2,right:shadowSize/2,top:shadowSize/2,bottom:-shadowSize/2,near:10,far:420});
    this.scene.add(this.sun,this.sun.target);
    this.observer=new ResizeObserver(this.resize);
    this.observer.observe(root);
    window.addEventListener('keydown',this.keyDown);
    window.addEventListener('keyup',this.keyUp);
    window.addEventListener('blur',this.blur);
    document.addEventListener('visibilitychange',this.visibility);
    this.applyQuality();
    this.abort=new AbortController();
    void this.load();
  }
  emit(extra={}){
    this.publish({state:this.state?.mode,assetReady:!!this.car,ready:this.firstFrame,paused:this.paused,fps:this.fps,
      speed:Math.round(Math.abs(this.state?.car.speed||0)*3.6),near:this.state&&Math.hypot(this.state.x-this.state.car.x,this.state.z-this.state.car.z)<=4,
      landmark:this.state&&nearestName(this.state,this.city.landmarks),player:this.state&&{x:this.state.x,z:this.state.z,yaw:this.state.yaw},
      cameraLabel:viewLabel[this.state?.mode==='drive'?this.driveView:this.walkView],destination:this.state&&waypoint(this.state,this.city.landmarks,this.destination),...extra});
  }
  applyQuality(){
    const p=GRAPHICS_PROFILES[this.quality==='auto'?this.auto.preset:this.quality];
    this.radius=p.shadows?252:160;this.battery=!p.shadows;
    this.targetFps=p.shadows?60:30;
    this.requestedRatio=p.pixelRatio*this.dpr.scale;
    this.renderer.shadowMap.enabled=p.shadows;
    if(this.sun.shadow.mapSize.width!==p.shadowSize){
      this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(p.shadowSize,p.shadowSize);
    }
    this.sun.shadow.needsUpdate=true;
    this.camera.far=p.shadows?450:245;
    this.camera.updateProjectionMatrix();

    this.resize();
  }
  setQuality(q){if(!['auto','balanced','battery','high'].includes(q))return;this.quality=q;this.dpr.reset();this.auto.reset();this.applyQuality();if(this.paused)this.schedule(true);}
  resize=()=>{
    const w=Math.max(1,this.root.clientWidth),h=Math.max(1,this.root.clientHeight);
    const ratio=renderPixelRatio(w,h,window.devicePixelRatio||1,this.requestedRatio);
    if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    if(this.paused)this.schedule(true);
  };
  async load(){
    try{
      const response=await fetch(ASSETS+'central-city.json',{signal:this.abort.signal});
      if(!response.ok)throw new Error('Harta nuk u ngarkua.');
      const city=await response.json();
      if(this.dead)return;
      this.city=city;this.mobility=buildMobility(city);this.state=initialState(this.mobility);
      this.makeCity(city);this.emit({map:mapSvg(city)});
      this.schedule();
    }catch(e){if(!this.dead)this.emit({error:'Qyteti nuk u hap. Rifillo për ta provuar përsëri.'});}
  }
  async loadLana(){
    if(this.lanaPhase)return;
    this.lanaPhase='pending';
    try{
      const response=await fetch(ASSETS+LANA_DISTRICT,{signal:this.abort.signal});
      if(!response.ok)throw Error('Lana not available');
      const zone=await response.json();
      if(this.dead)return;
      const merged=appendDistrict(this.city,zone),mobility=buildMobility(merged,this.mobility.spawn);
      if(!await this.stageLanaGeometry({...zone,markings:[]}))return;
      this.city=merged;this.mobility=mobility;this.lanaPhase='ready';
      this.emit({map:mapSvg(merged),district:'Lana dhe Blloku'});
      const {DistrictDecor}=await import('./DistrictDecor.js');
      if(!this.dead)this.districtDecor=new DistrictDecor(this.scene,districtPlacements(zone,mobility),ASSETS,disposeScene);
    }catch{if(!this.dead&&this.lanaPhase!=='ready'){this.lanaPhase='unavailable';this.emit({detail:'Lagjja e Lanës nuk u ngarkua; mund të vazhdosh në qendër.'});}}
  }
  makeCity(city){
    const sequence=this.assembleCity(city);
    let step=sequence.next();while(!step.done)step=sequence.next();
    this.attachCity(step.value);
  }
  attachCity({stage,chunks}){
    this.scene.add(stage);this.chunks.push(...chunks);
  }
  yieldPaint=()=>new Promise(resolve=>{
    const signal=this.abort.signal;if(signal.aborted){resolve();return;}
    const done=()=>{cancelAnimationFrame(frame);signal.removeEventListener('abort',done);resolve();};
    const frame=requestAnimationFrame(done);
    signal.addEventListener('abort',done,{once:true});
  });
  async stageLanaGeometry(city){
    const sequence=this.assembleCity(city,true);
    try{
      let deadline=performance.now()+5;
      for(;;){
        if(this.dead||this.abort.signal.aborted)return false;
        const step=sequence.next();
        if(step.done){this.attachCity(step.value);return true;}
        if(performance.now()>=deadline){await this.yieldPaint();deadline=performance.now()+5;}
      }
    }finally{sequence.return();}
  }
  *assembleCity(city,nextDistrict=false){
    const [x0,z0,x1,z1]=city.bounds,pools=new Map(),stage=new T.Group(),chunks=[];
    let success=false;
    const colors=['#c5a58e','#ccc3a9','#bcb7ae','#b7a6a0','#b6abab','#b4b7b2'].map(paintColor=>paint(paintColor));
    const park=paint('#7d895f'), walk=paint('#c2b69e'), curb=paint('#b9afa0'), water=paint('#477c85',.47);
    const add=(p,g,mat,shadow=false)=>{
      if(!g)return;
      const [x,z]=signPoint(p),key=Math.floor(x/N)+','+Math.floor(z/N);
      if(!pools.has(key))pools.set(key,new Map());
      const pool=pools.get(key),part=mat.uuid;
      if(!pool.has(part))pool.set(part,{mat,geoms:[],shadow});
      const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
      flat.clearGroups(); pool.get(part).geoms.push(flat);
    };
    const ground= new T.Mesh(new T.PlaneGeometry(x1-x0+80,z1-z0+80),paint('#9e9a7f'));ground.rotation.x=-Math.PI/2;ground.position.set((x0+x1)/2,nextDistrict?-.091:-.09,(z0+z1)/2);ground.receiveShadow=true;stage.add(ground);
    try{
    for(const p of city.parks){add(p,polygon(p,.006),park);yield;}
    for(const p of city.areas){add(p,polygon(p,.018),walk);yield;}
    for(const r of city.roads){
      const p=[r.a,r.b];
      if(!r.walk)add(p,strip({...r,w:r.w+1.5},.035),curb);
      const geom=strip(r,r.bridge ? .084 : r.walk ? .052 : .059);
      if(geom)add(p,r.walk?geom:worldUv(geom),r.walk?walk:this.pavement);yield;
    }
    for(const w of city.water){w.p?add(w.p,polygon(w.p,.068),water):add([w.a,w.b],strip(w,.068),water);yield;}
    for(const [i,{p,h}] of city.buildings.entries()){
      add(p,wall(p,Math.max(2,Math.min(83,h||6))),colors[i%colors.length],true);yield;
    }
    // A plain mass preserves the map and collision without recreating an unreviewed modern facade.
    city.markings.filter(m=>m.id==='pyramid'&&m.footprint).forEach(m=>add(m.footprint,wall(m.footprint,8),colors[2],true));
    for(const [key,parts] of pools){
      const group=new T.Group();
      for(const {mat,geoms,shadow} of parts.values()){
        const merged=mergeGeometries(geoms,false);
        for(const g of geoms)g.dispose();geoms.length=0;
        if(!merged)continue;
        merged.computeBoundingSphere();
        const mesh=new T.Mesh(merged,mat);mesh.castShadow=shadow;mesh.receiveShadow=true;group.add(mesh);
      }
      const [x,z]=key.split(',').map(Number);
      const box=new T.Box3().setFromObject(group);
      const center=new T.Vector3().set((x+.5)*N,0,(z+.5)*N);
      const extent=box.isEmpty()?N:Math.max(Math.hypot(center.x-box.min.x,center.z-box.min.z),Math.hypot(center.x-box.max.x,center.z-box.max.z));
      chunks.push({group,center,extent});stage.add(group);yield;
    }
    success=true;return {stage,chunks};
    }finally{
      if(!success){
        for(const parts of pools.values())for(const {geoms} of parts.values())for(const g of geoms)g.dispose();
        stage.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
        for(const m of [...colors,park,walk,curb,water,ground.material])m.dispose();
      }
    }
  }
  loadDetail(){
    const loader=new GLTFLoader(),textures=new T.TextureLoader();
    const setTexture=(file,color)=>{
      textures.load(ASSETS+file,t=>{
        if(this.dead){t.dispose();return;}
        t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
        if(color){t.colorSpace=T.SRGBColorSpace;this.pavement.map=t;this.pavement.color.set('#c9c9c9');}
        else{this.pavement.normalMap=t;this.pavement.normalScale.set(.52,.52);}
        this.pavement.needsUpdate=true;
      },undefined,()=>{});
    };
    setTexture('asphalt-color.webp',true);setTexture('asphalt-normal.webp',false);
    loader.load(ASSETS+'sedan.glb',({scene})=>{
      if(this.dead){disposeScene(scene);return;}
      const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
      const scale=4.25/Math.max(size.x,size.z);
      if(!Number.isFinite(scale)||scale<=0){disposeScene(scene);this.emit({detail:'Modeli i makinës nuk u ngarkua.'});return;}
      scene.scale.setScalar(scale);scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
      this.car=new T.Group();this.car.add(scene);this.scene.add(this.car);
      this.wheels=prepareSedanWheels(scene);
      this.emit();
    },undefined,()=>!this.dead&&this.emit({detail:'Modeli i makinës nuk u ngarkua.'}));
    // Hero meshes are non-blocking. Import only two project-authored historic exterior studies.
    this.landmarkTimer=setTimeout(()=>{if(this.dead)return;loader.load(ASSETS+'public-landmarks.glb',({scene})=>{
      if(this.dead){disposeScene(scene);return;}
      scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      this.heroNodes=[...scene.children];this.scene.add(scene);
    },undefined,()=>!this.dead&&this.emit({detail:'Disa monumente 3D nuk u ngarkuan.'}));},300);
  }
  keyDown=e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyR','KeyC','KeyJ','Space','Escape'].includes(e.code)||e.defaultPrevented||/^(SELECT|INPUT|TEXTAREA)$/.test(e.target?.tagName||'')||((e.code==='Space'||e.code==='Enter')&&/^(BUTTON|A)$/.test(e.target?.tagName||''))||e.target?.isContentEditable||!this.firstFrame)return;
    e.preventDefault();
    if(!e.repeat&&e.code==='KeyE')this.vehicle();
    else if(!e.repeat&&e.code==='KeyC')this.cycleCamera();
    else if(!e.repeat&&e.code==='KeyJ')this.jump();
    else if(!e.repeat&&e.code==='Escape')this.pause(!this.paused);
    else if(!this.paused)this.keys.add(e.code);
  };
  keyUp=e=>this.keys.delete(e.code);
  resetInput=()=>{this.keys.clear();Object.assign(this.touch,{x:0,y:0,brake:false});this.nextJump=false;if(this.state)this.state.car.speed=0;};
  blur=()=>{if(this.firstFrame)this.pause(true);};
  visibility=()=>{
    if(document.hidden){if(this.firstFrame)this.pause(true);cancelAnimationFrame(this.raf);this.raf=0;this.last=0;}
    else this.schedule(true);
  };
  lost=e=>{e.preventDefault();this.pause(true);cancelAnimationFrame(this.raf);this.raf=0;this.fault=true;this.emit({error:'Pamja 3D u ndërpre. Rifillo lojën.'});};
  pause(value){
    this.paused=value;this.resetInput();this.emit();this.last=0;this.elapsed=0;this.frameCount=0;
    if(value){cancelAnimationFrame(this.raf);this.raf=0;}
    else this.schedule();
  }
  vehicle(){
    if(!this.state||!this.car||this.paused)return;
    const message=vehicleAction(this.state,this.mobility);
    if(!message)this.resetInput();
    this.follow.reset();this.emit({detail:message});
  }
  setDestination(id){if(!this.city?.landmarks.some(p=>p.id===id))return;this.destination=this.destination===id?undefined:id;this.emit();}
  jump(){if(!this.paused&&this.state?.mode==='walk'&&this.state.walkY===0){this.nextJump=true;}}
  cycleCamera(){
    if(!this.state||this.paused||this.fault)return;
    if(this.state.mode==='drive')this.driveView=nextView('drive',this.driveView);
    else{this.walkView=nextView('walk',this.walkView);if(this.walkView!=='eyes')void this.loadAvatar();}
    this.follow.reset();this.emit();
  }
  async loadAvatar(){
    if(this.avatar?.root||this.avatarPending)return;
    this.avatarPending=true;this.emit({avatarLoading:true});
    try{
      const {TuriWalker}=await import('./TuriWalker.js');if(this.dead)return;
      const model=new TuriWalker();
      if(await model.load(this.abort.signal,disposeScene)){
        this.avatar=model;this.scene.add(model.root);
      }
    }catch{if(!this.dead){this.walkView='eyes';this.emit({detail:'Turi nuk u ngarkua. Pamja nga sytë mbetet aktive.'});}}
    finally{this.avatarPending=false;if(!this.dead)this.emit({avatarLoading:false});}
  }
  look(dx,dy){if(!this.state||this.paused||this.state.mode!=='walk')return;this.state.yaw+=dx*.0046;this.pitch=T.MathUtils.clamp((this.pitch??-.055)-dy*.0042,-.68,.67);}
  cast=(origin,ray,distance)=>{
    for(let d=.24;d<=distance;d+=.32)if(this.mobility.obstructed(origin.x+ray.x*d,origin.z+ray.z*d,.08))return d;
    return distance;
  };
  positionCamera(s,dt){
    const drive=s.mode==='drive',view=drive?this.driveView:(this.avatar?.root?this.walkView:'eyes'),pitch=this.pitch??-.055;
    const targetFov=view==='cockpit'?(this.camera.aspect<.8?78:68):view==='wide'?67:62;
    if(this.camera.fov!==targetFov){this.camera.fov=targetFov;this.camera.updateProjectionMatrix();}
    const dx=Math.sin(s.yaw),dz=Math.cos(s.yaw),y=1.69+(s.walkY||0);
    if(view==='eyes'){
      this.camera.position.set(s.x,y,s.z);this.camera.lookAt(s.x+dx,y+Math.tan(pitch),s.z+dz);
    }else if(view==='cockpit'){
      const eye={x:s.x-.37*Math.cos(s.yaw),y:1.22,z:s.z+.37*Math.sin(s.yaw)};
      this.camera.position.set(eye.x,eye.y,eye.z);this.camera.lookAt(eye.x+dx,eye.y-.06,eye.z+dz);
      if(!this.cabin){this.cabin=buildCityCabin();this.scene.add(this.cabin.group);}
      this.cabin.group.position.copy(this.camera.position);
      this.cabin.group.rotation.y=s.yaw+Math.PI;
      this.cabin.wheel.rotation.z=-.85*(s.car.steer||0);
      this.cabin.needle.rotation.z=2.2-Math.min(1,Math.abs(s.car.speed)/11)*4.4;
    }else{
      const shoulder=view==='shoulder';
      this.follow.update(this.camera,{key:s.mode+view,anchor:{x:s.x,y:drive?1.5:y,z:s.z},yaw:s.yaw+Math.PI,
        pitch:shoulder?-.18:view==='wide'?-.38:-.28,lookPitch:drive?-.03:pitch,
        distance:shoulder?3.85:view==='wide'?(drive?9.0:6.7):6.3,
        shoulder:shoulder?-.58:0,dt,cast:this.cast,ground:()=>.04});
    }
    if(this.cabin)this.cabin.group.visible=view==='cockpit';
    if(this.car)this.car.visible=view!=='cockpit';
    this.avatar?.update(s,view!=='eyes'&&useAvatar(s,this.walkView),dt);
  }
  schedule(force=false){if(!this.dead&&!this.fault&&!document.hidden&&this.state&&!this.raf&&(!this.paused||force))this.raf=requestAnimationFrame(this.draw);}
  draw=now=>{
    this.raf=0;
    if(!this.paused&&!this.framePacer.shouldRender(now,this.targetFps)){this.schedule();return;}
    try{this.tick(now);}catch{this.fault=true;this.resetInput();this.emit({error:'Pamja 3D nuk mund të vazhdojë. Rifillo lojën.'});}
    this.schedule();
  };
  tick(now){
    const {state:s}=this,k=(...keys)=>keys.some(key=>this.keys.has(key))?1:0;
    const input={x:k('ArrowRight','KeyD')-k('ArrowLeft','KeyA')+this.touch.x,y:k('ArrowUp','KeyW')-k('ArrowDown','KeyS')+this.touch.y,brake:this.touch.brake||!!k('Space')};
    const dt=this.last?(now-this.last)/1000:0;this.last=now;
    if(!this.paused){
      if(s.mode==='walk')s.yaw+=(k('KeyR')-k('KeyQ'))*Math.min(.07,dt)*1.6;
      const budget=fixedStepBudget(this.accumulator,Math.min(.085,dt),4);
      for(let i=0;i<budget.steps;i++){
        stepRoam(s,this.mobility,{...input,jump:this.nextJump},budget.step);
        this.nextJump=false;
      }
      this.accumulator=budget.remainder;
    }else this.accumulator=0;
    const car=s.car;
    if(this.car){
      this.car.position.set(car.x,.068,car.z);this.car.rotation.y=car.yaw+Math.PI;
      for(const w of this.wheels){if(w.front)w.yaw.rotation.y=(car.steer||0)*.49;w.pivot.rotation.x=-car.wheel;}
    }
    this.positionCamera(s,this.paused?0:Math.min(.07,dt));
    const x=Math.round(s.x/12)*12,z=Math.round(s.z/12)*12;
    this.sun.target.position.set(x,0,z);this.sun.position.set(x-90,150,z-67);
    for(const {group,center,extent} of this.chunks)group.visible=Math.hypot(center.x-s.x,center.z-s.z)<=this.radius+extent;
    for(const o of this.heroNodes||[])o.visible=Math.hypot(o.position.x-s.x,o.position.z-s.z)<this.radius;
    if(this.districtDecor)this.districtDecor.update(s,this.battery);
    this.renderer.render(this.scene,this.camera);
    if(!this.firstFrame){this.firstFrame=true;this.emit();this.loadDetail();}
    if(!this.paused&&this.firstFrame&&!this.lanaPhase&&approachLana(s))void this.loadLana();
    if(!this.paused&&dt<.3){
      this.elapsed+=dt;this.frameCount++;
      if(this.elapsed>=2){
        this.fps=Math.round(this.frameCount/this.elapsed);this.frameCount=0;this.elapsed=0;
        this.adaptToFrames(this.fps);
        this.emit();
      }
    }
    if(now-(this.lastHud||0)>225){this.lastHud=now;this.emit();}
  }
  adaptToFrames(fps){
    if(this.quality!=='auto')return;
    const target=this.targetFps,healthy=fps>=target*.97;
    let changed=this.dpr.sample(fps,target);
    // Lower presets must not be judged against an unattainable 60 FPS while
    // capped at 30. After sustained recovery, allow one bounded quality probe.
    if((this.dpr.atMinimum||healthy)&&this.auto.sample(fps,target)){
      this.dpr.reset();changed=true;
    }
    if(changed)this.applyQuality();
  }
  dispose(){
    this.dead=true;this.abort.abort();clearTimeout(this.landmarkTimer);cancelAnimationFrame(this.raf);this.observer.disconnect();
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.blur);
    document.removeEventListener('visibilitychange',this.visibility);this.renderer.domElement.removeEventListener('webglcontextlost',this.lost);
    this.districtDecor?.dispose();this.avatar?.dispose();disposeScene(this.scene);this.sun.shadow.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
