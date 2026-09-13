import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { makeActor, pose, world, V, smooth, solveArm, palmOrientation } from './motion';
import { ludoTableFrame, ludoRightDicePosition, prepareLudoParkedWeapon, parkLudoWeapon } from '../../utils/ludoTabletopLayout';
import { readSnakeWeaponContacts } from '../../utils/snakeWeaponGrip';
declare const LUDO_TABLETOP_ASSETS: string;
const IDS = ['polyAssaultRifle01Attack','polyPistol01Attack','polyShotgun01Attack'];
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, position: number[]) {
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color,roughness:.68}));
  object.position.fromArray(position);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
}
function App(){
  const host=useRef<HTMLDivElement>(null),api=useRef<any>();
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('Loading…');
  const [weapon,setWeapon]=useState(IDS[0]),[view,setView]=useState('table');
  useEffect(()=>{
    let disposed=false,raf=0,cleanup=()=>{};
    (async()=>{
      const bytes=Uint8Array.from(atob(LUDO_TABLETOP_ASSETS),c=>c.charCodeAt(0));
      const assets=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
      if(disposed)return;
      const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.35;host.current!.appendChild(renderer.domElement);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#172824');
      scene.add(new THREE.HemisphereLight('#f5fff1','#4b6354',2.4));
      const key=new THREE.DirectionalLight('#fff3dc',3);key.position.set(-1,3,-2);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;scene.add(key);
      const camera=new THREE.PerspectiveCamera(40,1,.01,20);
      const {actor,rig,rightPalm,leftPalm}=makeActor(assets.avatar);scene.add(actor);
      const tableY=world(rig.rightUpperArm).y-.21;
      actor.position.z=-.84;actor.updateMatrixWorld(true);
      const radius=4.2*.75*.72*.374*.92*.9,scale=3.22*.72*.374,half=.5625;
      const table={radius,surfaceY:tableY,getOuterRadius:()=>radius};
      mesh(scene,new THREE.CylinderGeometry(radius,radius,.06,64),'#745033',[0,tableY-.03,0]);
      mesh(scene,new THREE.CylinderGeometry(radius-.025,radius-.025,.006,64),'#315749',[0,tableY-.002,0]);
      mesh(scene,new THREE.BoxGeometry(4,.02,4),'#20382e',[0,-.07,0]);
      mesh(scene,new THREE.BoxGeometry(.40,.045,.40),'#684339',[0,.28,-.84]);
      mesh(scene,new THREE.BoxGeometry(.43,.31,.04),'#684339',[0,.45,-1.06]);
      const board=new THREE.Group();scene.add(board);board.position.y=tableY+.003;board.scale.setScalar(scale);board.rotation.y=-Math.PI/2;
      mesh(board,new THREE.BoxGeometry(1.125,.016,1.125),'#d4c7aa',[0,.008,0]);
      const colors=['#bc5352','#d0ab48','#568bba','#69a275'];
      colors.forEach((color,i)=>{
        const x=(i%2?1:-1)*.35,z=(i<2?-1:1)*.35;
        mesh(board,new THREE.BoxGeometry(.31,.008,.31),color,[x,.021,z]);

      });
      for(let i=-7;i<=7;i++) for(const j of [-1,0,1]) if(Math.abs(i)>1) for(const [x,z]of [[i*.075,j*.075],[j*.075,i*.075]])mesh(board,new THREE.BoxGeometry(.066,.004,.066),'#f4ecd8',[x,.02,z]);
      const seats=[0,1,2,3].map(i=>{const anchor=new THREE.Object3D();anchor.position.set(-Math.sin(i*Math.PI/2)*.84,tableY,-Math.cos(i*Math.PI/2)*.84);scene.add(anchor);return anchor;});
      const frames=seats.map(seat=>ludoTableFrame(board,seat,half));
      const reserveTokens=frames.flatMap((frame,i)=>[-.058,.058].flatMap(side=>[.547,.634].map((reach,j)=>{
        const point=frame.center.clone().addScaledVector(frame.outward,reach).addScaledVector(frame.right,side);point.y=tableY+.03;
        return mesh(scene,new THREE.CylinderGeometry(j?.015:.019,.022,.06,16),colors[i],point.toArray());
      })));
      const dieSize=.054*scale,dicePositions=frames.map(frame=>ludoRightDicePosition(frame,table,dieSize)!);
      const dice=dicePositions.map((position,i)=>{
        const die=new THREE.Group();scene.add(die);mesh(die,new THREE.BoxGeometry(dieSize,dieSize,dieSize),'#f7f1e6',[0,0,0]);
        for(const x of [-1,1])for(const z of [-1,1]){const pip=mesh(die,new THREE.CircleGeometry(.0034,10),'#202b28',[x*.011,dieSize/2+.0002,z*.011]);pip.rotation.x=-Math.PI/2;}
        die.position.copy(position);return die;
      });
      let holders:THREE.Group[]=[],id=IDS[0],park=V(),parkQ=new THREE.Quaternion(),gripLocal=V(),supportLocal=V();
      function selectWeapon(next:string){
        id=next;holders.forEach(h=>scene.remove(h));holders=[];
        for(let i=0;i<4;i++){
          const holder=new THREE.Group();scene.add(holder);
          holder.add(prepareLudoParkedWeapon(new THREE.ObjectLoader().parse(assets[id]),id,id.includes('Pistol')?.18:.4));
          if(!parkLudoWeapon({holder,frame:frames[i],table,obstacles:[...holders,...reserveTokens],dicePositions}))throw Error('No clear parking slot');
          holders.push(holder);
        }
        const gun=holders[0],contacts=readSnakeWeaponContacts(gun)!;
        park.copy(gun.position);parkQ.copy(gun.quaternion);gripLocal.copy(gun.worldToLocal(contacts.grip));supportLocal.copy(gun.worldToLocal(contacts.support));
      }
      selectWeapon(id);
      let action='',started=0,handStart=V(),supportStart=V(),release=V(),didRelease=false;
      function selectView(next:string){
        if(next==='table'){camera.position.set(0,tableY+1.7,-1.75);camera.lookAt(0,tableY,-.12);}
        if(next==='hands'){camera.position.set(-1.1,tableY+.75,-1.4);camera.lookAt(-.05,tableY-.01,-.52);}
        if(next==='player'){camera.position.copy(world(rig.head)).add(V(0,.075,.12));camera.lookAt(0,tableY,0);}
        rig.head.scale.setScalar(next==='player'?.001:1);
      }
      selectView('table');
      api.current={weapon:selectWeapon,view:selectView,start(kind:string){if(action)return;action=kind;started=performance.now();didRelease=false;pose(rig);handStart.copy(world(rightPalm));supportStart.copy(world(leftPalm));setBusy(true);}};
      const resize=()=>{renderer.setSize(host.current!.clientWidth,host.current!.clientHeight);camera.aspect=host.current!.clientWidth/host.current!.clientHeight;camera.updateProjectionMatrix();};
      const observer=new ResizeObserver(resize);observer.observe(host.current!);resize();setReady(true);setStatus('Ready');
      function frame(now:number){
        if(disposed)return;
        const t=(now-started)/1000,gun=holders[0];
        if(action==='pickup'){
          pose(rig);const carry=smooth((t-.65)/.65),returning=t>1.85,amount=returning?1-smooth((t-1.85)/.65):carry;
          const shoulder=world(rig.rightUpperArm),readyGrip=shoulder.clone().add(V(0,-.025,.19));
          const initialGrip=gripLocal.clone().multiply(gun.scale).applyQuaternion(parkQ).add(park);
          const aimQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0,-1,0),V(1,0,0),V(0,0,1)));
          gun.quaternion.copy(parkQ).slerp(aimQ,amount);
          const grip=initialGrip.clone().lerp(readyGrip,amount);gun.position.copy(grip).sub(gripLocal.clone().multiply(gun.scale).applyQuaternion(gun.quaternion));
          gun.updateMatrixWorld(true);const contacts=readSnakeWeaponContacts(gun)!;
          solveArm(rig,'right',rightPalm,handStart.clone().lerp(contacts.grip,smooth(t/.65)),palmOrientation(rig,'right',contacts.muzzle.clone().sub(contacts.grip).normalize(),contacts.up),true);
          solveArm(rig,'left',leftPalm,supportStart.clone().lerp(contacts.support,amount),undefined,true);
          setStatus(t<.65?'Reach and grip':t<1.3?'Lift':returning?'Place down':'Hold');
          if(t>=2.55){gun.position.copy(park);gun.quaternion.copy(parkQ);pose(rig);action='';setBusy(false);setStatus('Ready');}
        }else if(action==='dice'){
          const die=dice[0],home=dicePositions[0];
          if(t<.65){pose(rig,'reachDice',smooth(t/.65),0);solveArm(rig,'right',rightPalm,handStart.clone().lerp(home,smooth(t/.65)),undefined,true);setStatus('Reach dice');}
          else if(t<1.25){pose(rig,'gripDice',1,.85);const point=home.clone().add(V(0,Math.sin(smooth((t-.65)/.6)*Math.PI/2)*.13,-.04));solveArm(rig,'right',rightPalm,point,undefined,true);die.position.copy(world(rightPalm));setStatus('Grip and lift');}
          else{if(!didRelease){release.copy(die.position);didRelease=true;}const flight=Math.min(1,(t-1.25)/.8);die.position.copy(release).lerp(home,flight);die.position.y+=Math.sin(flight*Math.PI)*.08;die.rotation.set(flight*Math.PI*2,0,flight*Math.PI*4);pose(rig);setStatus('Roll');if(flight===1){die.position.copy(home);die.quaternion.identity();action='';setBusy(false);setStatus('Rolled 4');}}
        }
        renderer.render(scene,camera);raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
      cleanup=()=>{observer.disconnect();renderer.dispose();host.current?.replaceChildren();};
    })().catch(error=>setStatus(error.message));
    return()=>{disposed=true;cancelAnimationFrame(raf);cleanup();};
  },[]);
  return <div className="ludo-screen"><div className="ludo-stage" ref={host} role="img" aria-label="Ludo weapons lying flat beside the board, with dice on each player's right"/>
    <div className="ludo-controls"><select aria-label="View" value={view} disabled={busy||!ready} onChange={e=>{setView(e.target.value);api.current.view(e.target.value);}}><option value="table">Table view</option><option value="hands">Hand view</option><option value="player">Player view</option></select>
    <select aria-label="Weapon" value={weapon} disabled={busy||!ready} onChange={e=>{setWeapon(e.target.value);api.current.weapon(e.target.value);}}>{IDS.map((id,i)=><option key={id} value={id}>{['Rifle','Pistol','Shotgun'][i]}</option>)}</select>
    <button type="button" disabled={busy||!ready} onClick={()=>api.current.start('pickup')}>Pick up weapon</button><button type="button" disabled={busy||!ready} onClick={()=>api.current.start('dice')}>Roll dice</button></div>
    <div className="ludo-status" role="status" aria-live="polite">{status}</div></div>;
}
createRoot(document.getElementById('ludo-motion-preview')!).render(<App/>);
