import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createPublicTrail,advancePublicTrail} from './publicTrail.mjs';
import {makeWalkability,approachLandmark} from './publicMapGeometry.mjs';
import {createAerialTrail} from './aerialTrail.mjs';
import {createRescueFlight,rescueTargetFrom} from './rescueDrone.mjs';
import {loadRescueDrone,makeServiceVan} from './rescueDroneVisuals.mjs';
const el=id=>document.getElementById(id);
const canvas=document.querySelector('canvas');
const characterUrl='/assets/tirana-streets/players/turi.glb';
const TURI_HEIGHT=1.76;
async function start(){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene();
  scene.background=new T.Color(0x9cc6db);scene.fog=new T.FogExp2(0xb6d2d1,0.00225);
  const camera=new T.PerspectiveCamera(61,1,.08,560);
  scene.add(new T.HemisphereLight(0xf0f7ff,0x857657,2.1));
  const sun=new T.DirectionalLight(0xffe6c2,2.35);sun.position.set(-65,120,-48);scene.add(sun);
  const packet=await fetch('./assets/public-tirana-center.json').then(r=>{if(!r.ok)throw Error('Harta mungon.');return r.json()});
  const clear=makeWalkability(packet);
  const trail=createPublicTrail(packet.landmarks.map(landmark=>approachLandmark(landmark,clear)));
  const b=packet.bounds;
  const midX=(b[2]+b[0])/2,midZ=(b[3]+b[1])/2;
  const ground=new T.Mesh(new T.PlaneGeometry(b[2]-b[0]+30,b[3]-b[1]+30),new T.MeshStandardMaterial({color:0xa2a78a}));
  ground.rotateX(-Math.PI/2);ground.position.set(midX,-.02,midZ);scene.add(ground);
  const polygon=(points,height)=>new T.ShapeGeometry(new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)))).rotateX(-Math.PI/2).translate(0,height,0);
  const strip=({a,b,w},height)=>{const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz)||1;const x=-dz*w/(2*n),z=dx*w/(2*n);return polygon([[a[0]+x,a[1]+z],[b[0]+x,b[1]+z],[b[0]-x,b[1]-z],[a[0]-x,a[1]-z]],height)};
  const group=(polys,color)=>{if(!polys.length)return;const g=mergeGeometries(polys,false);for(const p of polys)p.dispose();if(g)scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color})))};
  group(packet.areas.map(p=>polygon(p,.022)),0xc7bfb0);group(packet.parks.map(p=>polygon(p,.013)),0x628759);
  group(packet.roads.filter(p=>!p.walk).map(p=>strip(p,.035)),0x656d71);
  group(packet.roads.filter(p=>p.walk).map(p=>strip(p,.046)),0xcac9ba);
  group(packet.water.map(p=>p.p?polygon(p.p,.028):strip(p,.028)),0x56979a);
  const shellColors=[0xc8bdad,0xb9c4c0,0xcdbca5,0xb99b85,0xd0b8a5,0xccc8b9];
  const shellGroups=new Map();
  packet.buildings.forEach(({p,h},i)=>{if(p.length<3)return;const geo=new T.ExtrudeGeometry(new T.Shape(p.map(([x,z])=>new T.Vector2(x,-z))),{depth:Math.max(2.8,h),bevelEnabled:false,steps:1}).rotateX(-Math.PI/2);const n=i%shellColors.length;if(!shellGroups.has(n))shellGroups.set(n,[]);shellGroups.get(n).push(geo)});
  for(const [i,geos] of shellGroups)group(geos,shellColors[i]);
  const loader=new GLTFLoader();
  const landmarkTask=loader.loadAsync('./assets/public-tirana-landmarks.glb').then(asset=>scene.add(asset.scene));
  const pin=new T.Mesh(new T.TorusGeometry(.55,.055,8,24),new T.MeshStandardMaterial({color:0xffec85,emissive:0x76620c}));pin.rotateX(-Math.PI/2);scene.add(pin);
  const [loaded]=await Promise.all([loader.loadAsync(characterUrl).catch(()=>{throw Error('Modeli origjinal i Turit nuk u ngarkua. Nuk u përdor zëvendësues.');}),landmarkTask]);
  const avatarRoot=new T.Group();let box=new T.Box3().setFromObject(loaded.scene);const scale=TURI_HEIGHT/Math.max(.01,box.max.y-box.min.y);
  const center=box.getCenter(new T.Vector3());loaded.scene.scale.setScalar(scale);loaded.scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);avatarRoot.add(loaded.scene);scene.add(avatarRoot);
  const mixer=new T.AnimationMixer(loaded.scene);
  const actions=Object.fromEntries(['idle','walk','run'].map(n=>[n,loaded.animations.find(c=>c.name.toLowerCase()===n)]).filter(([,c])=>c).map(([n,c])=>[n,mixer.clipAction(c)]));
  if(!actions.idle||!actions.walk||!actions.run)throw Error('Animacionet e Turit mungojnë.');
  let anim='idle';actions.idle.play();
  const serviceVan=rescueTargetFrom(trail[0],clear);
  const rescue=createRescueFlight(serviceVan,trail[0]);
  let drone=null,rotors=[];
  el('rescue').disabled=true;el('rescue').textContent='Duke ngarkuar dronin…';
  loadRescueDrone(loader).then(asset=>{
    ({drone,rotors}=asset);scene.add(drone);drone.visible=false;
    el('rescue').textContent='Fluturo me dron';el('rescue').disabled=false;
  }).catch(error=>{
    el('rescue').textContent='Droni nuk u ngarkua';console.warn(error);
  });
  const van=makeServiceVan(serviceVan);scene.add(van);van.visible=false;
  let rescueActive=false,airMode='free';
  const aerial=createAerialTrail(trail);
  const aerialPin=new T.Mesh(new T.TorusGeometry(5,.28,10,28),new T.MeshStandardMaterial({color:0x56ebdc,emissive:0x2b887d,emissiveIntensity:1.5}));
  scene.add(aerialPin);aerialPin.visible=false;
  const showTime=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds)%60).padStart(2,'0');
  let index=0,mode='3P',yaw=Math.atan2(trail[1].x-trail[0].x,trail[1].z-trail[0].z),pitch=.16;
  const pos=new T.Vector3(trail[0].x,0,trail[0].z),keys=new Set(),pointers=new Map();
  let groundView={yaw,pitch};
  let droneView={yaw,pitch:.51};
  function checkpoint(){const stop=trail[index];return stop?Math.hypot(stop.x-pos.x,stop.z-pos.z):0}
  function setLabel(){
    if(rescueActive){
      const state=rescue.state();pin.visible=false;
      if(airMode==='route'){
        const flight=aerial.state();el('stop').textContent=flight.complete?'Misioni ajror u përfundua':`${flight.index+1}/${flight.total} · ${flight.target.label}`;
        el('hint').textContent=flight.complete?'Përshkove të gjitha pikat ajrore.':'Kalo brenda unazës ndriçuese.';
        el('interact').hidden=true;return;
      }
      if(airMode==='free'){el('stop').textContent='Fluturim i lirë';el('hint').textContent='Eksploro qendrën nga lart ose zgjidh një mision.';el('interact').hidden=true;return;}
      const texts={
        search:['Kërkim me dron','Gjej furgonin portokalli. Afrohu dhe zgjidh Shëno.','Shëno furgonin'],
        found:['Furgoni u lokalizua','Dërgo njoftimin vetëm brenda lojës.','Njofto shpëtimin'],
        dispatched:['Ushtrimi përfundoi','Ekipi virtual i shpëtimit u njoftua.','Njoftuar']
      };
      el('interact').hidden=false;const [title,hint,button]=texts[state.phase];el('stop').textContent=title;el('hint').textContent=hint;el('interact').textContent=button;el('interact').disabled=!state.canInteract;
      return;
    }
    const stop=trail[index];el('interact').hidden=false;el('stop').textContent=stop?'Itinerari në këmbë · '+(index+1)+'/3 · '+stop.label:'Itinerari u përfundua';el('hint').textContent=stop?stop.action:'I verifikove të tria pikat e qytetit.';el('interact').textContent='Konfirmo';pin.visible=Boolean(stop);if(stop)pin.position.set(stop.x,2,stop.z);
  }
  function interact(){
    if(rescueActive){if(airMode==='rescue'){rescue.interact();setLabel();}return;}
    const next=advancePublicTrail(trail,index,pos,true);if(next.index!==index){index=next.index;setLabel();}
  }
  setLabel();el('controls').hidden=false;el('interact').addEventListener('click',interact);
  el('camera').addEventListener('click',()=>{mode=mode==='3P'?'FPV':'3P';el('camera').textContent='Kamera: '+mode});
  el('rescue').addEventListener('click',()=>{
    if(!drone)return;
    rescueActive=!rescueActive;clearInput();el('rescue').setAttribute('aria-pressed',String(rescueActive));
    el('rescue').textContent=rescueActive?'Kthehu te Turi':'Fluturo me dron';
    el('altitude').hidden=!rescueActive;el('air-mode-label').hidden=!rescueActive;drone.visible=rescueActive;
    if(rescueActive){groundView={yaw,pitch};({yaw,pitch}=droneView);}
    else{droneView={yaw,pitch};({yaw,pitch}=groundView);}
    van.visible=rescueActive&&airMode==='rescue';
    if(!rescueActive)aerialPin.visible=false;
    setLabel();
  });
  el('air-mode').addEventListener('change',()=>{
    if(!rescueActive)return;
    const picked=el('air-mode').value;
    if(!['free','rescue','route'].includes(picked))return;
    airMode=picked;van.visible=airMode==='rescue';
    if(airMode!=='route')aerialPin.visible=false;
    clearInput();setLabel();
  });
  for(const btn of document.querySelectorAll('[data-key]')){
    btn.addEventListener('pointerdown',e=>{btn.setPointerCapture(e.pointerId);pointers.set(e.pointerId,btn.dataset.key)});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,e=>pointers.delete(e.pointerId));
  }
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(e.target instanceof HTMLElement&&e.target.matches('select,option'))return;if(k==='e'&&!e.repeat&&!(e.target instanceof HTMLElement&&e.target.matches('button,a')))interact();if(['w','a','s','d','r','f','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault();}});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  function clearInput(){keys.clear();pointers.clear();drag=null}
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{if(drag)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY}});
  canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.006;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.y)*.003,-.45,.82);drag.x=e.clientX;drag.y=e.clientY});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null});
  window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();
  const facing=new T.Vector3(),right=new T.Vector3(),delta=new T.Vector3(),eye=new T.Vector3(),look=new T.Vector3(),follow=new T.Vector3();
  let stamp=performance.now(),raf=0,hudStamp=-1000,disposed=false;
  function frame(now){
    if(disposed)return;
    const dt=Math.min(.05,(now-stamp)*.001);stamp=now;
    const down=k=>keys.has(k)||Array.from(pointers.values()).includes(k);
    const f=Number(down('w')||down('arrowup'))-Number(down('s')||down('arrowdown'));
    const s=Number(down('d')||down('arrowright'))-Number(down('a')||down('arrowleft'));
    const run=down('shift');
    facing.set(Math.sin(yaw),0,Math.cos(yaw));right.set(-facing.z,0,facing.x);
    delta.copy(facing).multiplyScalar(f).addScaledVector(right,s);
    const moving=delta.lengthSq()>.01;
    if(rescueActive){
      const old=rescue.state(),height=Number(down('r'))-Number(down('f'));
      if(moving)delta.normalize().multiplyScalar(dt*10);
      const state=rescue.fly(old.x+delta.x,old.y+height*dt*7,old.z+delta.z,b);
      drone.position.set(state.x,state.y,state.z);drone.rotation.y=yaw;
      drone.visible=mode==='3P';avatarRoot.visible=true;
      rotors.forEach(rotor=>{rotor.rotation.y+=rotor.userData.spinDirection*dt*37;});
      follow.copy(drone.position).addScaledVector(facing,mode==='3P'?-6:1.1);
      follow.y+=mode==='3P'?3:-.2;
      look.copy(drone.position).addScaledVector(facing,mode==='3P'?8:12);
      look.y-=Math.max(4,(.25+pitch)*14);
      camera.position.copy(follow);camera.lookAt(look);
      let flight=null;
      if(airMode==='route'){
        const prev=aerial.state();flight=aerial.advance(state,dt);
        if(flight.index!==prev.index)setLabel();
        aerialPin.visible=!flight.complete;
        if(flight.target){
          aerialPin.position.set(flight.target.x,flight.target.y,flight.target.z);
          aerialPin.rotation.y=Math.atan2(state.x-flight.target.x,state.z-flight.target.z);
        }
      }
      if(now-hudStamp>120){
        hudStamp=now;el('interact').disabled=!(airMode==='rescue'&&state.canInteract);
        el('status').textContent=flight?showTime(flight.seconds)+' · '+(flight.target?Math.round(Math.hypot(state.x-flight.target.x,state.y-flight.target.y,state.z-flight.target.z))+' m deri te pika':'Koha e përfundimit'):Math.round(state.y)+' m lartësi · '+(airMode==='rescue'?'Ushtrim virtual':'Fluturim i lirë');
      }
    }else{
      if(moving){delta.normalize().multiplyScalar(dt*(run?7.6:4.2));if(clear(pos.x+delta.x,pos.z))pos.x+=delta.x;if(clear(pos.x,pos.z+delta.z))pos.z+=delta.z;avatarRoot.rotation.y=Math.atan2(delta.x,delta.z);}
      if(mode==='3P'){follow.copy(pos).addScaledVector(facing,-4.8);follow.y=3.1+pitch*2;eye.copy(pos).addScaledVector(facing,2);eye.y=1.4;camera.position.copy(follow);camera.lookAt(eye);}
      else{eye.copy(pos);eye.y=1.62;look.copy(eye).addScaledVector(facing,5);look.y-=pitch*4;camera.position.copy(eye);camera.lookAt(look);}
      avatarRoot.visible=mode==='3P';
      pin.position.y=1.7+Math.sin(now*.004)*.25;
      if(now-hudStamp>120){hudStamp=now;const distance=checkpoint();el('interact').disabled=index>=trail.length||distance>14;el('status').textContent=index<trail.length?Math.round(distance)+' m · Tërhiq ekranin për kamerën':'';}
    }
    const want=!rescueActive&&moving?(run?'run':'walk'):'idle';if(want!==anim){actions[anim].fadeOut(.15);actions[want].reset().fadeIn(.15).play();anim=want;}
    avatarRoot.position.copy(pos);mixer.update(dt);
    renderer.render(scene,camera);raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();mixer.stopAllAction();renderer.dispose();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();disposed=true;cancelAnimationFrame(raf);el('controls').hidden=true;el('stop').textContent='Grafika 3D u ndërpre. Rifresko për të provuar sërish.';});
}
start().catch(e=>{el('stop').textContent='Prova 3D nuk u hap';el('hint').textContent=e?.message||'Duhet WebGL.';console.error(e)});
