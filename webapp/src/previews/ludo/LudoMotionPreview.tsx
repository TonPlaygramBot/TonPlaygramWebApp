import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { V, smooth, world, makeActor, pose, palmOrientation, solveArm, heldPose, type Weapon } from './motion';

declare const LUDO_PREVIEW_MODEL: string;
const metal = new THREE.MeshStandardMaterial({ color: '#303b3e', metalness: .8, roughness: .36 });
const polymer = new THREE.MeshStandardMaterial({ color: '#252c2c', roughness: .75 });
const brass = new THREE.MeshStandardMaterial({ color: '#d1ab60', metalness: .72, roughness: .3 });
function box(parent: THREE.Object3D, size: number[], point: number[], mat = polymer) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]), mat);
  mesh.position.set(...point as [number,number,number]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: THREE.Object3D, radius: number, length: number, point: number[], mat = metal, alongZ = true) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), mat);
  if (alongZ) mesh.rotation.x = Math.PI/2;
  mesh.position.set(...point as [number,number,number]); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function makeWeapon(id: string): Weapon {
  const root = new THREE.Group();
  const pistol = id === 'pistol', short = id === 'smg';
  if (pistol) {
    box(root, [.026,.037,.122], [0,.03,.038], metal);
    const handle = box(root, [.026,.066,.03], [0,-.015,-.008]); handle.rotation.x = -.2;
    cylinder(root,.008,.124,[0,.029,.039]);
    box(root,[.008,.009,.008],[0,.053,.083]); box(root,[.016,.007,.007],[0,.053,-.015]);
  } else {
    box(root,[.031,.049,short?.125:.19],[0,.029,.027],metal);
    box(root,[.027,.081,.043],[0,-.027,-.061]);
    const mag = box(root,[.023,short?.08:.115,.042],[0,-.033,.042]); mag.rotation.x = -.14;
    box(root,[.044,.055,short?.13:.20],[0,.03,short?.135:.177]);
    for(let i=0;i<7;i++) box(root,[.047,.007,.008],[0,.061,.084+i*.018],metal);
    cylinder(root,.009,short?.12:.18,[0,.043,short?.23:.30]);
    cylinder(root,.013,.027,[0,.043,short?.286:.382]);
    cylinder(root,.011,.12,[0,.037,-.135]);
    box(root,[.041,.076,.072],[0,.019,-.197]);
    box(root,[.045,.079,.012],[0,.019,-.236]);
    box(root,[.008,.025,.012],[0,.074,short?.258:.34]);
    box(root,[.025,.02,.032],[0,.071,-.016]);
  }
  const guard = new THREE.Mesh(new THREE.TorusGeometry(.018,.003,6,16),metal);
  guard.rotation.y=Math.PI/2; guard.position.set(0,-.008,pistol?.026:-.033); root.add(guard);
  return { root, pistol, stock:V(0,.028,-.24), grip:V(0,-.018,pistol?-.009:-.06), support:V(0,.005,pistol?.012:short?.13:.16), muzzle:V(0,pistol?.029:.043,pistol?.102:short?.30:.40) };
}
function makeDie() {
  const die = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color:'#ece7d9',roughness:.28 });
  box(die,[.036,.036,.036],[0,0,0],shell);
  const pipMat = new THREE.MeshStandardMaterial({color:'#273332',roughness:.5});
  const pipGeo = new THREE.CircleGeometry(.0029,12);
  const faces = [V(0,1,0), V(0,0,1), V(1,0,0), V(-1,0,0), V(0,0,-1), V(0,-1,0)];
  const patterns = [[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]];
  faces.forEach((normal,i)=>{
    const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),normal);
    patterns[i].forEach(([x,y])=>{ const p=new THREE.Mesh(pipGeo,pipMat); p.position.copy(V(x*.009,y*.009,.0182).applyQuaternion(q)); p.quaternion.copy(q); die.add(p); });
  }); return die;
}
async function modelJson() {
  const bytes=Uint8Array.from(atob(LUDO_PREVIEW_MODEL),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
function App() {
  const canvas=useRef<HTMLDivElement>(null), controls=useRef<{ start:(kind:string)=>void; weapon:(id:string)=>void }>();
  const [ready,setReady]=useState(false), [busy,setBusy]=useState(false), [status,setStatus]=useState('Loading character…'), [selected,setSelected]=useState('rifle');
  useEffect(()=>{
    let dead=false, raf=0, dispose=()=>{};
    modelJson().then(json=>{
      if(dead)return;
      const host=canvas.current!, renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
      renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
      host.appendChild(renderer.domElement); renderer.domElement.setAttribute('aria-label','Seated human picking up a die and aiming tabletop weapons');
      const scene=new THREE.Scene(); scene.background=new THREE.Color('#172824');
      const camera=new THREE.PerspectiveCamera(38,1,.01,20);
      camera.position.set(-1.20,1.09,-2.10); camera.lookAt(-.10,.36,-.50);
      scene.add(new THREE.HemisphereLight('#eaf3ec','#657768',2));
      const key=new THREE.DirectionalLight('#fff1d6',3);key.position.set(1.2,3,2);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.bias=-.0004;scene.add(key);
      const {actor,rig,rightPalm,leftPalm}=makeActor(json);scene.add(actor);
      const shoulderY=world(rig.rightUpperArm).y, tableY=shoulderY-.21;
      const floorMat=new THREE.MeshStandardMaterial({color:'#243a30',roughness:1});
      box(scene,[4,.03,4],[0,-.065,0],floorMat);
      const wood=new THREE.MeshStandardMaterial({color:'#62462d',roughness:.55});
      const felt=new THREE.MeshStandardMaterial({color:'#31594b',roughness:.94});
      box(scene,[1.48,.075,1.4],[0,tableY-.05,.02],wood);
      box(scene,[1.42,.014,1.34],[0,tableY-.007,.02],felt);
      const chairMat=new THREE.MeshStandardMaterial({color:'#5a3931',roughness:.65});
      box(scene,[.40,.045,.40],[0,.28,-.74],chairMat);
      box(scene,[.43,.31,.045],[0,.45,-.97],chairMat);
      for(const x of [-.17,.17])for(const z of [-.9,-.58])box(scene,[.025,.30,.025],[x,.12,z],wood);
      const board=new THREE.Group();scene.add(board);
      const ivory=new THREE.MeshStandardMaterial({color:'#d0c6a4',roughness:.82});
      box(board,[.64,.016,.64],[-.17,tableY+.008,.12],ivory);
      const colors=['#bc5352','#d0ab48','#568bba','#69a275'];
      colors.forEach((color,i)=>{
        const mat=new THREE.MeshStandardMaterial({color,roughness:.68});
        const x=-.17+(i%2?1:-1)*.205,z=.12+(i<2?-1:1)*.205;
        box(board,[.195,.004,.195],[x,tableY+.019,z],mat);
        for(let j=0;j<4;j++)cylinder(board,.018,.025,[x+(j%2?1:-1)*.042,tableY+.035,z+(j<2?-1:1)*.042],mat,false);
      });
      for(let i=-7;i<=7;i++)for(const j of [-1,0,1]){
        if(Math.abs(i)>1){for(const [x,z]of [[i*.041,j*.041],[j*.041,i*.041]])box(board,[.035,.003,.035],[x-.17,tableY+.019,z+.12],new THREE.MeshStandardMaterial({color:'#e8dfc9'}));}
      }
      const die=makeDie(); scene.add(die);
      const dieHome=V(-.20,tableY+.026,-.52);die.position.copy(dieHome);
      const landing=V(-.14,tableY+.026,-.34);
      let pickup=dieHome.clone();
      const target=V(.04,tableY+.08,.55);
      const targetMat=new THREE.MeshStandardMaterial({color:'#c09250',metalness:.6,roughness:.35});
      cylinder(scene,.034,.09,target.toArray(),targetMat,false);
      let weapon=makeWeapon('rifle');scene.add(weapon.root);
      const park=V(-.30,tableY+.045,-.51),parkQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI*.12,Math.PI/2));
      weapon.root.position.copy(park);weapon.root.quaternion.copy(parkQ);
      let action='',start=0,releasePosition=V(),releaseQ=new THREE.Quaternion(),released=false,gripFrom=V(),leftFrom=V(),poseFrom:any[]=[],shot=-1;
      const casings:{mesh:THREE.Mesh;origin:THREE.Vector3;velocity:THREE.Vector3;start:number}[]=[];
      const flash=new THREE.Mesh(new THREE.ConeGeometry(.015,.08,8),new THREE.MeshBasicMaterial({color:'#ffe0a4',transparent:true,opacity:.8}));flash.rotation.x=Math.PI/2;flash.visible=false;scene.add(flash);
      const bullet=new THREE.Mesh(new THREE.SphereGeometry(.006,8,6),brass);bullet.visible=false;scene.add(bullet);
      let bulletFrom=V(),bulletTime=-99;
      function mark(text:string){setStatus(text);}
      function startAction(kind:string){
        if(action)return;
        action=kind;start=performance.now();released=false;shot=-1;
        pose(rig);gripFrom=world(rightPalm);leftFrom=world(leftPalm);poseFrom=[];
        if(kind==='dice')pickup.copy(die.position);
        setBusy(true);mark(kind==='dice'?'Pick up':'Reach');
      }
      controls.current={start:startAction,weapon(id){
        scene.remove(weapon.root);weapon=makeWeapon(id);scene.add(weapon.root);weapon.root.position.copy(park);weapon.root.quaternion.copy(parkQ);
      }};
      const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};
      const observer=new ResizeObserver(resize);observer.observe(host);resize();setReady(true);mark('Ready');
      const saved=()=>rig.bones.map(b=>b.quaternion.clone());
      const blendPose=(previous:any[],t:number)=>rig.bones.forEach((b,i)=>b.quaternion.slerpQuaternions(previous[i],b.quaternion,smooth(t)));
      function frame(now:number){
        if(dead)return;
        const t=(now-start)/1000;
        if(action==='dice'){
          if(t<.55){
            pose(rig,'reachDice',smooth(t/.55),0);
            solveArm(rig,'right',rightPalm,gripFrom.clone().lerp(pickup,smooth(t/.55)),undefined,true);
            poseFrom=saved();
          }else if(t<.72){
            pose(rig,'gripDice',1,smooth((t-.55)/.17));
            solveArm(rig,'right',rightPalm,pickup,undefined,true);die.position.copy(world(rightPalm));die.quaternion.copy(rightPalm.getWorldQuaternion(new THREE.Quaternion()));poseFrom=saved();mark('Grip');
          }else if(t<1.08){
            pose(rig,'windUp',1,1);blendPose(poseFrom,(t-.72)/.36);actor.updateMatrixWorld(true);
            die.position.copy(world(rightPalm));die.quaternion.copy(rightPalm.getWorldQuaternion(new THREE.Quaternion()));mark('Wind up');
          }else if(t<1.34){
            pose(rig,'windUp',1,1);const wind=saved();pose(rig,'release',1,1-smooth((t-1.08)/.26));blendPose(wind,(t-1.08)/.26);actor.updateMatrixWorld(true);
            die.position.copy(world(rightPalm));die.quaternion.copy(rightPalm.getWorldQuaternion(new THREE.Quaternion()));mark('Throw');
          }else{
            if(!released){
              // Sample the exact release pose, including when a frame crosses the boundary.
              pose(rig,'release',1,0);actor.updateMatrixWorld(true);die.position.copy(world(rightPalm));die.quaternion.copy(rightPalm.getWorldQuaternion(new THREE.Quaternion()));
              releasePosition.copy(die.position);releaseQ.copy(die.quaternion);released=true;poseFrom=saved();
            }
            const flight=Math.min(1,(t-1.34)/.92);
            die.position.copy(releasePosition).lerp(landing,flight);
            die.position.y+=Math.sin(flight*Math.PI)*.14;
            const tumble=new THREE.Quaternion().setFromEuler(new THREE.Euler(flight*Math.PI*4,flight*Math.PI*2,flight*Math.PI*3));
            die.quaternion.copy(releaseQ).multiply(tumble);
            if(flight>.77)die.quaternion.slerp(new THREE.Quaternion(),smooth((flight-.77)/.23));
            pose(rig);blendPose(poseFrom,(t-1.34)/.6);mark(flight<1?'Roll':'Rolled 1');
            if(t>2.5){action='';setBusy(false);}
          }
        }else if(action==='fire'){
          pose(rig,weapon.pistol?'firearmAimPistol':'firearmAimRifle',1,1);
          const held=heldPose(rig,weapon,target);
          const lift=smooth((t-.6)/.6),returning=t>2.55,amount=returning?1-smooth((t-2.55)/.7):lift;
          weapon.root.position.copy(park).lerp(held.position,amount);weapon.root.quaternion.copy(parkQ).slerp(held.q,amount);
          if(t>=1.35&&t<2.05){
            const n=Math.floor((t-1.35)/.22);
            if(n!==shot){shot=n;bulletFrom=weapon.root.localToWorld(weapon.muzzle.clone());bulletTime=now;const mesh=cylinder(scene,.0028,.014,[0,0,0],brass);const origin=weapon.root.localToWorld(V(.02,.03,.01));casings.push({mesh,origin,velocity:V(.36,.5,.14),start:now});}
            const kick=Math.max(0,1-((t-1.35)%.22)/.075)*.01;weapon.root.position.addScaledVector(V(0,0,-1).applyQuaternion(held.q),kick);
          }
          const grip=weapon.root.localToWorld(weapon.grip.clone());
          const up=V(0,1,0).applyQuaternion(weapon.root.quaternion),forward=V(0,0,1).applyQuaternion(weapon.root.quaternion);
          const rq=palmOrientation(rig,'right',forward,up),lq=palmOrientation(rig,'left',forward.clone().negate(),up);
          const reaching=smooth(t/.6);
          solveArm(rig,'right',rightPalm,gripFrom.clone().lerp(grip,returning?Math.min(1,amount*4):reaching),rq);
          const support=weapon.root.localToWorld(weapon.support.clone());
          solveArm(rig,'left',leftPalm,leftFrom.clone().lerp(support,amount),lq);
          mark(t<.6?'Grip':t<1.2?'Raise and aim':t<2.05?'Fire':returning?'Place down':'Aim');
          if(t>3.25){action='';pose(rig);setBusy(false);mark('Ready');}
        }
        const elapsed=(now-bulletTime)/1000;
        bullet.visible=elapsed>=0&&elapsed<.13;flash.visible=elapsed>=0&&elapsed<.055;
        if(bullet.visible)bullet.position.copy(bulletFrom).lerp(target,Math.min(1,elapsed/.11));
        if(flash.visible){flash.position.copy(bulletFrom);flash.quaternion.copy(weapon.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2));}
        casings.forEach(c=>{const age=(now-c.start)/1000;c.mesh.position.copy(c.origin).addScaledVector(c.velocity,age);c.mesh.position.y=Math.max(tableY+.004,c.origin.y+c.velocity.y*age-2.5*age*age);if(age<.65)c.mesh.rotation.set(age*12,age*7,age*9);});
        if(casings.length>16){const old=casings.shift()!;scene.remove(old.mesh);old.mesh.geometry.dispose();}
        renderer.render(scene,camera);raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
      dispose=()=>{observer.disconnect();renderer.dispose();scene.traverse(o=>{if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).geometry.dispose();});host.replaceChildren();};
    }).catch(error=>setStatus('Preview could not load: '+error.message));
    return()=>{dead=true;cancelAnimationFrame(raf);dispose();};
  },[]);
  return <div className="ludo-screen"><div className="ludo-stage" ref={canvas} role="img" aria-label="Ludo human motion review"/>
    <div className="ludo-controls"><select aria-label="Weapon" value={selected} disabled={busy||!ready} onChange={e=>{setSelected(e.target.value);controls.current?.weapon(e.target.value);}}><option value="rifle">Rifle</option><option value="smg">Submachine gun</option><option value="pistol">Pistol</option></select>
    <button type="button" disabled={busy||!ready} onClick={()=>controls.current?.start('fire')}>Aim &amp; fire</button><button type="button" disabled={busy||!ready} onClick={()=>controls.current?.start('dice')}>Roll dice</button></div>
    <div className="ludo-status" role="status" aria-live="polite">{status}</div></div>;
}
createRoot(document.getElementById('ludo-motion-preview')!).render(<App/>);
